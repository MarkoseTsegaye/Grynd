import { useEffect, useState } from 'react';
import { useSplitsStore } from '../store/splitsStore';
import { useHaptics } from '../../../shared/hooks/useHaptics';

export function useSplitsList() {
  const { splits, isLoaded, loadData, deleteSplit } = useSplitsStore();
  const { impact } = useHaptics();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) loadData();
  }, [isLoaded, loadData]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    impact();
    await deleteSplit(id);
    setDeletingId(null);
  };

  return { splits, isLoaded, deletingId, handleDelete };
}
