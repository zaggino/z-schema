import { areEqual } from './json.js';

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

export const difference = (bigSet: any[], subSet: any[]) => {
  const arr = [];
  let idx = bigSet.length;
  while (idx--) {
    if (subSet.indexOf(bigSet[idx]) === -1) {
      arr.push(bigSet[idx]);
    }
  }
  return arr;
};
