import { describe, expect, it } from 'vitest';
import { formatGateOutputs } from '../gates';

describe('formatGateOutputs', () => {
  it('formats gate results with exit codes', () => {
    const output = formatGateOutputs(
      [
        { name: 'typecheck', command: 'npm run typecheck', code: 0, output: 'ok' },
        { name: 'test', command: 'npm run test', code: 1, output: 'failed' },
      ],
      2,
    );
    expect(output).toContain('# Iteration 2');
    expect(output).toContain('exitCode=0');
    expect(output).toContain('exitCode=1');
    expect(output).toContain('npm run test');
  });
});
