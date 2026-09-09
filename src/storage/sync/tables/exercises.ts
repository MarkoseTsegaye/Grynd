import type { SupabaseClient } from '@supabase/supabase-js';
import type { Exercise } from '../../../features/splits/types';
import { useSplitsStore } from '../../../features/splits';
import type { TableAdapter } from '../lib/adapter';
import { maxUpdatedAt } from '../lib/merge';

const TABLE = 'exercises' as const;

interface ServerRow {
  user_id: string;
  id: string;
  name: string;
  notes: string | null;
  unilateral: boolean | null;
  plate_loaded: boolean | null;
  updated_at: number;
  deleted_at: number | null;
}

function toServerRow(exercise: Exercise, userId: string): ServerRow {
  return {
    user_id: userId,
    id: exercise.id,
    name: exercise.name,
    notes: exercise.notes ?? null,
    unilateral: exercise.unilateral ?? null,
    plate_loaded: exercise.plateLoaded ?? null,
    updated_at: exercise.updatedAt,
    deleted_at: exercise.deletedAt ?? null,
  };
}

function fromServerRow(row: ServerRow): Exercise {
  const exercise: Exercise = {
    id: row.id,
    name: row.name,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
  if (row.notes) exercise.notes = row.notes;
  if (row.unilateral) exercise.unilateral = true;
  if (row.plate_loaded) exercise.plateLoaded = true;
  return exercise;
}

export const exercisesAdapter: TableAdapter = {
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

    const exercises = rows.map(fromServerRow);
    await useSplitsStore.getState().applyServerExercises(exercises);
    return { ok: true, nextSince: maxUpdatedAt(exercises) };
  },

  seedRows(uid) {
    const all = useSplitsStore.getState().getAllExerciseRowsForSync();
    return all.map((row) => ({ rowId: row.id, serverRow: toServerRow(row, uid) }));
  },

  subscribe(uid, enqueue) {
    let last = new Map<string, number>();
    const snap = useSplitsStore.getState().getAllExerciseRowsForSync();
    for (const row of snap) last.set(row.id, row.updatedAt);

    return useSplitsStore.subscribe((state) => {
      const all = [...state.exercises, ...state.exerciseTombstones];
      const next = new Map<string, number>();
      for (const row of all) next.set(row.id, row.updatedAt);

      for (const row of all) {
        const prev = last.get(row.id);
        if (prev == null || row.updatedAt > prev) {
          enqueue(row.id, toServerRow(row, uid));
        }
      }
      last = next;
    });
  },
};
