import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkoutSession } from '../types';

const mockGetActiveSession = vi.fn<() => Promise<WorkoutSession | null>>();
const mockSetActiveSession = vi.fn<(session: WorkoutSession) => Promise<void>>();
const mockClearActiveSession = vi.fn<() => Promise<void>>();
const mockSaveSession = vi.fn<(session: WorkoutSession) => Promise<void>>();

const storeMocks = vi.hoisted(() => ({
  advanceCycle: vi.fn(),
  autoAdvanceCycle: false,
}));

vi.mock('../../../storage/adapters/sessions', () => ({
  getActiveSession: () => mockGetActiveSession(),
  setActiveSession: (session: WorkoutSession) => mockSetActiveSession(session),
  clearActiveSession: () => mockClearActiveSession(),
  saveSession: (session: WorkoutSession) => mockSaveSession(session),
}));

vi.mock('../../splits/store/cycleStore', () => ({
  useCycleStore: { getState: () => ({ advanceCycle: storeMocks.advanceCycle }) },
}));

vi.mock('../../../shared/store/prefsStore', () => ({
  usePrefsStore: { getState: () => ({ autoAdvanceCycle: storeMocks.autoAdvanceCycle }) },
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
    storeMocks.autoAdvanceCycle = false;
    storeMocks.advanceCycle.mockReset();
    storeMocks.advanceCycle.mockResolvedValue(undefined);
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

  it('leaveWorkout retains session in storage and sets pausedAt', async () => {
    const session = makeSession();
    useWorkoutStore.setState({ session, currentExerciseIndex: 2 });
    vi.spyOn(Date, 'now').mockReturnValue(42_000);

    await useWorkoutStore.getState().leaveWorkout();

    expect(mockClearActiveSession).not.toHaveBeenCalled();
    expect(mockSetActiveSession).toHaveBeenCalledWith({
      ...session,
      currentExerciseIndex: 2,
      pausedAt: 42_000,
    });
    expect(useWorkoutStore.getState().session).toEqual({
      ...session,
      currentExerciseIndex: 2,
      pausedAt: 42_000,
    });
  });

  it('resumeWorkoutEntry clears pausedAt for matching split', async () => {
    const session = makeSession({ pausedAt: 42_000, currentExerciseIndex: 1 });
    useWorkoutStore.setState({ session, currentExerciseIndex: 1 });

    await useWorkoutStore.getState().resumeWorkoutEntry('split-1');

    const { pausedAt: _, ...cleared } = session;
    expect(mockSetActiveSession).toHaveBeenCalledWith({
      ...cleared,
      currentExerciseIndex: 1,
    });
    expect(useWorkoutStore.getState().session?.pausedAt).toBeUndefined();
  });

  it('resumeWorkoutEntry restores exercise index from session', async () => {
    const session = makeSession({ pausedAt: 42_000, currentExerciseIndex: 1 });
    useWorkoutStore.setState({ session, currentExerciseIndex: 0 });

    await useWorkoutStore.getState().resumeWorkoutEntry('split-1');

    expect(useWorkoutStore.getState().currentExerciseIndex).toBe(1);
    expect(useWorkoutStore.getState().session?.currentExerciseIndex).toBe(1);
  });

  it('resumeWorkoutEntry no-ops for non-matching split', async () => {
    const session = makeSession({ pausedAt: 42_000 });
    useWorkoutStore.setState({ session, currentExerciseIndex: 0 });

    await useWorkoutStore.getState().resumeWorkoutEntry('other-split');

    expect(mockSetActiveSession).not.toHaveBeenCalled();
    expect(useWorkoutStore.getState().session?.pausedAt).toBe(42_000);
  });

  it('resumeWorkoutEntry syncs legacy incomplete session without pausedAt', async () => {
    const session = makeSession({ currentExerciseIndex: 1 });
    useWorkoutStore.setState({ session, currentExerciseIndex: 1 });

    await useWorkoutStore.getState().resumeWorkoutEntry('split-1');

    expect(mockSetActiveSession).toHaveBeenCalledWith({
      ...session,
      currentExerciseIndex: 1,
    });
    expect(useWorkoutStore.getState().session?.pausedAt).toBeUndefined();
  });

  it('resumeWorkoutEntry no-ops for completed session', async () => {
    const session = makeSession({ completedAt: 9000, pausedAt: 42_000 });
    useWorkoutStore.setState({ session, currentExerciseIndex: 0 });

    await useWorkoutStore.getState().resumeWorkoutEntry('split-1');

    expect(mockSetActiveSession).not.toHaveBeenCalled();
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

  it('updateSet replaces fields and preserves loggedAt', async () => {
    const session = makeSession({
      exercises: [
        {
          exerciseId: 'ex-1',
          exerciseName: 'Bench',
          firstLoggedAt: 100,
          sets: [
            { reps: 5, weightKg: 60, loggedAt: 100, notes: 'old' },
            { reps: 5, weightKg: 65, loggedAt: 200 },
          ],
        },
        { exerciseId: 'ex-2', exerciseName: 'OHP', sets: [] },
      ],
    });
    useWorkoutStore.setState({ session, currentExerciseIndex: 0 });

    await useWorkoutStore.getState().updateSet('ex-1', 0, 8, 70, { toFailure: true }, 'new');

    const updated = useWorkoutStore.getState().session?.exercises[0].sets[0];
    expect(updated).toEqual({
      reps: 8,
      weightKg: 70,
      loggedAt: 100,
      effort: { toFailure: true },
      notes: 'new',
    });
    expect(useWorkoutStore.getState().session?.exercises[0].sets).toHaveLength(2);
    expect(mockSetActiveSession).toHaveBeenCalled();
  });

  it('updateSet no-ops for an out-of-range index', async () => {
    const session = makeSession({
      exercises: [
        {
          exerciseId: 'ex-1',
          exerciseName: 'Bench',
          sets: [{ reps: 5, weightKg: 60, loggedAt: 100 }],
        },
        { exerciseId: 'ex-2', exerciseName: 'OHP', sets: [] },
      ],
    });
    useWorkoutStore.setState({ session, currentExerciseIndex: 0 });

    await useWorkoutStore.getState().updateSet('ex-1', 3, 8, 70);

    expect(useWorkoutStore.getState().session?.exercises[0].sets[0]).toEqual({
      reps: 5,
      weightKg: 60,
      loggedAt: 100,
    });
    expect(mockSetActiveSession).not.toHaveBeenCalled();
  });

  it('loadActiveSession restores stored exercise index', async () => {
    mockGetActiveSession.mockResolvedValue(makeSession({ currentExerciseIndex: 1 }));

    await useWorkoutStore.getState().loadActiveSession();

    expect(useWorkoutStore.getState().currentExerciseIndex).toBe(1);
    expect(useWorkoutStore.getState().session?.currentExerciseIndex).toBe(1);
  });

  it('loadActiveSession rehydrates paused session', async () => {
    mockGetActiveSession.mockResolvedValue(
      makeSession({ pausedAt: 42_000, currentExerciseIndex: 1 }),
    );

    await useWorkoutStore.getState().loadActiveSession();

    expect(useWorkoutStore.getState().session?.pausedAt).toBe(42_000);
    expect(useWorkoutStore.getState().session?.completedAt).toBeNull();
    expect(useWorkoutStore.getState().currentExerciseIndex).toBe(1);
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

  it('loadActiveSession keeps newer in-memory sets over a stale storage snapshot', async () => {
    const stored = makeSession({
      exercises: [
        {
          exerciseId: 'ex-1',
          exerciseName: 'Bench',
          sets: [{ reps: 5, weightKg: 60, loggedAt: 100 }],
        },
        { exerciseId: 'ex-2', exerciseName: 'OHP', sets: [] },
      ],
    });
    const current = makeSession({
      exercises: [
        {
          exerciseId: 'ex-1',
          exerciseName: 'Bench',
          sets: [
            { reps: 5, weightKg: 60, loggedAt: 100 },
            { reps: 5, weightKg: 65, loggedAt: 200 },
          ],
        },
        { exerciseId: 'ex-2', exerciseName: 'OHP', sets: [] },
      ],
    });
    mockGetActiveSession.mockResolvedValue(stored);
    useWorkoutStore.setState({ session: current, currentExerciseIndex: 0 });

    await useWorkoutStore.getState().loadActiveSession();

    expect(useWorkoutStore.getState().session?.exercises[0].sets).toHaveLength(2);
  });

  it('finishWorkout clears memory even if cycle advance fails', async () => {
    storeMocks.autoAdvanceCycle = true;
    storeMocks.advanceCycle.mockRejectedValue(new Error('cycle failed'));
    useWorkoutStore.setState({ session: makeSession(), currentExerciseIndex: 0 });

    await useWorkoutStore.getState().finishWorkout();

    expect(mockSaveSession).toHaveBeenCalled();
    expect(mockClearActiveSession).toHaveBeenCalled();
    expect(useWorkoutStore.getState().session).toBeNull();
    expect(useWorkoutStore.getState().error).toContain('cycle failed');
  });

  it('deleteSet recomputes firstLoggedAt from remaining sets', async () => {
    const session = makeSession({
      exercises: [
        {
          exerciseId: 'ex-1',
          exerciseName: 'Bench',
          firstLoggedAt: 100,
          sets: [
            { reps: 5, weightKg: 60, loggedAt: 100 },
            { reps: 5, weightKg: 65, loggedAt: 200 },
          ],
        },
        { exerciseId: 'ex-2', exerciseName: 'OHP', sets: [] },
      ],
    });
    useWorkoutStore.setState({ session, currentExerciseIndex: 0 });

    await useWorkoutStore.getState().deleteSet('ex-1', 0);

    expect(useWorkoutStore.getState().session?.exercises[0].firstLoggedAt).toBe(200);
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

describe('useWorkoutStore substituteExercise', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetActiveSession.mockResolvedValue(undefined);
    useWorkoutStore.setState({ session: makeSession(), currentExerciseIndex: 0 });
  });

  // The bug: this used to mint `exerciseId: generateId()`, an id with no
  // library row behind it — so a substituted lift opened as "Exercise not
  // found" in Trends and never accumulated history across sessions.
  it('stores the picked library exercise id, not a generated one', async () => {
    await useWorkoutStore
      .getState()
      .substituteExercise(0, { masterExerciseId: 'lib-incline', name: 'Incline DB Press' });

    const entry = useWorkoutStore.getState().session!.exercises[0];
    expect(entry.exerciseId).toBe('lib-incline');
    expect(entry.exerciseId).not.toBe('generated-id');
    expect(entry.exerciseName).toBe('Incline DB Press');
  });

  it('remembers what was planned so history still compares against it', async () => {
    await useWorkoutStore
      .getState()
      .substituteExercise(0, { masterExerciseId: 'lib-incline', name: 'Incline DB Press' });

    const entry = useWorkoutStore.getState().session!.exercises[0];
    expect(entry.substitutedForExerciseId).toBe('ex-1');
    expect(entry.substitutedForExerciseName).toBe('Bench');
  });

  it('carries the exercise attributes through, like addAdHocExercise', async () => {
    await useWorkoutStore.getState().substituteExercise(0, {
      masterExerciseId: 'lib-row',
      name: 'Single-arm Row',
      unilateral: true,
      plateLoaded: true,
    });

    const entry = useWorkoutStore.getState().session!.exercises[0];
    expect(entry.unilateral).toBe(true);
    expect(entry.plateLoaded).toBe(true);
  });

  it('keeps pointing at the original plan when substituting twice', async () => {
    const store = useWorkoutStore.getState();
    await store.substituteExercise(0, { masterExerciseId: 'lib-a', name: 'A' });
    await useWorkoutStore.getState().substituteExercise(0, { masterExerciseId: 'lib-b', name: 'B' });

    const entry = useWorkoutStore.getState().session!.exercises[0];
    expect(entry.exerciseId).toBe('lib-b');
    expect(entry.substitutedForExerciseId).toBe('ex-1');
  });

  it('starts the substitute with no sets', async () => {
    useWorkoutStore.setState({
      session: makeSession({
        exercises: [
          { exerciseId: 'ex-1', exerciseName: 'Bench', sets: [{ weightKg: 80, reps: 8, loggedAt: 1 }] },
        ],
      }),
    });

    await useWorkoutStore.getState().substituteExercise(0, { masterExerciseId: 'lib-x', name: 'X' });

    expect(useWorkoutStore.getState().session!.exercises[0].sets).toEqual([]);
  });

  it('no-ops without a resolved library id or name, and on a bad index', async () => {
    const before = useWorkoutStore.getState().session;
    await useWorkoutStore.getState().substituteExercise(0, { masterExerciseId: '', name: 'X' });
    await useWorkoutStore.getState().substituteExercise(0, { masterExerciseId: 'lib-x', name: '  ' });
    await useWorkoutStore.getState().substituteExercise(9, { masterExerciseId: 'lib-x', name: 'X' });

    expect(useWorkoutStore.getState().session).toBe(before);
    expect(mockSetActiveSession).not.toHaveBeenCalled();
  });
});
