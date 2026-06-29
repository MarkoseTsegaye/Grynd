import path from 'node:path';
import { readFile } from 'node:fs/promises';

export interface SquadConfig {
  models: {
    coordinator: string;
    dev: string;
    lead: string;
    tester: string;
  };
  reviewModelOverrides: {
    pass1_codeQuality: string;
    pass2_tests: string;
    pass3_security: string;
  };
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

const DEFAULT_CONFIG: SquadConfig = {
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

function normalizeConfig(config: SquadConfig): SquadConfig {
  return {
    models: {
      coordinator: normalizeModelId(config.models.coordinator),
      dev: normalizeModelId(config.models.dev),
      lead: normalizeModelId(config.models.lead),
      tester: normalizeModelId(config.models.tester),
    },
    reviewModelOverrides: {
      pass1_codeQuality: normalizeModelId(config.reviewModelOverrides.pass1_codeQuality),
      pass2_tests: normalizeModelId(config.reviewModelOverrides.pass2_tests),
      pass3_security: normalizeModelId(config.reviewModelOverrides.pass3_security),
    },
    gates: config.gates,
    defaults: config.defaults,
  };
}

export async function loadSquadConfig(repoRoot: string): Promise<SquadConfig> {
  try {
    const raw = await readFile(path.join(repoRoot, '.squad', 'config.json'), 'utf-8');
    const parsed = JSON.parse(raw) as Partial<SquadConfig>;
    return normalizeConfig({
      models: { ...DEFAULT_CONFIG.models, ...parsed.models },
      reviewModelOverrides: { ...DEFAULT_CONFIG.reviewModelOverrides, ...parsed.reviewModelOverrides },
      gates: { ...DEFAULT_CONFIG.gates, ...parsed.gates },
      defaults: { ...DEFAULT_CONFIG.defaults, ...parsed.defaults },
    });
  } catch {
    return normalizeConfig(DEFAULT_CONFIG);
  }
}
