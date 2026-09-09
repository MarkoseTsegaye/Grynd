import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { useAuthStore } from '../../features/auth/store/authStore';
import { useWeightStore } from '../../features/weight/store/weightStore';
import { useSplitsStore } from '../../features/splits';
import { useHistoryStore } from '../../features/history/store/historyStore';
import { useCycleStore } from '../../features/splits/store/cycleStore';
import { usePrefsStore } from '../../shared/store/prefsStore';
import { useSyncStatusStore } from './status';
import * as queue from './queue';
import { getLastSyncedAt, setLastSyncedAt } from './lib/lastSynced';
import type { TableAdapter } from './lib/adapter';
import { weightAdapter } from './tables/weight';
import { splitsAdapter } from './tables/splits';
import { exercisesAdapter } from './tables/exercises';
import { sessionsAdapter } from './tables/sessions';
import { cyclesAdapter } from './tables/cycles';
import { prefsAdapter } from './tables/prefs';

/**
 * Sync engine.
 *
 * Owns the auth-bound + store-bound lifecycle. Adapters plug in through
 * a registry so the engine itself is table-agnostic — adding a new
 * synced table is one file (an adapter) plus one entry in `ADAPTERS`.
 *
 * Once bootstrapped it:
 *
 *   - subscribes to the auth store: whenever the UID changes it rebinds
 *     all adapters (last-synced bookmarks are per-UID), seeds the queue
 *     with everything currently on device the first time a UID is seen,
 *     and runs pull + drain
 *   - subscribes to every store the adapter registry names: every
 *     mutation enqueues an upsert; a background drain flushes it
 *   - exposes `pull()` for pull-to-refresh / AppState-active hooks
 */

const ADAPTERS: TableAdapter[] = [
  weightAdapter,
  splitsAdapter,
  exercisesAdapter,
  sessionsAdapter,
  cyclesAdapter,
  prefsAdapter,
];

const ADAPTERS_BY_NAME = new Map<string, TableAdapter>(
  ADAPTERS.map((a) => [a.name, a]),
);

let started = false;
let boundUid: string | null = null;
let draining = false;
let pulling = false;
let storeUnsubs: Array<() => void> = [];

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
 * Push every queued write for the current UID. Safe to call
 * repeatedly; a second call while one is in flight is a no-op.
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
      const adapter = ADAPTERS_BY_NAME.get(entry.table);
      if (!adapter) {
        // Unknown table — leave it queued so a future build with the
        // adapter can drain it.
        continue;
      }
      const result = await adapter.pushRow(supabase, entry.row);
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
 * Pull every row updated since our last successful pull, LWW-merge
 * into the local stores, and advance the per-table watermarks.
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
    let anyFailure = false;
    let failureMessage: string | null = null;
    let isNetworkFailure = false;
    let touchedAny = false;

    for (const adapter of ADAPTERS) {
      const since = await getLastSyncedAt(uid, adapter.name);
      const result = await adapter.pull(supabase, uid, since);
      if (!result.ok) {
        anyFailure = true;
        failureMessage = result.error;
        isNetworkFailure = /network|fetch|failed to fetch/i.test(result.error);
        // Keep pulling other tables — one missing table shouldn't
        // block progress on the rest.
        continue;
      }
      if (result.nextSince != null) {
        await setLastSyncedAt(uid, adapter.name, result.nextSince);
        touchedAny = true;
      }
    }

    if (anyFailure) {
      status().setStatus(isNetworkFailure ? 'offline' : 'error');
      status().setError(isNetworkFailure ? null : failureMessage);
      return;
    }

    if (touchedAny) status().setLastSyncedAt(Date.now());
    else if (prev === 'idle') status().setLastSyncedAt(Date.now());

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

async function enqueueRow(uid: string, table: string, rowId: string, serverRow: unknown) {
  await queue.enqueue(uid, { table, rowId, row: serverRow });
  await refreshPendingCount(uid);
}

async function seedIfFirstTime(uid: string) {
  for (const adapter of ADAPTERS) {
    const since = await getLastSyncedAt(uid, adapter.name);
    if (since != null) continue;
    for (const seed of adapter.seedRows(uid)) {
      await queue.enqueue(uid, {
        table: adapter.name,
        rowId: seed.rowId,
        row: seed.serverRow,
      });
    }
  }
  await refreshPendingCount(uid);
}

function bindStoreSubscriptions(uid: string) {
  // Tear down any leftover subs first — defensive against a rebind
  // racing with a previous UID's teardown.
  for (const off of storeUnsubs) off();
  storeUnsubs = [];

  for (const adapter of ADAPTERS) {
    const off = adapter.subscribe(uid, (rowId, serverRow) => {
      void enqueueRow(uid, adapter.name, rowId, serverRow).then(() => void drain());
    });
    storeUnsubs.push(off);
  }
}

async function bindToUid(uid: string) {
  boundUid = uid;
  status().setStatus('syncing');
  await refreshPendingCount(uid);
  await seedIfFirstTime(uid);
  bindStoreSubscriptions(uid);
  await pull();
  await drain();
}

async function unbind() {
  boundUid = null;
  for (const off of storeUnsubs) off();
  storeUnsubs = [];
  status().setPendingWrites(0);
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

  const uid = currentUid();
  if (uid) void bindToUid(uid);
}

/**
 * Force-push every local row to the server right now. Called from the
 * Settings "Sync now" button. Guarantees that anything on device ends
 * up in Supabase, even in the failure modes the automatic seed leaves
 * behind (stores that hadn't loaded from AsyncStorage when the engine
 * first bound; a UID switch that raced with a store hydration).
 *
 * Steps:
 *   1. Ensure every store has hydrated from AsyncStorage — the seed
 *      relies on `getState()` returning real rows.
 *   2. **Pull first**, so any row the server already has newer than
 *      ours merges into local via LWW. Without this a raw push would
 *      clobber newer server-side edits from another device with our
 *      stale local copy — Supabase's upsert has no LWW of its own.
 *   3. Enqueue every local row for every adapter (dedup keeps the queue
 *      from bloating if the row was already queued). What we push is
 *      now the LWW winner, so no clobber.
 *   4. Drain.
 */
export async function pushAllNow(): Promise<{ ok: true; pushed: number } | { ok: false; error: string }> {
  if (!isSupabaseConfigured() || !supabase) {
    return { ok: false, error: 'Cloud sync is not configured.' };
  }
  const uid = currentUid();
  if (!uid) {
    return { ok: false, error: 'Sign in first — no account bound.' };
  }

  status().setStatus('syncing');
  try {
    // Hydrate every store so seedRows() sees real data. Guarded so an
    // already-loaded store doesn't get re-read from disk needlessly.
    const weight = useWeightStore.getState();
    const splits = useSplitsStore.getState();
    const history = useHistoryStore.getState();
    const cycle = useCycleStore.getState();
    const prefs = usePrefsStore.getState();

    await Promise.all([
      weight.isLoaded ? Promise.resolve() : weight.loadEntries(),
      splits.isLoaded ? Promise.resolve() : splits.loadData(),
      history.isLoaded ? Promise.resolve() : history.loadSessions(),
      cycle.isLoaded ? Promise.resolve() : cycle.loadCycle(),
      prefs.isLoaded ? Promise.resolve() : prefs.loadPrefs(),
    ]);

    // Pull first so newer server rows merge into local before we push.
    // If pull fails (network, RLS, missing table) we abort — pushing on
    // top of an unknown server state is the exact scenario this guard
    // exists to prevent.
    await pull();
    if (status().status === 'offline' || status().status === 'error') {
      const message = status().lastError ?? 'Could not reach the server.';
      return { ok: false, error: message };
    }

    let enqueued = 0;
    for (const adapter of ADAPTERS) {
      for (const seed of adapter.seedRows(uid)) {
        await queue.enqueue(uid, {
          table: adapter.name,
          rowId: seed.rowId,
          row: seed.serverRow,
        });
        enqueued += 1;
      }
    }
    await refreshPendingCount(uid);

    await drain();
    return { ok: true, pushed: enqueued };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    status().setStatus('error');
    status().setError(message);
    return { ok: false, error: message };
  }
}

/**
 * Test-only helper: reset internal module state so a fresh bootstrap
 * can run in a new test. Idempotent.
 */
export function __resetForTests(): void {
  started = false;
  boundUid = null;
  draining = false;
  pulling = false;
  for (const off of storeUnsubs) off();
  storeUnsubs = [];
  status().reset();
}
