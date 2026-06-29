import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkoutSession } from '../types';

const mockGetActiveSession = vi.fn<() => Promise<WorkoutSession | null>>();
const mockSetActiveSession = vi.fn<(session: WorkoutSession) => Promise<void>>();
const mockClearActiveSession = vi.fn<() => Promise<void>>();
const mockSaveSession = vi.fn<(session: WorkoutSession) => Promise<void>>();

vi.mock('../../../storage/adapters/sessions', () => ({
  getActiveSession: () => mockGetActiveSession(),
  setActiveSession: (session: WorkoutSession) => mockSetActiveSession(session),
  clearActiveSession: () => mockClearActiveSession(),
  saveSession: (session: WorkoutSession) => mockSaveSession(session),
}));

vi.mock('../../splits/store/cycleStore', () => ({
  useCycleStore: { getState: () => ({ advanceCycle: vi.fn() }) },
}));

vi.mock('../../../shared/store/prefsStore', () => ({
  usePrefsStore: { getState: () => ({ autoAdvanceCycle: false }) },
}));

vi.mock('../../../shared/lib/id', () => ({
  generateId: () => 'generated-id',
}));

import { useWorkoutStore } from '../store/workoutStore';

function makeSession(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: 'session-1',
    splitId: 'split-1',
    splitName: 'Push Day',
    startedAt: 1000,
    completedAt: null,
    exercises: [
      { exerciseId: 'ex-1', exerciseName: 'Bench', sets: [] },
      { exerciseId: 'ex-2', exerciseName: 'OHP', sets: [] },
    ],
    ...overrides,
  };
}

describe('useWorkoutStore pause/resume', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActiveSession.mockResolvedValue(null);
    mockSetActiveSession.mockResolvedValue(undefined);
    mockClearActiveSession.mockResolvedValue(undefined);
    useWorkoutStore.setState({
      session: null,
      currentExerciseIndex: 0,
      isLoaded: false,
      error: null,
    });
  });

  it('leaveWorkout retains session in storage', async () => {
    const session = makeSession();
    useWorkoutStore.setState({ session, currentExerciseIndex: 2 });

    await useWorkoutStore.getState().leaveWorkout();

    expect(mockClearActiveSession).not.toHaveBeenCalled();
    expect(mockSetActiveSession).toHaveBeenCalledWith({
      ...session,
      currentExerciseIndex: 2,
    });
    expect(useWorkoutStore.getState().session).toEqual({
      ...session,
      currentExerciseIndex: 2,
    });
  });

  it('goToExercise persists index on the active session', async () => {
    const session = makeSession();
    useWorkoutStore.setState({ session, currentExerciseIndex: 0 });

    useWorkoutStore.getState().goToExercise(1);

    expect(useWorkoutStore.getState().currentExerciseIndex).toBe(1);
    expect(mockSetActiveSession).toHaveBeenCalledWith({
      ...session,
      currentExerciseIndex: 1,
    });
  });

  it('loadActiveSession restores stored exercise index', async () => {
    mockGetActiveSession.mockResolvedValue(makeSession({ currentExerciseIndex: 1 }));

    await useWorkoutStore.getState().loadActiveSession();

    expect(useWorkoutStore.getState().currentExerciseIndex).toBe(1);
    expect(useWorkoutStore.getState().session?.currentExerciseIndex).toBe(1);
  });

  it('loadActiveSession clamps stale exercise index', async () => {
    mockGetActiveSession.mockResolvedValue(makeSession({ currentExerciseIndex: 99 }));

    await useWorkoutStore.getState().loadActiveSession();

    expect(useWorkoutStore.getState().currentExerciseIndex).toBe(1);
    expect(useWorkoutStore.getState().session?.currentExerciseIndex).toBe(1);
  });

  it('loadActiveSession defaults exercise index to 0 when absent', async () => {
    mockGetActiveSession.mockResolvedValue(makeSession());

    await useWorkoutStore.getState().loadActiveSession();

    expect(useWorkoutStore.getState().currentExerciseIndex).toBe(0);
  });

  it('loadActiveSession keeps in-memory session when storage returns null', async () => {
    const session = makeSession({ currentExerciseIndex: 1 });
    useWorkoutStore.setState({ session, currentExerciseIndex: 1 });

    await useWorkoutStore.getState().loadActiveSession();

    expect(useWorkoutStore.getState().session).toEqual(session);
    expect(useWorkoutStore.getState().currentExerciseIndex).toBe(1);
  });

  it('abandonWorkout clears session and resets index', async () => {
    useWorkoutStore.setState({
      session: makeSession({ currentExerciseIndex: 2 }),
      currentExerciseIndex: 2,
    });

    await useWorkoutStore.getState().abandonWorkout();

    expect(mockClearActiveSession).toHaveBeenCalled();
    expect(useWorkoutStore.getState().session).toBeNull();
    expect(useWorkoutStore.getState().currentExerciseIndex).toBe(0);
  });

  it('finishWorkout persists custom completedAt', async () => {
    const customCompletedAt = 9_999_999;
    const session = makeSession();
    useWorkoutStore.setState({ session, currentExerciseIndex: 0 });

    await useWorkoutStore.getState().finishWorkout(customCompletedAt);

    expect(mockSaveSession).toHaveBeenCalledWith(
      expect.objectContaining({
        id: session.id,
        completedAt: customCompletedAt,
      }),
    );
    expect(mockClearActiveSession).toHaveBeenCalled();
    expect(useWorkoutStore.getState().session).toBeNull();
  });
});
