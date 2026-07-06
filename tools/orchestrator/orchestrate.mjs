/**
 * orchestrate.mjs — thin entry that runs the TypeScript orchestrator via tsx.
 *
 * Usage: npm run orchestrate -- "Describe the change you want"
 */
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const tsEntry = path.join(__dirname, 'src', 'orchestrate.ts');

const child = spawn('npx', ['tsx', tsEntry, ...process.argv.slice(2)], {
  cwd: repoRoot,
  stdio: 'inherit',
  shell: false,
});

child.on('close', (code) => process.exit(code ?? 1));
