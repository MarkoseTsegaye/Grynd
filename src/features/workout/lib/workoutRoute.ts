export const COLD_START_GUARD_MS = 2000;

export function isWorkoutRoute(pathname: string): boolean {
  return pathname.startsWith('/workout/');
}

/** Skip foreground resume prompt when cold-start prompt fired recently. */
export function shouldSuppressForegroundPrompt(
  coldStartPromptAt: number | null,
  now: number,
  guardMs: number = COLD_START_GUARD_MS,
): boolean {
  return coldStartPromptAt !== null && now - coldStartPromptAt < guardMs;
}
