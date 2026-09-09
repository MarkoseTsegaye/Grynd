import type { SupabaseClient } from '@supabase/supabase-js';
import type { WeightEntry } from '../../../features/weight/types';

/**
 * Per-table adapter: knows the row shape on both sides of the wire and
 * the SQL naming convention (snake_case, `weight_lbs`, `date_key`, …).
 * The sync engine stays generic; each new table plugs in through one of
 * these.
 */

export const TABLE = 'weight_entries' as const;

interface ServerRow {
  user_id: string;
  id: string;
  date_key: string;
  logged_at: number;
  weight_lbs: number;
  updated_at: number;
  deleted_at: number | null;
}

export function toServerRow(entry: WeightEntry, userId: string): ServerRow {
  return {
    user_id: userId,
    id: entry.id,
    date_key: entry.dateKey,
    logged_at: entry.loggedAt,
    weight_lbs: entry.weightLbs,
    updated_at: entry.updatedAt,
    deleted_at: entry.deletedAt ?? null,
  };
}

export function fromServerRow(row: ServerRow): WeightEntry {
  return {
    id: row.id,
    dateKey: row.date_key,
    loggedAt: row.logged_at,
    weightLbs: row.weight_lbs,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

/**
 * Push one row to the server. Callers must have already stamped the
 * row with a fresh `updatedAt`; the server trusts that value.
 */
export async function pushRow(
  supabase: SupabaseClient,
  row: ServerRow,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.from(TABLE).upsert(row, { onConflict: 'user_id,id' });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Pull every row for `userId` whose `updated_at` is strictly newer than
 * `sinceMs`. Tombstones are included so deletes propagate — callers
 * (the sync engine and the store's `applyServerRows`) skip rendering
 * them.
 */
export async function pullSince(
  supabase: SupabaseClient,
  userId: string,
  sinceMs: number | null,
): Promise<{ ok: true; rows: WeightEntry[] } | { ok: false; error: string }> {
  let query = supabase.from(TABLE).select('*').eq('user_id', userId);
  if (sinceMs != null) query = query.gt('updated_at', sinceMs);

  const { data, error } = await query;
  if (error) return { ok: false, error: error.message };

  const rows = (data ?? []) as ServerRow[];
  return { ok: true, rows: rows.map(fromServerRow) };
}
