import { areEqual } from './are-equal.js';

export const isUniqueArray = <T>(arr: T[], indexes?: number[]): boolean => {
  let i;
  let j;
  const l = arr.length;
  for (i = 0; i < l; i++) {
    for (j = i + 1; j < l; j++) {
      if (areEqual(arr[i], arr[j])) {
        if (indexes) {
          indexes.push(i, j);
        }
        return false;
      }
    }
  }
  return true;
};
