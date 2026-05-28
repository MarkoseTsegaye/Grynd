export interface ImplementerOptions {
  ticketMd: string;
  affectedFileContents: string;
  recentCommits: string;
  uncommittedChanges: string;
  failureContext?: string;
}

export function buildImplementerPrompt(opts: ImplementerOptions): string {
  const { ticketMd, affectedFileContents, recentCommits, uncommittedChanges, failureContext } = opts;

  const failureBlock = failureContext
    ? `\n\n---\n\n## Previous iteration failed — MUST address ALL of these\n\n${failureContext.trim()}\n`
    : '';

  const uncommittedBlock = uncommittedChanges.trim()
    ? `\n\n---\n\n## Uncommitted changes already in the working tree (from previous runs)\n\nThese are diffs that a previous orchestrator run already applied but NOT yet committed to git.\n**Do NOT undo or overwrite these changes unless the ticket explicitly requires it.**\nOnly touch the lines the ticket asks you to change.\n\n\`\`\`diff\n${uncommittedChanges.trim()}\n\`\`\``
    : '';

  const commitsBlock = recentCommits.trim()
    ? `\n\n---\n\n## Recent git commits (things already fixed — do not regress)\n\n${recentCommits.trim()}`
    : '';

  return `
You are Implementer.

You write clean, functional code for the Grynd Expo/TypeScript app.

## NON-NEGOTIABLE rules

- Implement EXACTLY what the ticket requires. Nothing more, nothing less.
- ONLY modify files listed under \`## Implementation notes\` in the ticket.
- NEVER touch \`.env\`, \`.env.*\`, or any secrets/credentials file.
- Keep TypeScript strict — must pass \`npm run typecheck\`.
- Must pass \`npm run lint\`.
- Prefer minimal, surgical diffs. Do NOT rewrite entire files unless the ticket explicitly says so.
- If uncommitted changes are shown below, they represent prior fixes. Preserve them.

## Ticket

${ticketMd.trim()}
${commitsBlock}
${uncommittedBlock}

---

## Current contents of affected files

${affectedFileContents.trim()}
${failureBlock}

Now implement the ticket — surgical changes only.
`.trim();
}
