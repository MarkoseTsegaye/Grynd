import path from 'node:path';
import { readFile } from 'node:fs/promises';

/** Paths the Implementer must never modify — reverted automatically after each run. */
export const PROTECTED_PATHS = [
  '.env.development',
  '.env.production',
  '.env.local',
  'tools/orchestrator/queue.txt',
  'tools/orchestrator/failed.txt',
] as const;

export function isValidReview(review: string): boolean {
  const trimmed = review.trim();
  return trimmed.length > 0 && /^##\s*Verdict/im.test(trimmed);
}

export function summarizeReviewPasses(
  reviews: { pass: string; review: string }[],
): string {
  return reviews
    .map(({ pass, review }) => {
      if (!isValidReview(review)) return `- ${pass}: INVALID (empty or missing ## Verdict)`;
      if (/^##\s*Verdict\s*\n+\s*\*{0,2}PASS\*{0,2}\s*$/im.test(review)) return `- ${pass}: PASS`;
      return `- ${pass}: FAIL`;
    })
    .join('\n');
}

export async function readProtectedQueueHeader(repoRoot: string): Promise<string[]> {
  const queuePath = path.join(repoRoot, 'tools/orchestrator/queue.txt');
  try {
    const raw = await readFile(queuePath, 'utf-8');
    return raw.split('\n').filter((l) => l.startsWith('#'));
  } catch {
    return [
      '# One request per line. Lines starting with # are comments and are skipped.',
      '# Add tasks below — drain.mjs processes them one at a time, committing after each PASS.',
      '# Failed tasks are re-queued at the front automatically.',
      '#',
    ];
  }
}
