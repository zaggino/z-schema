import { DEFAULT_MAX_RECURSION_DEPTH } from './constants.js';
import { areEqual, firstPairByKey } from './equality.js';

/**
 * Arrays holding objects are compared pair by pair up to this many items, and by key above it. Measured: one
 * key per item is faster from about 8 items for arrays of objects and from about 30 for arrays of short
 * tuples. The bench cases `unique-items-objects-small` and `unique-items-objects-medium` sit on either side.
 *
 * @internal
 */
export const PAIRWISE_MAX_ITEMS = 32;

/** Every pair in index order, stopping at the first comparison that is not `false`. */
const isUniquePairwise = (arr: readonly unknown[], indexes?: number[], maxDepth?: number): boolean => {
  const l = arr.length;
  const eqOpts = { maxDepth };
  for (let i = 0; i < l; i++) {
    for (let j = i + 1; j < l; j++) {
      if (areEqual(arr[i], arr[j], eqOpts)) {
        if (indexes) {
          indexes.push(i, j);
        }
        return false;
      }
    }
  }
  return true;
};

/**
 * `isUniquePairwise` with one key per item in place of one comparison per pair: same result, same reported
 * pair, same error, for items whose values stay the same while they are read. (An accessor that returns
 * something else on each read, or throws only sometimes, is read at other moments than the pairwise loop reads
 * it, so it can get another result.) Exported so that tests can run it on arrays of any length, whatever
 * `PAIRWISE_MAX_ITEMS` is.
 *
 * @internal
 */
export const isUniqueByKey = (arr: unknown[], indexes?: number[], maxDepth?: number): boolean => {
  let pair: readonly [number, number] | undefined;
  try {
    pair = firstPairByKey(arr, maxDepth ?? DEFAULT_MAX_RECURSION_DEPTH);
  } catch {
    // Keys cannot decide: the items are not trees, or reading one failed where the pairwise loop might not have
    // looked (a property that throws when read, a stack overflow on a very deep item). The pairwise loop
    // decides. A fault in the key code would land here too and show only as lost speed: the test that keys
    // every generated tree directly is what catches that.
    return isUniquePairwise(arr, indexes, maxDepth);
  }
  if (pair === undefined) {
    return true;
  }
  // areEqual has the last word on the pair: it confirms it, throws at the depth limit, or disagrees with the
  // keys (the items changed between the two reads), in which case the pairwise loop decides.
  if (!areEqual(arr[pair[0]], arr[pair[1]], { maxDepth })) {
    return isUniquePairwise(arr, indexes, maxDepth);
  }
  if (indexes) {
    indexes.push(pair[0], pair[1]);
  }
  return false;
};

/**
 * Check if all elements in an array are unique.
 *
 * Uses a Set-based fast path for arrays of pure primitives (O(n)).
 * Otherwise items are compared deeply: pair by pair up to `PAIRWISE_MAX_ITEMS` items, and by one serialized
 * key per item above that. The result, the reported index pair and any thrown error are the same either way.
 * Above that, an item is read to the end only when the beginning of its key (its first `PREFIX_MAX_VALUES`
 * values, with the key names of the objects they are in) does not tell it apart.
 */
export const isUniqueArray = (arr: unknown[], indexes?: number[], maxDepth?: number): boolean => {
  const l = arr.length;
  if (l <= 1) {
    return true;
  }

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
      const key = `${typeof v}:${String(v)}`;
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

  // At least one item is an object or array: items need deep comparison.
  if (l <= PAIRWISE_MAX_ITEMS) {
    return isUniquePairwise(arr, indexes, maxDepth);
  }
  return isUniqueByKey(arr, indexes, maxDepth);
};

export const difference = <T>(bigSet: readonly T[], subSet: readonly T[]): T[] => {
  const exclusions = new Set(subSet);
  const arr: T[] = [];
  let idx = bigSet.length;
  while (idx--) {
    if (!exclusions.has(bigSet[idx])) {
      arr.push(bigSet[idx]);
    }
  }
  return arr;
};
