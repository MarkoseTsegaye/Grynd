import type { SupabaseClient } from '@supabase/supabase-js';
import type { WorkoutSession } from '../../../features/workout/types';
import { useHistoryStore } from '../../../features/history/store/historyStore';
import type { TableAdapter } from '../lib/adapter';
import { maxUpdatedAt } from '../lib/merge';

const TABLE = 'sessions' as const;

interface ServerRow {
  user_id: string;
  id: string;
  split_id: string;
  split_name: string;
  started_at: number;
  completed_at: number | null;
  exercises: unknown;
  current_exercise_index: number | null;
  paused_at: number | null;
  updated_at: number;
  deleted_at: number | null;
}

function toServerRow(session: WorkoutSession, userId: string): ServerRow {
  return {
    user_id: userId,
    id: session.id,
    split_id: session.splitId,
    split_name: session.splitName,
    started_at: session.startedAt,
    completed_at: session.completedAt,
    // The exercises array carries plates, effort, side, and RPE/RIR
    // and does not earn a normalized table (we only ever read a whole
    // session at a time). JSONB round-trips cleanly.
    exercises: session.exercises,
    current_exercise_index: session.currentExerciseIndex ?? null,
    paused_at: session.pausedAt ?? null,
    updated_at:
      session.updatedAt ?? session.completedAt ?? session.startedAt,
    deleted_at: session.deletedAt ?? null,
  };
}

function fromServerRow(row: ServerRow): WorkoutSession {
  const session: WorkoutSession = {
    id: row.id,
    splitId: row.split_id,
    splitName: row.split_name,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    exercises: (row.exercises as WorkoutSession['exercises']) ?? [],
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
  if (row.current_exercise_index != null) {
    session.currentExerciseIndex = row.current_exercise_index;
  }
  if (row.paused_at != null) session.pausedAt = row.paused_at;
  return session;
}

export const sessionsAdapter: TableAdapter = {
  name: TABLE,

  async pushRow(supabase, row) {
    const { error } = await supabase.from(TABLE).upsert(row as ServerRow, {
      onConflict: 'user_id,id',
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  },

  async pull(supabase, uid, sinceMs) {
    let query = supabase.from(TABLE).select('*').eq('user_id', uid);
    if (sinceMs != null) query = query.gt('updated_at', sinceMs);

    const { data, error } = await query;
    if (error) return { ok: false, error: error.message };

    const rows = (data ?? []) as ServerRow[];
    if (rows.length === 0) return { ok: true, nextSince: null };

    const sessions = rows.map(fromServerRow);
    await useHistoryStore.getState().applyServerSessions(sessions);
    return { ok: true, nextSince: maxUpdatedAt(sessions.map((s) => ({ id: s.id, updatedAt: s.updatedAt ?? 0 }))) };
  },

  seedRows(uid) {
    const all = useHistoryStore.getState().getAllSessionRowsForSync();
    return all.map((row) => ({ rowId: row.id, serverRow: toServerRow(row, uid) }));
  },

  subscribe(uid, enqueue) {
    let last = new Map<string, number>();
    const snap = useHistoryStore.getState().getAllSessionRowsForSync();
    for (const row of snap) last.set(row.id, row.updatedAt ?? 0);

    return useHistoryStore.subscribe((state) => {
      const all = [...state.sessions, ...state.tombstones];
      const next = new Map<string, number>();
      for (const row of all) next.set(row.id, row.updatedAt ?? 0);

      for (const row of all) {
        const prev = last.get(row.id);
        const ts = row.updatedAt ?? 0;
        if (prev == null || ts > prev) {
          enqueue(row.id, toServerRow(row, uid));
        }
      }
      last = next;
    });
  },
};
