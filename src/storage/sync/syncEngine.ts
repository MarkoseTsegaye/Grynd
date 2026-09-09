import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { useAuthStore } from '../../features/auth/store/authStore';
import { useWeightStore } from '../../features/weight/store/weightStore';
import { useSyncStatusStore } from './status';
import * as queue from './queue';
import * as weightTable from './tables/weight';
import { getLastSyncedAt, setLastSyncedAt } from './lib/lastSynced';
import { maxUpdatedAt } from './lib/merge';
import type { WeightEntry } from '../../features/weight/types';

/**
 * Sync engine.
 *
 * Once bootstrapped it:
 *
 *   - subscribes to the auth store: whenever the UID changes it resets
 *     internal state (last-synced bookmarks are per-UID) and runs an
 *     initial full push + pull for the new user
 *   - subscribes to the weight store: every mutation enqueues an upsert
 *     that a background drain flushes to Supabase
 *   - exposes `pull()` for pull-to-refresh / AppState-active hooks
 *
 * When Supabase is not configured, or the user has no session yet, every
 * public method is a safe no-op and the status store advertises
 * `unconfigured` / `idle` accordingly.
 */

let started = false;
let boundUid: string | null = null;
let draining = false;
let pulling = false;

function status() {
  return useSyncStatusStore.getState();
}

function currentUid(): string | null {
  const s = useAuthStore.getState();
  return s.user?.id ?? null;
}

async function refreshPendingCount(uid: string) {
  const n = await queue.size(uid);
  status().setPendingWrites(n);
}

/**
 * Push every queued write for the current UID. Safe to call repeatedly;
 * a second call while one is in flight is a no-op.
 */
export async function drain(): Promise<void> {
  if (draining) return;
  if (!isSupabaseConfigured() || !supabase) return;
  const uid = currentUid();
  if (!uid) return;

  draining = true;
  try {
    // Snapshot upfront so a mutation landing mid-drain doesn't get
    // silently stripped by `remove()` — the snapshot is what we drained,
    // anything newer stays.
    const snap = await queue.snapshot(uid);
    if (snap.length === 0) return;

    status().setStatus('syncing');
    const drained: typeof snap = [];
    for (const entry of snap) {
      if (entry.table !== weightTable.TABLE) {
        // Phase 2 only ships the weight adapter. Unknown tables sit in
        // the queue harmlessly until their adapter lands.
        continue;
      }
      const result = await weightTable.pushRow(
        supabase,
        entry.row as Parameters<typeof weightTable.pushRow>[1],
      );
      if (result.ok) {
        drained.push(entry);
      } else {
        // Bail on the first failure. The remaining entries stay queued
        // for the next drain. Network errors flip to `offline`; anything
        // else surfaces as `error` with the message.
        const isNetwork = /network|fetch|failed to fetch/i.test(result.error);
        status().setStatus(isNetwork ? 'offline' : 'error');
        status().setError(isNetwork ? null : result.error);
        break;
      }
    }
    await queue.remove(uid, drained);
    await refreshPendingCount(uid);

    // Only clear to idle if nothing bumped us into a failure state above.
    if (status().status === 'syncing') {
      status().setStatus('idle');
      status().setError(null);
    }
  } finally {
    draining = false;
  }
}

/**
 * Pull every row updated since our last successful pull, LWW-merge into
 * the local store, and advance the bookmark.
 */
export async function pull(): Promise<void> {
  if (pulling) return;
  if (!isSupabaseConfigured() || !supabase) return;
  const uid = currentUid();
  if (!uid) return;

  pulling = true;
  const prev = status().status;
  try {
    status().setStatus('syncing');
    const since = await getLastSyncedAt(uid, weightTable.TABLE);
    const result = await weightTable.pullSince(supabase, uid, since);

    if (!result.ok) {
      const isNetwork = /network|fetch|failed to fetch/i.test(result.error);
      status().setStatus(isNetwork ? 'offline' : 'error');
      status().setError(isNetwork ? null : result.error);
      return;
    }

    if (result.rows.length > 0) {
      await useWeightStore.getState().applyServerRows(result.rows);
      const max = maxUpdatedAt(result.rows);
      if (max != null) await setLastSyncedAt(uid, weightTable.TABLE, max);
      status().setLastSyncedAt(Date.now());
    } else if (since == null) {
      // First pull for this UID that returned nothing — mark the bookmark
      // with `now` so subsequent pulls have a starting point that skips
      // the historical scan.
      status().setLastSyncedAt(Date.now());
    }

    // Preserve a pre-existing offline/error banner if a mutation raced us.
    if (prev !== 'offline' && prev !== 'error') {
      status().setStatus('idle');
      status().setError(null);
    } else {
      status().setStatus(prev);
    }
  } finally {
    pulling = false;
  }
}

async function bindToUid(uid: string) {
  boundUid = uid;
  status().setStatus('syncing');
  await refreshPendingCount(uid);

  // Seed the queue with everything currently on device the first time we
  // see this UID (fresh sign-in, or upgrade from a build with no sync).
  // Subsequent launches with a populated `lastSyncedAt` skip this so we
  // don't re-push the world on every start.
  const since = await getLastSyncedAt(uid, weightTable.TABLE);
  if (since == null) {
    const rows = useWeightStore.getState().getAllRowsForSync();
    for (const row of rows) {
      await queue.enqueue(uid, {
        table: weightTable.TABLE,
        rowId: row.id,
        row: weightTable.toServerRow(row, uid),
      });
    }
    await refreshPendingCount(uid);
  }

  await pull();
  await drain();
}

async function unbind() {
  boundUid = null;
  status().setPendingWrites(0);
}

/**
 * Enqueue a single weight-entry write. Called by the store subscription
 * so mutation → server round-trip is one method away.
 */
async function enqueueWeightRow(uid: string, row: WeightEntry) {
  await queue.enqueue(uid, {
    table: weightTable.TABLE,
    rowId: row.id,
    row: weightTable.toServerRow(row, uid),
  });
  await refreshPendingCount(uid);
}

/**
 * Called once from the root layout (after `authStore.bootstrap`). Wires
 * up the subscriptions and kicks off the initial sync. Safe to call more
 * than once — subsequent calls are no-ops.
 */
export function startSyncEngine(): void {
  if (started) return;
  started = true;

  if (!isSupabaseConfigured()) {
    status().setStatus('unconfigured');
    return;
  }

  // Auth subscription — bind/rebind as the UID changes.
  useAuthStore.subscribe((state, prev) => {
    const uid = state.user?.id ?? null;
    const prevUid = prev.user?.id ?? null;
    if (uid === prevUid) return;

    if (uid == null) {
      void unbind();
      return;
    }
    void bindToUid(uid);
  });

  // If the store already has a user (bootstrap resolved before we
  // subscribed) bind immediately.
  const uid = currentUid();
  if (uid) void bindToUid(uid);

  // Weight store — every persisted change lands as a server upsert.
  // We diff (entries + tombstones) against the previous snapshot and
  // enqueue any row whose `updatedAt` moved forward.
  let lastSnapshot = new Map<string, number>();
  useWeightStore.subscribe((state) => {
    const activeUid = boundUid;
    if (!activeUid) return;

    const all = [...state.entries, ...state.tombstones];
    const nextSnapshot = new Map<string, number>();
    for (const row of all) nextSnapshot.set(row.id, row.updatedAt);

    for (const row of all) {
      const prev = lastSnapshot.get(row.id);
      if (prev == null || row.updatedAt > prev) {
        void enqueueWeightRow(activeUid, row).then(() => void drain());
      }
    }
    lastSnapshot = nextSnapshot;
  });
}

/**
 * Test-only helper: reset internal module state so a fresh bootstrap
 * can run in a new test. No-op outside tests but harmless to call.
 */
export function __resetForTests(): void {
  started = false;
  boundUid = null;
  draining = false;
  pulling = false;
  status().reset();
}
