import { describe, it, expect } from 'vitest';
import { pickTopSet, summarizeExerciseLine } from '../exerciseLine';
import type { LoggedExercise, LoggedSet, SetSide } from '../../../workout/types';

function set(weightKg: number, reps: number, side?: SetSide): LoggedSet {
  return { weightKg, reps, loggedAt: 0, ...(side ? { side } : {}) };
}

function exercise(sets: LoggedSet[], extra: Partial<LoggedExercise> = {}): LoggedExercise {
  return { exerciseId: 'ex-1', exerciseName: 'Squat', sets, ...extra };
}

/** 225 lb / 220 lb / 185 lb expressed in the kilograms the app stores. */
const KG_225 = 225 / 2.2046;
const KG_220 = 220 / 2.2046;

describe('pickTopSet', () => {
  it('picks the heaviest set', () => {
    expect(pickTopSet([set(80, 10), set(100, 5), set(90, 8)])?.weightKg).toBe(100);
  });

  it('breaks ties on reps', () => {
    expect(pickTopSet([set(100, 5), set(100, 8), set(100, 6)])?.reps).toBe(8);
  });

  it('returns null for no sets', () => {
    expect(pickTopSet([])).toBeNull();
  });
});

describe('summarizeExerciseLine', () => {
  it('returns null when nothing was logged', () => {
    expect(summarizeExerciseLine(exercise([]), null, 'lbs')).toBeNull();
  });

  it('renders uniform reps as sets×reps with the top set in the display unit', () => {
    const line = summarizeExerciseLine(
      exercise([set(KG_225, 8), set(KG_225, 8), set(KG_220, 8), set(KG_225, 8)]),
      null,
      'lbs',
    );
    expect(line?.setsText).toBe('4×8');
    expect(line?.topSetText).toBe('225 lb');
    expect(line?.delta).toBeNull();
  });

  it('renders a range when reps vary across sets', () => {
    const line = summarizeExerciseLine(exercise([set(100, 10), set(100, 8), set(100, 6)]), null, 'kg');
    expect(line?.setsText).toBe('3×6–10');
    expect(line?.topSetText).toBe('100 kg');
  });

  it('counts unilateral L/R pairs as one set each', () => {
    const sets = [
      set(20, 8, 'left'),
      set(20, 8, 'right'),
      set(20, 8, 'left'),
      set(20, 8, 'right'),
    ];
    const line = summarizeExerciseLine(exercise(sets, { unilateral: true }), null, 'kg');
    expect(line?.setsText).toBe('2×8 L/R');
  });

  it('counts uneven sides by the fuller side', () => {
    const sets = [set(20, 8, 'left'), set(20, 8, 'right'), set(20, 8, 'left')];
    const line = summarizeExerciseLine(exercise(sets), null, 'kg');
    expect(line?.setsText).toBe('2×8 L/R');
  });

  it('ignores the unilateral flag when no sides were recorded', () => {
    const line = summarizeExerciseLine(exercise([set(20, 8), set(20, 8)], { unilateral: true }), null, 'kg');
    expect(line?.setsText).toBe('2×8');
  });

  it('shows BW rather than a zero load', () => {
    const line = summarizeExerciseLine(exercise([set(0, 8), set(0, 8)]), null, 'lbs');
    expect(line?.topSetText).toBe('BW');
  });

  it('reports a weight gain in the display unit', () => {
    const line = summarizeExerciseLine(exercise([set(KG_225, 8)]), [set(KG_220, 8)], 'lbs');
    expect(line?.delta).toEqual({ direction: 'up', label: '+5 lb' });
  });

  it('reports a weight loss with a true minus sign', () => {
    const line = summarizeExerciseLine(exercise([set(KG_220, 8)]), [set(KG_225, 8)], 'lbs');
    expect(line?.delta).toEqual({ direction: 'down', label: '−5 lb' });
  });

  it('converts the delta for a kg user', () => {
    const line = summarizeExerciseLine(exercise([set(102.5, 8)]), [set(100, 8)], 'kg');
    expect(line?.delta).toEqual({ direction: 'up', label: '+2.5 kg' });
  });

  it('falls back to reps when the load held', () => {
    const line = summarizeExerciseLine(exercise([set(100, 10)]), [set(100, 8)], 'kg');
    expect(line?.delta).toEqual({ direction: 'up', label: '+2 reps' });
  });

  it('uses the singular for a one-rep change', () => {
    const line = summarizeExerciseLine(exercise([set(100, 7)]), [set(100, 8)], 'kg');
    expect(line?.delta).toEqual({ direction: 'down', label: '−1 rep' });
  });

  it('lets weight win over reps when both moved', () => {
    const line = summarizeExerciseLine(exercise([set(KG_225, 6)]), [set(KG_220, 8)], 'lbs');
    expect(line?.delta).toEqual({ direction: 'up', label: '+5 lb' });
  });

  it('reports an unchanged top set as "same"', () => {
    const line = summarizeExerciseLine(exercise([set(100, 8), set(100, 6)]), [set(100, 8)], 'kg');
    expect(line?.delta).toEqual({ direction: 'flat', label: 'same' });
  });

  it('compares bodyweight work on reps alone', () => {
    const line = summarizeExerciseLine(exercise([set(0, 9)]), [set(0, 8)], 'lbs');
    expect(line?.delta).toEqual({ direction: 'up', label: '+1 rep' });
  });

  it('compares top sets, not matching positions', () => {
    // Prior session warmed up last; the heaviest set is still the comparison.
    const line = summarizeExerciseLine(
      exercise([set(100, 5), set(105, 5)]),
      [set(105, 5), set(60, 12)],
      'kg',
    );
    expect(line?.delta).toEqual({ direction: 'flat', label: 'same' });
  });

  it('treats an empty prior list as no comparison', () => {
    expect(summarizeExerciseLine(exercise([set(100, 8)]), [], 'kg')?.delta).toBeNull();
  });
});
