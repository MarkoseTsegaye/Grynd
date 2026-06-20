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

const DEFAULT_CONFIG: SquadConfig = {
  models: {
    coordinator: 'composer-2.5',
    dev: 'composer-2.5',
    lead: 'claude-4.6-sonnet-medium-thinking',
    tester: 'gpt-5.5-medium',
  },
  reviewModelOverrides: {
    pass1_codeQuality: 'composer-2.5',
    pass2_tests: 'gpt-5.5-medium',
    pass3_security: 'claude-4.6-sonnet-medium-thinking',
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

export async function loadSquadConfig(repoRoot: string): Promise<SquadConfig> {
  try {
    const raw = await readFile(path.join(repoRoot, '.squad', 'config.json'), 'utf-8');
    const parsed = JSON.parse(raw) as Partial<SquadConfig>;
    return {
      models: { ...DEFAULT_CONFIG.models, ...parsed.models },
      reviewModelOverrides: { ...DEFAULT_CONFIG.reviewModelOverrides, ...parsed.reviewModelOverrides },
      gates: { ...DEFAULT_CONFIG.gates, ...parsed.gates },
      defaults: { ...DEFAULT_CONFIG.defaults, ...parsed.defaults },
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}
