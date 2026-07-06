import type { LoggedExercise } from '../types';

function getExerciseFirstLoggedAt(exercise: LoggedExercise): number | undefined {
  if (exercise.firstLoggedAt !== undefined) {
    return exercise.firstLoggedAt;
  }
  if (exercise.sets.length === 0) {
    return undefined;
  }
  return Math.min(...exercise.sets.map((set) => set.loggedAt));
}

export function sortExercisesByPerformedOrder(exercises: LoggedExercise[]): LoggedExercise[] {
  const indexed = exercises.map((exercise, templateIndex) => ({
    exercise,
    templateIndex,
    firstLoggedAt: getExerciseFirstLoggedAt(exercise),
  }));

  return indexed
    .sort((a, b) => {
      const aLogged = a.firstLoggedAt !== undefined;
      const bLogged = b.firstLoggedAt !== undefined;

      if (aLogged && bLogged) {
        if (a.firstLoggedAt !== b.firstLoggedAt) {
          return a.firstLoggedAt! - b.firstLoggedAt!;
        }
        return a.templateIndex - b.templateIndex;
      }
      if (aLogged) return -1;
      if (bLogged) return 1;
      return a.templateIndex - b.templateIndex;
    })
    .map(({ exercise }) => exercise);
}
