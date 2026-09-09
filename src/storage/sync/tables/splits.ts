import type { SupabaseClient } from '@supabase/supabase-js';
import type { Split } from '../../../features/splits/types';
import { useSplitsStore } from '../../../features/splits';
import type { TableAdapter } from '../lib/adapter';
import { maxUpdatedAt } from '../lib/merge';

const TABLE = 'splits' as const;

interface ServerRow {
  user_id: string;
  id: string;
  name: string;
  exercise_ids: string[];
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

function toServerRow(split: Split, userId: string): ServerRow {
  return {
    user_id: userId,
    id: split.id,
    name: split.name,
    exercise_ids: split.exerciseIds,
    created_at: split.createdAt,
    updated_at: split.updatedAt,
    deleted_at: split.deletedAt ?? null,
  };
}

function fromServerRow(row: ServerRow): Split {
  return {
    id: row.id,
    name: row.name,
    exerciseIds: row.exercise_ids ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export const splitsAdapter: TableAdapter = {
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

    const splits = rows.map(fromServerRow);
    await useSplitsStore.getState().applyServerSplits(splits);
    return { ok: true, nextSince: maxUpdatedAt(splits) };
  },

  seedRows(uid) {
    const all = useSplitsStore.getState().getAllSplitRowsForSync();
    return all.map((row) => ({ rowId: row.id, serverRow: toServerRow(row, uid) }));
  },

  subscribe(uid, enqueue) {
    let last = new Map<string, number>();
    const snap = useSplitsStore.getState().getAllSplitRowsForSync();
    for (const row of snap) last.set(row.id, row.updatedAt);

    return useSplitsStore.subscribe((state) => {
      const all = [...state.splits, ...state.splitTombstones];
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
