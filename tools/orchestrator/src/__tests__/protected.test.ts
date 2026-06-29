import { describe, expect, it } from 'vitest';
import { isValidReview, summarizeReviewPasses } from '../protected';

describe('isValidReview', () => {
  it('accepts reviews with a verdict section', () => {
    expect(isValidReview('## Verdict\n\nPASS')).toBe(true);
  });

  it('rejects empty reviews', () => {
    expect(isValidReview('')).toBe(false);
    expect(isValidReview('   ')).toBe(false);
  });

  it('rejects reviews missing verdict', () => {
    expect(isValidReview('Looks good to me')).toBe(false);
  });
});

describe('summarizeReviewPasses', () => {
  it('labels pass, fail, and invalid reviews', () => {
    const summary = summarizeReviewPasses([
      { pass: 'pass1', review: '## Verdict\n\nPASS' },
      { pass: 'pass2', review: '## Verdict\n\nFAIL' },
      { pass: 'pass3', review: '' },
    ]);
    expect(summary).toContain('pass1: PASS');
    expect(summary).toContain('pass2: FAIL');
    expect(summary).toContain('pass3: INVALID');
  });
});
