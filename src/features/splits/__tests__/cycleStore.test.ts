import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkoutCycle } from '../types';

const mockGetWorkoutCycle = vi.fn<() => Promise<WorkoutCycle | null>>();
const mockSaveWorkoutCycle = vi.fn<(cycle: WorkoutCycle) => Promise<void>>();

vi.mock('../../../storage/adapters/cycle', () => ({
  getWorkoutCycle: () => mockGetWorkoutCycle(),
  saveWorkoutCycle: (cycle: WorkoutCycle) => mockSaveWorkoutCycle(cycle),
}));

vi.mock('../../../shared/lib/id', () => ({
  generateId: () => 'generated-id',
}));

import { useCycleStore } from '../store/cycleStore';

function makeCycle(overrides: Partial<WorkoutCycle> = {}): WorkoutCycle {
  return {
    days: [
      { id: 'a', type: 'rest' },
      { id: 'b', type: 'rest' },
      { id: 'c', type: 'rest' },
      { id: 'd', type: 'rest' },
    ],
    currentIndex: 2,
    lastAdvancedAt: null,
    updatedAt: 0,
    ...overrides,
  };
}

describe('useCycleStore removeDay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSaveWorkoutCycle.mockResolvedValue(undefined);
    useCycleStore.setState({ cycle: null, isLoaded: false });
  });

  it('shifts currentIndex left when a day before it is removed', async () => {
    // currentIndex 2 points at day "c"; removing "a" should keep pointing at "c".
    useCycleStore.setState({ cycle: makeCycle() });

    await useCycleStore.getState().removeDay('a');

    const { cycle } = useCycleStore.getState();
    expect(cycle?.days.map((d) => d.id)).toEqual(['b', 'c', 'd']);
    expect(cycle?.currentIndex).toBe(1);
    expect(cycle?.days[cycle.currentIndex].id).toBe('c');
  });

  it('keeps currentIndex when a day after it is removed', async () => {
    useCycleStore.setState({ cycle: makeCycle() });

    await useCycleStore.getState().removeDay('d');

    const { cycle } = useCycleStore.getState();
    expect(cycle?.currentIndex).toBe(2);
    expect(cycle?.days[cycle.currentIndex].id).toBe('c');
  });

  it('clamps currentIndex when the current day is the last and gets removed', async () => {
    useCycleStore.setState({ cycle: makeCycle({ currentIndex: 3 }) });

    await useCycleStore.getState().removeDay('d');

    const { cycle } = useCycleStore.getState();
    expect(cycle?.currentIndex).toBe(2);
    expect(cycle?.days.map((d) => d.id)).toEqual(['a', 'b', 'c']);
  });

  it('handles removing the only remaining day', async () => {
    useCycleStore.setState({
      cycle: makeCycle({ days: [{ id: 'a', type: 'rest' }], currentIndex: 0 }),
    });

    await useCycleStore.getState().removeDay('a');

    const { cycle } = useCycleStore.getState();
    expect(cycle?.days).toEqual([]);
    expect(cycle?.currentIndex).toBe(0);
  });

  it('no-ops when the day id is not found', async () => {
    useCycleStore.setState({ cycle: makeCycle() });

    await useCycleStore.getState().removeDay('missing');

    expect(mockSaveWorkoutCycle).not.toHaveBeenCalled();
    expect(useCycleStore.getState().cycle?.currentIndex).toBe(2);
  });
});

describe('useCycleStore setCurrentIndex', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSaveWorkoutCycle.mockResolvedValue(undefined);
    useCycleStore.setState({ cycle: null, isLoaded: false });
  });

  it('moves today to the chosen day and persists it', async () => {
    useCycleStore.setState({ cycle: makeCycle() });

    await useCycleStore.getState().setCurrentIndex(0);

    const { cycle } = useCycleStore.getState();
    expect(cycle?.currentIndex).toBe(0);
    expect(mockSaveWorkoutCycle).toHaveBeenCalledTimes(1);
  });

  it('stamps updatedAt so the sync adapter pushes the change', async () => {
    useCycleStore.setState({ cycle: makeCycle({ updatedAt: 0 }) });

    await useCycleStore.getState().setCurrentIndex(3);

    expect(useCycleStore.getState().cycle?.updatedAt).toBeGreaterThan(0);
  });

  it('resets lastAdvancedAt — choosing a day is a fresh start on it', async () => {
    const stale = Date.now() - 5 * 24 * 60 * 60 * 1000;
    useCycleStore.setState({ cycle: makeCycle({ lastAdvancedAt: stale }) });

    await useCycleStore.getState().setCurrentIndex(1);

    expect(useCycleStore.getState().cycle?.lastAdvancedAt).toBeGreaterThan(stale);
  });

  it('clamps past the end rather than wrapping to the start', async () => {
    useCycleStore.setState({ cycle: makeCycle() });

    await useCycleStore.getState().setCurrentIndex(99);

    expect(useCycleStore.getState().cycle?.currentIndex).toBe(3);
  });

  it('clamps a negative index to the first day', async () => {
    useCycleStore.setState({ cycle: makeCycle() });

    await useCycleStore.getState().setCurrentIndex(-4);

    expect(useCycleStore.getState().cycle?.currentIndex).toBe(0);
  });

  it('no-ops when the day is already today', async () => {
    useCycleStore.setState({ cycle: makeCycle({ currentIndex: 2 }) });

    await useCycleStore.getState().setCurrentIndex(2);

    expect(mockSaveWorkoutCycle).not.toHaveBeenCalled();
  });

  it('no-ops with no cycle or an empty one', async () => {
    await useCycleStore.getState().setCurrentIndex(0);
    useCycleStore.setState({ cycle: makeCycle({ days: [], currentIndex: 0 }) });
    await useCycleStore.getState().setCurrentIndex(0);

    expect(mockSaveWorkoutCycle).not.toHaveBeenCalled();
  });
});
