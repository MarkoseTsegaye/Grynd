import { describe, expect, it } from 'vitest';
import { validateTicketMarkdown, REQUIRED_TICKET_SECTIONS } from '../ticketTemplate';
import { parseVerdictPass, parseVerdictFail, allReviewsPass } from '../verdict';
import { extractAffectedPaths, extractTicketTitle, storySlugFromTitle } from '../ticketUtils';
import { loadSquadConfig, normalizeModelId, resolveModels } from '../config';
import path from 'node:path';

const VALID_TICKET = `
## Title
Fix swipe gesture

## Context
Users report swipe not working.

## Goal
Restore left swipe navigation.

## Non-goals
No redesign.

## Requirements
- Fix pan gesture in workout screen

## Acceptance criteria
- [ ] Swipe left advances to next exercise
- [ ] Swipe right goes to previous

## Edge cases
- First exercise: no right swipe

## Implementation notes
- \`app/workout/[splitId].tsx\`

## Test plan
- npm run typecheck
- npm run lint
- npm run test
`.trim();

describe('validateTicketMarkdown', () => {
  it('accepts a well-formed ticket', () => {
    expect(validateTicketMarkdown(VALID_TICKET)).toEqual({ ok: true });
  });

  it('rejects missing sections', () => {
    const result = validateTicketMarkdown('## Title\nHello');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes('## Context'))).toBe(true);
    }
  });

  it('requires checklist acceptance criteria', () => {
    const bad = VALID_TICKET.replace(/- \[ \] .+/g, 'No checklist item');
    const result = validateTicketMarkdown(bad);
    expect(result.ok).toBe(false);
  });

  it('lists all required sections', () => {
    expect(REQUIRED_TICKET_SECTIONS).toContain('## Test plan');
  });
});

describe('parseVerdictPass', () => {
  it('accepts plain PASS', () => {
    expect(parseVerdictPass('## Verdict\n\nPASS')).toBe(true);
  });

  it('accepts bold PASS', () => {
    expect(parseVerdictPass('## Verdict\n\n**PASS**')).toBe(true);
  });

  it('rejects FAIL', () => {
    expect(parseVerdictPass('## Verdict\n\nFAIL')).toBe(false);
  });

  it('parseVerdictFail detects FAIL', () => {
    expect(parseVerdictFail('## Verdict\n\nFAIL')).toBe(true);
  });
});

describe('allReviewsPass', () => {
  it('requires every review to pass', () => {
    const pass = '## Verdict\n\nPASS';
    const fail = '## Verdict\n\nFAIL';
    expect(allReviewsPass([pass, pass, pass])).toBe(true);
    expect(allReviewsPass([pass, fail, pass])).toBe(false);
    expect(allReviewsPass([])).toBe(false);
  });

  it('rejects empty reviews', () => {
    const pass = '## Verdict\n\nPASS';
    expect(allReviewsPass([pass, '', pass])).toBe(false);
  });
});

describe('extractAffectedPaths', () => {
  it('extracts paths from implementation notes', () => {
    const paths = extractAffectedPaths(VALID_TICKET);
    expect(paths).toContain('app/workout/[splitId].tsx');
  });

  it('extracts paths from affected files section', () => {
    const ticket = '## Affected files\nsrc/shared/lib/id.ts\n## Other\n';
    expect(extractAffectedPaths(ticket)).toContain('src/shared/lib/id.ts');
  });
});

describe('extractTicketTitle', () => {
  it('reads title from ticket', () => {
    expect(extractTicketTitle(VALID_TICKET)).toBe('Fix swipe gesture');
  });
});

describe('storySlugFromTitle', () => {
  it('slugifies titles', () => {
    expect(storySlugFromTitle('Fix Swipe Gesture!')).toBe('fix-swipe-gesture');
  });
});

describe('normalizeModelId', () => {
  it('maps legacy slugs to valid SDK model ids', () => {
    expect(normalizeModelId('gpt-5.5-medium')).toBe('gpt-5.5');
    expect(normalizeModelId('claude-4.6-sonnet-medium-thinking')).toBe('claude-sonnet-4-6');
    expect(normalizeModelId('composer-2.5')).toBe('composer-2.5');
  });
});

describe('loadSquadConfig', () => {
  it('loads config from .squad/config.json', async () => {
    const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
    const config = await loadSquadConfig(repoRoot);
    expect(config.gates.test).toBe('npm run test');
    expect(config.reviewModelOverrides.pass2_tests).toBe('gpt-5.5');
    expect(config.reviewModelOverrides.pass3_security).toBe('claude-sonnet-4-6');
  });

  it('reads the provider and the Claude model set', async () => {
    const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
    const config = await loadSquadConfig(repoRoot);
    expect(config.provider).toBe('claude');
    expect(config.claude.models.dev).toBe('claude-sonnet-5');
    expect(config.claude.reviewModelOverrides.pass3_security).toBe('claude-opus-4-8');
  });
});

describe('resolveModels', () => {
  it('returns the Claude set for the claude provider', async () => {
    const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
    const config = await loadSquadConfig(repoRoot);
    const resolved = resolveModels(config, 'claude');
    expect(resolved.models.coordinator).toBe('claude-haiku-4-5');
    expect(resolved.reviewModelOverrides.pass1_codeQuality).toBe('claude-sonnet-5');
  });

  it('returns the Cursor set for the cursor provider', async () => {
    const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
    const config = await loadSquadConfig(repoRoot);
    const resolved = resolveModels(config, 'cursor');
    expect(resolved.models.coordinator).toBe('composer-2.5');
    expect(resolved.reviewModelOverrides.pass2_tests).toBe('gpt-5.5');
  });
});
