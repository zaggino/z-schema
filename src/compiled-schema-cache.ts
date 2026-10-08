import type { JsonSchema, JsonSchemaInternal } from './json-schema-versions.js';
import type { ZSchemaOptions } from './z-schema-options.js';

import { isInternalKey, NON_SCHEMA_KEYWORDS_SET } from './json-schema.js';
import { MAX_COMPILED_SCHEMA_CACHE_KEY_LENGTH, MAX_COMPILED_SCHEMA_CACHE_SIZE } from './utils/constants.js';

let globalSchemaStateGeneration = 0;

/**
 * Invalidates every compiled-schema cache entry in every validator instance.
 * Call whenever process-wide state that affects schema compilation or schema
 * validation changes (global formats, global schema cache, schema reader).
 */
export function bumpGlobalSchemaStateGeneration(): void {
  globalSchemaStateGeneration++;
}

/** Returns the current global schema state generation. */
export function getGlobalSchemaStateGeneration(): number {
  return globalSchemaStateGeneration;
}

const NOT_SERIALIZABLE = new Error('value does not round-trip through JSON');

/**
 * `JSON.stringify` replacer that aborts when the schema holds a value that does not
 * round-trip through JSON (so two different schemas could share one key).
 * Inspects the original value via the holder because `toJSON` runs before the replacer.
 */
function strictReplacer(this: Record<string, unknown>, key: string, value: unknown): unknown {
  const original = this[key];
  switch (typeof original) {
    case 'undefined':
    case 'function':
    case 'symbol':
    case 'bigint': {
      throw NOT_SERIALIZABLE;
    }
    case 'number': {
      if (!Number.isFinite(original)) {
        throw NOT_SERIALIZABLE;
      }
      break;
    }
    case 'object': {
      if (original !== null) {
        const proto: unknown = Object.getPrototypeOf(original);
        if (proto !== Object.prototype && proto !== Array.prototype && proto !== null) {
          throw NOT_SERIALIZABLE;
        }
      }
      break;
    }
    case 'boolean':
    case 'string': {
      break;
    }
    default: {
      break;
    }
  }
  return value;
}

const REF_KEYS: Array<[string, string]> = [
  ['$ref', '__$refResolved'],
  ['$recursiveRef', '__$recursiveRefResolved'],
  ['$dynamicRef', '__$dynamicRefResolved'],
];

/**
 * Returns true if the compiled tree still holds a reference keyword that did not resolve
 * (compiler leaves `__$xxxResolved` undefined), or is too deep to inspect. Such a schema must
 * not be cached: a target registered later would be missed.
 */
export function hasUnresolvedRef(node: unknown, maxDepth: number, visited = new Set<unknown>(), depth = 0): boolean {
  if (node === null || typeof node !== 'object' || visited.has(node)) {
    return false;
  }
  if (depth >= maxDepth) {
    return true;
  }
  visited.add(node);
  const record = node as Record<string, unknown>;
  if (!Array.isArray(node)) {
    for (let i = 0; i < REF_KEYS.length; i++) {
      if (typeof record[REF_KEYS[i][0]] === 'string' && record[REF_KEYS[i][1]] === undefined) {
        return true;
      }
    }
  }
  const keys = Object.keys(record);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (isInternalKey(key) || NON_SCHEMA_KEYWORDS_SET.has(key)) {
      continue;
    }
    if (hasUnresolvedRef(record[key], maxDepth, visited, depth + 1)) {
      return true;
    }
  }
  return false;
}

type OptionsSnapshot = Record<string, unknown>;

function snapshotOptions(options: ZSchemaOptions): OptionsSnapshot {
  const snapshot: OptionsSnapshot = {};
  const source = options as Record<string, unknown>;
  const keys = Object.keys(source);
  for (let i = 0; i < keys.length; i++) {
    snapshot[keys[i]] = source[keys[i]];
  }
  const { customFormats } = options;
  if (customFormats && typeof customFormats === 'object') {
    snapshot.customFormats = { ...customFormats };
  }
  return snapshot;
}

function sameShallow(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) {
    return false;
  }
  for (let i = 0; i < keys.length; i++) {
    if (a[keys[i]] !== b[keys[i]] || !(keys[i] in b)) {
      return false;
    }
  }
  return true;
}

function sameOptions(snapshot: OptionsSnapshot, snapshotKeyCount: number, options: ZSchemaOptions): boolean {
  const current = options as Record<string, unknown>;
  const keys = Object.keys(current);
  if (keys.length !== snapshotKeyCount) {
    return false;
  }
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const was = snapshot[key];
    const now = current[key];
    if (key === 'customFormats' && was && now && typeof was === 'object' && typeof now === 'object') {
      if (!sameShallow(was as Record<string, unknown>, now as Record<string, unknown>)) {
        return false;
      }
    } else if (was !== now || !(key in snapshot)) {
      return false;
    }
  }
  return true;
}

interface CompiledSchemaEntry {
  schema: JsonSchemaInternal;
  generation: number;
  options: OptionsSnapshot;
  optionsKeyCount: number;
}

/**
 * Per-instance cache mapping a schema object's structural key
 * (`JSON.stringify`) to its compiled and validated clone. Bounded by entry
 * count and total key length, with FIFO eviction.
 *
 * Coherence with the instance schema cache is owner-tracked: while a cache miss
 * compiles schema `K`, mappings it writes are owned by `K`. Replacing a mapping
 * that another owner (or a non-cached call) wrote clears every entry, so a hit
 * can never see a `$ref` target that the uncached path would resolve differently.
 */
export class CompiledSchemaCache {
  private readonly entries = new Map<string, CompiledSchemaEntry>();
  private totalKeyLength = 0;
  private currentOwner: string | undefined;
  private readonly owners = new Map<string, string>();
  // `null` records a pinned schema that cannot be keyed, so it is not re-stringified on every call.
  private readonly pinnedKeys = new WeakMap<object, string | null>();

  /**
   * Computes the structural cache key of a schema.
   * @returns The key, or `undefined` when the schema cannot be keyed faithfully (circular, or
   * containing values that do not round-trip through JSON such as `NaN`, `undefined`, Dates).
   */
  keyOf(schema: JsonSchema): string | undefined {
    const pinned = this.pinnedKeys.get(schema);
    if (pinned !== undefined) {
      return pinned ?? undefined;
    }
    try {
      return JSON.stringify(schema, strictReplacer);
    } catch {
      return undefined;
    }
  }

  /**
   * Computes and remembers the key of a schema object that is never mutated afterwards (the private
   * snapshot behind `compile()`), so later {@link keyOf} calls for it skip `JSON.stringify`.
   */
  pinKey(schema: JsonSchema): string | undefined {
    const key = this.keyOf(schema);
    this.pinnedKeys.set(schema, key ?? null);
    return key;
  }

  /** Marks `key` as the schema being compiled on a miss; pair with {@link endOwner} in a finally. */
  beginOwner(key: string | undefined): void {
    this.currentOwner = key;
  }

  /** Ends the owner scope started by {@link beginOwner}. */
  endOwner(): void {
    this.currentOwner = undefined;
  }

  /** Called by the instance schema cache on every mapping write. */
  onScacheWrite(remotePath: string, prev: JsonSchemaInternal | undefined, next: JsonSchemaInternal): void {
    if (prev === next) {
      return;
    }
    const owner = this.currentOwner;
    if (prev !== undefined && (owner === undefined || this.owners.get(remotePath) !== owner)) {
      this.clear();
    }
    if (owner === undefined) {
      this.owners.delete(remotePath);
    } else {
      this.owners.set(remotePath, owner);
    }
  }

  /**
   * Looks up a compiled schema. Stale entries (global generation changed, or the
   * instance options differ from those at store time) are dropped.
   */
  get(key: string, options: ZSchemaOptions): JsonSchemaInternal | undefined {
    const entry = this.entries.get(key);
    if (entry === undefined) {
      return undefined;
    }
    if (
      entry.generation === globalSchemaStateGeneration &&
      sameOptions(entry.options, entry.optionsKeyCount, options)
    ) {
      return entry.schema;
    }
    this.delete(key);
    return undefined;
  }

  /** Stores a compiled and validated schema, evicting the oldest entries to stay within bounds. */
  set(key: string, schema: JsonSchemaInternal, options: ZSchemaOptions): void {
    if (key.length > MAX_COMPILED_SCHEMA_CACHE_KEY_LENGTH) {
      return;
    }
    if (this.entries.has(key)) {
      this.delete(key);
    }
    while (
      this.entries.size > 0 &&
      (this.entries.size >= MAX_COMPILED_SCHEMA_CACHE_SIZE ||
        this.totalKeyLength + key.length > MAX_COMPILED_SCHEMA_CACHE_KEY_LENGTH)
    ) {
      this.delete(this.entries.keys().next().value!);
    }
    const snapshot = snapshotOptions(options);
    this.entries.set(key, {
      schema,
      generation: globalSchemaStateGeneration,
      options: snapshot,
      optionsKeyCount: Object.keys(snapshot).length,
    });
    this.totalKeyLength += key.length;
  }

  /** Drops all entries (owner bookkeeping is kept). */
  clear(): void {
    this.entries.clear();
    this.totalKeyLength = 0;
  }

  private delete(key: string): void {
    if (this.entries.delete(key)) {
      this.totalKeyLength -= key.length;
    }
  }
}
