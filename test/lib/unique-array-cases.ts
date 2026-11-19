import { areEqual } from '../../src/utils/equality.ts';

/** Result of running an `isUniqueArray`-shaped function on one input. */
export type UniqueOutcome =
  | { result: boolean; indexes: number[] }
  | { result: 'throw'; indexes: number[]; message: string };

/** One generated input for an `isUniqueArray`-shaped function. */
export interface UniqueCase {
  arr: unknown[];
  maxDepth: number | undefined;
}

export type UniqueArrayFn = (arr: unknown[], indexes?: number[], maxDepth?: number) => boolean;

/** Lengths of the generated long arrays. A test checks that the smaller one is above `PAIRWISE_MAX_ITEMS`. */
export const LONG_MIN_ITEMS = 49;
export const LONG_MAX_ITEMS = 120;

/** The length `pad` fills an array up to, and the number of fillers `prepend` puts in front. Above `PAIRWISE_MAX_ITEMS` too. */
export const PADDED_ITEMS = 60;

/**
 * Number of values in a generated long item. The variants of one item share all values but the last, and a test
 * checks that this is more than `PREFIX_MAX_VALUES`.
 */
export const LONG_ITEM_MIN_VALUES = 40;
export const LONG_ITEM_MAX_VALUES = 60;

/**
 * The pairwise loop: every pair in index order, stopping at the first comparison that is not `false`. For an
 * array that holds an object or array, this is the definition of the result, the reported pair and the error.
 * It calls the live `areEqual` on purpose: what it pins down is which pairs are compared and in which order,
 * not how two values compare.
 */
export const referencePairwise: UniqueArrayFn = (arr, indexes, maxDepth) => {
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

/** `true` when at least one item is an object or array: the arrays `referencePairwise` speaks for. */
export const holdsReference = (arr: unknown[]): boolean => {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] !== null && typeof arr[i] === 'object') {
      return true;
    }
  }
  return false;
};

/** Runs `fn` with a fresh indexes array and captures result, indexes and thrown message. */
export const outcomeOf = (fn: UniqueArrayFn, arr: unknown[], maxDepth: number | undefined): UniqueOutcome => {
  const indexes: number[] = [];
  try {
    const result = fn(arr, indexes, maxDepth);
    return { result, indexes };
  } catch (error) {
    return { result: 'throw', indexes, message: error instanceof Error ? error.message : String(error) };
  }
};

/** `true` when two outcomes have the same result, the same indexes and, for a throw, the same message. */
export const sameOutcome = (a: UniqueOutcome, b: UniqueOutcome): boolean => {
  if (a.result !== b.result || a.indexes.length !== b.indexes.length) {
    return false;
  }
  for (let i = 0; i < a.indexes.length; i++) {
    if (a.indexes[i] !== b.indexes[i]) {
      return false;
    }
  }
  return a.result !== 'throw' || b.result !== 'throw' || a.message === b.message;
};

const buildChain = (shape: boolean[], leaf: unknown): unknown => {
  let v = leaf;
  for (let i = 0; i < shape.length; i++) {
    v = shape[i] ? { k: v } : [v];
  }
  return v;
};

/** `depth` objects nested under the key `k`, around `leaf`. */
export const objectChain = (depth: number, leaf: unknown = 1): unknown =>
  buildChain(
    Array.from({ length: depth }, () => true),
    leaf
  );

/** `count` distinct objects `{ id: 0 }`, `{ id: 1 }`, … */
export const idItems = (count: number): Array<Record<string, unknown>> => {
  const out: Array<Record<string, unknown>> = [];
  for (let i = 0; i < count; i++) {
    out.push({ id: i });
  }
  return out;
};

/** `count` distinct strings `filler-0`, `filler-1`, … */
export const stringFillers = (count: number): string[] => {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(`filler-${i}`);
  }
  return out;
};

/** A copy of `arr` followed by string fillers, `PADDED_ITEMS` items in all (or `arr.length` if that is more). */
export const pad = (arr: unknown[]): unknown[] => arr.concat(stringFillers(Math.max(0, PADDED_ITEMS - arr.length)));

/** `PADDED_ITEMS` string fillers followed by `arr`. */
export const prepend = (arr: unknown[]): unknown[] => {
  const out: unknown[] = stringFillers(PADDED_ITEMS);
  return out.concat(arr);
};

/** The numbers `0 … length - 2` followed by `last`. With the default `last` it is `0 … length - 1`. */
export const numberRow = (length: number, last: number = length - 1): number[] => {
  const row: number[] = [];
  for (let i = 0; i < length - 1; i++) {
    row.push(i);
  }
  row.push(last);
  return row;
};

/** An object with `length` keys `k00`, `k01`, …; the values are those of `numberRow(length, last)`. */
export const recordRow = (length: number, last: number = length - 1): Record<string, number> => {
  const row: Record<string, number> = {};
  for (let i = 0; i < length - 1; i++) {
    row[`k${String(i).padStart(2, '0')}`] = i;
  }
  row[`k${String(length - 1).padStart(2, '0')}`] = last;
  return row;
};

interface Rng {
  /** Integer in [0, n). */
  int: (n: number) => number;
  /** Integer in [lo, hi]. */
  range: (lo: number, hi: number) => number;
  /** True with probability p. */
  chance: (p: number) => boolean;
}

const createRng = (seed: number): Rng => {
  let state = seed % 4_294_967_296;
  const nextFloat = (): number => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return state / 4_294_967_296;
  };
  return {
    int: (n) => Math.floor(nextFloat() * n),
    range: (lo, hi) => lo + Math.floor(nextFloat() * (hi - lo + 1)),
    chance: (p) => nextFloat() < p,
  };
};

const KEYS = ['a', 'b', 'c', 'd'];
const ODD_KEYS = ['', '1', '1:a', 'a;', '|'];

const leafFnA = (): number => 1;
const leafFnB = (): number => 2;
// Two symbols with the same description: equal as text, not identical.
const LEAF_SYMBOL_A = Symbol('leaf');
const LEAF_SYMBOL_B = Symbol('leaf');

/** Leaves that are the same value on every pick. Some look like parts of a serialized key on purpose. */
const LEAF_VALUES: unknown[] = [
  0,
  -0,
  1,
  1.5,
  10,
  Number.NaN,
  '',
  '1',
  '10',
  'a',
  '1:a',
  's1:a',
  'n1;',
  ';',
  '|',
  ',',
  true,
  false,
  null,
  undefined,
  10n,
  leafFnA,
  leafFnB,
  LEAF_SYMBOL_A,
  LEAF_SYMBOL_B,
];

/** Leaves that are a new object on every pick: equal by value to an earlier pick of the same kind, never identical. */
const LEAF_FACTORIES: Array<(rng: Rng) => unknown> = [
  (rng) => new Date(rng.int(2)),
  () => JSON.parse('{"__proto__":1}'),
  // an object without a prototype
  () => Object.assign(Object.create(null), { a: 1 }),
  () => new Map([[1, 2]]),
  () => /a/,
  // an array with two holes
  () => {
    const holes: unknown[] = [1];
    holes.length = 3;
    return holes;
  },
];

const makeLeaf = (rng: Rng): unknown => {
  const n = rng.int(LEAF_VALUES.length + LEAF_FACTORIES.length);
  return n < LEAF_VALUES.length ? LEAF_VALUES[n] : LEAF_FACTORIES[n - LEAF_VALUES.length](rng);
};

const makeKey = (rng: Rng): string =>
  rng.chance(0.3) ? ODD_KEYS[rng.int(ODD_KEYS.length)] : KEYS[rng.int(KEYS.length)];

const makeTree = (rng: Rng, depth: number): unknown => {
  if (depth <= 0 || rng.int(3) === 0) {
    return makeLeaf(rng);
  }
  const count = rng.range(1, 3);
  if (rng.chance(0.5)) {
    const items: unknown[] = [];
    for (let i = 0; i < count; i++) {
      items.push(makeTree(rng, depth - 1));
    }
    return items;
  }
  const obj: Record<string, unknown> = {};
  for (let i = 0; i < count; i++) {
    obj[makeKey(rng)] = makeTree(rng, depth - 1);
  }
  return obj;
};

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date);

/** Defines an own enumerable data property, also for the key `__proto__`. */
const setKey = (out: Record<string, unknown>, key: string, value: unknown): void => {
  Object.defineProperty(out, key, { value, enumerable: true, writable: true, configurable: true });
};

/** Deep copy; each leaf is replaced by a fresh leaf with probability p. */
const cloneMutate = (rng: Rng, v: unknown, p: number): unknown => {
  if (Array.isArray(v)) {
    const out: unknown[] = [];
    for (let i = 0; i < v.length; i++) {
      out.push(cloneMutate(rng, v[i], p));
    }
    return out;
  }
  if (v instanceof Date) {
    return rng.chance(p) ? makeLeaf(rng) : new Date(v);
  }
  if (isPlainObject(v)) {
    const out: Record<string, unknown> = {};
    const keys = Object.keys(v);
    for (let i = 0; i < keys.length; i++) {
      setKey(out, keys[i], cloneMutate(rng, v[keys[i]], p));
    }
    return out;
  }
  return rng.chance(p) ? makeLeaf(rng) : v;
};

/** Deep copy in which every object has its keys inserted in reverse order. */
const reverseKeys = (v: unknown): unknown => {
  if (Array.isArray(v)) {
    const out: unknown[] = [];
    for (let i = 0; i < v.length; i++) {
      out.push(reverseKeys(v[i]));
    }
    return out;
  }
  if (!isPlainObject(v)) {
    return v;
  }
  const out: Record<string, unknown> = {};
  const keys = Object.keys(v);
  for (let i = keys.length - 1; i >= 0; i--) {
    setKey(out, keys[i], reverseKeys(v[keys[i]]));
  }
  return out;
};

/** Distinct filler items (small objects and strings), n of them. */
const mixedFillers = (n: number): unknown[] => {
  const out: unknown[] = [];
  for (let i = 0; i < n; i++) {
    out.push(i % 2 === 0 ? { id: 1000 + i } : `filler-${1000 + i}`);
  }
  return out;
};

/** Inserts distinct filler at random positions until the array has `LONG_MIN_ITEMS` to `LONG_MAX_ITEMS` items. */
const padLong = (rng: Rng, items: unknown[]): unknown[] => {
  const target = rng.range(LONG_MIN_ITEMS, LONG_MAX_ITEMS);
  const filler = mixedFillers(Math.max(0, target - items.length));
  for (let i = 0; i < filler.length; i++) {
    items.splice(rng.int(items.length + 1), 0, filler[i]);
  }
  return items;
};

/** Seeded in-place Fisher-Yates shuffle. */
const shuffle = (rng: Rng, items: unknown[]): unknown[] => {
  for (let i = items.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    const tmp = items[i];
    items[i] = items[j];
    items[j] = tmp;
  }
  return items;
};

const makeChainItems = (rng: Rng, maxDepth: number | undefined): unknown[] => {
  const base = Number.isNaN(maxDepth) ? 5 : (maxDepth ?? 100);
  const length = Math.min(110, Math.max(0, base + rng.range(-3, 3)));
  const shape: boolean[] = [];
  for (let i = 0; i < length; i++) {
    shape.push(rng.chance(0.7));
  }
  const leafA = makeLeaf(rng);
  let leafB = makeLeaf(rng);
  if (rng.chance(0.5)) {
    leafB = rng.int(100);
  }
  const pool = [
    buildChain(shape, leafA),
    buildChain(shape, leafA),
    buildChain(shape, leafB),
    makeLeaf(rng),
    { a: buildChain(shape, leafA), b: 1 },
    { a: buildChain(shape, leafA), b: 2 },
    { a: 1, b: buildChain(shape, leafA) },
    { a: 2, b: buildChain(shape, leafA) },
    { a: 1, b: buildChain(shape, leafB) },
    { a: leafA, b: buildChain(shape, leafA) },
  ];
  const count = rng.range(2, 6);
  const items: unknown[] = [];
  for (let i = 0; i < count; i++) {
    items.push(pool[rng.int(pool.length)]);
  }
  // Items that came out as the same reference stay as they are; copy the rest half of the time.
  for (let i = 0; i < items.length; i++) {
    if (rng.chance(0.5) && items[i] !== null && typeof items[i] === 'object') {
      items[i] = cloneMutate(rng, items[i], 0);
    }
  }
  return items;
};

const makeLongItems = (rng: Rng): unknown[] => {
  const row = rng.chance(0.5) ? recordRow : numberRow;
  const size = rng.range(LONG_ITEM_MIN_VALUES, LONG_ITEM_MAX_VALUES);
  // Four rows that share every value but the last. The first and the fourth are equal.
  const variants = [row(size, 0), row(size, 1), row(size, 2), row(size, 0)];
  const count = rng.range(2, 6);
  const items: unknown[] = [];
  for (let i = 0; i < count; i++) {
    items.push(variants[rng.int(variants.length)]);
  }
  return items;
};

const makePooledItems = (rng: Rng, depth: number, count: number): unknown[] => {
  const poolSize = rng.range(3, 10);
  const pool: unknown[] = [];
  for (let i = 0; i < poolSize; i++) {
    pool.push(makeTree(rng, depth));
  }
  if (rng.chance(0.3)) {
    pool.push(reverseKeys(pool[rng.int(pool.length)]));
  }
  const items: unknown[] = [];
  if (rng.chance(0.2) && count <= pool.length) {
    // Distinct-leaning mode: each pool entry used at most once.
    for (let i = 0; i < count; i++) {
      items.push(pool[i]);
    }
    return items;
  }
  for (let i = 0; i < count; i++) {
    const picked = pool[rng.int(pool.length)];
    items.push(rng.chance(0.3) ? cloneMutate(rng, picked, 0.15) : picked);
  }
  return items;
};

const makeLargeItems = (rng: Rng): unknown[] => {
  const count = rng.range(LONG_MIN_ITEMS, LONG_MAX_ITEMS);
  if (rng.chance(0.4)) {
    return makePooledItems(rng, 2, count);
  }
  const items: unknown[] = [];
  for (let i = 0; i < count; i++) {
    items.push(rng.chance(0.5) ? { id: i, tag: 'x' } : [i, 'y']);
  }
  if (rng.chance(0.5)) {
    const from = rng.int(count);
    const to = rng.int(count);
    items[to] = cloneMutate(rng, items[from], 0);
  }
  return items;
};

/** Long array whose items are all distinct: a counter sits at a nested position of every item. */
const makeUniqueLargeItems = (rng: Rng): unknown[] => {
  const count = rng.range(LONG_MIN_ITEMS, LONG_MAX_ITEMS);
  const items: unknown[] = [];
  for (let i = 0; i < count; i++) {
    switch (rng.int(4)) {
      case 0: {
        items.push({ a: [makeTree(rng, 2), i] });
        break;
      }
      case 1: {
        items.push([{ x: i }, makeTree(rng, 1)]);
        break;
      }
      case 2: {
        items.push({ n: { m: [i, makeTree(rng, 1)] }, t: makeTree(rng, 2) });
        break;
      }
      default: {
        items.push(`u${i}`);
      }
    }
  }
  return items;
};

const makeSharedItems = (rng: Rng): unknown[] => {
  const shared = makeTree(rng, 2);
  const cyclic: unknown[] = [1];
  cyclic.push(cyclic);
  const otherCyclic: unknown[] = [1];
  otherCyclic.push(otherCyclic);
  const candidates: unknown[] = [
    shared,
    [shared, shared],
    { a: shared, b: shared },
    cyclic,
    otherCyclic,
    [1, cyclic],
    cloneMutate(rng, shared, 0),
    reverseKeys(shared),
  ];
  const count = rng.range(2, 5);
  const items: unknown[] = [];
  for (let i = 0; i < count; i++) {
    items.push(candidates[rng.int(candidates.length)]);
  }
  if (rng.chance(0.2)) {
    items.push(items);
  }
  return items;
};

const makeLeafItems = (rng: Rng): unknown[] => {
  const count = rng.range(2, 12);
  const items: unknown[] = [];
  for (let i = 0; i < count; i++) {
    items.push(makeLeaf(rng));
  }
  return items;
};

/** Which `maxDepth` values a kind of case takes. */
type DepthChoice = 'default' | 'limited' | 'any';

/**
 * - `default`: always `undefined`.
 * - `limited`: `undefined`, a small integer, a small fraction, or a negative number.
 * - `any`: those, and `NaN` and `Infinity`, which mean no limit. Never for a kind that builds cycles: comparing
 *   two cycles without a limit does not end.
 */
const pickMaxDepth = (rng: Rng, choice: DepthChoice): number | undefined => {
  if (choice === 'default') {
    return undefined;
  }
  const r = rng.int(20);
  if (r < 11) {
    return undefined;
  }
  if (r === 16) {
    return rng.range(0, 8) + 0.5;
  }
  if (r === 17) {
    return -1;
  }
  if (r === 18 && choice === 'any') {
    return Number.POSITIVE_INFINITY;
  }
  if (r === 19 && choice === 'any') {
    return Number.NaN;
  }
  return rng.range(0, 8);
};

/** One kind of generated case. `weight` is its share of the cases. */
interface CaseKind {
  weight: number;
  depth: DepthChoice;
  make: (rng: Rng, maxDepth: number | undefined) => unknown[];
}

const maybePadLong = (rng: Rng, items: unknown[]): unknown[] => (rng.chance(0.5) ? padLong(rng, items) : items);

const CASE_KINDS: CaseKind[] = [
  // chains that end around the depth limit
  { weight: 3, depth: 'any', make: (rng, maxDepth) => maybePadLong(rng, makeChainItems(rng, maxDepth)) },
  // items that share more values than a prefix holds
  { weight: 2, depth: 'limited', make: (rng) => maybePadLong(rng, makeLongItems(rng)) },
  // shared references and cycles, short and long
  { weight: 1, depth: 'limited', make: makeSharedItems },
  { weight: 1, depth: 'limited', make: (rng) => shuffle(rng, padLong(rng, makeSharedItems(rng))) },
  { weight: 1, depth: 'any', make: makeLeafItems },
  // long arrays: all distinct, and with a possible copy
  { weight: 1, depth: 'default', make: makeUniqueLargeItems },
  { weight: 1, depth: 'any', make: makeLargeItems },
  // small pools of trees with repeats, copies and reordered keys
  { weight: 10, depth: 'any', make: (rng) => makePooledItems(rng, rng.range(1, 4), rng.range(2, 12)) },
];

const TOTAL_WEIGHT = CASE_KINDS.reduce((sum, kind) => sum + kind.weight, 0);

const pickKind = (rng: Rng): CaseKind => {
  let n = rng.int(TOTAL_WEIGHT);
  for (let i = 0; i < CASE_KINDS.length; i++) {
    if (n < CASE_KINDS[i].weight) {
      return CASE_KINDS[i];
    }
    n -= CASE_KINDS[i].weight;
  }
  return CASE_KINDS.at(-1) ?? CASE_KINDS[0];
};

/** Seeded, deterministic corpus of inputs for comparing `isUniqueArray` implementations. */
export const generateCases = (seed: number, count: number): UniqueCase[] => {
  const rng = createRng(seed);
  const cases: UniqueCase[] = [];
  for (let n = 0; n < count; n++) {
    const kind = pickKind(rng);
    const maxDepth = pickMaxDepth(rng, kind.depth);
    const arr = kind.make(rng, maxDepth);
    cases.push({ arr, maxDepth });
  }
  return cases;
};

/** `true` when no object or array can be reached twice from the items (so there is no sharing and no cycle). */
export const isTree = (arr: unknown[]): boolean => {
  const seen = new Set<object>();
  const stack: unknown[] = [];
  for (let i = 0; i < arr.length; i++) {
    stack.push(arr[i]);
  }
  while (stack.length > 0) {
    const v = stack.pop();
    if (v === null || typeof v !== 'object') {
      continue;
    }
    if (seen.has(v)) {
      return false;
    }
    seen.add(v);
    const keys = Object.keys(v);
    for (let i = 0; i < keys.length; i++) {
      stack.push((v as Record<string, unknown>)[keys[i]]);
    }
  }
  return true;
};
