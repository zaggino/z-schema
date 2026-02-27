import type {
  JsonSchema,
  JsonSchemaInternal,
  JsonSchemaInternalD4,
  JsonSchemaInternalD6,
} from './json-schema-versions.js';
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
import { isObject } from './utils/what-is.js';
import { DEFAULT_MAX_RECURSION_DEPTH } from './z-schema-options.js';

// common properties of all JSON Schema versions
export interface JsonSchemaCommon {
  $ref?: string;
  $schema?: string;
  id?: string;
  $id?: string;
  $anchor?: string;
  $dynamicAnchor?: string;
  $dynamicRef?: string;
  $defs?: Record<string, JsonSchema>;
  $vocabulary?: Record<string, boolean>;
  $recursiveAnchor?: boolean;
  $recursiveRef?: string;
  title?: string;
  description?: string;
  default?: unknown;
  definitions?: Record<string, JsonSchema>;
  type?: string | string[];
  properties?: Record<string, JsonSchema | boolean>;
  patternProperties?: Record<string, JsonSchema>;
  multipleOf?: number;
  minimum?: number;
  exclusiveMinimum?: boolean | number;
  maximum?: number;
  exclusiveMaximum?: boolean | number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  additionalItems?: boolean | JsonSchema;
  items?: JsonSchema | boolean | Array<JsonSchema | boolean>;
  prefixItems?: Array<JsonSchema | boolean>;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  minProperties?: number;
  maxProperties?: number;
  required?: string[];
  additionalProperties?: boolean | JsonSchema;
  dependencies?: Record<string, string[] | JsonSchema>;
  enum?: Array<unknown>;
  format?: string;
  allOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  not?: JsonSchema;
  contentEncoding?: string;
  contentMediaType?: string;
  if?: JsonSchema | boolean;
  then?: JsonSchema | boolean;
  else?: JsonSchema | boolean;
  examples?: unknown[];
  const?: unknown;
  contains?: JsonSchema;
  propertyNames?: JsonSchema;
  unevaluatedItems?: JsonSchema | boolean;
  unevaluatedProperties?: JsonSchema | boolean;
  dependentSchemas?: Record<string, JsonSchema>;
  dependentRequired?: Record<string, string[]>;
  maxContains?: number;
  minContains?: number;
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
  __$visited?: boolean;
}

export const getId = (schema: JsonSchemaInternal) => {
  if ((schema as JsonSchemaInternalD6).$id) {
    return (schema as JsonSchemaInternalD6).$id;
  }
  if ((schema as JsonSchemaInternalD4).id) {
    return (schema as JsonSchemaInternalD4).id;
  }
  return undefined;
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
    // Reverse iteration: traversal order determines which $dynamicAnchor wins
    // when siblings share the same anchor name — required for $dynamicRef correctness
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
