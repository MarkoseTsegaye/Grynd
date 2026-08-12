import { useState } from 'react';
import { useSplitsStore } from '../store/splitsStore';
import { useHaptics } from '../../../shared/hooks/useHaptics';
import { validateSplitName } from '../lib/splitName';

export function useCreateSplit(onCreated: (splitId: string) => void) {
  const { createSplit, splits } = useSplitsStore();
  const { success } = useHaptics();
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validation = validateSplitName(
    name,
    splits.map((split) => split.name),
  );
  const canSubmit = validation.ok && !isSubmitting;

  // Only nag once there is something to correct — an empty field is a starting
  // state, not a mistake.
  const validationError = name.trim().length > 0 && !validation.ok ? validation.error : null;

  const handleSubmit = async () => {
    if (!validation.ok || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const split = await createSplit(validation.name);
      success();
      setName('');
      onCreated(split.id);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return { name, setName, canSubmit, isSubmitting, error, validationError, handleSubmit };
}
