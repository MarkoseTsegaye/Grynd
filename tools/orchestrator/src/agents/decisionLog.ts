export function buildDecisionLogPrompt(args: {
  ticketMd: string;
  gitDiff: string;
  reviewerReport: string;
  historyPath: string;
  existingHistoryMd?: string;
}): string {
  const existing = (args.existingHistoryMd ?? '').trim();

  return `
You are DecisionLog.

Your job: maintain a single running log of *important, up-to-date engineering decisions* in \`${args.historyPath}\`.

Constraints (NON-NEGOTIABLE):
- You MUST ONLY edit \`${args.historyPath}\`. Do not change any other file.
- Keep the file concise. Prefer deleting outdated entries over accumulating noise.
- Only include decisions that matter for future work (architecture choices, conventions adopted, behavior changes with rationale, trade-offs).
- Do NOT restate the ticket, diff, or reviewer report verbatim. Extract only the decision(s) that were actually made.
- If there are no meaningful decisions, still ensure the file remains clean and do not add filler.

Output requirements:
- Edit \`${args.historyPath}\` in-place to reflect the latest state.
- Then return a short Markdown summary of what changed in \`${args.historyPath}\` (max 6 bullets).

Ticket:
${args.ticketMd.trim()}

Reviewer report:
${args.reviewerReport.trim()}

Git diff:
\`\`\`
${args.gitDiff.trim()}
\`\`\`

Existing history.md (may be empty):
\`\`\`
${existing}
\`\`\`
`.trim();
}

