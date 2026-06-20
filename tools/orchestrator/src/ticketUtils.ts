/** Extract file paths from the ticket's ## Implementation notes or ## Affected files section. */
export function extractAffectedPaths(ticketMd: string): string[] {
  const sections = ['## Implementation notes', '## Affected files'];
  const paths = new Set<string>();

  for (const header of sections) {
    const match = (ticketMd + '\n## ').match(new RegExp(`${header}\\s*\\n([\\s\\S]*?)\\n## `, 'm'));
    if (!match) continue;
    for (const line of match[1].split('\n')) {
      const trimmed = line.trim().replace(/^[-*]\s+/, '');
      const pathMatch = trimmed.match(/`([^`]+\.(?:ts|tsx|js|jsx|json|md))`/);
      if (pathMatch) paths.add(pathMatch[1]);
      else if (/^(?:app|src|tools)\//.test(trimmed)) paths.add(trimmed.split(/\s/)[0]);
    }
  }

  return [...paths];
}

export function extractTicketTitle(ticketMd: string): string {
  const match = ticketMd.match(/^##\s+Title\s*\n(.+)$/m);
  return match?.[1]?.trim() ?? 'orchestrator run';
}

export function storySlugFromTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return slug || 'untitled';
}
