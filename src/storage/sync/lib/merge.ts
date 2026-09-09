/**
 * Last-write-wins merge helpers.
 *
 * Every syncable row carries `updatedAt` (ms since epoch). When a remote
 * copy of a row shows up we keep whichever has the greater `updatedAt`.
 * Ties resolve to the incoming row so an idempotent server echo can
 * still replace a locally-buffered write (their timestamps match, both
 * are equally valid, take the newer one).
 */

export interface SyncableRow {
  id: string;
  updatedAt: number;
}

/**
 * Merge a batch of incoming (typically server-side) rows into a local
 * array. Returns a new array — the input is not mutated. Rows are keyed
 * by `id`.
 */
export function mergeByLastWrite<T extends SyncableRow>(local: T[], incoming: T[]): T[] {
  if (incoming.length === 0) return local;

  const byId = new Map<string, T>();
  for (const row of local) byId.set(row.id, row);

  for (const row of incoming) {
    const existing = byId.get(row.id);
    if (!existing || row.updatedAt >= existing.updatedAt) {
      byId.set(row.id, row);
    }
  }

  return Array.from(byId.values());
}

/**
 * Returns the largest `updatedAt` across a list of rows, or `null` for an
 * empty list. Used to advance the per-table `lastSyncedAt` watermark after
 * a successful pull.
 */
export function maxUpdatedAt(rows: SyncableRow[]): number | null {
  if (rows.length === 0) return null;
  let max = rows[0].updatedAt;
  for (let i = 1; i < rows.length; i += 1) {
    if (rows[i].updatedAt > max) max = rows[i].updatedAt;
  }
  return max;
}
