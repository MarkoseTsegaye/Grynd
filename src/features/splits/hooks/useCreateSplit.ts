import { useState } from 'react';
import { useSplitsStore } from '../store/splitsStore';
import { useHaptics } from '../../../shared/hooks/useHaptics';

export function useCreateSplit(onCreated: (splitId: string) => void) {
  const { createSplit } = useSplitsStore();
  const { success } = useHaptics();
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim().length > 0 && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const split = await createSplit(name.trim());
      success();
      onCreated(split.id);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return { name, setName, canSubmit, isSubmitting, error, handleSubmit };
}
