import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// In-memory AsyncStorage mock. The queue module only calls getItem,
// setItem, and removeItem — cover exactly those.
const memory = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (k: string) => memory.get(k) ?? null),
    setItem: vi.fn(async (k: string, v: string) => {
      memory.set(k, v);
    }),
    removeItem: vi.fn(async (k: string) => {
      memory.delete(k);
    }),
  },
}));

// Fresh module per test so nothing internal (there isn't any yet, but
// future memoization won't surprise us) bleeds across.
async function loadQueue() {
  vi.resetModules();
  return await import('../queue');
}

const UID = 'user-1';

describe('mutation queue', () => {
  beforeEach(() => {
    memory.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is empty for a fresh UID', async () => {
    const q = await loadQueue();
    expect(await q.snapshot(UID)).toEqual([]);
    expect(await q.size(UID)).toBe(0);
  });

  it('persists an enqueued write and reads it back on a fresh module', async () => {
    const first = await loadQueue();
    await first.enqueue(UID, {
      table: 'weight_entries',
      rowId: 'r1',
      row: { id: 'r1', weight_lbs: 180 },
    });

    const reloaded = await loadQueue();
    const snap = await reloaded.snapshot(UID);
    expect(snap).toHaveLength(1);
    expect(snap[0].rowId).toBe('r1');
  });

  it('deduplicates by (table, rowId) keeping the newest payload', async () => {
    const q = await loadQueue();
    await q.enqueue(UID, {
      table: 'weight_entries',
      rowId: 'r1',
      row: { id: 'r1', weight_lbs: 180 },
      enqueuedAt: 100,
    });
    await q.enqueue(UID, {
      table: 'weight_entries',
      rowId: 'r1',
      row: { id: 'r1', weight_lbs: 181 },
      enqueuedAt: 200,
    });

    const snap = await q.snapshot(UID);
    expect(snap).toHaveLength(1);
    expect((snap[0].row as { weight_lbs: number }).weight_lbs).toBe(181);
    // Original enqueuedAt is preserved so FIFO order is stable.
    expect(snap[0].enqueuedAt).toBe(100);
  });

  it('keeps entries with the same rowId across different tables separate', async () => {
    const q = await loadQueue();
    await q.enqueue(UID, { table: 'weight_entries', rowId: 'r1', row: { a: 1 } });
    await q.enqueue(UID, { table: 'splits', rowId: 'r1', row: { b: 2 } });

    const snap = await q.snapshot(UID);
    expect(snap).toHaveLength(2);
  });

  it('scopes writes by UID so accounts do not share buffered writes', async () => {
    const q = await loadQueue();
    await q.enqueue('user-a', { table: 'weight_entries', rowId: 'r1', row: {} });
    await q.enqueue('user-b', { table: 'weight_entries', rowId: 'r2', row: {} });

    expect((await q.snapshot('user-a'))[0].rowId).toBe('r1');
    expect((await q.snapshot('user-b'))[0].rowId).toBe('r2');
  });

  it('remove() strips only the exact entries the caller drained', async () => {
    const q = await loadQueue();
    await q.enqueue(UID, {
      table: 'weight_entries',
      rowId: 'r1',
      row: {},
      enqueuedAt: 100,
    });
    await q.enqueue(UID, {
      table: 'weight_entries',
      rowId: 'r2',
      row: {},
      enqueuedAt: 200,
    });

    const [first] = await q.snapshot(UID);
    await q.remove(UID, [first]);

    const remaining = await q.snapshot(UID);
    expect(remaining.map((e) => e.rowId)).toEqual(['r2']);
  });

  it('remove() ignores a stale entry (already re-enqueued with a new timestamp)', async () => {
    const q = await loadQueue();
    // Snapshot BEFORE the re-enqueue.
    await q.enqueue(UID, {
      table: 'weight_entries',
      rowId: 'r1',
      row: {},
      enqueuedAt: 100,
    });
    const stale = await q.snapshot(UID);
    // Something between snapshot and drain updates the queued write in
    // place (dedup preserves enqueuedAt so this simulates a same-rowId
    // change with a new payload — no snapshot mismatch here) — so we
    // instead simulate a full replace by clear + re-enqueue with a new
    // enqueuedAt.
    await q.clear(UID);
    await q.enqueue(UID, {
      table: 'weight_entries',
      rowId: 'r1',
      row: {},
      enqueuedAt: 999,
    });

    await q.remove(UID, stale);

    const remaining = await q.snapshot(UID);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].enqueuedAt).toBe(999);
  });

  it('clear() empties one UID without touching another', async () => {
    const q = await loadQueue();
    await q.enqueue('user-a', { table: 'weight_entries', rowId: 'r1', row: {} });
    await q.enqueue('user-b', { table: 'weight_entries', rowId: 'r2', row: {} });

    await q.clear('user-a');

    expect(await q.size('user-a')).toBe(0);
    expect(await q.size('user-b')).toBe(1);
  });
});
