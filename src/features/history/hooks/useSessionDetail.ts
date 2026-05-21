import { useHistoryStore } from '../store/historyStore';
import type { WorkoutSession } from '../../workout/types';

export function useSessionDetail(sessionId: string): WorkoutSession | null {
  const { sessions } = useHistoryStore();
  return sessions.find((s) => s.id === sessionId) ?? null;
}
