export const REQUIRED_TICKET_SECTIONS = [
  '## Title',
  '## Context',
  '## Goal',
  '## Non-goals',
  '## Requirements',
  '## Acceptance criteria',
  '## Edge cases',
  '## Implementation notes',
  '## Test plan',
] as const;

export function validateTicketMarkdown(ticketMd: string): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];

  for (const header of REQUIRED_TICKET_SECTIONS) {
    if (!ticketMd.includes(header)) errors.push(`Missing required section: "${header}"`);
  }

  if (!/\n## Acceptance criteria\s*\n([\s\S]*?)\n## /m.test(ticketMd + '\n## ')) {
    errors.push('Acceptance criteria section is empty or malformed.');
  } else {
    const acMatch = (ticketMd + '\n## ').match(/\n## Acceptance criteria\s*\n([\s\S]*?)\n## /m);
    const acBody = acMatch?.[1] ?? '';
    const hasChecklist = /^\s*-\s*\[\s*\]\s+\S+/m.test(acBody);
    if (!hasChecklist) errors.push('Acceptance criteria must include at least one checklist item like "- [ ] ...".');
  }

  return errors.length ? { ok: false, errors } : { ok: true };
}

export function ticketmanOutputInstructions(): string {
  return [
    'Output ONLY the ticket in Markdown.',
    'The ticket MUST include these exact section headers:',
    ...REQUIRED_TICKET_SECTIONS.map((s) => `- ${s}`),
    'Acceptance criteria MUST be a checklist using "- [ ]" items.',
    'Be specific about what files to touch in Implementation notes.',
    'In Test plan, include commands: "npm run typecheck" and "npm run lint" (and any manual steps if UI changes).',
  ].join('\n');
}

