import { areEqual } from '../../src/utils/json.ts';

/** Result of running an `isUniqueArray`-shaped function on one input. */
export interface UniqueOutcome {
  result: boolean | 'throw';
  indexes: number[];
  message?: string;
}

/** One generated input for an `isUniqueArray`-shaped function. */
export interface UniqueCase {
  arr: unknown[];
  maxDepth: number | undefined;
}

export type UniqueArrayFn = (arr: unknown[], indexes?: number[], maxDepth?: number) => boolean;

/**
 * Frozen pairwise implementation of the uniqueness check. It defines the expected
 * result, reported index pair and throw behaviour; do not change it.
 */
export const referenceIsUniqueArray = (arr: unknown[], indexes?: number[], maxDepth?: number): boolean => {
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

  // Slow path: at least one element is an object/array — need deep comparison.
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
const LEAF_KINDS = 23;

const makeLeaf = (rng: Rng): unknown => {
  switch (rng.int(LEAF_KINDS)) {
    case 0: {
      return 0;
    }
    case 1: {
      return -0;
    }
    case 2: {
      return 1;
    }
    case 3: {
      return 1.5;
    }
    case 4: {
      return Number.NaN;
    }
    case 5: {
      return '';
    }
    case 6: {
      return '1';
    }
    case 7: {
      return 'a';
    }
    case 8: {
      return true;
    }
    case 9: {
      return false;
    }
    case 10: {
      return null;
    }
    case 11: {
      return undefined;
    }
    case 12: {
      return 10n;
    }
    case 13: {
      return new Date(rng.int(2));
    }
    case 14: {
      return 10;
    }
    case 15: {
      return '10';
    }
    case 16: {
      return '1:a';
    }
    case 17: {
      return 's1:a';
    }
    case 18: {
      return 'n1;';
    }
    case 19: {
      return ';';
    }
    case 20: {
      return '|';
    }
    case 21: {
      return ',';
    }
    default: {
      return JSON.parse('{"__proto__":1}');
    }
  }
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

const pickMaxDepth = (rng: Rng, allowNaN: boolean): number | undefined => {
  const r = rng.int(10);
  if (r < 6) {
    return undefined;
  }
  if (r < 9 || !allowNaN) {
    return rng.range(0, 8);
  }
  return Number.NaN;
};

/** Distinct filler items (small objects and strings), n of them. */
const makeFiller = (n: number, offset: number): unknown[] => {
  const out: unknown[] = [];
  for (let i = 0; i < n; i++) {
    out.push(i % 2 === 0 ? { id: offset + i } : `filler${offset + i}`);
  }
  return out;
};

/** Inserts distinct filler at random positions until the array has 49-120 items. */
const padLong = (rng: Rng, items: unknown[]): unknown[] => {
  const target = rng.range(49, 120);
  const filler = makeFiller(Math.max(0, target - items.length), 1000);
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

const buildChain = (shape: boolean[], leaf: unknown): unknown => {
  let v = leaf;
  for (let i = 0; i < shape.length; i++) {
    v = shape[i] ? { k: v } : [v];
  }
  return v;
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

const makeLongItem = (asObject: boolean, size: number, tailOffset: number): unknown => {
  const prefix = 35;
  if (asObject) {
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < size; i++) {
      obj[`k${String(i).padStart(2, '0')}`] = i < prefix ? i : i + tailOffset;
    }
    return obj;
  }
  const arr: unknown[] = [];
  for (let i = 0; i < size; i++) {
    arr.push(i < prefix ? i : i + tailOffset);
  }
  return arr;
};

const makeLongItems = (rng: Rng): unknown[] => {
  const asObject = rng.chance(0.5);
  const size = rng.range(40, 60);
  const variants = [
    makeLongItem(asObject, size, 0),
    makeLongItem(asObject, size, 1),
    makeLongItem(asObject, size, 2),
    makeLongItem(asObject, size, 0),
  ];
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
  const count = rng.range(49, 120);
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
  const count = rng.range(49, 120);
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

/** Seeded, deterministic corpus of inputs for comparing `isUniqueArray` implementations. */
export const generateCases = (seed: number, count: number): UniqueCase[] => {
  const rng = createRng(seed);
  const cases: UniqueCase[] = [];
  for (let n = 0; n < count; n++) {
    const kind = rng.int(20);
    let arr: unknown[];
    let maxDepth: number | undefined;
    if (kind <= 2) {
      maxDepth = pickMaxDepth(rng, true);
      arr = makeChainItems(rng, maxDepth);
      if (rng.chance(0.5)) {
        arr = padLong(rng, arr);
      }
    } else if (kind <= 4) {
      maxDepth = pickMaxDepth(rng, false);
      arr = makeLongItems(rng);
      if (rng.chance(0.5)) {
        arr = padLong(rng, arr);
      }
    } else if (kind === 5) {
      maxDepth = pickMaxDepth(rng, false);
      arr = makeSharedItems(rng);
    } else if (kind === 6) {
      maxDepth = pickMaxDepth(rng, false);
      arr = shuffle(rng, padLong(rng, makeSharedItems(rng)));
    } else if (kind === 7) {
      maxDepth = pickMaxDepth(rng, true);
      arr = makeLeafItems(rng);
    } else if (kind === 8) {
      maxDepth = undefined;
      arr = makeUniqueLargeItems(rng);
    } else if (kind === 9) {
      maxDepth = pickMaxDepth(rng, true);
      arr = makeLargeItems(rng);
    } else {
      maxDepth = pickMaxDepth(rng, true);
      arr = makePooledItems(rng, rng.range(1, 4), rng.range(2, 12));
    }
    cases.push({ arr, maxDepth });
  }
  return cases;
};
