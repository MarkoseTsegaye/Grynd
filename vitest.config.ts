import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'tools/orchestrator/src/__tests__/**/*.test.ts',
      'src/**/__tests__/**/*.test.ts',
    ],
    environment: 'node',
  },
});
