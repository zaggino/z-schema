import { DEFAULT_MAX_RECURSION_DEPTH } from './constants.js';
import { sortedKeys } from './json.js';
import { isObject } from './what-is.js';

// This module holds the definition of equality between JSON values (`areEqual`) and the key writer that mirrors
// it (`writeKey` and its helpers). A change to one has to be made in the other.

interface AreEqualOptions {
  caseInsensitiveComparison?: boolean;
  maxDepth?: number;
}

// `writeKey` below writes values in the order this function compares them, so that `uniqueItems` can
// compare one key per item instead of every pair. It repeats, and has to keep repeating:
// - the identity check coming before the depth check (identical values never throw);
// - the order: an array's length, then its items; an object's key count and sorted keys, then its values;
// - the depths: items at depth + 1, the two key lists at depth + 1, each key at depth + 2, values at depth + 1;
// - what an object is: anything `isObject` accepts, compared by its own enumerable keys.
// `caseInsensitiveComparison` is not repeated there: unique items never use it.
// If the two drift apart, a pair the keys report wrongly is caught by the `areEqual` call that confirms it. A
// pair they miss is caught only by the generated cases in test/spec/utils.array.spec.ts.
export const areEqual = (json1: unknown, json2: unknown, options?: AreEqualOptions, _depth = 0): boolean => {
  const caseInsensitiveComparison = options?.caseInsensitiveComparison || false;
  const maxDepth = options?.maxDepth ?? DEFAULT_MAX_RECURSION_DEPTH;

  // http://json-schema.org/latest/json-schema-core.html#rfc.section.3.6

  // Two JSON values are said to be equal if and only if:
  // both are nulls; or
  // both are booleans, and have the same value; or
  // both are strings, and have the same value; or
  // both are numbers, and have the same mathematical value; or
  if (json1 === json2) {
    return true;
  }
  if (
    caseInsensitiveComparison &&
    typeof json1 === 'string' &&
    typeof json2 === 'string' &&
    json1.toUpperCase() === json2.toUpperCase()
  ) {
    return true;
  }

  if (_depth >= maxDepth) {
    throw new Error(
      `Maximum recursion depth (${maxDepth}) exceeded in areEqual. ` +
        'If your data is deeply nested and valid, increase the maxRecursionDepth option.'
    );
  }

  let i;
  let len;

  // both are arrays, and:
  if (Array.isArray(json1) && Array.isArray(json2)) {
    // have the same number of items; and
    if (json1.length !== json2.length) {
      return false;
    }
    // items at the same index are equal according to this definition; or
    len = json1.length;
    for (i = 0; i < len; i++) {
      if (!areEqual(json1[i], json2[i], options, _depth + 1)) {
        return false;
      }
    }
    return true;
  }

  // both are objects, and:
  if (isObject(json1) && isObject(json2)) {
    // have the same set of property names; and
    const keys1 = sortedKeys(json1 as Record<string, unknown>);
    const keys2 = sortedKeys(json2 as Record<string, unknown>);
    if (!areEqual(keys1, keys2, options, _depth + 1)) {
      return false;
    }
    // values for a same property name are equal according to this definition.
    len = keys1.length;
    for (i = 0; i < len; i++) {
      if (!areEqual(json1[keys1[i]], json2[keys1[i]], options, _depth + 1)) {
        return false;
      }
    }
    return true;
  }

  return false;
};

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
 * This is the twin of `areEqual` above. Change the two together.
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
