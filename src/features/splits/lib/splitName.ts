export const MIN_SPLIT_NAME_LENGTH = 2;
export const MAX_SPLIT_NAME_LENGTH = 30;

export type SplitNameValidation =
  | { ok: true; name: string }
  | { ok: false; error: string };

/**
 * Validates a split name before it becomes a permanent row.
 *
 * The only previous rule was "not empty", which is how a single mistyped
 * character becomes a split you then have to notice and clean up. Duplicates
 * matter too: two splits with the same name are indistinguishable everywhere
 * they appear — the cycle editor, the progress list, history.
 */
export function validateSplitName(
  rawName: string,
  existingNames: string[] = [],
): SplitNameValidation {
  const name = rawName.trim().replace(/\s+/g, ' ');

  if (name.length === 0) {
    return { ok: false, error: 'Give the split a name.' };
  }

  if (name.length < MIN_SPLIT_NAME_LENGTH) {
    return { ok: false, error: `Use at least ${MIN_SPLIT_NAME_LENGTH} characters.` };
  }

  if (name.length > MAX_SPLIT_NAME_LENGTH) {
    return { ok: false, error: `Keep it under ${MAX_SPLIT_NAME_LENGTH} characters.` };
  }

  // A name of only punctuation or digits reads as a mistake in every list.
  if (!/[a-z]/i.test(name)) {
    return { ok: false, error: 'Include at least one letter.' };
  }

  const taken = existingNames.some(
    (existing) => existing.trim().toLowerCase() === name.toLowerCase(),
  );
  if (taken) {
    return { ok: false, error: 'You already have a split with that name.' };
  }

  return { ok: true, name };
}
