import { query } from '@anthropic-ai/claude-agent-sdk';
import type { AgentProvider, AgentRunOptions } from './types';

/** Turn cap per agent run — high enough for multi-file changes; override via ORCH_MAX_TURNS. */
const DEFAULT_MAX_TURNS = 60;

function resolveMaxTurns(): number {
  const raw = Number(process.env.ORCH_MAX_TURNS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_MAX_TURNS;
}

/**
 * Claude Agent SDK provider. Runs the Claude Code engine autonomously in
 * `repoRoot` (edit + bash tools, permissions bypassed — the same authority the
 * Cursor local agent had) and returns the final result text.
 *
 * Credentials resolve the way the Agent SDK / Claude Code expect them:
 * ANTHROPIC_API_KEY, CLAUDE_CODE_OAUTH_TOKEN, or an existing `claude` login.
 */
export function createClaudeProvider(): AgentProvider {
  const maxTurns = resolveMaxTurns();

  return {
    name: 'claude',
    async run({ modelId, repoRoot, prompt, label }: AgentRunOptions): Promise<string> {
      let result: string | null = null;

      for await (const message of query({
        prompt,
        options: {
          cwd: repoRoot,
          model: modelId,
          permissionMode: 'bypassPermissions',
          maxTurns,
          systemPrompt: { type: 'preset', preset: 'claude_code' },
        },
      })) {
        if (message.type !== 'result') continue;

        if (message.subtype === 'success') {
          result = message.result;
        } else {
          const detail = message.errors.length > 0 ? `: ${message.errors.join('; ')}` : '';
          throw new Error(`${label} did not complete (${message.subtype})${detail}`);
        }
      }

      if (result === null) {
        throw new Error(`${label} produced no result message.`);
      }
      return result.trim();
    },
  };
}
