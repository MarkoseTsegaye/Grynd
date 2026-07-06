import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { writeTextFile } from './fs';
import { storySlugFromTitle } from './ticketUtils';

export async function appendTraceabilityEntry(args: {
  repoRoot: string;
  title: string;
  runDir: string;
  ticketMd: string;
  finalReview: string;
}): Promise<string> {
  const slug = storySlugFromTitle(args.title);
  const storyPath = path.join(args.repoRoot, '.squad', 'traceability', 'stories', `${slug}.md`);

  let existing = '';
  try {
    existing = await readFile(storyPath, 'utf-8');
  } catch {
    existing = `# ${args.title}\n\n`;
  }

  const entry = [
    '',
    `## Run ${new Date().toISOString()}`,
    '',
    `Artifacts: \`${path.relative(args.repoRoot, args.runDir)}\``,
    '',
    '### Ticket',
    args.ticketMd.trim(),
    '',
    '### Final review',
    args.finalReview.trim(),
    '',
  ].join('\n');

  await writeTextFile(storyPath, existing.trimEnd() + entry);
  return storyPath;
}
