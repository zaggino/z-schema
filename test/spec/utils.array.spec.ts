import { describe, expect, it } from 'vitest';

import { isUniqueArray, isUniqueByKey } from '../../src/utils/array.ts';
import { generateCases, outcomeOf, referenceIsUniqueArray } from '../lib/unique-array-reference.ts';

describe('isUniqueArray', () => {
  // --- empty / trivial ---
  it('should return true for empty array', () => {
    expect(isUniqueArray([])).toBe(true);
  });

  it('should return true for single-element array', () => {
    expect(isUniqueArray([1])).toBe(true);
  });

  // --- primitives (fast path) ---
  it('should return true for unique numbers', () => {
    expect(isUniqueArray([1, 2, 3, 4, 5])).toBe(true);
  });

  it('should detect duplicate numbers', () => {
    expect(isUniqueArray([1, 2, 3, 2])).toBe(false);
  });

  it('should return true for unique strings', () => {
    expect(isUniqueArray(['a', 'b', 'c'])).toBe(true);
  });

  it('should detect duplicate strings', () => {
    expect(isUniqueArray(['a', 'b', 'a'])).toBe(false);
  });

  it('should return true for unique booleans', () => {
    expect(isUniqueArray([true, false])).toBe(true);
  });

  it('should detect duplicate booleans', () => {
    expect(isUniqueArray([true, true])).toBe(false);
  });

  it('should return true for unique nulls mixed with other primitives', () => {
    expect(isUniqueArray([null, 0, false, ''])).toBe(true);
  });

  it('should detect duplicate nulls', () => {
    expect(isUniqueArray([null, 1, null])).toBe(false);
  });

  it('should distinguish between types with same string representation', () => {
    // 1 (number) vs '1' (string) vs true (boolean) — all different
    expect(isUniqueArray([1, '1', true])).toBe(true);
  });

  it('should distinguish 0, false, null, and empty string', () => {
    expect(isUniqueArray([0, false, null, ''])).toBe(true);
  });

  // --- objects/arrays (slow path) ---
  it('should return true for unique objects', () => {
    expect(isUniqueArray([{ a: 1 }, { a: 2 }, { b: 1 }])).toBe(true);
  });

  it('should detect duplicate objects', () => {
    expect(isUniqueArray([{ a: 1 }, { a: 1 }])).toBe(false);
  });

  it('should return true for unique arrays', () => {
    expect(isUniqueArray([[1, 2], [1, 3], [2]])).toBe(true);
  });

  it('should detect duplicate arrays', () => {
    expect(isUniqueArray([[1, 2], [3], [1, 2]])).toBe(false);
  });

  it('should detect duplicates in mixed primitive and object arrays', () => {
    expect(isUniqueArray([1, { a: 1 }, { a: 1 }])).toBe(false);
  });

  it('should return true for mixed unique primitive and object arrays', () => {
    expect(isUniqueArray([1, 'hello', { a: 1 }, [1, 2]])).toBe(true);
  });

  it('should detect deeply nested duplicate objects', () => {
    expect(isUniqueArray([{ a: { b: { c: 1 } } }, { a: { b: { c: 1 } } }])).toBe(false);
  });

  it('should distinguish objects with different key order', () => {
    // areEqual treats { a: 1, b: 2 } and { b: 2, a: 1 } as equal (uses sortedKeys)
    expect(
      isUniqueArray([
        { a: 1, b: 2 },
        { b: 2, a: 1 },
      ])
    ).toBe(false);
  });

  // --- indexes parameter ---
  it('should populate indexes for duplicate primitives', () => {
    const indexes: number[] = [];
    expect(isUniqueArray([10, 20, 30, 20], indexes)).toBe(false);
    expect(indexes).toEqual([1, 3]);
  });

  it('should populate indexes for duplicate objects', () => {
    const indexes: number[] = [];
    expect(isUniqueArray([{ x: 1 }, { x: 2 }, { x: 1 }], indexes)).toBe(false);
    expect(indexes).toEqual([0, 2]);
  });

  it('should not populate indexes when array is unique', () => {
    const indexes: number[] = [];
    expect(isUniqueArray([1, 2, 3], indexes)).toBe(true);
    expect(indexes).toEqual([]);
  });

  // --- large arrays (fast path performance validation) ---
  it('should handle large unique primitive arrays efficiently', () => {
    const arr = Array.from({ length: 10_000 }, (_, i) => i);
    expect(isUniqueArray(arr)).toBe(true);
  });

  it('should detect duplicate at end of large primitive array', () => {
    const arr = Array.from({ length: 10_000 }, (_, i) => i);
    arr.push(0); // duplicate of first element
    const indexes: number[] = [];
    expect(isUniqueArray(arr, indexes)).toBe(false);
    expect(indexes).toEqual([0, 10_000]);
  });
});

interface ContractRow {
  name: string;
  build: () => unknown[];
  maxDepth?: number;
  result: boolean | 'throw';
  indexes?: number[];
}

const nestKey = (depth: number, leaf: unknown = 1): unknown => {
  let v = leaf;
  for (let i = 0; i < depth; i++) {
    v = { k: v };
  }
  return v;
};

const PREPEND_COUNT = 60;

const pad = (arr: unknown[]): unknown[] => {
  const out = arr.slice();
  for (let i = 0; out.length < 60; i++) {
    out.push(`pad${i}`);
  }
  return out;
};

const prepend = (arr: unknown[]): unknown[] => {
  const out: unknown[] = [];
  for (let i = 0; i < PREPEND_COUNT; i++) {
    out.push(`pad${i}`);
  }
  return out.concat(arr);
};

const sharedInner = [Number.NaN];

const contractRows: ContractRow[] = [
  {
    name: 'primitives only: reports the first earlier match',
    build: () => ['a', 'b', 'b', 'a'],
    result: false,
    indexes: [1, 2],
  },
  {
    name: 'object present: reports the first pair in index order',
    build: () => ['a', 'b', 'b', 'a', {}],
    result: false,
    indexes: [0, 3],
  },
  {
    name: 'NaN duplicates among primitives: false without a pair',
    build: () => [Number.NaN, Number.NaN],
    result: false,
    indexes: [],
  },
  { name: 'NaN duplicates next to an object: unique', build: () => [Number.NaN, Number.NaN, {}], result: true },
  { name: '-0 equals 0 next to an object', build: () => [-0, 0, {}], result: false, indexes: [0, 1] },
  { name: 'number and string stay distinct next to an object', build: () => [1, '1', {}], result: true },
  { name: 'empty array and empty object are distinct', build: () => [[], {}], result: true },
  { name: 'equal bigints next to an object', build: () => [10n, 10n, {}], result: false, indexes: [0, 1] },
  { name: 'bigint and number stay distinct', build: () => [10n, 10, {}], result: true },
  {
    name: 'undefined duplicates next to an object',
    build: () => [undefined, undefined, {}],
    result: false,
    indexes: [0, 1],
  },
  {
    name: 'objects with different key order are equal',
    build: () => [
      { a: 1, b: 2 },
      { b: 2, a: 1 },
    ],
    result: false,
    indexes: [0, 1],
  },
  {
    name: 'shared reference holding NaN is equal',
    build: () => [[sharedInner], [sharedInner]],
    result: false,
    indexes: [0, 1],
  },
  { name: 'separate NaN holders are distinct', build: () => [[Number.NaN], [Number.NaN]], result: true },
  {
    name: 'dates have no own keys and compare equal',
    build: () => [new Date(0), new Date(1)],
    result: false,
    indexes: [0, 1],
  },
  {
    name: 'own __proto__ key differs from an empty object',
    build: () => [JSON.parse('{"__proto__":1}'), {}],
    result: true,
  },
  { name: 'deep object next to a primitive is unique', build: () => [nestKey(200), 5], result: true },
  {
    name: 'deep objects compared before a later duplicate throw',
    build: () => [nestKey(200), 7, 7, nestKey(200)],
    result: 'throw',
  },
  {
    name: 'earlier duplicate pair is reported before deep objects are compared',
    build: () => [7, nestKey(200), 7, nestKey(200)],
    result: false,
    indexes: [0, 2],
  },
  { name: 'maxDepth 1 throws on empty objects', build: () => [{}, {}], maxDepth: 1, result: 'throw' },
  { name: 'maxDepth 2 throws on differing keys', build: () => [{ a: 1 }, { b: 1 }], maxDepth: 2, result: 'throw' },
  { name: 'maxDepth 3 accepts differing keys', build: () => [{ a: 1 }, { b: 1 }], maxDepth: 3, result: true },
  { name: 'maxDepth 0 throws on equal objects', build: () => [{ a: 1 }, { a: 1 }], maxDepth: 0, result: 'throw' },
  {
    name: 'chain of depth 98 with equal leaves is equal',
    build: () => [nestKey(98), nestKey(98)],
    result: false,
    indexes: [0, 1],
  },
  {
    name: 'chain of depth 100 with equal leaves throws',
    build: () => [nestKey(100), nestKey(100)],
    result: 'throw',
  },
  {
    name: 'chain of depth 100 with different leaves throws',
    build: () => [nestKey(100, 1), nestKey(100, 2)],
    result: 'throw',
  },
  {
    name: 'chain of depth 99 with equal leaves is equal',
    build: () => [nestKey(99), nestKey(99)],
    result: false,
    indexes: [0, 1],
  },
  {
    name: 'nested objects with different key order are equal',
    build: () => [[{ a: { x: 1, y: 2 } }], [{ a: { y: 2, x: 1 } }]],
    result: false,
    indexes: [0, 1],
  },
  {
    name: 'bigint and number values inside objects stay distinct',
    build: () => [{ a: 10n }, { a: 10 }, {}],
    result: true,
  },
  {
    name: 'strings that look like serialized keys stay distinct',
    build: () => [{ a: '1:a' }, { a: '1', b: 'a' }, {}],
    result: true,
  },
  { name: 'empty-string keys compare equal', build: () => [{ '': 1 }, { '': 1 }], result: false, indexes: [0, 1] },
  {
    name: 'arrays of numeric-looking strings stay distinct',
    build: () => [['1', '1'], ['11'], ['1', 1]],
    result: true,
  },
  {
    name: 'chain of depth 99 with different leaves is unique',
    build: () => [nestKey(99, 1), nestKey(99, 2)],
    result: true,
  },
];

const expectedDepth = (row: ContractRow): number => row.maxDepth ?? 100;

const expectRow = (row: ContractRow, arr: unknown[], shift = 0): void => {
  const outcome = outcomeOf(isUniqueArray, arr, row.maxDepth);
  const indexes = (row.indexes ?? []).map((index) => index + shift);
  expect({ result: outcome.result, indexes: outcome.indexes }).toEqual({ result: row.result, indexes });
  if (row.result === 'throw') {
    expect(outcome.message).toContain(`Maximum recursion depth (${expectedDepth(row)})`);
  }
};

const rowCases = contractRows.map((row) => [row.name, row] as const);

describe('isUniqueArray contract', () => {
  it.each(rowCases)('%s', (_name, row) => {
    const arr = row.build();
    expect(arr.length).toBeGreaterThan(0);
    expectRow(row, arr);
  });

  it.each(rowCases)('%s (padded to 60 items)', (_name, row) => {
    const arr = pad(row.build());
    expect(arr.length).toBeGreaterThanOrEqual(60);
    expectRow(row, arr);
  });

  it.each(rowCases)('%s (filler prepended)', (_name, row) => {
    const arr = prepend(row.build());
    expect(arr.length).toBeGreaterThanOrEqual(PREPEND_COUNT);
    expectRow(row, arr, PREPEND_COUNT);
  });
});

describe('isUniqueArray matches the pairwise reference', () => {
  it('agrees on result, indexes and message for generated cases', () => {
    const cases = generateCases(20_240_601, 3000);
    const mismatches: number[] = [];
    const counts = { false: 0, throw: 0, large: 0, largeFalse: 0, largeThrow: 0, largeTrue: 0 };
    for (let n = 0; n < cases.length; n++) {
      const { arr, maxDepth } = cases[n];
      const actual = outcomeOf(isUniqueArray, arr, maxDepth);
      const expected = outcomeOf(referenceIsUniqueArray, arr, maxDepth);
      const isLarge = arr.length >= 49;
      if (expected.result === false) {
        counts.false++;
      }
      if (expected.result === 'throw') {
        counts.throw++;
      }
      if (isLarge) {
        counts.large++;
        if (expected.result === false) {
          counts.largeFalse++;
        } else if (expected.result === 'throw') {
          counts.largeThrow++;
        } else {
          counts.largeTrue++;
        }
      }
      if (
        actual.result !== expected.result ||
        actual.message !== expected.message ||
        JSON.stringify(actual.indexes) !== JSON.stringify(expected.indexes)
      ) {
        mismatches.push(n);
      }
    }
    expect(mismatches).toEqual([]);
    expect(counts.false).toBeGreaterThanOrEqual(100);
    expect(counts.throw).toBeGreaterThanOrEqual(100);
    expect(counts.large).toBeGreaterThanOrEqual(100);
    expect(counts.largeFalse).toBeGreaterThanOrEqual(100);
    expect(counts.largeThrow).toBeGreaterThanOrEqual(100);
    expect(counts.largeTrue).toBeGreaterThanOrEqual(100);
  });
});

const holdsReference = (arr: unknown[]): boolean => {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] !== null && typeof arr[i] === 'object') {
      return true;
    }
  }
  return false;
};

describe('isUniqueByKey matches the pairwise reference', () => {
  it('agrees on result, indexes and message for generated cases', () => {
    const cases = generateCases(20_240_601, 3000);
    const mismatches: number[] = [];
    let compared = 0;
    for (let n = 0; n < cases.length; n++) {
      const { arr, maxDepth } = cases[n];
      if (!holdsReference(arr)) {
        continue;
      }
      compared++;
      const actual = outcomeOf(isUniqueByKey, arr, maxDepth);
      const expected = outcomeOf(referenceIsUniqueArray, arr, maxDepth);
      if (
        actual.result !== expected.result ||
        actual.message !== expected.message ||
        JSON.stringify(actual.indexes) !== JSON.stringify(expected.indexes)
      ) {
        mismatches.push(n);
      }
    }
    expect(mismatches).toEqual([]);
    expect(compared).toBeGreaterThanOrEqual(1500);
  });
});

const makeItems = (count: number): Array<{ id: number; name: string }> => {
  const out: Array<{ id: number; name: string }> = [];
  for (let i = 0; i < count; i++) {
    out.push({ id: i, name: `item-${i}` });
  }
  return out;
};

const makeNumbers = (count: number): unknown[] => {
  const out: unknown[] = [];
  for (let i = 0; i < count; i++) {
    out.push(i);
  }
  return out;
};

describe('isUniqueArray on long arrays', () => {
  it('accepts 50,000 distinct objects', () => {
    expect(isUniqueArray(makeItems(50_000))).toBe(true);
  });

  it('accepts distinct numbers followed by an object', () => {
    const arr = makeNumbers(50_000);
    arr.push({});
    expect(isUniqueArray(arr)).toBe(true);
  });

  it('reports a repeated number among numbers followed by an object', () => {
    const arr = makeNumbers(50_000);
    arr[40_000] = 7;
    arr.push({});
    const indexes: number[] = [];
    expect(isUniqueArray(arr, indexes)).toBe(false);
    expect(indexes).toEqual([7, 40_000]);
  });

  it('reports a copy of the first object at the end', () => {
    const arr: unknown[] = makeItems(50_000);
    arr.push({ id: 0, name: 'item-0' });
    const indexes: number[] = [];
    expect(isUniqueArray(arr, indexes)).toBe(false);
    expect(indexes).toEqual([0, 50_000]);
  });

  it('reports the smallest first index among several copies', () => {
    const arr: unknown[] = makeItems(50_000);
    arr[30_000] = { id: 5, name: 'item-5' };
    arr[40_000] = { id: 5, name: 'item-5' };
    arr[45_000] = { id: 2, name: 'item-2' };
    const indexes: number[] = [];
    expect(isUniqueArray(arr, indexes)).toBe(false);
    expect(indexes).toEqual([2, 45_000]);
  });

  it('throws at the depth limit like the pairwise reference', () => {
    const arr: unknown[] = [];
    for (let i = 0; i < 20_000; i++) {
      arr.push(nestKey(8));
    }
    const expected = outcomeOf(referenceIsUniqueArray, arr.slice(0, 60), 5);
    expect(expected.result).toBe('throw');
    const actual = outcomeOf(isUniqueArray, arr, 5);
    expect(actual.result).toBe('throw');
    expect(actual.message).toBe(expected.message);
    expect(actual.message).toMatch(/Maximum recursion depth/);
  });

  it('matches the reference when items differ only after the depth limit', () => {
    const arr: unknown[] = [];
    for (let i = 0; i < 2000; i++) {
      const item = makeNumbers(100);
      item[99] = i;
      arr.push(item);
    }
    const expected = outcomeOf(referenceIsUniqueArray, arr.slice(0, 60), 1);
    const actual = outcomeOf(isUniqueArray, arr, 1);
    expect(actual).toEqual(expected);
  });
});

describe('isUniqueArray around the pairwise limit', () => {
  const lengths = [31, 32, 33, 34];

  it.each(lengths)('handles %i items', (length) => {
    const unique: unknown[] = [];
    for (let i = 0; i < length; i++) {
      unique.push({ id: i, tags: [i] });
    }
    expect(outcomeOf(isUniqueArray, unique, undefined)).toEqual(outcomeOf(referenceIsUniqueArray, unique, undefined));
    expect(isUniqueArray(unique)).toBe(true);

    const withCopy = unique.slice();
    withCopy[length - 1] = { id: 3, tags: [3] };
    const indexes: number[] = [];
    expect(isUniqueArray(withCopy, indexes)).toBe(false);
    expect(indexes).toEqual([3, length - 1]);
    expect(outcomeOf(isUniqueArray, withCopy, undefined)).toEqual(
      outcomeOf(referenceIsUniqueArray, withCopy, undefined)
    );
  });
});

const makeIdItems = (count: number): unknown[] => {
  const out: unknown[] = [];
  for (let i = 0; i < count; i++) {
    out.push({ id: i });
  }
  return out;
};

describe('isUniqueArray falls back to comparing pairs', () => {
  it('lets the pairwise loop decide when keys and comparison disagree', () => {
    const arr = makeIdItems(60);
    let reads = 0;
    arr[0] = { v: 1 };
    arr[1] = {
      get v() {
        reads++;
        return reads === 1 ? 1 : 2;
      },
    };
    const indexes: number[] = [];
    expect(isUniqueArray(arr, indexes)).toBe(true);
    expect(indexes).toEqual([]);
  });

  it('does not throw for a property that throws when read', () => {
    const arr = makeIdItems(60);
    arr[10] = {
      get v(): number {
        throw new Error('unreadable');
      },
    };
    expect(isUniqueArray(arr)).toBe(true);
  });

  it('matches the reference for self-containing arrays', () => {
    const arr: unknown[] = [];
    for (let i = 0; i < 60; i++) {
      const self: unknown[] = [];
      self.push(self);
      arr.push(self);
    }
    const expected = outcomeOf(referenceIsUniqueArray, arr, undefined);
    expect(expected.result).toBe('throw');
    expect(outcomeOf(isUniqueArray, arr, undefined)).toEqual(expected);
  });

  it('reports a shared reference', () => {
    const arr = makeIdItems(60);
    arr[41] = arr[20];
    const indexes: number[] = [];
    expect(isUniqueArray(arr, indexes)).toBe(false);
    expect(indexes).toEqual([20, 41]);
  });

  it('reports one-item arrays holding the same object with NaN', () => {
    const inner = { n: Number.NaN };
    const arr: unknown[] = [];
    for (let i = 0; i < 60; i++) {
      arr.push([inner]);
    }
    const indexes: number[] = [];
    expect(isUniqueArray(arr, indexes)).toBe(false);
    expect(indexes).toEqual([0, 1]);
  });
});

const isDigitsOnly = (prop: string | symbol): boolean => {
  if (typeof prop !== 'string' || prop.length === 0) {
    return false;
  }
  for (let i = 0; i < prop.length; i++) {
    const code = prop.charCodeAt(i);
    if (code < 48 || code > 57) {
      return false;
    }
  }
  return true;
};

const numberRow = (length: number, last: number): number[] => {
  const row: number[] = [];
  for (let i = 0; i < length - 1; i++) {
    row.push(i);
  }
  row.push(last);
  return row;
};

const recordRow = (length: number, last: number): Record<string, number> => {
  const row: Record<string, number> = {};
  for (let i = 0; i < length - 1; i++) {
    row[`k${String(i).padStart(2, '0')}`] = i;
  }
  row[`k${String(length - 1).padStart(2, '0')}`] = last;
  return row;
};

const countingRow = (first: number, counter: { reads: number }): number[] => {
  const values = numberRow(1000, 999);
  values[0] = first;
  return new Proxy(values, {
    get(target, prop, receiver) {
      if (isDigitsOnly(prop)) {
        counter.reads++;
      }
      return Reflect.get(target, prop, receiver);
    },
  });
};

describe('isUniqueArray reads long items only when needed', () => {
  it('does not read distinct items to the end', () => {
    const counter = { reads: 0 };
    const items: unknown[] = [];
    for (let i = 0; i < 100; i++) {
      items.push(countingRow(i, counter));
    }
    expect(isUniqueArray(items)).toBe(true);
    expect(counter.reads).toBeLessThanOrEqual(100 * 40);
  });

  it('reads items that share their first values to the end', () => {
    const items: unknown[] = [];
    for (let i = 0; i < 5000; i++) {
      items.push(numberRow(40, 1000 + i));
    }
    expect(isUniqueArray(items)).toBe(true);

    const withCopy = items.slice();
    withCopy[4999] = items[7];
    const indexes: number[] = [];
    expect(isUniqueArray(withCopy, indexes)).toBe(false);
    expect(indexes).toEqual([7, 4999]);
  });

  const lengths = [30, 31, 32, 33, 34, 35];

  it.each(lengths)('handles arrays of %i numbers', (length) => {
    const items: unknown[] = [];
    for (let i = 0; i < 40; i++) {
      items.push(numberRow(length, 1000 + i));
    }
    expect(isUniqueArray(items)).toBe(true);
    expect(outcomeOf(isUniqueArray, items, undefined)).toEqual(outcomeOf(referenceIsUniqueArray, items, undefined));

    const withCopy = items.slice();
    withCopy[39] = items[4];
    const indexes: number[] = [];
    expect(isUniqueArray(withCopy, indexes)).toBe(false);
    expect(indexes).toEqual([4, 39]);
    expect(outcomeOf(isUniqueArray, withCopy, undefined)).toEqual(
      outcomeOf(referenceIsUniqueArray, withCopy, undefined)
    );
  });

  it.each(lengths)('handles objects of %i keys', (length) => {
    const items: unknown[] = [];
    for (let i = 0; i < 40; i++) {
      items.push(recordRow(length, 1000 + i));
    }
    expect(isUniqueArray(items)).toBe(true);
    expect(outcomeOf(isUniqueArray, items, undefined)).toEqual(outcomeOf(referenceIsUniqueArray, items, undefined));

    const withCopy = items.slice();
    withCopy[39] = items[4];
    const indexes: number[] = [];
    expect(isUniqueArray(withCopy, indexes)).toBe(false);
    expect(indexes).toEqual([4, 39]);
    expect(outcomeOf(isUniqueArray, withCopy, undefined)).toEqual(
      outcomeOf(referenceIsUniqueArray, withCopy, undefined)
    );
  });

  it('accepts many items that share a prefix', () => {
    const items: unknown[] = [];
    for (let i = 0; i < 50_000; i++) {
      items.push(numberRow(34, 1000 + i));
    }
    expect(isUniqueArray(items)).toBe(true);
  });
});
