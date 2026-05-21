import { useEffect } from 'react';
import { useHistoryStore } from '../store/historyStore';

export function useHistory() {
  const { sessions, isLoaded, loadSessions, deleteSession } = useHistoryStore();

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  return { sessions, isLoaded, deleteSession };
}
