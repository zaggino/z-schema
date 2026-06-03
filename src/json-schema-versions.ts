import type { JsonSchemaCommon, ZSchemaInternalProperties } from './json-schema.js';

export type JsonSchemaVersion = 'draft-04' | 'draft-06' | 'draft-07' | 'draft2019-09' | 'draft2020-12';

export const CURRENT_DEFAULT_SCHEMA_VERSION: JsonSchemaVersion = 'draft2020-12';

export const VERSION_SCHEMA_URL_MAPPING: Record<JsonSchemaVersion, string> = {
  'draft-04': 'http://json-schema.org/draft-04/schema#',
  'draft-06': 'http://json-schema.org/draft-06/schema#',
  'draft-07': 'http://json-schema.org/draft-07/schema#',
  'draft2019-09': 'https://json-schema.org/draft/2019-09/schema',
  'draft2020-12': 'https://json-schema.org/draft/2020-12/schema',
};

// ---------------------------------------------------------------------------
// Public union / superset types
// ---------------------------------------------------------------------------

/** Union of all draft-specific schema interfaces — the public API type. */
export type JsonSchema =
  | JsonSchemaDraft4
  | JsonSchemaDraft6
  | JsonSchemaDraft7
  | JsonSchemaDraft201909
  | JsonSchemaDraft202012;

/**
 * Superset of ALL draft-specific properties with the widest possible types.
 * Use inside the validator where the active draft is not known at compile time.
 *
 * NOTE: this is a manually defined interface (not a computed intersection)
 * because `exclusiveMinimum` is `boolean` in Draft-04 and `number` in
 * Draft-06+, which would yield `never` in a plain intersection.
 */
export interface JsonSchemaAll extends JsonSchemaCommon {
  // ── Draft-04 ──────────────────────────────────────────────────────────
  /** Pre-`$id` identifier (draft-04 only). */
  id?: string;

  // ── Draft-06+ ─────────────────────────────────────────────────────────
  /** Schema identifier (replaces `id` from draft-06 onward). */
  $id?: string;
  const?: unknown;
  contains?: JsonSchema;
  propertyNames?: JsonSchema;
  examples?: unknown[];

  // ── Draft-07+ ─────────────────────────────────────────────────────────
  if?: JsonSchema | boolean;
  then?: JsonSchema | boolean;
  else?: JsonSchema | boolean;
  contentEncoding?: string;
  contentMediaType?: string;

  // ── Draft 2019-09+ ────────────────────────────────────────────────────
  $defs?: Record<string, JsonSchema>;
  $anchor?: string;
  $vocabulary?: Record<string, boolean>;
  $recursiveAnchor?: boolean;
  $recursiveRef?: string;
  dependentSchemas?: Record<string, JsonSchema>;
  dependentRequired?: Record<string, string[]>;
  unevaluatedItems?: JsonSchema | boolean;
  unevaluatedProperties?: JsonSchema | boolean;
  maxContains?: number;
  minContains?: number;

  // ── Draft 2020-12+ ────────────────────────────────────────────────────
  $dynamicAnchor?: string;
  $dynamicRef?: string;
  prefixItems?: Array<JsonSchema | boolean>;
}

// ---------------------------------------------------------------------------
// Internal types (schema + z-schema runtime properties)
// ---------------------------------------------------------------------------

/**
 * Sub-schema-valued keywords. On the internal type these point at
 * `JsonSchemaInternal` (rather than the public `JsonSchema`) so the validator
 * can traverse nested schemas without asserting `as JsonSchemaInternal` at
 * every step.
 */
type InternalSchemaKeys =
  | 'items'
  | 'additionalItems'
  | 'properties'
  | 'patternProperties'
  | 'additionalProperties'
  | 'dependencies'
  | 'allOf'
  | 'anyOf'
  | 'oneOf'
  | 'not'
  | 'definitions'
  | 'contains'
  | 'propertyNames'
  | 'if'
  | 'then'
  | 'else'
  | '$defs'
  | 'dependentSchemas'
  | 'unevaluatedItems'
  | 'unevaluatedProperties'
  | 'prefixItems';

/**
 * Internal schema type used throughout the validator. Based on `JsonSchemaAll`
 * so that validators can access any draft-specific property without narrowing,
 * but with every sub-schema keyword re-typed to `JsonSchemaInternal` so nested
 * traversal needs no type assertions.
 */
export type JsonSchemaInternal = Omit<JsonSchemaAll, InternalSchemaKeys> &
  ZSchemaInternalProperties & {
    items?: JsonSchemaInternal | boolean | Array<JsonSchemaInternal | boolean>;
    additionalItems?: boolean | JsonSchemaInternal;
    properties?: Record<string, JsonSchemaInternal | boolean>;
    patternProperties?: Record<string, JsonSchemaInternal>;
    additionalProperties?: boolean | JsonSchemaInternal;
    dependencies?: Record<string, string[] | JsonSchemaInternal>;
    allOf?: JsonSchemaInternal[];
    anyOf?: JsonSchemaInternal[];
    oneOf?: JsonSchemaInternal[];
    not?: JsonSchemaInternal;
    definitions?: Record<string, JsonSchemaInternal>;
    contains?: JsonSchemaInternal;
    propertyNames?: JsonSchemaInternal;
    if?: JsonSchemaInternal | boolean;
    then?: JsonSchemaInternal | boolean;
    else?: JsonSchemaInternal | boolean;
    $defs?: Record<string, JsonSchemaInternal>;
    dependentSchemas?: Record<string, JsonSchemaInternal>;
    unevaluatedItems?: JsonSchemaInternal | boolean;
    unevaluatedProperties?: JsonSchemaInternal | boolean;
    prefixItems?: Array<JsonSchemaInternal | boolean>;
  };

/** @deprecated Use `JsonSchemaInternal` — they are now equivalent. */
export type JsonSchemaInternalAll = JsonSchemaAll & ZSchemaInternalProperties;

export type JsonSchemaInternalD4 = JsonSchemaDraft4 & ZSchemaInternalProperties;
export type JsonSchemaInternalD6 = JsonSchemaDraft6 & ZSchemaInternalProperties;
export type JsonSchemaInternalD7 = JsonSchemaDraft7 & ZSchemaInternalProperties;
export type JsonSchemaInternalD201909 = JsonSchemaDraft201909 & ZSchemaInternalProperties;
export type JsonSchemaInternalD202012 = JsonSchemaDraft202012 & ZSchemaInternalProperties;

// ---------------------------------------------------------------------------
// Draft-04
// ---------------------------------------------------------------------------

/**
 * JSON Schema Draft-04.
 *
 * Key differences from later drafts:
 * - Uses `id` instead of `$id`.
 * - `exclusiveMinimum`/`exclusiveMaximum` are boolean modifiers on `minimum`/`maximum`
 *   (inherited as `boolean | number` from `JsonSchemaCommon` for cross-draft compatibility).
 * - No `const`, `contains`, `propertyNames`, `examples`, `if`/`then`/`else`.
 *
 * @see https://json-schema.org/draft-04/draft-zyp-json-schema-04
 */
export interface JsonSchemaDraft4 extends JsonSchemaCommon {
  /** Schema identifier (draft-04). Replaced by `$id` in draft-06+. */
  id?: string;
}

// ---------------------------------------------------------------------------
// Draft-06  (adds $id, const, contains, propertyNames, examples)
// ---------------------------------------------------------------------------

/**
 * JSON Schema Draft-06.
 *
 * Additions over Draft-04:
 * - `$id` replaces `id`.
 * - `exclusiveMinimum`/`exclusiveMaximum` changed to standalone `number` values.
 * - Added `const`, `contains`, `propertyNames`, `examples`.
 *
 * @see https://json-schema.org/draft-06/draft-wright-json-schema-validation-01
 */
export interface JsonSchemaDraft6 extends JsonSchemaCommon {
  $id?: string;
  const?: unknown;
  contains?: JsonSchema;
  propertyNames?: JsonSchema;
  examples?: unknown[];
}

// ---------------------------------------------------------------------------
// Draft-07  (adds if/then/else, content*)
// ---------------------------------------------------------------------------

/**
 * JSON Schema Draft-07.
 *
 * Additions over Draft-06:
 * - `if`/`then`/`else` conditional applicators.
 * - `contentEncoding`, `contentMediaType`.
 *
 * @see https://json-schema.org/draft-07/draft-handrews-json-schema-validation-01
 */
export interface JsonSchemaDraft7 extends JsonSchemaDraft6 {
  if?: JsonSchema | boolean;
  then?: JsonSchema | boolean;
  else?: JsonSchema | boolean;
  contentEncoding?: string;
  contentMediaType?: string;
}

// ---------------------------------------------------------------------------
// Draft 2019-09  (adds $defs, $anchor, $vocabulary, $recursive*, dependent*,
//                 unevaluated*, contains bounds)
// ---------------------------------------------------------------------------

/**
 * JSON Schema Draft 2019-09.
 *
 * Additions over Draft-07:
 * - `$defs` (replaces `definitions`), `$anchor`, `$vocabulary`.
 * - `$recursiveAnchor`/`$recursiveRef` for recursive references.
 * - `dependentSchemas`/`dependentRequired` (split from `dependencies`).
 * - `unevaluatedItems`/`unevaluatedProperties`.
 * - `maxContains`/`minContains`.
 *
 * @see https://json-schema.org/draft/2019-09/release-notes
 */
export interface JsonSchemaDraft201909 extends JsonSchemaDraft7 {
  $defs?: Record<string, JsonSchema>;
  $anchor?: string;
  $vocabulary?: Record<string, boolean>;
  $recursiveAnchor?: boolean;
  $recursiveRef?: string;
  dependentSchemas?: Record<string, JsonSchema>;
  dependentRequired?: Record<string, string[]>;
  unevaluatedItems?: JsonSchema | boolean;
  unevaluatedProperties?: JsonSchema | boolean;
  maxContains?: number;
  minContains?: number;
}

// ---------------------------------------------------------------------------
// Draft 2020-12  (adds $dynamicAnchor/$dynamicRef, prefixItems)
// ---------------------------------------------------------------------------

/**
 * JSON Schema Draft 2020-12.
 *
 * Additions over Draft 2019-09:
 * - `$dynamicAnchor`/`$dynamicRef` replace `$recursiveAnchor`/`$recursiveRef`.
 * - `prefixItems` replaces the array form of `items`.
 *
 * @see https://json-schema.org/draft/2020-12/release-notes
 */
export interface JsonSchemaDraft202012 extends JsonSchemaDraft201909 {
  $dynamicAnchor?: string;
  $dynamicRef?: string;
  prefixItems?: Array<JsonSchema | boolean>;
}
