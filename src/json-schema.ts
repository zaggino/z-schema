import type { JsonSchema, JsonSchemaInternal } from './json-schema-versions.js';
import type { Reference } from './schema-compiler.js';
import type { ZSchemaOptions } from './z-schema-options.js';

import { getRemotePath, isAbsoluteUri } from './utils/uri.js';

/**
 * Keywords whose values are not JSON Schema sub-schemas and must not be
 * traversed during schema walking (id collection, reference collection, etc.).
 */
export const NON_SCHEMA_KEYWORDS = ['enum', 'const', 'default', 'examples'] as const;

/** Returns true if the key is an internal z-schema property (prefixed with `__$`). */
export const isInternalKey = (key: string): boolean => key.startsWith('__$');
import { DEFAULT_MAX_RECURSION_DEPTH } from './utils/constants.js';
import { isObject } from './utils/what-is.js';

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
  enum?: Array<unknown>;
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
  __$refResolved?: JsonSchema;
  __$dynamicRefResolved?: JsonSchema;
  __$recursiveRefResolved?: JsonSchema;
  __$resourceRoot?: JsonSchemaInternal;
  __$schemaResolved?: unknown;
  __$validated?: boolean;
  __$validationOptions?: ZSchemaOptions;
}

export const getId = (schema: JsonSchemaInternal): string | undefined => {
  // Draft-04 uses `id` exclusively — never return `$id` for a draft-04 schema
  if (typeof schema.$schema === 'string' && schema.$schema.includes('draft-04')) {
    return schema.id;
  }
  // Draft-06+ uses `$id`; fall back to `id` for backward compatibility
  // with schemas that haven't migrated to `$id` yet.
  return schema.$id ?? schema.id;
};

export const findId = (
  schema: JsonSchemaInternal,
  id: string,
  targetBaseUri?: string,
  currentBaseUri?: string,
  maxDepth = DEFAULT_MAX_RECURSION_DEPTH,
  _depth = 0
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

  const schemaId = getId(schema);
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

  if (inTargetBase) {
    if (schemaId && (schemaId === id || (schemaId[0] === '#' && schemaId.substring(1) === id))) {
      return schema;
    }
    if (schema.$anchor === id || schema.$dynamicAnchor === id) {
      return schema;
    }
  }

  let result;
  if (Array.isArray(schema)) {
    for (let i = 0; i < schema.length; i++) {
      result = findId(schema[i], id, targetBaseUri, nextBaseUri, maxDepth, _depth + 1);
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
      if (isInternalKey(k) || NON_SCHEMA_KEYWORDS.includes(k as any)) {
        continue;
      }
      result = findId(schema[k] as JsonSchemaInternal, id, targetBaseUri, nextBaseUri, maxDepth, _depth + 1);
      if (result) {
        return result;
      }
    }
  }
};
