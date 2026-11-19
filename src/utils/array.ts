import { DEFAULT_MAX_RECURSION_DEPTH } from './constants.js';
import { areEqual, sortedKeys } from './json.js';

/** Arrays holding objects are compared pair by pair up to this many items, and by key above it. */
const PAIRWISE_MAX_ITEMS = 32;

/** Values the prefix pass writes for an item before it stops. */
const PREFIX_VALUES = 32;

const NO_PAIR: readonly number[] = [];

/**
 * State of the key writer, one per `isUniqueByKey` call.
 *
 * An item's key is written in the order `areEqual` compares two values: an array as its length and then its
 * items; an object as the number of its keys, the sorted keys, and then the values in that order.
 *
 * At its depth limit `areEqual` stops comparing by value: two values are equal there only when they are
 * identical, and any other pair makes it throw. Such a position is written as a separate limit token (the value
 * for a primitive, an identity number for an object). A key is therefore a list of alternating segments and
 * limit tokens, `[segment, token, segment, …, segment]`, and for two items:
 *
 * - a difference inside a segment means `areEqual` returns `false`;
 * - equal segments followed by different tokens mean `areEqual` throws;
 * - equal segments and tokens throughout mean the items are equal.
 *
 * Only trees are keyed: an object or array reached a second time sets `shared`.
 *
 * Keys are written in two passes. The prefix pass gives every item the beginning of its first segment: writing
 * stops after `PREFIX_VALUES` values or at the first limit token. Items with different prefixes differ inside a
 * segment, so `areEqual` returns `false` for them. A prefix that was not stopped is the whole key, so items with
 * the same one are equal. Whether writing stops depends only on what was written before, so items with the same
 * prefix were all stopped or all not stopped; the stopped ones get a full key in the second pass. The partners of
 * an item all share its prefix, so exactly one of the two passes settles each item. The prefix pass records no
 * objects, so its budget bounds it even on a cycle.
 */
interface KeyState {
  /** Values the prefix pass may still write for the current item. */
  budget: number;
  /** Identity numbers of objects, created on first use. */
  ids: Map<unknown, number> | undefined;
  /** The depth at which `areEqual` stops comparing by value. */
  limit: number;
  /** Next identity number. */
  nextId: number;
  /** The segment being written. */
  out: string;
  /** Finished segments and limit tokens of the current item, alternating. */
  parts: string[];
  /** `true` in the prefix pass: writing stops at the budget or at the first limit token, and no objects are recorded. */
  prefix: boolean;
  /** Objects and arrays written so far, over all items. */
  seen: Set<unknown>;
  /** Set when an object or array is reached a second time (a shared reference or a cycle). */
  shared: boolean;
  /** Set when writing the current item ended early: the budget ran out, the prefix reached a limit token, or `shared` was set. */
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

/** Text of a value that is not an object or array. Equal texts mean the two values are identical (`===`). */
const primitiveToken = (st: KeyState, v: unknown, parent: unknown): string => {
  // oxlint-disable-next-line default-case -- the cases cover every typeof result
  switch (typeof v) {
    case 'string': {
      return `s${v.length}:${v}`;
    }
    case 'number': {
      if (Number.isNaN(v)) {
        // NaN equals nothing, unless areEqual never looks at it because both sides are the same parent object.
        // The parent's identity says exactly that; a NaN item has no parent and gets a number of its own.
        return `N${parent === undefined ? st.nextId++ : identityOf(st, parent)};`;
      }
      // -0 and 0 are written alike, as areEqual treats them.
      return `n${v};`;
    }
    case 'boolean': {
      return v ? 't' : 'f';
    }
    case 'undefined': {
      return 'u';
    }
    case 'bigint': {
      return `b${v};`;
    }
    case 'object': {
      // only null gets here
      return 'l';
    }
    case 'function':
    case 'symbol': {
      // functions and symbols are equal only to themselves
      return `r${identityOf(st, v)};`;
    }
  }
};

/** Ends the current segment with a limit token. */
const writeLimitToken = (st: KeyState, token: string): void => {
  st.parts.push(st.out, token);
  st.out = '';
};

const writeKey = (st: KeyState, v: unknown, depth: number, parent: unknown): void => {
  if (st.prefix && st.budget-- <= 0) {
    st.stopped = true;
    return;
  }
  const isRef = v !== null && typeof v === 'object';
  if (depth >= st.limit) {
    // areEqual: identical, or it throws
    if (st.prefix) {
      st.stopped = true;
    } else {
      writeLimitToken(st, isRef ? `r${identityOf(st, v)};` : primitiveToken(st, v, parent));
    }
    return;
  }
  if (!isRef) {
    st.out += primitiveToken(st, v, parent);
    return;
  }
  if (!st.prefix) {
    if (st.seen.has(v)) {
      st.shared = true;
      st.stopped = true;
      return;
    }
    st.seen.add(v);
  }
  if (Array.isArray(v)) {
    const len = v.length;
    st.out += `A${len}:`;
    for (let i = 0; i < len && !st.stopped; i++) {
      writeKey(st, v[i], depth + 1, v);
    }
    return;
  }
  st.out += 'O';
  if (depth + 1 >= st.limit) {
    // areEqual compares the two key lists at depth + 1; they are never the same array, so it throws
    if (st.prefix) {
      st.stopped = true;
    } else {
      writeLimitToken(st, `r${identityOf(st, v)};`);
    }
    return;
  }
  const obj = v as Record<string, unknown>;
  const keys = sortedKeys(obj);
  const count = keys.length;
  st.out += `${count}:`;
  if (depth + 2 >= st.limit) {
    // each key is compared at depth + 2
    if (st.prefix) {
      // with no keys there is no limit token and nothing more to write
      if (count > 0) {
        st.stopped = true;
      }
      return;
    }
    for (let i = 0; i < count; i++) {
      writeLimitToken(st, keys[i]);
    }
  } else {
    for (let i = 0; i < count; i++) {
      st.out += `${keys[i].length}:${keys[i]}`;
    }
  }
  for (let i = 0; i < count && !st.stopped; i++) {
    writeKey(st, obj[keys[i]], depth + 1, obj);
  }
};

/**
 * Keys already seen, as a trie over `[segment, token, segment, …]`. A node stands for the items that agree on
 * everything up to and including one segment.
 */
interface KeyTrie {
  /** Smallest item index that reached each node. */
  first: number[];
  /**
   * Node number by `<parent node>|<segment>`; the segment alone at the first level. The limit token between a
   * node and its child is not part of the key: only items with the node's own token go past it.
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
  let prefix = '';
  for (let k = 0; k < count; k += 2) {
    const mapKey = prefix + parts[k];
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
    prefix = `${node}|`;
  }
  return -1;
};

/**
 * The pair the pairwise loop would stop at, as `[i, j]`: the lexicographically smallest pair whose comparison
 * is not `false`. `NO_PAIR` when every comparison is `false`; `undefined` when the items are not trees.
 */
const firstPairByKey = (arr: unknown[], limit: number): readonly number[] | undefined => {
  const st: KeyState = {
    budget: 0,
    ids: undefined,
    limit,
    nextId: 0,
    out: '',
    parts: [],
    prefix: true,
    seen: new Set(),
    shared: false,
    stopped: false,
  };
  const l = arr.length;
  let first = -1;
  let second = -1;

  // Pass 1: a bounded prefix of every key.
  const firstByPrefix = new Map<string, number>();
  let needsFullKey: Uint8Array | undefined;
  for (let j = 0; j < l; j++) {
    st.out = '';
    st.budget = PREFIX_VALUES;
    st.stopped = false;
    writeKey(st, arr[j], 0, undefined);
    const earlier = firstByPrefix.get(st.out);
    if (earlier === undefined) {
      firstByPrefix.set(st.out, j);
    } else if (st.stopped) {
      // The prefix is not the whole key: both items get a full key in pass 2.
      if (needsFullKey === undefined) {
        needsFullKey = new Uint8Array(l);
      }
      needsFullKey[earlier] = 1;
      needsFullKey[j] = 1;
    } else if (first === -1 || earlier < first) {
      // The prefix is the whole key, so the two items are equal.
      first = earlier;
      second = j;
      if (first === 0) {
        break;
      }
    }
  }
  if (needsFullKey === undefined || first === 0) {
    return first === -1 ? NO_PAIR : [first, second];
  }

  // Pass 2: full keys for the items their prefix did not settle.
  const trie: KeyTrie = { first: [], nodeByKey: new Map(), token: [] };
  st.prefix = false;
  for (let j = 0; j < l; j++) {
    if (needsFullKey[j] === 1) {
      st.out = '';
      st.parts.length = 0;
      st.stopped = false;
      writeKey(st, arr[j], 0, undefined);
      if (st.shared) {
        return undefined;
      }
      st.parts.push(st.out);
      const candidate = addToTrie(trie, st.parts, j);
      if (candidate !== -1 && (first === -1 || candidate < first)) {
        first = candidate;
        second = j;
        if (first === 0) {
          break;
        }
      }
    }
  }
  return first === -1 ? NO_PAIR : [first, second];
};

/** Every pair in index order, stopping at the first comparison that is not `false`. */
const isUniquePairwise = (arr: unknown[], indexes?: number[], maxDepth?: number): boolean => {
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
 * `isUniquePairwise` with one key per item in place of one comparison per pair. Same result, same reported
 * pair, same error. `isUniqueArray` uses it above `PAIRWISE_MAX_ITEMS` items; it is exported so that tests can
 * run it on arrays of any length. An item is read to the end only when its first `PREFIX_VALUES` values do not
 * tell it apart from another item.
 */
export const isUniqueByKey = (arr: unknown[], indexes?: number[], maxDepth?: number): boolean => {
  let pair: readonly number[] | undefined;
  try {
    pair = firstPairByKey(arr, maxDepth ?? DEFAULT_MAX_RECURSION_DEPTH);
  } catch {
    // Keying reads every item on its own, so it can fail where the pairwise loop would not have looked: a
    // property that throws when read, or a stack overflow on a very deep item. The pairwise loop decides then.
    pair = undefined;
  }
  if (pair === undefined) {
    return isUniquePairwise(arr, indexes, maxDepth);
  }
  if (pair === NO_PAIR) {
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
 * An item is read to the end only when its first `PREFIX_VALUES` values do not tell it apart from another item.
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
