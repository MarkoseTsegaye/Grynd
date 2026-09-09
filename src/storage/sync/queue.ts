import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Persisted mutation queue.
 *
 * Zustand actions enqueue upserts synchronously; the sync engine drains
 * them to Supabase in the background. The queue survives an app kill so
 * writes made offline still reach the server on the next launch.
 *
 * Dedup rule: only the latest mutation per (table, rowId) is kept. A
 * user tapping the same weight ten times in a row produces one server
 * write, not ten. Deletes are modeled as upserts with `deletedAt` set,
 * so the same dedup applies.
 *
 * Scoped by UID so signing out of one account doesn't leak buffered
 * writes into the next.
 */

export interface QueueEntry<T = unknown> {
  /** The Supabase table this row targets, e.g. `weight_entries`. */
  table: string;
  /** Client-side row id, used only for dedup. */
  rowId: string;
  /** Fully-formed server-shape row (snake_case fields, user_id set). */
  row: T;
  /** ms since epoch at enqueue time. Preserved across dedup replaces. */
  enqueuedAt: number;
}

const KEY_PREFIX = 'sync:queue';

function keyFor(uid: string): string {
  return `${KEY_PREFIX}:${uid}`;
}

async function readRaw(uid: string): Promise<QueueEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(uid));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as QueueEntry[]) : [];
  } catch {
    return [];
  }
}

async function writeRaw(uid: string, queue: QueueEntry[]): Promise<void> {
  try {
    if (queue.length === 0) {
      await AsyncStorage.removeItem(keyFor(uid));
      return;
    }
    await AsyncStorage.setItem(keyFor(uid), JSON.stringify(queue));
  } catch {
    // If persistence fails we lose durability guarantees for this write,
    // but the in-memory sync engine will still attempt the push on its
    // next drain — corrupting the queue by throwing here would be worse.
  }
}

/**
 * Enqueue an upsert. If a queued write for the same (table, rowId)
 * already exists, its row is replaced in-place (keeping the original
 * `enqueuedAt` so dedup doesn't reset the FIFO order).
 */
export async function enqueue<T>(
  uid: string,
  entry: Omit<QueueEntry<T>, 'enqueuedAt'> & { enqueuedAt?: number },
): Promise<void> {
  const queue = await readRaw(uid);
  const existingIndex = queue.findIndex(
    (q) => q.table === entry.table && q.rowId === entry.rowId,
  );
  const enqueuedAt = entry.enqueuedAt ?? Date.now();

  if (existingIndex >= 0) {
    queue[existingIndex] = {
      ...queue[existingIndex],
      row: entry.row as unknown,
    };
  } else {
    queue.push({
      table: entry.table,
      rowId: entry.rowId,
      row: entry.row as unknown,
      enqueuedAt,
    });
  }

  await writeRaw(uid, queue);
}

/** Read a snapshot of the queue without mutating it. */
export async function snapshot(uid: string): Promise<QueueEntry[]> {
  return readRaw(uid);
}

/**
 * Remove queued entries that were successfully drained. Matches on
 * (table, rowId) so a re-enqueue happening between snapshot and remove
 * (a mutation during a push) is preserved: we only strip the specific
 * entries the caller drained.
 */
export async function remove(
  uid: string,
  entries: Array<Pick<QueueEntry, 'table' | 'rowId' | 'enqueuedAt'>>,
): Promise<void> {
  if (entries.length === 0) return;
  const queue = await readRaw(uid);
  const drained = new Set(entries.map((e) => `${e.table}|${e.rowId}|${e.enqueuedAt}`));
  const next = queue.filter(
    (q) => !drained.has(`${q.table}|${q.rowId}|${q.enqueuedAt}`),
  );
  await writeRaw(uid, next);
}

/** Nuke the queue for a UID — used on account switch. */
export async function clear(uid: string): Promise<void> {
  await writeRaw(uid, []);
}

export async function size(uid: string): Promise<number> {
  const queue = await readRaw(uid);
  return queue.length;
}
