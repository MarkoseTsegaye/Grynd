import type { SupabaseClient } from '@supabase/supabase-js';
import type { WorkoutCycle } from '../../../features/splits/types';
import { useCycleStore } from '../../../features/splits/store/cycleStore';
import type { TableAdapter } from '../lib/adapter';

const TABLE = 'cycles' as const;
/**
 * The cycle is one row per user (PK: user_id). A single sentinel keeps
 * queue dedup effective — repeated cycle edits fold to one queued upsert.
 */
const SINGLETON_ROW_ID = 'singleton' as const;

interface ServerRow {
  user_id: string;
  days: unknown;
  current_index: number;
  last_advanced_at: number | null;
  updated_at: number;
}

function toServerRow(cycle: WorkoutCycle, userId: string): ServerRow {
  return {
    user_id: userId,
    days: cycle.days,
    current_index: cycle.currentIndex,
    last_advanced_at: cycle.lastAdvancedAt,
    updated_at: cycle.updatedAt,
  };
}

function fromServerRow(row: ServerRow): WorkoutCycle {
  return {
    days: (row.days as WorkoutCycle['days']) ?? [],
    currentIndex: row.current_index ?? 0,
    lastAdvancedAt: row.last_advanced_at,
    updatedAt: row.updated_at,
  };
}

export const cyclesAdapter: TableAdapter = {
  name: TABLE,

  async pushRow(supabase, row) {
    const { error } = await supabase.from(TABLE).upsert(row as ServerRow, {
      onConflict: 'user_id',
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  },

  async pull(supabase, uid, sinceMs) {
    let query = supabase.from(TABLE).select('*').eq('user_id', uid);
    if (sinceMs != null) query = query.gt('updated_at', sinceMs);

    const { data, error } = await query.maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: true, nextSince: null };

    const cycle = fromServerRow(data as ServerRow);
    await useCycleStore.getState().applyServerCycle(cycle);
    return { ok: true, nextSince: cycle.updatedAt };
  },

  seedRows(uid) {
    const cycle = useCycleStore.getState().getCycleForSync();
    if (!cycle) return [];
    return [{ rowId: SINGLETON_ROW_ID, serverRow: toServerRow(cycle, uid) }];
  },

  subscribe(uid, enqueue) {
    let lastUpdatedAt = useCycleStore.getState().cycle?.updatedAt ?? -1;
    return useCycleStore.subscribe((state) => {
      const cycle = state.cycle;
      if (!cycle) return;
      if (cycle.updatedAt > lastUpdatedAt) {
        lastUpdatedAt = cycle.updatedAt;
        enqueue(SINGLETON_ROW_ID, toServerRow(cycle, uid));
      }
    });
  },
};
