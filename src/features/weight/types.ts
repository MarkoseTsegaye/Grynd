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
}
