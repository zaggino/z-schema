import { areEqual } from './json.js';

/**
 * Check if all elements in an array are unique.
 *
 * Uses a Set-based fast path for arrays of pure primitives (O(n)).
 * Falls back to pairwise deep comparison (O(n²)) when the array contains
 * objects or arrays that need structural equality checks.
 */
export const isUniqueArray = <T>(arr: T[], indexes?: number[], maxDepth?: number): boolean => {
  const l = arr.length;
  if (l <= 1) return true;

  // Fast path: if every element is a primitive, use a Set.
  // We distinguish types so that e.g. 1 !== '1' and 0 !== false.
  let allPrimitive = true;
  for (let i = 0; i < l; i++) {
    const v = arr[i];
    if (v !== null && typeof v === 'object') {
      allPrimitive = false;
      break;
    }
  }

  if (allPrimitive) {
    // Prefix each value with its type so "1" (number) !== "1" (string).
    const seen = new Set<string>();
    for (let i = 0; i < l; i++) {
      const v = arr[i];
      const key = typeof v + ':' + String(v);
      if (seen.has(key)) {
        // Find the first occurrence for the indexes report.
        if (indexes) {
          for (let j = 0; j < i; j++) {
            const prev = arr[j];
            if (typeof prev === typeof v && prev === v) {
              indexes.push(j, i);
              break;
            }
          }
        }
        return false;
      }
      seen.add(key);
    }
    return true;
  }

  // Slow path: at least one element is an object/array — need deep comparison.
  for (let i = 0; i < l; i++) {
    for (let j = i + 1; j < l; j++) {
      if (areEqual(arr[i], arr[j], { maxDepth })) {
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
  const exclusions = new Set(subSet);
  const arr = [];
  let idx = bigSet.length;
  while (idx--) {
    if (!exclusions.has(bigSet[idx])) {
      arr.push(bigSet[idx]);
    }
  }
  return arr;
};
