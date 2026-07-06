import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createProvider, resolveProviderName } from '../providers';

describe('resolveProviderName', () => {
  const originalProvider = process.env.ORCH_PROVIDER;

  beforeEach(() => {
    delete process.env.ORCH_PROVIDER;
  });

  afterEach(() => {
    if (originalProvider === undefined) delete process.env.ORCH_PROVIDER;
    else process.env.ORCH_PROVIDER = originalProvider;
  });

  it('falls back to the configured provider when the env var is unset', () => {
    expect(resolveProviderName('claude')).toBe('claude');
    expect(resolveProviderName('cursor')).toBe('cursor');
  });

  it('lets ORCH_PROVIDER override the configured default', () => {
    process.env.ORCH_PROVIDER = 'cursor';
    expect(resolveProviderName('claude')).toBe('cursor');
    process.env.ORCH_PROVIDER = 'CLAUDE';
    expect(resolveProviderName('cursor')).toBe('claude');
  });

  it('rejects an unknown provider value', () => {
    process.env.ORCH_PROVIDER = 'openai';
    expect(() => resolveProviderName('claude')).toThrow(/Unknown ORCH_PROVIDER/);
  });
});

describe('createProvider', () => {
  const originalKey = process.env.CURSOR_API_KEY;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.CURSOR_API_KEY;
    else process.env.CURSOR_API_KEY = originalKey;
  });

  it('builds the claude provider without any external credentials', async () => {
    expect((await createProvider('claude')).name).toBe('claude');
  });

  it('requires CURSOR_API_KEY for the cursor provider', async () => {
    delete process.env.CURSOR_API_KEY;
    await expect(createProvider('cursor')).rejects.toThrow(/CURSOR_API_KEY/);
  });

  it('builds the cursor provider when the key is present', async () => {
    process.env.CURSOR_API_KEY = 'test-key';
    expect((await createProvider('cursor')).name).toBe('cursor');
  });
});
