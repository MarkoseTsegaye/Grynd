import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Exercise, Split } from '../types';

const mockGetSplits = vi.fn<() => Promise<Split[]>>();
const mockSaveSplits = vi.fn<(splits: Split[]) => Promise<void>>();
const mockGetExercises = vi.fn<() => Promise<Exercise[]>>();
const mockSaveExercises = vi.fn<(exercises: Exercise[]) => Promise<void>>();

vi.mock('../../../storage/adapters/splits', () => ({
  getSplits: () => mockGetSplits(),
  saveSplits: (splits: Split[]) => mockSaveSplits(splits),
  getExercises: () => mockGetExercises(),
  saveExercises: (exercises: Exercise[]) => mockSaveExercises(exercises),
}));

vi.mock('../../../storage/adapters/cycle', () => ({
  getWorkoutCycle: vi.fn(),
  saveWorkoutCycle: vi.fn(),
}));

vi.mock('../../../shared/lib/id', () => ({
  generateId: () => 'ex-new',
}));

import { useSplitsStore } from '../store/splitsStore';

describe('exercise attributes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSplits.mockResolvedValue([]);
    mockSaveSplits.mockResolvedValue(undefined);
    mockGetExercises.mockResolvedValue([]);
    mockSaveExercises.mockResolvedValue(undefined);
    useSplitsStore.setState({
      splits: [],
      exercises: [],
      isLoaded: true,
      error: null,
    });
  });

  it('createExercise stores unilateral and plateLoaded when set', async () => {
    const exercise = await useSplitsStore.getState().createExercise('DB Row', {
      unilateral: true,
      plateLoaded: true,
    });

    expect(exercise).toMatchObject({
      id: 'ex-new',
      name: 'DB Row',
      unilateral: true,
      plateLoaded: true,
    });
    expect(mockSaveExercises).toHaveBeenCalledWith([
      expect.objectContaining({ unilateral: true, plateLoaded: true }),
    ]);
  });

  it('createExercise omits unset attributes', async () => {
    const exercise = await useSplitsStore.getState().createExercise('Squat');
    expect(exercise.unilateral).toBeUndefined();
    expect(exercise.plateLoaded).toBeUndefined();
  });

  it('updateExercise can clear attributes with null', async () => {
    useSplitsStore.setState({
      exercises: [
        {
          id: 'ex-1',
          name: 'Curl',
          unilateral: true,
          plateLoaded: true,
        },
      ],
    });

    await useSplitsStore.getState().updateExercise('ex-1', {
      unilateral: null,
      plateLoaded: null,
    });

    const updated = useSplitsStore.getState().exercises[0];
    expect(updated.unilateral).toBeUndefined();
    expect(updated.plateLoaded).toBeUndefined();
  });
});
