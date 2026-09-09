import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

/**
 * Coarse-grained lifecycle for the sync engine.
 *
 *   - `idle`        — no work in flight, everything up to date
 *   - `syncing`     — a push or pull is running right now
 *   - `offline`     — the last attempt failed with a network error; the
 *                     engine will retry on the next mutation or app-resume
 *   - `error`       — the last attempt failed for a non-network reason
 *                     (auth, RLS, bad payload) — surfaced with a message
 *                     so the user has a chance to act (sign back in, etc)
 *   - `unconfigured`— Supabase env vars are missing; the engine is dark
 *                     and every action is a no-op
 */
export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error' | 'unconfigured';

interface SyncState {
  status: SyncStatus;
  /** ms of the last successful pull, or null if no pull has completed yet. */
  lastSyncedAt: number | null;
  /** Rows still queued for push. Shown next to the status dot. */
  pendingWrites: number;
  /** Message for the last non-network error, if any. */
  lastError: string | null;

  setStatus: (status: SyncStatus) => void;
  setLastSyncedAt: (ms: number) => void;
  setPendingWrites: (n: number) => void;
  setError: (message: string | null) => void;
  reset: () => void;
}

const INITIAL: Pick<SyncState, 'status' | 'lastSyncedAt' | 'pendingWrites' | 'lastError'> = {
  status: 'idle',
  lastSyncedAt: null,
  pendingWrites: 0,
  lastError: null,
};

export const useSyncStatusStore = create<SyncState>()(
  devtools(
    (set) => ({
      ...INITIAL,
      setStatus: (status) => set({ status }),
      setLastSyncedAt: (ms) => set({ lastSyncedAt: ms }),
      setPendingWrites: (n) => set({ pendingWrites: n }),
      setError: (message) => set({ lastError: message }),
      reset: () => set(INITIAL),
    }),
    { name: 'SyncStatusStore', enabled: process.env.APP_ENV === 'development' },
  ),
);
