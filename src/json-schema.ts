import type { JsonSchema, JsonSchemaInternal } from './json-schema-versions.js';
import type { Reference } from './schema-compiler.js';
import type { ZSchemaOptions } from './z-schema-options.js';

import { cloneDepthError } from './utils/clone.js';
import { DEFAULT_MAX_RECURSION_DEPTH } from './utils/constants.js';
import { defineOwn } from './utils/properties.js';
import { getRemotePath, isAbsoluteUri } from './utils/uri.js';
import { isObject } from './utils/what-is.js';

/**
 * Keywords whose values are not JSON Schema sub-schemas and must not be
 * traversed during schema walking (id collection, reference collection, etc.).
 */
export const NON_SCHEMA_KEYWORDS = ['enum', 'const', 'default', 'examples'] as const;
export const NON_SCHEMA_KEYWORDS_SET = new Set<string>(NON_SCHEMA_KEYWORDS);

/** Returns true if the key is an internal z-schema property (prefixed with `__$`). */
export const isInternalKey = (key: string): boolean => key.startsWith('__$');

/**
 * Keywords whose value maps names to sub-schemas (or, for the two dependency keywords, to name lists). The
 * names in such a map are chosen by the schema author and are not keywords.
 */
const SCHEMA_MAP_KEYWORDS_SET = new Set<string>([
  '$defs',
  'definitions',
  'dependencies',
  'dependentRequired',
  'dependentSchemas',
  'patternProperties',
  'properties',
]);

/** Where an object sits in a schema: it is a schema, a map from names to schemas, or data. */
export const AT_SCHEMA = 0;
export const AT_MAP = 1;
export const AT_DATA = 2;
export type SchemaPosition = typeof AT_SCHEMA | typeof AT_MAP | typeof AT_DATA;

/**
 * The position of `value`, found under `key` in an object at `position`. Not for array items: an item has the
 * position of its array.
 */
export const childPosition = (position: SchemaPosition, key: string, value: unknown): SchemaPosition => {
  if (position === AT_MAP) {
    return AT_SCHEMA;
  }
  if (position === AT_SCHEMA) {
    if (NON_SCHEMA_KEYWORDS_SET.has(key)) {
      return AT_DATA;
    }
    if (SCHEMA_MAP_KEYWORDS_SET.has(key) && isObject(value)) {
      return AT_MAP;
    }
  }
  return position;
};

/**
 * {@link childPosition} for walkers that visit schemas only: the answer is `AT_DATA` for everything such a
 * walker does not enter, which is keyword data and, at a schema position, a key reserved for the library.
 */
export const walkPosition = (position: SchemaPosition, key: string, value: unknown): SchemaPosition =>
  position === AT_SCHEMA && isInternalKey(key) ? AT_DATA : childPosition(position, key, value);

/**
 * Turns a schema supplied by a caller into the library's own copy of it. It clones like `deepClone` (sorted
 * keys, shared objects cloned once, cycles kept, the same error past `maxDepth`), except that keys with the
 * reserved `__$` prefix are not copied from objects that can be schemas: z-schema keeps its own state on
 * schema objects under such keys.
 *
 * What is dropped and what is kept:
 *
 * - `__$` keys are dropped from every object that can be a schema, the values of unknown keywords included.
 *   Their values are not read.
 * - The names inside `properties`, `patternProperties`, `$defs`, `definitions`, `dependencies`,
 *   `dependentSchemas` and `dependentRequired` are kept whatever they are: a property may be called
 *   `__$compiled`. The value under such a name is a schema again.
 * - Everything under `enum`, `const`, `default` and `examples` is data and is copied as it is.
 *
 * An object reached in more than one of these three ways (as a schema, as such a map, as data) gets one clone
 * for each.
 *
 * @param schema - The schema as the caller supplied it. It is not modified.
 * @param maxDepth - Nesting allowed below `schema`.
 * @returns The clone.
 * @throws {@link Error} when the schema is nested deeper than `maxDepth`. Values under dropped keys do not count.
 */
export const cloneInputSchema = (schema: JsonSchema, maxDepth = DEFAULT_MAX_RECURSION_DEPTH): JsonSchemaInternal => {
  // One table per mode: the clones of the same object differ between modes.
  const visited: [Map<object, unknown>?, Map<object, unknown>?, Map<object, unknown>?] = [];
  const cloneNode = (node: unknown, mode: SchemaPosition, depth: number): unknown => {
    if (typeof node !== 'object' || node === null) {
      return node;
    }
    if (depth >= maxDepth) {
      throw cloneDepthError(maxDepth);
    }
    let seen = visited[mode];
    if (seen === undefined) {
      seen = new Map();
      visited[mode] = seen;
    }
    const known = seen.get(node);
    if (known !== undefined) {
      return known;
    }
    if (Array.isArray(node)) {
      const res: unknown[] = [];
      seen.set(node, res);
      for (let i = 0; i < node.length; i++) {
        res[i] = cloneNode(node[i], mode, depth + 1);
      }
      return res;
    }
    const res: Record<string, unknown> = {};
    seen.set(node, res);
    const obj = node as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      // Checked before the value is read: nothing under a reserved key is looked at.
      if (mode === AT_SCHEMA && isInternalKey(key)) {
        continue;
      }
      const value = obj[key];
      const childMode = childPosition(mode, key, value);
      // An own `__proto__` key stays an own key.
      defineOwn(res, key, cloneNode(value, childMode, depth + 1));
    }
    return res;
  };
  return cloneNode(schema, AT_SCHEMA, 0) as JsonSchemaInternal;
};

/**
 * Properties present in ALL JSON Schema drafts (04 through 2020-12) with
 * identical types.  Draft-specific additions live on the individual draft
 * interfaces in `json-schema-versions.ts`.
 */
export interface JsonSchemaCommon {
  // ── Core ────────────────────────────────────────────────────────────────
  $ref?: string;
  $schema?: string;
  title?: string;
  description?: string;
  default?: unknown;

  // ── Type / enum ─────────────────────────────────────────────────────────
  type?: string | string[];
  enum?: unknown[];
  format?: string;

  // ── Numeric ─────────────────────────────────────────────────────────────
  multipleOf?: number;
  minimum?: number;
  maximum?: number;
  /** Draft-04: `boolean` modifier on `minimum`/`maximum`. Draft-06+: standalone `number`. */
  exclusiveMinimum?: boolean | number;
  /** Draft-04: `boolean` modifier on `minimum`/`maximum`. Draft-06+: standalone `number`. */
  exclusiveMaximum?: boolean | number;

  // ── String ──────────────────────────────────────────────────────────────
  minLength?: number;
  maxLength?: number;
  pattern?: string;

  // ── Array ───────────────────────────────────────────────────────────────
  items?: JsonSchema | boolean | Array<JsonSchema | boolean>;
  additionalItems?: boolean | JsonSchema;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;

  // ── Object ──────────────────────────────────────────────────────────────
  properties?: Record<string, JsonSchema | boolean>;
  patternProperties?: Record<string, JsonSchema>;
  additionalProperties?: boolean | JsonSchema;
  required?: string[];
  minProperties?: number;
  maxProperties?: number;
  dependencies?: Record<string, string[] | JsonSchema>;

  // ── Combinators ─────────────────────────────────────────────────────────
  allOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  not?: JsonSchema;

  // ── Definitions ─────────────────────────────────────────────────────────
  definitions?: Record<string, JsonSchema>;
}

export type JsonSchemaType = 'array' | 'boolean' | 'integer' | 'null' | 'number' | 'object' | 'string';

export interface ZSchemaInternalProperties {
  __$compiled?: unknown;
  __$missingReferences?: Reference[];
  __$refResolved?: JsonSchemaInternal | boolean;
  __$dynamicRefResolved?: JsonSchemaInternal;
  __$recursiveRefResolved?: JsonSchemaInternal;
  __$resourceRoot?: JsonSchemaInternal;
  /** `$schema` was filled in with the default by the compiler, not written by the caller. */
  __$schemaDefaulted?: boolean;
  __$schemaResolved?: unknown;
  __$validated?: boolean;
  __$validationOptions?: ZSchemaOptions;
}

/**
 * The schema's id, or `undefined` when it has none or it is not a string. Callers also pass keyword
 * maps such as `properties`, where a property named `id` or `$id` holds a sub-schema, not an id.
 */
export const getId = (schema: JsonSchemaInternal): string | undefined => {
  // Draft-04 uses `id` exclusively — never return `$id` for a draft-04 schema.
  // Draft-06+ uses `$id`; fall back to `id` for backward compatibility
  // with schemas that haven't migrated to `$id` yet.
  const id: unknown =
    typeof schema.$schema === 'string' && schema.$schema.includes('draft-04') ? schema.id : (schema.$id ?? schema.id);
  return typeof id === 'string' ? id : undefined;
};

export const findId = (
  schema: JsonSchemaInternal,
  id: string,
  targetBaseUri?: string,
  currentBaseUri?: string,
  maxDepth = DEFAULT_MAX_RECURSION_DEPTH,
  _depth = 0,
  position: SchemaPosition = AT_SCHEMA
): JsonSchemaInternal | undefined => {
  // process only arrays and objects
  if (typeof schema !== 'object' || schema === null) {
    return;
  }

  // no id means root so return itself
  if (!id) {
    return schema;
  }

  if (_depth >= maxDepth) {
    throw new Error(
      `Maximum recursion depth (${maxDepth}) exceeded in findId. ` +
        'If your schema is deeply nested and valid, increase the maxRecursionDepth option.'
    );
  }

  const baseUri = currentBaseUri ?? targetBaseUri;

  // a map of names to schemas has no keywords of its own
  const isSchema = position === AT_SCHEMA;
  const schemaId = isSchema ? getId(schema) : undefined;
  let nextBaseUri = baseUri;

  if (schemaId) {
    if (isAbsoluteUri(schemaId)) {
      nextBaseUri = getRemotePath(schemaId);
    } else if (baseUri && isAbsoluteUri(baseUri)) {
      try {
        nextBaseUri = getRemotePath(new URL(schemaId, baseUri).toString());
      } catch {
        // keep existing scope when URL resolution fails
      }
    }
  }

  const inTargetBase = !targetBaseUri || nextBaseUri === targetBaseUri;

  if (inTargetBase && isSchema) {
    if (schemaId && (schemaId === id || (schemaId.startsWith('#') && schemaId.slice(1) === id))) {
      return schema;
    }
    if (schema.$anchor === id || schema.$dynamicAnchor === id) {
      return schema;
    }
  }

  let result;
  if (Array.isArray(schema)) {
    for (let i = 0; i < schema.length; i++) {
      result = findId(schema[i] as JsonSchemaInternal, id, targetBaseUri, nextBaseUri, maxDepth, _depth + 1, position);
      if (result) {
        return result;
      }
    }
  }
  if (isObject(schema)) {
    const keys = Object.keys(schema) as Array<keyof JsonSchemaInternal>;
    // Reverse iteration: when sibling sub-schemas share the same $dynamicAnchor
    // name, the LAST sibling (by key order) must win.  This is required for
    // $dynamicRef correctness — e.g. the optional test "$dynamicRef skips over
    // intermediate resources - pointer reference across resource boundary".
    for (let i = keys.length - 1; i >= 0; i--) {
      const k = keys[i];
      const child = walkPosition(position, k, schema[k]);
      if (child === AT_DATA) {
        continue;
      }
      result = findId(schema[k] as JsonSchemaInternal, id, targetBaseUri, nextBaseUri, maxDepth, _depth + 1, child);
      if (result) {
        return result;
      }
    }
  }
};
