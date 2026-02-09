import type { Reference } from './schema-compiler.js';
import type { ZSchemaOptions } from './z-schema-options.js';

import { isObject } from './utils/what-is.js';

// TODO: currently unsupported 'draft-07', '2019-09', '2020-12'
export type JsonSchemaVersion = 'draft-04' | 'draft-06';

export const VERSION_SCHEMA_URL_MAPPING: Record<JsonSchemaVersion, string> = {
  'draft-04': 'http://json-schema.org/draft-04/schema#',
  'draft-06': 'http://json-schema.org/draft-06/schema#',
};

export interface JsonSchema {
  $ref?: string;
  id?: string;
  $schema?: string;
  title?: string;
  description?: string;
  default?: unknown;
  definitions?: Record<string, JsonSchema>;
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  patternProperties?: Record<string, JsonSchema>;
  dependencies?: Record<string, string[]>;
  // properties
  multipleOf?: number;
  minimum?: number;
  exclusiveMinimum?: boolean;
  maximum?: number;
  exclusiveMaximum?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  additionalItems?: boolean | JsonSchema;
  items?: JsonSchema | JsonSchema[];
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  minProperties?: number;
  maxProperties?: number;
  required?: string[];
  additionalProperties?: boolean | JsonSchema;
  enum?: Array<unknown>;
  format?: string;
  allOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  not?: JsonSchema;
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

export interface JsonSchemaInternal extends JsonSchema, ZSchemaInternalProperties {}

export const findId = (schema: JsonSchemaInternal, id: string): JsonSchemaInternal | undefined => {
  // process only arrays and objects
  if (typeof schema !== 'object' || schema === null) {
    return;
  }

  // no id means root so return itself
  if (!id) {
    return schema;
  }

  if (schema.id) {
    if (schema.id === id || (schema.id[0] === '#' && schema.id.substring(1) === id)) {
      return schema;
    }
  }

  let idx, result;
  if (Array.isArray(schema)) {
    idx = schema.length;
    while (idx--) {
      result = findId(schema[idx], id);
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
      result = findId(schema[k] as JsonSchemaInternal, id);
      if (result) {
        return result;
      }
    }
  }
};
