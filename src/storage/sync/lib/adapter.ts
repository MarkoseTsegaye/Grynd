import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Contract every synced table implements. The engine iterates a
 * registry of these — it has no per-table knowledge itself.
 *
 * Queue entries store the **server-shape** row (snake_case, `user_id`
 * set) so drain is generic across tables. Serialization happens once,
 * at enqueue time.
 *
 * Singleton tables (cycle, prefs) treat `rowId` as a fixed sentinel so
 * dedup keeps only one queued entry per (uid, table).
 */

export type PushResult = { ok: true } | { ok: false; error: string };

export type PullResult =
  | {
      ok: true;
      /**
       * New `lastSyncedAt` value to persist. null when the pull returned
       * no rows and the caller should leave the watermark untouched.
       */
      nextSince: number | null;
    }
  | { ok: false; error: string };

export interface TableAdapter {
  /** Server-side table name, e.g. `weight_entries`. */
  readonly name: string;

  /**
   * Push one already-serialized server-shape row (from the mutation
   * queue) to Supabase.
   */
  pushRow: (supabase: SupabaseClient, row: unknown) => Promise<PushResult>;

  /**
   * Pull server rows for `uid` whose `updated_at > sinceMs`, LWW-merge
   * them into the local store, and return the new watermark. When the
   * store already reflects a newer local value the merge is a no-op.
   */
  pull: (
    supabase: SupabaseClient,
    uid: string,
    sinceMs: number | null,
  ) => Promise<PullResult>;

  /**
   * Serialized snapshot of every local row (including tombstones) so
   * the engine can seed the server on the first sync after sign-in.
   * Each entry carries a `rowId` used only for queue dedup.
   */
  seedRows: (uid: string) => Array<{ rowId: string; serverRow: unknown }>;

  /**
   * Subscribe to store changes. Called once per bound UID. The engine
   * passes `enqueue` — the adapter calls it whenever a local row moved
   * forward (updatedAt bumped, or a soft-delete). Returns an
   * unsubscribe function the engine calls on unbind / UID switch.
   */
  subscribe: (
    uid: string,
    enqueue: (rowId: string, serverRow: unknown) => void,
  ) => () => void;
}
