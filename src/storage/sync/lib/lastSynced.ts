import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * `lastSyncedAt` bookmarks the newest `updatedAt` we've seen from the
 * server per (uid, table). On the next pull we ask for rows strictly
 * newer than this — no rescanning, no double-applies.
 *
 * The bookmark is scoped by UID so that signing out and back into a
 * different account starts pulling from zero (each UID has its own
 * RLS island).
 */

const KEY_PREFIX = 'sync:lastSyncedAt';

function keyFor(uid: string, table: string): string {
  return `${KEY_PREFIX}:${uid}:${table}`;
}

export async function getLastSyncedAt(uid: string, table: string): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(uid, table));
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export async function setLastSyncedAt(
  uid: string,
  table: string,
  ms: number,
): Promise<void> {
  try {
    await AsyncStorage.setItem(keyFor(uid, table), String(ms));
  } catch {
    // Non-fatal — the bookmark is an optimization. On next pull without
    // it we re-fetch everything, which is correct but slower.
  }
}

export async function clearLastSyncedAt(uid: string, table: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(keyFor(uid, table));
  } catch {
    // Same reasoning as above.
  }
}
