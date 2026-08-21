/**
 * One paired daily entry: body weight in pounds plus an optional daily
 * calorie intake for bulk-vs-cut context. Keyed by `dateKey` (a local
 * `YYYY-MM-DD`) so two entries on the same calendar day collapse to one.
 */
export interface WeightEntry {
  id: string;
  /** Local calendar day, `YYYY-MM-DD` — primary business key. */
  dateKey: string;
  /** ms when the entry was created or last modified. */
  loggedAt: number;
  /** Body weight in pounds. */
  weightLbs: number;
  /** Optional daily calorie intake, whole kcal. */
  calories?: number;
}
