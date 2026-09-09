/**
 * One body-weight entry per calendar day, keyed by `dateKey` (local
 * `YYYY-MM-DD`) so two logs on the same day collapse to one.
 */
export interface WeightEntry {
  id: string;
  /** Local calendar day, `YYYY-MM-DD` — primary business key. */
  dateKey: string;
  /** ms when the entry was created or last modified. */
  loggedAt: number;
  /** Body weight in pounds. */
  weightLbs: number;
  /**
   * ms of the last mutation touching this row. Used by the sync layer to
   * resolve conflicts: on pull, the row whose `updatedAt` is greater wins.
   * Older on-device entries without this field are backfilled to `loggedAt`.
   */
  updatedAt: number;
  /**
   * ms of a soft delete, or null/undefined for live rows. The sync layer
   * keeps tombstones locally until the server acks the delete; the UI
   * always filters them out.
   */
  deletedAt?: number | null;
}
