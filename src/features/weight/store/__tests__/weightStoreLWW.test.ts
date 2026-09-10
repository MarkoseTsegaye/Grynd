import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WeightEntry } from '../../types';

// In-memory storage mock so the adapter can persist without touching
// the real AsyncStorage.
const disk = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (k: string) => disk.get(k) ?? null),
    setItem: vi.fn(async (k: string, v: string) => {
      disk.set(k, v);
    }),
    removeItem: vi.fn(async (k: string) => {
      disk.delete(k);
    }),
  },
}));

async function loadStore() {
  vi.resetModules();
  const mod = await import('../weightStore');
  return mod.useWeightStore;
}

function entry(over: Partial<WeightEntry> & { id: string; updatedAt: number }): WeightEntry {
  return {
    dateKey: '2026-01-01',
    loggedAt: 1,
    weightLbs: 180,
    ...over,
  };
}

describe('weightStore.applyServerRows — LWW behavior', () => {
  beforeEach(() => {
    disk.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('adds an incoming row that does not exist locally', async () => {
    const useStore = await loadStore();
    await useStore.getState().applyServerRows([entry({ id: 'a', updatedAt: 5 })]);
    expect(useStore.getState().entries).toHaveLength(1);
    expect(useStore.getState().entries[0].id).toBe('a');
  });

  it('keeps the local row when its updatedAt is newer', async () => {
    const useStore = await loadStore();
    // Seed local row with updatedAt=100 via upsertEntry (stamps now, so
    // patch it after via setState).
    useStore.setState({
      entries: [entry({ id: 'a', updatedAt: 100, weightLbs: 180 })],
      isLoaded: true,
    });

    await useStore.getState().applyServerRows([
      entry({ id: 'a', updatedAt: 50, weightLbs: 200 }),
    ]);

    expect(useStore.getState().entries[0].weightLbs).toBe(180);
    expect(useStore.getState().entries[0].updatedAt).toBe(100);
  });

  it('replaces the local row when the incoming updatedAt is newer', async () => {
    const useStore = await loadStore();
    useStore.setState({
      entries: [entry({ id: 'a', updatedAt: 5, weightLbs: 180 })],
      isLoaded: true,
    });

    await useStore.getState().applyServerRows([
      entry({ id: 'a', updatedAt: 20, weightLbs: 195 }),
    ]);

    expect(useStore.getState().entries[0].weightLbs).toBe(195);
    expect(useStore.getState().entries[0].updatedAt).toBe(20);
  });

  it('honors an incoming tombstone: row moves from visible to tombstones', async () => {
    const useStore = await loadStore();
    useStore.setState({
      entries: [entry({ id: 'a', updatedAt: 5 })],
      isLoaded: true,
    });

    await useStore.getState().applyServerRows([
      entry({ id: 'a', updatedAt: 20, deletedAt: 20 }),
    ]);

    expect(useStore.getState().entries).toHaveLength(0);
    expect(useStore.getState().tombstones).toHaveLength(1);
    expect(useStore.getState().tombstones[0].deletedAt).toBe(20);
  });

  it('preserves a local tombstone when the incoming server row is older', async () => {
    const useStore = await loadStore();
    useStore.setState({
      entries: [],
      tombstones: [entry({ id: 'a', updatedAt: 100, deletedAt: 100 })],
      isLoaded: true,
    });

    // Server still has the pre-delete row at updatedAt=50 (hasn't seen
    // the delete yet). Local tombstone wins, stays hidden.
    await useStore.getState().applyServerRows([
      entry({ id: 'a', updatedAt: 50 }),
    ]);

    expect(useStore.getState().entries).toHaveLength(0);
    expect(useStore.getState().tombstones).toHaveLength(1);
  });

  it('resurrects a tombstoned row if the server has a newer non-deleted version', async () => {
    const useStore = await loadStore();
    // Local deleted the row at t=5. Meanwhile another device re-created
    // (or restored) the same id at t=10. LWW says the server wins.
    useStore.setState({
      entries: [],
      tombstones: [entry({ id: 'a', updatedAt: 5, deletedAt: 5 })],
      isLoaded: true,
    });

    await useStore.getState().applyServerRows([
      entry({ id: 'a', updatedAt: 10, deletedAt: null, weightLbs: 175 }),
    ]);

    expect(useStore.getState().entries).toHaveLength(1);
    expect(useStore.getState().entries[0].weightLbs).toBe(175);
    expect(useStore.getState().tombstones).toHaveLength(0);
  });

  it('is a no-op when no incoming row is newer', async () => {
    const useStore = await loadStore();
    useStore.setState({
      entries: [entry({ id: 'a', updatedAt: 100 })],
      isLoaded: true,
    });
    // Track whether persistence fired (it shouldn't when nothing changed).
    const before = disk.get('weight:all');

    await useStore.getState().applyServerRows([
      entry({ id: 'a', updatedAt: 50 }),
    ]);

    expect(useStore.getState().entries[0].updatedAt).toBe(100);
    expect(disk.get('weight:all')).toBe(before);
  });
});
