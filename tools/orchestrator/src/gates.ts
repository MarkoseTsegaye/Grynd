import { execCapture } from './exec';

export interface GateResult {
  name: string;
  command: string;
  code: number;
  output: string;
}

export async function runQualityGates(
  repoRoot: string,
  gateCommands: { typecheck: string; lint: string; test: string },
): Promise<{ results: GateResult[]; pass: boolean }> {
  const entries: Array<{ name: string; command: string }> = [
    { name: 'typecheck', command: gateCommands.typecheck },
    { name: 'lint', command: gateCommands.lint },
    { name: 'test', command: gateCommands.test },
  ];

  const results: GateResult[] = [];

  for (const entry of entries) {
    const [bin, ...args] = entry.command.split(/\s+/);
    const run = await execCapture(bin, args, { cwd: repoRoot });
    results.push({
      name: entry.name,
      command: entry.command,
      code: run.code,
      output: (run.stdout + '\n' + run.stderr).trim(),
    });
  }

  return {
    results,
    pass: results.every((r) => r.code === 0),
  };
}

export function formatGateOutputs(results: GateResult[], iteration: number): string {
  const sections = [`# Iteration ${iteration}`, ''];
  for (const r of results) {
    sections.push(`## ${r.command}`, `exitCode=${r.code}`, r.output || '(no output)', '');
  }
  return sections.join('\n');
}
