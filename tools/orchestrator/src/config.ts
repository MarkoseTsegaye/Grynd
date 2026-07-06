import path from 'node:path';
import { readFile } from 'node:fs/promises';
import type { AgentProviderName } from './providers/types';

export interface RoleModels {
  coordinator: string;
  dev: string;
  lead: string;
  tester: string;
}

export interface ReviewModelOverrides {
  pass1_codeQuality: string;
  pass2_tests: string;
  pass3_security: string;
}

export interface ProviderModels {
  models: RoleModels;
  reviewModelOverrides: ReviewModelOverrides;
}

export interface SquadConfig {
  /** Default agent backend; overridable per-run via ORCH_PROVIDER. */
  provider: AgentProviderName;
  /** Cursor SDK role models. */
  models: RoleModels;
  /** Cursor SDK review-pass models. */
  reviewModelOverrides: ReviewModelOverrides;
  /** Claude Agent SDK role + review models (used when provider is "claude"). */
  claude: ProviderModels;
  gates: {
    typecheck: string;
    lint: string;
    test: string;
  };
  defaults: {
    maxIterations: number;
    reviewPassesRequired: number;
  };
}

/** Map legacy/IDE model slugs to valid Cursor SDK model ids. */
export const MODEL_ALIASES: Record<string, string> = {
  'gpt-5.5-medium': 'gpt-5.5',
  'claude-4.6-sonnet-medium-thinking': 'claude-sonnet-4-6',
  'claude-opus-4-8-thinking-high': 'claude-opus-4-8',
  'gpt-5.3-codex': 'gpt-5.3-codex',
};

const DEFAULT_CURSOR_MODELS: ProviderModels = {
  models: {
    coordinator: 'composer-2.5',
    dev: 'composer-2.5',
    lead: 'claude-sonnet-4-6',
    tester: 'gpt-5.5',
  },
  reviewModelOverrides: {
    pass1_codeQuality: 'composer-2.5',
    pass2_tests: 'gpt-5.5',
    pass3_security: 'claude-sonnet-4-6',
  },
};

const DEFAULT_CLAUDE_MODELS: ProviderModels = {
  models: {
    coordinator: 'claude-haiku-4-5',
    dev: 'claude-sonnet-5',
    lead: 'claude-opus-4-8',
    tester: 'claude-opus-4-8',
  },
  reviewModelOverrides: {
    pass1_codeQuality: 'claude-sonnet-5',
    pass2_tests: 'claude-opus-4-8',
    pass3_security: 'claude-opus-4-8',
  },
};

const DEFAULT_CONFIG: SquadConfig = {
  provider: 'claude',
  models: DEFAULT_CURSOR_MODELS.models,
  reviewModelOverrides: DEFAULT_CURSOR_MODELS.reviewModelOverrides,
  claude: DEFAULT_CLAUDE_MODELS,
  gates: {
    typecheck: 'npm run typecheck',
    lint: 'npm run lint',
    test: 'npm run test',
  },
  defaults: {
    maxIterations: 3,
    reviewPassesRequired: 3,
  },
};

export function normalizeModelId(modelId: string): string {
  return MODEL_ALIASES[modelId] ?? modelId;
}

function normalizeRoleModels(models: RoleModels): RoleModels {
  return {
    coordinator: normalizeModelId(models.coordinator),
    dev: normalizeModelId(models.dev),
    lead: normalizeModelId(models.lead),
    tester: normalizeModelId(models.tester),
  };
}

function normalizeReviewOverrides(overrides: ReviewModelOverrides): ReviewModelOverrides {
  return {
    pass1_codeQuality: normalizeModelId(overrides.pass1_codeQuality),
    pass2_tests: normalizeModelId(overrides.pass2_tests),
    pass3_security: normalizeModelId(overrides.pass3_security),
  };
}

function normalizeConfig(config: SquadConfig): SquadConfig {
  return {
    provider: config.provider === 'cursor' ? 'cursor' : 'claude',
    models: normalizeRoleModels(config.models),
    reviewModelOverrides: normalizeReviewOverrides(config.reviewModelOverrides),
    claude: {
      models: normalizeRoleModels(config.claude.models),
      reviewModelOverrides: normalizeReviewOverrides(config.claude.reviewModelOverrides),
    },
    gates: config.gates,
    defaults: config.defaults,
  };
}

/** Select the model set for the active provider. */
export function resolveModels(config: SquadConfig, provider: AgentProviderName): ProviderModels {
  if (provider === 'claude') {
    return config.claude;
  }
  return { models: config.models, reviewModelOverrides: config.reviewModelOverrides };
}

export async function loadSquadConfig(repoRoot: string): Promise<SquadConfig> {
  try {
    const raw = await readFile(path.join(repoRoot, '.squad', 'config.json'), 'utf-8');
    const parsed = JSON.parse(raw) as Partial<SquadConfig>;
    return normalizeConfig({
      provider: parsed.provider ?? DEFAULT_CONFIG.provider,
      models: { ...DEFAULT_CONFIG.models, ...parsed.models },
      reviewModelOverrides: {
        ...DEFAULT_CONFIG.reviewModelOverrides,
        ...parsed.reviewModelOverrides,
      },
      claude: {
        models: { ...DEFAULT_CLAUDE_MODELS.models, ...parsed.claude?.models },
        reviewModelOverrides: {
          ...DEFAULT_CLAUDE_MODELS.reviewModelOverrides,
          ...parsed.claude?.reviewModelOverrides,
        },
      },
      gates: { ...DEFAULT_CONFIG.gates, ...parsed.gates },
      defaults: { ...DEFAULT_CONFIG.defaults, ...parsed.defaults },
    });
  } catch {
    return normalizeConfig(DEFAULT_CONFIG);
  }
}
