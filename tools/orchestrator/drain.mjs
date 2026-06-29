/**
 * drain.mjs — sequential orchestrator queue runner
 *
 * Reads tasks from queue.txt one line at a time, runs `npm run orchestrate`
 * on each, waits for it to finish, then moves to the next.
 *
 * Failed tasks are re-queued at the front so nothing is lost.
 * Ctrl+C re-queues the in-flight task before exiting.
 *
 * Usage:
 *   npm run orchestrate:drain
 */

import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const QUEUE_FILE = path.join(__dirname, 'queue.txt');
const FAILED_FILE = path.join(__dirname, 'failed.txt');
const repoRoot = path.resolve(__dirname, '..', '..');

const DEFAULT_HEADER = [
  '# One request per line. Lines starting with # are comments and are skipped.',
  '# Add tasks below — drain.mjs processes them one at a time, committing after each PASS.',
  '# Failed tasks are re-queued at the front automatically.',
  '#',
  '# Example:',
  '# fix the + Set button dead tap on second open',
];

function log(msg) {
  const ts = new Date().toLocaleTimeString();
  console.log(`[drain ${ts}] ${msg}`);
}

async function readQueue() {
  if (!existsSync(QUEUE_FILE)) return [];
  const raw = await readFile(QUEUE_FILE, 'utf-8');
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));
}

async function readHeader() {
  if (!existsSync(QUEUE_FILE)) return DEFAULT_HEADER;
  const existing = (await readFile(QUEUE_FILE, 'utf-8')).split('\n');
  const header = existing.filter((l) => l.startsWith('#'));
  return header.length > 0 ? header : DEFAULT_HEADER;
}

async function writeQueue(lines) {
  const header = await readHeader();
  const body = lines.map((l) => l.trim()).filter(Boolean);
  await writeFile(QUEUE_FILE, [...header, ...body].join('\n') + (body.length ? '\n' : ''), 'utf-8');
}

async function prependTask(task) {
  const rest = await readQueue();
  await writeQueue([task, ...rest]);
}

async function logFailure(task, code) {
  const line = `[${new Date().toISOString()}] exit=${code} ${task}\n`;
  await appendFile(FAILED_FILE, line, 'utf-8');
}

function runOrchestrate(request) {
  return new Promise((resolve) => {
    log(`Starting: "${request}"`);
    const child = spawn('npm', ['run', 'orchestrate', '--', request], {
      cwd: repoRoot,
      stdio: 'inherit',
      shell: false,
    });
    child.on('close', (code) => {
      if (code === 0) {
        log(`✅  Done: "${request}"`);
      } else {
        log(`❌  Failed (exit ${code}): "${request}"`);
      }
      resolve(code ?? 1);
    });
  });
}

async function main() {
  log('Queue runner started. Reading queue.txt…');

  let processed = 0;
  let failed = 0;
  let currentTask = null;

  const handleInterrupt = async () => {
    if (currentTask) {
      await prependTask(currentTask);
      log(`Interrupted — re-queued in-flight task: "${currentTask}"`);
    }
    process.exit(130);
  };

  process.on('SIGINT', () => {
    void handleInterrupt();
  });

  while (true) {
    const tasks = await readQueue();

    if (tasks.length === 0) {
      log(`Queue empty. Processed ${processed} task(s), ${failed} failed. Exiting.`);
      break;
    }

    const [next, ...rest] = tasks;
    currentTask = next;

    await writeQueue(rest);
    log(`${rest.length} task(s) left in queue after dequeuing this one.`);

    const code = await runOrchestrate(next);
    processed++;
    currentTask = null;

    if (code !== 0) {
      failed++;
      await logFailure(next, code);
      await prependTask(next);
      log(`Re-queued failed task at front of queue.`);
    }
  }

  process.exit(failed > 0 ? 1 : 0);
}

main();
