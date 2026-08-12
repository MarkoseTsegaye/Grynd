import { describe, expect, it } from 'vitest';
import { validateBackup } from '../validateBackup';
import { BACKUP_APP, BACKUP_VERSION, type GryndBackupV1 } from '../types';

/** Mirrors what exportBackup() produces, including a set logged with RIR. */
function makeBackup(overrides: Partial<GryndBackupV1['data']> = {}): unknown {
  const backup: GryndBackupV1 = {
    version: BACKUP_VERSION,
    exportedAt: new Date('2026-08-11T12:00:00.000Z').toISOString(),
    app: BACKUP_APP,
    data: {
      splits: [{ id: 'split-1', name: 'Push', exerciseIds: ['ex-1'], createdAt: 1 }],
      exercises: [{ id: 'ex-1', name: 'Bench', createdAt: 1 }],
      sessions: [
        {
          id: 'sess-1',
          splitId: 'split-1',
          splitName: 'Push',
          startedAt: 1,
          completedAt: 2,
          exercises: [
            {
              exerciseId: 'ex-1',
              exerciseName: 'Bench',
              sets: [
                { weightKg: 60, reps: 8, loggedAt: 1 },
                // legacy RPE set
                { weightKg: 60, reps: 6, loggedAt: 2, effort: { toFailure: true, rpe: 10 } },
                // new RIR set
                { weightKg: 60, reps: 5, loggedAt: 3, effort: { toFailure: false, rir: 2 } },
              ],
            },
          ],
        },
      ],
      cycle: {
        days: [
          { id: 'd1', type: 'split', splitId: 'split-1' },
          { id: 'd2', type: 'rest' },
        ],
        currentIndex: 0,
        lastAdvancedAt: null,
      },
      prefs: { weightUnit: 'lbs', autoAdvanceCycle: true, defaultRestSeconds: 90 },
      ...overrides,
    } as GryndBackupV1['data'],
  };
  // Round-trip through JSON exactly like the exported file does.
  return JSON.parse(JSON.stringify(backup));
}

describe('validateBackup round-trip', () => {
  it('accepts a backup in the shape exportBackup produces', () => {
    const result = validateBackup(makeBackup());
    expect(result.ok).toBe(true);
  });

  it('accepts sets carrying the new rir field', () => {
    const result = validateBackup(makeBackup());
    if (!result.ok) throw new Error(result.error);
    const set = result.backup.data.sessions[0].exercises[0].sets[2];
    expect(set.effort).toEqual({ toFailure: false, rir: 2 });
  });

  it('preserves legacy rpe sets untouched', () => {
    const result = validateBackup(makeBackup());
    if (!result.ok) throw new Error(result.error);
    const set = result.backup.data.sessions[0].exercises[0].sets[1];
    expect(set.effort).toEqual({ toFailure: true, rpe: 10 });
  });

  it('accepts an empty cycle', () => {
    const result = validateBackup(
      makeBackup({ cycle: { days: [], currentIndex: 0, lastAdvancedAt: null } }),
    );
    expect(result.ok).toBe(true);
  });

  it('accepts a split day whose splitId is null rather than absent', () => {
    // Older cycle data can carry an explicit null; rejecting the whole backup
    // over it would make those files permanently unimportable.
    const result = validateBackup(
      makeBackup({
        cycle: {
          days: [{ id: 'd1', type: 'split', splitId: null }],
          currentIndex: 0,
          lastAdvancedAt: null,
        } as never,
      }),
    );
    expect(result.ok).toBe(true);
  });

  it('accepts a custom rest duration, not just a preset', () => {
    // Requiring preset membership made any backup carrying a custom rest
    // value fail validation outright — the file became unimportable.
    const result = validateBackup(
      makeBackup({
        prefs: { weightUnit: 'lbs', autoAdvanceCycle: true, defaultRestSeconds: 105 },
      }),
    );
    if (!result.ok) throw new Error(result.error);
    expect(result.backup.data.prefs.defaultRestSeconds).toBe(105);
  });

  it('still rejects a rest duration outside the allowed range', () => {
    const result = validateBackup(
      makeBackup({
        prefs: { weightUnit: 'lbs', autoAdvanceCycle: true, defaultRestSeconds: 99999 },
      }),
    );
    expect(result.ok).toBe(false);
  });

  it('rejects a file from another app', () => {
    const bad = makeBackup() as Record<string, unknown>;
    bad.app = 'something-else';
    const result = validateBackup(bad);
    expect(result).toEqual({ ok: false, error: 'This file was not exported from Grynd.' });
  });

  it('rejects an unsupported version', () => {
    const bad = makeBackup() as Record<string, unknown>;
    bad.version = 99;
    const result = validateBackup(bad);
    expect(result.ok).toBe(false);
  });
});
