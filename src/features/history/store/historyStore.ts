import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import {
  getSessions,
  saveSessions,
  deleteSession as deleteSessionAdapter,
} from '../../../storage/adapters/sessions';
import type { WorkoutSession } from '../../workout/types';

function isTombstone(session: WorkoutSession): boolean {
  return session.deletedAt != null;
}

interface HistoryState {
  /** Visible finished sessions (completed and not soft-deleted). */
  sessions: WorkoutSession[];
  /**
   * Soft-deleted sessions kept on device until the sync engine
   * confirms the server accepted the tombstone. Never rendered.
   */
  tombstones: WorkoutSession[];
  isLoaded: boolean;
  error: string | null;
  loadSessions: () => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  /** LWW-merge server-side rows into the local store. */
  applyServerSessions: (rows: WorkoutSession[]) => Promise<void>;
  /**
   * All persisted sessions including tombstones, but NOT in-progress
   * sessions (those live on the active-session key). Used by the sync
   * engine to seed the server on first push.
   */
  getAllSessionRowsForSync: () => WorkoutSession[];
  /**
   * Insert or replace a finished session in the store's in-memory
   * state. Called by workoutStore.finishWorkout right after saving so
   * the sync engine's history subscription sees the change without
   * waiting for the next `loadSessions()`.
   */
  ingestFinishedSession: (session: WorkoutSession) => void;
}

export const useHistoryStore = create<HistoryState>()(
  devtools(
    (set, get) => ({
      sessions: [],
      tombstones: [],
      isLoaded: false,
      error: null,

      loadSessions: async () => {
        try {
          const all = await getSessions();
          const finished = all.filter((s) => s.completedAt !== null);
          set({
            sessions: finished.filter((s) => !isTombstone(s)),
            tombstones: finished.filter(isTombstone),
            isLoaded: true,
            error: null,
          });
        } catch (err) {
          set({ error: String(err), isLoaded: true });
        }
      },

      deleteSession: async (id) => {
        await deleteSessionAdapter(id);
        const { sessions, tombstones } = get();
        const target = sessions.find((s) => s.id === id);
        if (!target) return;
        const now = Date.now();
        const tombstone: WorkoutSession = { ...target, deletedAt: now, updatedAt: now };
        set({
          sessions: sessions.filter((s) => s.id !== id),
          tombstones: [...tombstones, tombstone],
        });
      },

      applyServerSessions: async (rows) => {
        const { sessions, tombstones } = get();
        const byId = new Map<string, WorkoutSession>();
        for (const s of sessions) byId.set(s.id, s);
        for (const t of tombstones) byId.set(t.id, t);

        let touched = false;
        for (const incoming of rows) {
          const local = byId.get(incoming.id);
          const localTs = local?.updatedAt ?? 0;
          const incomingTs = incoming.updatedAt ?? 0;
          if (!local || incomingTs > localTs) {
            byId.set(incoming.id, incoming);
            touched = true;
          }
        }
        if (!touched) return;

        const merged = Array.from(byId.values());
        set({
          sessions: merged.filter((s) => !isTombstone(s)),
          tombstones: merged.filter(isTombstone),
        });
        // Persist the full merged set (including tombstones) so a
        // reload after crash rebuilds the same state.
        await saveSessions(merged);
      },

      getAllSessionRowsForSync: () => [...get().sessions, ...get().tombstones],

      ingestFinishedSession: (session) => {
        const { sessions, tombstones } = get();
        const idx = sessions.findIndex((s) => s.id === session.id);
        if (idx >= 0) {
          const next = sessions.slice();
          next[idx] = session;
          set({ sessions: next });
        } else {
          set({ sessions: [session, ...sessions] });
        }
        // Ingest overrides any prior tombstone for this id.
        if (tombstones.some((t) => t.id === session.id)) {
          set({ tombstones: tombstones.filter((t) => t.id !== session.id) });
        }
      },
    }),
    { name: 'HistoryStore', enabled: process.env.APP_ENV === 'development' },
  ),
);
