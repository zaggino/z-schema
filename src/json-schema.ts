import type {
  JsonSchema,
  JsonSchemaInternal,
  JsonSchemaInternalD4,
  JsonSchemaInternalD6,
} from './json-schema-versions.js';
import type { Reference } from './schema-compiler.js';
import type { ZSchemaOptions } from './z-schema-options.js';

import { getRemotePath, isAbsoluteUri } from './utils/uri.js';
import { isObject } from './utils/what-is.js';

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
  currentBaseUri?: string
): JsonSchemaInternal | undefined => {
  // process only arrays and objects
  if (typeof schema !== 'object' || schema === null) {
    return;
  }

  // no id means root so return itself
  if (!id) {
    return schema;
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

  let idx, result;
  if (Array.isArray(schema)) {
    idx = schema.length;
    while (idx--) {
      result = findId(schema[idx], id, targetBaseUri, nextBaseUri);
      if (result) {
        return result;
      }
    }
  }
  if (isObject(schema)) {
    const keys = Object.keys(schema) as Array<keyof JsonSchemaInternal>;
    idx = keys.length;
    while (idx--) {
      const k = keys[idx];
      if (k.indexOf('__$') === 0) {
        continue;
      }
      result = findId(schema[k] as JsonSchemaInternal, id, targetBaseUri, nextBaseUri);
      if (result) {
        return result;
      }
    }
  }
};
