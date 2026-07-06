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
