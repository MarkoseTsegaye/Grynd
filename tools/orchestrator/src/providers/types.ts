/**
 * Agent provider abstraction.
 *
 * The orchestrator drives coding/review agents through a single seam: give an
 * agent a prompt, let it act in the repo working tree, and read back its final
 * text output. `AgentProvider` is that seam — `cursor` (Cursor SDK) and
 * `claude` (Claude Agent SDK) are interchangeable implementations.
 */
export type AgentProviderName = 'cursor' | 'claude';

export interface AgentRunOptions {
  /** Provider-specific model id (already resolved for this provider). */
  modelId: string;
  /** Repo working directory the agent runs in. */
  repoRoot: string;
  /** The full instruction for this agent run. */
  prompt: string;
  /** Human-readable label used in error messages (e.g. "Implementer"). */
  label: string;
}

export interface AgentProvider {
  readonly name: AgentProviderName;
  run(options: AgentRunOptions): Promise<string>;
}
