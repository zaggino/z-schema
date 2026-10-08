import type { JsonSchema, JsonSchemaInternal } from './json-schema-versions.js';
import type { SchemaCache } from './schema-cache.js';

import { MAX_COMPILED_SCHEMA_CACHE_KEY_LENGTH, MAX_COMPILED_SCHEMA_CACHE_SIZE } from './utils/constants.js';
import { getSafeRemotePath } from './utils/uri.js';

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

interface CompiledSchemaEntry {
  schema: JsonSchemaInternal;
  generation: number;
}

/**
 * Per-instance cache mapping a schema object's structural key
 * (`JSON.stringify`) to its compiled and validated clone. Bounded by entry
 * count and total key length, with FIFO eviction.
 */
export class CompiledSchemaCache {
  private readonly entries = new Map<string, CompiledSchemaEntry>();
  private totalKeyLength = 0;

  /**
   * Computes the structural cache key of a schema.
   * @returns The key, or `undefined` when the schema cannot be serialized (e.g. circular).
   */
  keyOf(schema: JsonSchema): string | undefined {
    try {
      return JSON.stringify(schema);
    } catch {
      return undefined;
    }
  }

  /**
   * Looks up a compiled schema. Stale entries (global generation changed, or the
   * schema's id is no longer mapped to it in the instance cache) are dropped.
   */
  get(key: string, scache: SchemaCache): JsonSchemaInternal | undefined {
    const entry = this.entries.get(key);
    if (entry === undefined) {
      return undefined;
    }
    const { schema } = entry;
    if (entry.generation === globalSchemaStateGeneration) {
      const { id } = schema;
      if (typeof id !== 'string') {
        return schema;
      }
      const remotePath = getSafeRemotePath(id);
      if (remotePath && scache.cache[remotePath] === schema) {
        return schema;
      }
    }
    this.delete(key);
    return undefined;
  }

  /** Stores a compiled and validated schema, evicting the oldest entries to stay within bounds. */
  set(key: string, schema: JsonSchemaInternal): void {
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
    this.entries.set(key, { schema, generation: globalSchemaStateGeneration });
    this.totalKeyLength += key.length;
  }

  /** Drops all entries. */
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
