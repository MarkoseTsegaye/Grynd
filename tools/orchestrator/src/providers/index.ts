import type { AgentProvider, AgentProviderName } from './types';

export type { AgentProvider, AgentProviderName, AgentRunOptions } from './types';

/**
 * Pick the active provider. `ORCH_PROVIDER` (env) overrides the configured
 * default so a single run can be pinned to a backend without editing config.
 */
export function resolveProviderName(configProvider: AgentProviderName): AgentProviderName {
  const raw = process.env.ORCH_PROVIDER?.trim().toLowerCase();
  if (raw === 'cursor' || raw === 'claude') return raw;
  if (raw) {
    throw new Error(`Unknown ORCH_PROVIDER "${raw}" (expected "cursor" or "claude").`);
  }
  return configProvider;
}

/**
 * Construct the selected provider, loading only that backend's SDK. The
 * unselected provider's dependency (e.g. `@cursor/sdk` for a Claude run) is
 * never imported, so it isn't required to be installed.
 */
export async function createProvider(name: AgentProviderName): Promise<AgentProvider> {
  if (name === 'cursor') {
    const apiKey = process.env.CURSOR_API_KEY;
    if (!apiKey) {
      throw new Error(
        'Missing required environment variable: CURSOR_API_KEY (needed for ORCH_PROVIDER=cursor).',
      );
    }
    const { createCursorProvider } = await import('./cursor');
    return createCursorProvider(apiKey);
  }
  const { createClaudeProvider } = await import('./claude');
  return createClaudeProvider();
}
