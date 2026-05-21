import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { getSessions, deleteSession as deleteSessionAdapter } from '../../../storage/adapters/sessions';
import type { WorkoutSession } from '../../workout/types';

interface HistoryState {
  sessions: WorkoutSession[];
  isLoaded: boolean;
  error: string | null;
  loadSessions: () => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
}

export const useHistoryStore = create<HistoryState>()(
  devtools(
    (set, get) => ({
      sessions: [],
      isLoaded: false,
      error: null,

      loadSessions: async () => {
        try {
          const sessions = await getSessions();
          set({ sessions: sessions.filter((s) => s.completedAt !== null), isLoaded: true, error: null });
        } catch (err) {
          set({ error: String(err), isLoaded: true });
        }
      },

      deleteSession: async (id) => {
        await deleteSessionAdapter(id);
        set({ sessions: get().sessions.filter((s) => s.id !== id) });
      },
    }),
    { name: 'HistoryStore', enabled: process.env.APP_ENV === 'development' },
  ),
);
