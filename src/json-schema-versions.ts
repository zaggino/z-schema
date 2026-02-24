import type { JsonSchemaCommon, ZSchemaInternalProperties } from './json-schema.js';

// TODO: currently unsupported 'draft-07', '2019-09', '2020-12'
export type JsonSchemaVersion = 'draft-04' | 'draft-06';

export const CURRENT_DEFAULT_SCHEMA_VERSION: JsonSchemaVersion = 'draft-06';

export const VERSION_SCHEMA_URL_MAPPING: Record<JsonSchemaVersion, string> = {
  'draft-04': 'http://json-schema.org/draft-04/schema#',
  'draft-06': 'http://json-schema.org/draft-06/schema#',
};

export type JsonSchema = JsonSchemaDraft4 | JsonSchemaDraft6;
export type JsonSchemaAll = JsonSchemaDraft4 & JsonSchemaDraft6;

export type JsonSchemaInternal = JsonSchema & ZSchemaInternalProperties;
export type JsonSchemaInternalAll = JsonSchemaAll & ZSchemaInternalProperties;
export type JsonSchemaInternalD4 = JsonSchemaDraft4 & ZSchemaInternalProperties;
export type JsonSchemaInternalD6 = JsonSchemaDraft6 & ZSchemaInternalProperties;

export interface JsonSchemaDraft4 extends JsonSchemaCommon {
  exclusiveMaximum?: boolean;
  exclusiveMinimum?: boolean;
}

export interface JsonSchemaDraft6 extends JsonSchemaCommon {
  $id?: string;
  examples?: unknown[];
  const?: unknown;
  contains?: JsonSchema;
  propertyNames?: JsonSchema;
  exclusiveMaximum?: number;
  exclusiveMinimum?: number;
}
