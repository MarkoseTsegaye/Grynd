import { Agent, CursorAgentError } from '@cursor/sdk';
import type { AgentProvider, AgentRunOptions } from './types';

/**
 * Cursor SDK provider. Runs an autonomous agent locally in `repoRoot` and
 * returns its final result text. This is the original orchestrator backend,
 * preserved so runs can be pinned to Cursor via ORCH_PROVIDER=cursor.
 */
export function createCursorProvider(apiKey: string): AgentProvider {
  return {
    name: 'cursor',
    async run({ modelId, repoRoot, prompt, label }: AgentRunOptions): Promise<string> {
      try {
        await using agent = await Agent.create({
          apiKey,
          model: { id: modelId },
          local: { cwd: repoRoot },
        });
        const run = await agent.send(prompt);
        const result = await run.wait();
        return (result.result ?? '').trim();
      } catch (err) {
        if (err instanceof CursorAgentError) {
          throw new Error(`${label} failed to start: ${err.message}`);
        }
        throw err;
      }
    },
  };
}
