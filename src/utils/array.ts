import { DEFAULT_MAX_RECURSION_DEPTH } from './constants.js';
import { areEqual, sortedKeys } from './json.js';

/**
 * Arrays holding objects are compared pair by pair up to this many items, and by key above it. Measured: one
 * key per item is faster from about 8 items for arrays of objects and from about 30 for arrays of short
 * tuples. The bench cases `unique-items-objects-small` and `unique-items-objects-medium` sit on either side.
 *
 * @internal
 */
export const PAIRWISE_MAX_ITEMS = 32;

/**
 * Values the prefix pass writes for an item before it stops. Only values count: the key names of every object
 * it enters are written in full.
 *
 * @internal
 */
export const PREFIX_MAX_VALUES = 32;

/** Thrown by `writeKey` when it reaches an object or array a second time. `isUniqueByKey` catches it. */
const NOT_A_TREE = new Error('The items are not trees.');

/** State of the key writer, one per `firstPairByKey` call. */
interface KeyState {
  /** Values the prefix pass may still write for the current item. */
  budget: number;
  /** Identity numbers of objects, functions and symbols, created on first use. */
  ids: Map<unknown, number> | undefined;
  /** The depth at which `areEqual` stops comparing by value. */
  limit: number;
  /** Next identity number. Each `NaN` in a full key takes one too. */
  nextId: number;
  /** Finished segments and limit tokens of the current item, alternating. */
  parts: string[];
  /** `true` in the prefix pass, `false` in the full pass. */
  prefixPass: boolean;
  /** Objects and arrays written by the full pass, over all items. */
  seen: Set<object>;
  /** The segment being written. */
  segment: string;
  /** Set when the prefix pass stopped before the end of the current item's key. */
  stopped: boolean;
}

const identityOf = (st: KeyState, ref: unknown): number => {
  if (st.ids === undefined) {
    st.ids = new Map();
  }
  let id = st.ids.get(ref);
  if (id === undefined) {
    id = st.nextId++;
    st.ids.set(ref, id);
  }
  return id;
};

/**
 * Text of a value that is not an object or array. Two values have the same text exactly when they are identical
 * (`===`). `NaN` is identical to nothing, so it gets a new number, taken from the state, every time.
 */
const primitiveText = (st: KeyState, v: unknown): string => {
  if (typeof v === 'string') {
    return `s${v.length}:${v}`;
  }
  if (typeof v === 'number') {
    // -0 and 0 are written alike, as areEqual treats them.
    return Number.isNaN(v) ? `N${st.nextId++};` : `n${v};`;
  }
  if (typeof v === 'boolean') {
    return v ? 't' : 'f';
  }
  if (v === undefined) {
    return 'u';
  }
  if (typeof v === 'bigint') {
    return `b${v};`;
  }
  if (v === null) {
    return 'l';
  }
  // functions and symbols are identical only to themselves
  return `r${identityOf(st, v)};`;
};

/** Writes a limit token. It ends the prefix; in a full key it ends the segment. */
const writeLimitToken = (st: KeyState, token: string): void => {
  if (st.prefixPass) {
    st.stopped = true;
    return;
  }
  st.parts.push(st.segment, token);
  st.segment = '';
};

/**
 * Writes the key of `v`, a value `depth` levels inside the current item (the item itself is at depth 0).
 *
 * A key is the text of a value in the order `areEqual` compares two values: an array as its length and then
 * its items; an object as the number of its keys, the sorted keys, and then the values in that order. Every
 * part carries its length or a terminator, so no key is the beginning of another.
 *
 * At its depth limit `areEqual` stops comparing by value: two values are equal there only when they are
 * identical, and any other pair makes it throw. Such a position is written as a limit token of its own (the
 * text of a primitive, an identity number for an object). A key is therefore a list of alternating segments
 * and limit tokens, `[segment, token, segment, …, segment]`, and what `areEqual` does with two items follows
 * from the first place where their keys differ:
 *
 * - inside a segment: it returns `false`;
 * - at a limit token: it throws;
 * - nowhere: the items are equal.
 *
 * Two passes call this. The prefix pass writes the beginning of the first segment only: it stops after
 * `PREFIX_MAX_VALUES` values, at the first limit token, and at a `NaN`. It does not track visited objects; the
 * budget alone bounds it, also on a cycle. The full pass writes the whole key, and each object at most once:
 * reaching one a second time (a shared reference or a cycle) throws `NOT_A_TREE`. That keeps the work
 * proportional to the size of the items.
 *
 * This is the twin of `areEqual` in ./json.ts. Change the two together.
 */
const writeKey = (st: KeyState, v: unknown, depth: number): void => {
  if (st.prefixPass && st.budget-- <= 0) {
    st.stopped = true;
    return;
  }
  const isRef = v !== null && typeof v === 'object';
  if (depth >= st.limit) {
    // areEqual: identical, or it throws
    writeLimitToken(st, isRef ? `r${identityOf(st, v)};` : primitiveText(st, v));
    return;
  }
  if (!isRef) {
    if (st.prefixPass && Number.isNaN(v)) {
      // NaN equals nothing, unless areEqual never looks at it because both sides are the same object. A prefix
      // cannot tell which. In the full pass each NaN gets a number of its own, and an object that two items
      // share throws NOT_A_TREE, which leaves the decision to the pairwise loop.
      st.stopped = true;
      return;
    }
    st.segment += primitiveText(st, v);
    return;
  }
  if (!st.prefixPass) {
    if (st.seen.has(v)) {
      throw NOT_A_TREE;
    }
    st.seen.add(v);
  }
  if (Array.isArray(v)) {
    const len = v.length;
    st.segment += `A${len}:`;
    for (let i = 0; i < len && !st.stopped; i++) {
      writeKey(st, v[i], depth + 1);
    }
    return;
  }
  st.segment += 'O';
  if (depth + 1 >= st.limit) {
    // areEqual compares the two key lists at depth + 1; they are never the same array, so it throws
    writeLimitToken(st, `r${identityOf(st, v)};`);
    return;
  }
  const obj = v as Record<string, unknown>;
  const keys = sortedKeys(obj);
  const count = keys.length;
  st.segment += `${count}:`;
  if (depth + 2 >= st.limit) {
    // each key is compared at depth + 2
    for (let i = 0; i < count && !st.stopped; i++) {
      writeLimitToken(st, keys[i]);
    }
  } else {
    for (let i = 0; i < count; i++) {
      st.segment += `${keys[i].length}:${keys[i]}`;
    }
  }
  for (let i = 0; i < count && !st.stopped; i++) {
    writeKey(st, obj[keys[i]], depth + 1);
  }
};

/**
 * Full keys already seen, as a trie over `[segment, token, segment, …]`. A node stands for the items that agree
 * on everything up to and including one segment.
 */
interface KeyTrie {
  /** Smallest item index that reached each node. */
  first: number[];
  /**
   * Node number by `<parent node>|<segment>`; the segment alone at the first level. A first-level segment starts
   * with a type letter or is empty, never with a digit, so it cannot be taken for a deeper key. The limit token
   * between a node and its child is not part of the key: only items with the node's own token go past it.
   */
  nodeByKey: Map<string, number>;
  /**
   * The limit token that followed the node's segment in the item that created the node. Not read for a node
   * where keys end: whether a token follows a segment is decided by the segments before it, so the items
   * reaching a node either all end there or all continue.
   */
  token: string[];
}

/**
 * Adds item `j` to the trie. Returns an earlier index whose comparison with it is not `false` (the two are
 * equal, or `areEqual` throws on them), or -1 when there is none worth reporting.
 *
 * The index returned is the first item of the node where `j` ends or takes another limit token. An item that
 * follows the node's token further down may also throw against a third item that left the node earlier, but
 * that third item already formed a pair with the node's first item, which comes before it. So over all items,
 * the pair with the smallest first index is always among the pairs returned here.
 */
const addToTrie = (trie: KeyTrie, parts: string[], j: number): number => {
  const count = parts.length;
  let parentKey = '';
  for (let k = 0; k < count; k += 2) {
    const mapKey = parentKey + parts[k];
    const isLast = k + 1 === count;
    const token = isLast ? '' : parts[k + 1];
    let node = trie.nodeByKey.get(mapKey);
    if (node === undefined) {
      node = trie.first.length;
      trie.nodeByKey.set(mapKey, node);
      trie.first.push(j);
      trie.token.push(token);
    } else if (isLast || token !== trie.token[node]) {
      // Equal to the items that ended here, or throwing against the node's first item.
      return trie.first[node];
    }
    parentKey = `${node}|`;
  }
  return -1;
};

/**
 * The pair the pairwise loop would stop at, as `[i, j]`: the lexicographically smallest pair whose comparison
 * is not `false`. `undefined` when every comparison is `false`. Throws `NOT_A_TREE`, or whatever reading an
 * item throws, when keys cannot decide.
 *
 * Pass 1 writes a bounded prefix of every key. Items with different prefixes differ inside a segment. A prefix
 * that was not stopped is a whole key without limit tokens, so two items sharing one are equal. Writing stops
 * for reasons that the text written so far decides (the budget, the depth, the kind of value that comes
 * next), so the items sharing a prefix were either all stopped or all not; those that were stopped get a full
 * key in pass 2. An item's partners all share its prefix, so each item is settled by exactly one pass.
 *
 * @internal
 */
export const firstPairByKey = (arr: readonly unknown[], limit: number): readonly [number, number] | undefined => {
  const st: KeyState = {
    budget: 0,
    ids: undefined,
    limit,
    nextId: 0,
    parts: [],
    prefixPass: true,
    seen: new Set(),
    segment: '',
    stopped: false,
  };
  const l = arr.length;
  // `l` stands for "no pair yet": every index is smaller. Index 0 cannot be improved on, so both loops end there.
  let first = l;
  let second = l;

  const firstByPrefix = new Map<string, number>();
  let needsFullKey: Uint8Array | undefined;
  for (let j = 0; j < l && first !== 0; j++) {
    st.segment = '';
    st.budget = PREFIX_MAX_VALUES;
    st.stopped = false;
    writeKey(st, arr[j], 0);
    const earlier = firstByPrefix.get(st.segment);
    if (earlier === undefined) {
      firstByPrefix.set(st.segment, j);
    } else if (st.stopped) {
      if (needsFullKey === undefined) {
        needsFullKey = new Uint8Array(l);
      }
      needsFullKey[earlier] = 1;
      needsFullKey[j] = 1;
    } else if (earlier < first) {
      first = earlier;
      second = j;
    }
  }

  if (needsFullKey !== undefined && first !== 0) {
    const trie: KeyTrie = { first: [], nodeByKey: new Map(), token: [] };
    st.prefixPass = false;
    // The last prefix may have been stopped; the full pass never stops.
    st.stopped = false;
    for (let j = 0; j < l && first !== 0; j++) {
      if (needsFullKey[j] === 0) {
        continue;
      }
      st.segment = '';
      st.parts.length = 0;
      writeKey(st, arr[j], 0);
      st.parts.push(st.segment);
      const candidate = addToTrie(trie, st.parts, j);
      if (candidate !== -1 && candidate < first) {
        first = candidate;
        second = j;
      }
    }
  }
  return first === l ? undefined : [first, second];
};

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
