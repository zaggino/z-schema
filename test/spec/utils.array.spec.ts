import { beforeAll, describe, expect, it } from 'vitest';

import {
  firstPairByKey,
  isUniqueArray,
  isUniqueByKey,
  PAIRWISE_MAX_ITEMS,
  PREFIX_MAX_VALUES,
} from '../../src/utils/array.ts';
import { DEFAULT_MAX_RECURSION_DEPTH } from '../../src/utils/constants.ts';
import { areEqual } from '../../src/utils/json.ts';
import {
  generateCases,
  holdsReference,
  idItems,
  isTree,
  LONG_ITEM_MIN_VALUES,
  LONG_MIN_ITEMS,
  numberRow,
  objectChain,
  outcomeOf,
  pad,
  PADDED_ITEMS,
  prepend,
  recordRow,
  referencePairwise,
  sameOutcome,
} from '../lib/unique-array-cases.ts';

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

describe('sizes used by the uniqueItems tests', () => {
  it('long and padded arrays are above the pairwise limit', () => {
    expect(LONG_MIN_ITEMS).toBeGreaterThan(PAIRWISE_MAX_ITEMS);
    expect(PADDED_ITEMS).toBeGreaterThan(PAIRWISE_MAX_ITEMS);
  });

  it('the variants of a long item share more values than a prefix holds', () => {
    expect(LONG_ITEM_MIN_VALUES - 1).toBeGreaterThan(PREFIX_MAX_VALUES);
  });
});

interface ContractRow {
  name: string;
  build: () => unknown[];
  maxDepth?: number;
  result: boolean | 'throw';
  indexes?: number[];
}

interface ContractGroup {
  theme: string;
  rows: ContractRow[];
}

const sharedInner = [Number.NaN];

const contractGroups: ContractGroup[] = [
  {
    theme: 'which pair is reported',
    rows: [
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
        name: 'earlier duplicate pair is reported before deep objects are compared',
        build: () => [7, objectChain(200), 7, objectChain(200)],
        result: false,
        indexes: [0, 2],
      },
      {
        name: 'deep objects compared before a later duplicate throw',
        build: () => [objectChain(200), 7, 7, objectChain(200)],
        result: 'throw',
      },
    ],
  },
  {
    theme: 'how values compare',
    rows: [
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
        name: 'nested objects with different key order are equal',
        build: () => [[{ a: { x: 1, y: 2 } }], [{ a: { y: 2, x: 1 } }]],
        result: false,
        indexes: [0, 1],
      },
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
    ],
  },
  {
    theme: 'shared references',
    rows: [
      {
        name: 'shared reference holding NaN is equal',
        build: () => [[sharedInner], [sharedInner]],
        result: false,
        indexes: [0, 1],
      },
      { name: 'separate NaN holders are distinct', build: () => [[Number.NaN], [Number.NaN]], result: true },
    ],
  },
  {
    theme: 'depth limit',
    rows: [
      { name: 'deep object next to a primitive is unique', build: () => [objectChain(200), 5], result: true },
      { name: 'maxDepth 0 throws on equal objects', build: () => [{ a: 1 }, { a: 1 }], maxDepth: 0, result: 'throw' },
      { name: 'maxDepth 1 throws on empty objects', build: () => [{}, {}], maxDepth: 1, result: 'throw' },
      { name: 'maxDepth 2 throws on differing keys', build: () => [{ a: 1 }, { b: 1 }], maxDepth: 2, result: 'throw' },
      { name: 'maxDepth 3 accepts differing keys', build: () => [{ a: 1 }, { b: 1 }], maxDepth: 3, result: true },
      {
        name: 'chain of depth 98 with equal leaves is equal',
        build: () => [objectChain(98), objectChain(98)],
        result: false,
        indexes: [0, 1],
      },
      {
        name: 'chain of depth 99 with equal leaves is equal',
        build: () => [objectChain(99), objectChain(99)],
        result: false,
        indexes: [0, 1],
      },
      {
        name: 'chain of depth 99 with different leaves is unique',
        build: () => [objectChain(99, 1), objectChain(99, 2)],
        result: true,
      },
      {
        name: 'chain of depth 100 with equal leaves throws',
        build: () => [objectChain(100), objectChain(100)],
        result: 'throw',
      },
      {
        name: 'chain of depth 100 with different leaves throws',
        build: () => [objectChain(100, 1), objectChain(100, 2)],
        result: 'throw',
      },
    ],
  },
];

const expectRow = (row: ContractRow, arr: unknown[], shift = 0): void => {
  const outcome = outcomeOf(isUniqueArray, arr, row.maxDepth);
  const indexes = (row.indexes ?? []).map((index) => index + shift);
  expect({ result: outcome.result, indexes: outcome.indexes }).toEqual({ result: row.result, indexes });
  if (outcome.result === 'throw') {
    expect(outcome.message).toContain(`Maximum recursion depth (${row.maxDepth ?? DEFAULT_MAX_RECURSION_DEPTH})`);
  }
};

describe('isUniqueArray contract', () => {
  describe.each(contractGroups)('$theme', ({ rows }) => {
    const cases = rows.map((row) => [row.name, row] as const);

    it.each(cases)('%s', (_name, row) => {
      expectRow(row, row.build());
    });

    it.each(cases)('%s (padded)', (_name, row) => {
      const arr = pad(row.build());
      expect(arr.length).toBeGreaterThan(PAIRWISE_MAX_ITEMS);
      expectRow(row, arr);
    });

    it.each(cases)('%s (fillers in front)', (_name, row) => {
      const arr = prepend(row.build());
      expect(arr.length).toBeGreaterThan(PAIRWISE_MAX_ITEMS);
      expectRow(row, arr, PADDED_ITEMS);
    });
  });
});

const SEED = 20_240_601;
const CASE_COUNT = 3000;

interface Tally {
  false: number;
  throw: number;
  true: number;
}

interface CaseSummary {
  /** Case numbers where `isUniqueArray` differs from the pairwise loop. */
  arrayMismatches: number[];
  /** Case numbers where `isUniqueByKey` differs from the pairwise loop. */
  byKeyMismatches: number[];
  /** Expected outcomes of the arrays of at least `LONG_MIN_ITEMS` items, and of the shorter ones. */
  long: Tally;
  short: Tally;
  /** Tree cases where `firstPairByKey` reported a pair that `areEqual` calls different. */
  rejectedPairs: number[];
  /** Number of tree cases. */
  trees: number;
  /** Tree cases where `firstPairByKey` threw. */
  treesThatThrew: number[];
}

const summarizeCases = (): CaseSummary => {
  const summary: CaseSummary = {
    arrayMismatches: [],
    byKeyMismatches: [],
    long: { false: 0, throw: 0, true: 0 },
    short: { false: 0, throw: 0, true: 0 },
    rejectedPairs: [],
    trees: 0,
    treesThatThrew: [],
  };
  const cases = generateCases(SEED, CASE_COUNT);
  for (let n = 0; n < cases.length; n++) {
    const { arr, maxDepth } = cases[n];
    if (!holdsReference(arr)) {
      continue;
    }
    const expected = outcomeOf(referencePairwise, arr, maxDepth);
    const tally = arr.length >= LONG_MIN_ITEMS ? summary.long : summary.short;
    tally[`${expected.result}`]++;
    if (!sameOutcome(outcomeOf(isUniqueArray, arr, maxDepth), expected)) {
      summary.arrayMismatches.push(n);
    }
    if (!sameOutcome(outcomeOf(isUniqueByKey, arr, maxDepth), expected)) {
      summary.byKeyMismatches.push(n);
    }
    if (!isTree(arr)) {
      continue;
    }
    summary.trees++;
    let pair: readonly [number, number] | undefined;
    try {
      pair = firstPairByKey(arr, maxDepth ?? DEFAULT_MAX_RECURSION_DEPTH);
    } catch {
      summary.treesThatThrew.push(n);
      continue;
    }
    if (pair !== undefined) {
      try {
        if (!areEqual(arr[pair[0]], arr[pair[1]], { maxDepth })) {
          summary.rejectedPairs.push(n);
        }
      } catch {
        // areEqual throwing at the depth limit is a valid outcome for a proposed pair
      }
    }
  }
  return summary;
};

describe('generated cases', () => {
  let summary: CaseSummary;

  beforeAll(() => {
    summary = summarizeCases();
  });

  it('isUniqueArray gives the result, the pair and the error of the pairwise loop', () => {
    expect(summary.arrayMismatches).toEqual([]);
  });

  it('isUniqueByKey gives the result, the pair and the error of the pairwise loop', () => {
    expect(summary.byKeyMismatches).toEqual([]);
  });

  it('every tree is keyed without falling back to the pairwise loop', () => {
    expect(summary.treesThatThrew).toEqual([]);
    expect(summary.rejectedPairs).toEqual([]);
    expect(summary.trees).toBeGreaterThanOrEqual(1000);
  });

  it('the cases cover every outcome on short and on long arrays', () => {
    expect(summary.long.true).toBeGreaterThanOrEqual(100);
    expect(summary.long.false).toBeGreaterThanOrEqual(100);
    expect(summary.long.throw).toBeGreaterThanOrEqual(100);
    expect(summary.short.true).toBeGreaterThanOrEqual(100);
    expect(summary.short.false).toBeGreaterThanOrEqual(100);
    expect(summary.short.throw).toBeGreaterThanOrEqual(100);
  });
});

describe('firstPairByKey', () => {
  it('reports the first pair of equal items', () => {
    expect(firstPairByKey([{ a: 1 }, { b: 1 }, { a: 1 }], DEFAULT_MAX_RECURSION_DEPTH)).toEqual([0, 2]);
  });

  it('reports nothing for distinct items', () => {
    expect(firstPairByKey([{ a: 1 }, { b: 1 }], DEFAULT_MAX_RECURSION_DEPTH)).toBeUndefined();
  });

  // Two items made of the same characters in the same order, divided differently.
  const lookalikes: Array<[string, unknown[]]> = [
    [
      'neighbouring strings',
      [
        ['as', 'b'],
        ['a', 'sb'],
      ],
    ],
    ['nested arrays', [[[1], 2], [[1, 2]]]],
    [
      'neighbouring keys',
      [
        { a: 1, bc: 2 },
        { ab: 1, c: 2 },
      ],
    ],
  ];

  it.each(lookalikes)('keeps %s apart', (_name, items) => {
    expect(firstPairByKey(items, DEFAULT_MAX_RECURSION_DEPTH)).toBeUndefined();
  });
});

describe('isUniqueArray on long arrays', () => {
  it('accepts 50,000 distinct objects', () => {
    expect(isUniqueArray(idItems(50_000))).toBe(true);
  });

  it('accepts distinct numbers followed by an object', () => {
    const arr: unknown[] = numberRow(50_000);
    arr.push({});
    expect(isUniqueArray(arr)).toBe(true);
  });

  it('reports a repeated number among numbers followed by an object', () => {
    const arr: unknown[] = numberRow(50_000);
    arr[40_000] = 7;
    arr.push({});
    const indexes: number[] = [];
    expect(isUniqueArray(arr, indexes)).toBe(false);
    expect(indexes).toEqual([7, 40_000]);
  });

  it('reports a copy of the first object at the end', () => {
    const arr: unknown[] = idItems(50_000);
    arr.push({ id: 0 });
    const indexes: number[] = [];
    expect(isUniqueArray(arr, indexes)).toBe(false);
    expect(indexes).toEqual([0, 50_000]);
  });

  it('reports the smallest first index among several copies', () => {
    const arr: unknown[] = idItems(50_000);
    arr[30_000] = { id: 5 };
    arr[40_000] = { id: 5 };
    arr[45_000] = { id: 2 };
    const indexes: number[] = [];
    expect(isUniqueArray(arr, indexes)).toBe(false);
    expect(indexes).toEqual([2, 45_000]);
  });

  it('throws at the depth limit like the pairwise reference', () => {
    const arr: unknown[] = [];
    for (let i = 0; i < 20_000; i++) {
      arr.push(objectChain(8));
    }
    const expected = outcomeOf(referencePairwise, arr, 5);
    expect(expected).toMatchObject({
      result: 'throw',
      message: expect.stringContaining('Maximum recursion depth (5)'),
    });
    expect(outcomeOf(isUniqueArray, arr, 5)).toEqual(expected);
  });

  it('matches the reference when items differ only after the depth limit', () => {
    const arr: unknown[] = [];
    for (let i = 0; i < 2000; i++) {
      arr.push(numberRow(100, i));
    }
    const expected = outcomeOf(referencePairwise, arr, 1);
    const actual = outcomeOf(isUniqueArray, arr, 1);
    expect(actual).toEqual(expected);
  });
});

/**
 * `items` are unique. With a copy of `items[source]` in place of the last item, that pair is reported. The
 * pairwise loop says the same both times.
 */
const expectUniqueThenCopy = (items: unknown[], source: number): void => {
  const unique = { result: true, indexes: [] };
  expect(outcomeOf(isUniqueArray, items, undefined)).toEqual(unique);
  expect(outcomeOf(referencePairwise, items, undefined)).toEqual(unique);

  const last = items.length - 1;
  const withCopy = items.slice();
  withCopy[last] = structuredClone(items[source]);
  const reported = { result: false, indexes: [source, last] };
  expect(outcomeOf(isUniqueArray, withCopy, undefined)).toEqual(reported);
  expect(outcomeOf(referencePairwise, withCopy, undefined)).toEqual(reported);
};

describe('isUniqueArray around the pairwise limit', () => {
  const lengths = [-1, 0, 1, 2].map((delta) => PAIRWISE_MAX_ITEMS + delta);

  it.each(lengths)('handles %i items', (length) => {
    const items: unknown[] = [];
    for (let i = 0; i < length; i++) {
      items.push({ id: i, tags: [i] });
    }
    expectUniqueThenCopy(items, 3);
  });
});

describe('isUniqueArray with items that are not plain trees', () => {
  it('gives the pairwise result for the values as they are after keying', () => {
    const arr = idItems(PADDED_ITEMS);
    let reads = 0;
    arr[0] = { v: 1 };
    arr[1] = {};
    Object.defineProperty(arr[1], 'v', {
      enumerable: true,
      get() {
        reads++;
        return reads === 1 ? 1 : 2;
      },
    });
    const actual = outcomeOf(isUniqueArray, arr, undefined);
    const expected = outcomeOf(referencePairwise, arr, undefined);
    expect(actual).toEqual(expected);
    expect(actual).toEqual({ result: true, indexes: [] });
  });

  it('gives the pairwise result after a property failed on its first read only', () => {
    const arr = idItems(PADDED_ITEMS);
    let reads = 0;
    arr[0] = { v: 1 };
    arr[1] = {};
    Object.defineProperty(arr[1], 'v', {
      enumerable: true,
      get() {
        reads++;
        if (reads === 1) {
          throw new Error('first read failed');
        }
        return 1;
      },
    });
    const actual = outcomeOf(isUniqueArray, arr, undefined);
    const expected = outcomeOf(referencePairwise, arr, undefined);
    expect(actual).toEqual(expected);
    expect(actual).toEqual({ result: false, indexes: [0, 1] });
  });

  it('does not throw for a property that throws when read', () => {
    const arr = idItems(PADDED_ITEMS);
    arr[10] = {
      get v(): number {
        throw new Error('unreadable');
      },
    };
    expect(isUniqueArray(arr)).toBe(true);
  });

  it('throws what a property throws when the pairwise loop reads it too', () => {
    const arr = idItems(PADDED_ITEMS);
    arr[0] = { v: 1 };
    arr[1] = {};
    Object.defineProperty(arr[1], 'v', {
      enumerable: true,
      get(): number {
        throw new Error('read failed');
      },
    });
    const actual = outcomeOf(isUniqueArray, arr, undefined);
    const expected = outcomeOf(referencePairwise, arr, undefined);
    expect(actual).toEqual({ result: 'throw', indexes: [], message: 'read failed' });
    expect(expected).toEqual(actual);
  });

  it('reports the pair for long items that share an object', () => {
    const sharedList = numberRow(40);
    const arr: unknown[] = [];
    for (let i = 0; i < PADDED_ITEMS; i++) {
      arr.push({ a: sharedList });
    }
    const actual = outcomeOf(isUniqueArray, arr, undefined);
    expect(actual).toEqual({ result: false, indexes: [0, 1] });
    expect(actual).toEqual(outcomeOf(referencePairwise, arr, undefined));
  });

  it('matches the reference for self-containing arrays', () => {
    const arr: unknown[] = [];
    for (let i = 0; i < PADDED_ITEMS; i++) {
      const self: unknown[] = [];
      self.push(self);
      arr.push(self);
    }
    const expected = outcomeOf(referencePairwise, arr, undefined);
    expect(expected.result).toBe('throw');
    expect(outcomeOf(isUniqueArray, arr, undefined)).toEqual(expected);
  });

  it('reports a shared reference', () => {
    const arr = idItems(PADDED_ITEMS);
    arr[41] = arr[20];
    const indexes: number[] = [];
    expect(isUniqueArray(arr, indexes)).toBe(false);
    expect(indexes).toEqual([20, 41]);
  });

  it('reports one-item arrays holding the same object with NaN', () => {
    const inner = { n: Number.NaN };
    const arr: unknown[] = [];
    for (let i = 0; i < PADDED_ITEMS; i++) {
      arr.push([inner]);
    }
    const indexes: number[] = [];
    expect(isUniqueArray(arr, indexes)).toBe(false);
    expect(indexes).toEqual([0, 1]);
  });
});

const DIGITS = /^[0-9]+$/;

const countingRow = (first: number, counter: { reads: number }): number[] => {
  const values = numberRow(1000);
  values[0] = first;
  return new Proxy(values, {
    get(target, prop, receiver) {
      if (typeof prop === 'string' && DIGITS.test(prop)) {
        counter.reads++;
      }
      return Reflect.get(target, prop, receiver);
    },
  });
};

const rowBuilders: Array<[string, (length: number, last: number) => unknown]> = [
  ['arrays of numbers', numberRow],
  ['objects with numbered keys', recordRow],
];
const valueCounts = [-2, -1, 0, 1, 2, 3].map((delta) => PREFIX_MAX_VALUES + delta);

describe('isUniqueArray reads long items only when needed', () => {
  it('does not read distinct items to the end', () => {
    const counter = { reads: 0 };
    const items: unknown[] = [];
    for (let i = 0; i < PADDED_ITEMS; i++) {
      items.push(countingRow(i, counter));
    }
    expect(isUniqueArray(items)).toBe(true);
    // The prefix pass reads PREFIX_MAX_VALUES values of each row. The bound has no slack on purpose.
    expect(counter.reads).toBeLessThanOrEqual(items.length * PREFIX_MAX_VALUES);
  });

  it('reads items that share their first values to the end', () => {
    const items: unknown[] = [];
    for (let i = 0; i < 5000; i++) {
      items.push(numberRow(PREFIX_MAX_VALUES + 8, 1000 + i));
    }
    expect(isUniqueArray(items)).toBe(true);

    const withCopy = items.slice();
    withCopy[4999] = numberRow(PREFIX_MAX_VALUES + 8, 1000 + 7);
    const indexes: number[] = [];
    expect(isUniqueArray(withCopy, indexes)).toBe(false);
    expect(indexes).toEqual([7, 4999]);
  });

  describe.each(rowBuilders)('%s', (_name, row) => {
    it.each(valueCounts)('handles items of %i values', (length) => {
      const items: unknown[] = [];
      for (let i = 0; i < PAIRWISE_MAX_ITEMS + 8; i++) {
        items.push(row(length, 1000 + i));
      }
      expectUniqueThenCopy(items, 4);
    });
  });

  it('accepts many items that share a prefix', () => {
    const items: unknown[] = [];
    for (let i = 0; i < 50_000; i++) {
      items.push(numberRow(PREFIX_MAX_VALUES + 2, 1000 + i));
    }
    expect(isUniqueArray(items)).toBe(true);
  });
});
