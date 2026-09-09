import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../keys';
import { sortExercisesByPerformedOrder } from '../../features/workout/lib/sortExercisesByPerformedOrder';
import type { WorkoutSession, LoggedExercise, LoggedSet } from '../../features/workout/types';

function normalizeSession(session: WorkoutSession): WorkoutSession {
  // Backfill `updatedAt` for sessions saved before phase 3 (the field
  // didn't exist). Prefer `completedAt` for finished workouts; fall
  // back to `startedAt` for anything still open.
  const updatedAt =
    typeof session.updatedAt === 'number'
      ? session.updatedAt
      : session.completedAt ?? session.startedAt;
  return {
    ...session,
    updatedAt,
    exercises: sortExercisesByPerformedOrder(
      session.exercises.map((ex) => ({
        ...ex,
        sets: ex.sets.map((set) => normalizeLoggedSet(set)),
      })),
    ),
  };
}

function normalizeLoggedSet(set: LoggedSet): LoggedSet {
  const normalized: LoggedSet = {
    ...set,
    weightKg: set.weightKg ?? 0,
  };

  if (set.plates) {
    normalized.plates = {
      unit: set.plates.unit,
      perSide: Object.fromEntries(
        Object.entries(set.plates.perSide).filter(([, count]) => count > 0),
      ),
    };
  }

  return normalized;
}

export async function getSessions(): Promise<WorkoutSession[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.SESSIONS);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WorkoutSession[];
    return parsed.map(normalizeSession);
  } catch {
    return [];
  }
}

export async function saveSessions(sessions: WorkoutSession[]): Promise<void> {
  try {
    const normalized = sessions.map(normalizeSession);
    await AsyncStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(normalized));
  } catch (err) {
    throw new Error(`Failed to save sessions: ${String(err)}`);
  }
}

export async function saveSession(session: WorkoutSession): Promise<void> {
  try {
    const sessions = await getSessions();
    const idx = sessions.findIndex((s) => s.id === session.id);
    if (idx >= 0) {
      sessions[idx] = session;
    } else {
      sessions.unshift(session);
    }
    await AsyncStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
  } catch (err) {
    throw new Error(`Failed to save session: ${String(err)}`);
  }
}

export async function getActiveSession(): Promise<WorkoutSession | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION);
    return raw ? (JSON.parse(raw) as WorkoutSession) : null;
  } catch {
    return null;
  }
}

export async function setActiveSession(session: WorkoutSession): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(session));
  } catch (err) {
    throw new Error(`Failed to set active session: ${String(err)}`);
  }
}

export async function clearActiveSession(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION);
  } catch (err) {
    throw new Error(`Failed to clear active session: ${String(err)}`);
  }
}

/**
 * Soft-delete a session — set `deletedAt` and bump `updatedAt` so the
 * sync layer pushes the tombstone. UI code filters these out.
 */
export async function deleteSession(sessionId: string): Promise<void> {
  try {
    const sessions = await getSessions();
    const now = Date.now();
    const updated = sessions.map((s) =>
      s.id === sessionId ? { ...s, deletedAt: now, updatedAt: now } : s,
    );
    await AsyncStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(updated));
  } catch (err) {
    throw new Error(`Failed to delete session: ${String(err)}`);
  }
}

export async function getPreviousPerformance(
  exerciseId: string,
  beforeSessionId: string,
): Promise<LoggedExercise | null> {
  try {
    const sessions = await getSessions();
    const completed = sessions
      .filter((s) => s.completedAt !== null && s.id !== beforeSessionId)
      .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));

    for (const session of completed) {
      const exercise = session.exercises.find(
        (e) =>
          e.exerciseId === exerciseId ||
          e.substitutedForExerciseId === exerciseId,
      );
      if (exercise && exercise.sets.length > 0) return exercise;
    }
    return null;
  } catch {
    return null;
  }
}
