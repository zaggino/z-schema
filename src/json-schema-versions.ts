/* eslint-disable @typescript-eslint/no-empty-object-type */
import type { JsonSchemaCommon, ZSchemaInternalProperties } from './json-schema.js';

// TODO: currently unsupported '2019-09', '2020-12'
export type JsonSchemaVersion = 'draft-04' | 'draft-06' | 'draft-07';

export const CURRENT_DEFAULT_SCHEMA_VERSION: JsonSchemaVersion = 'draft-07';

export const VERSION_SCHEMA_URL_MAPPING: Record<JsonSchemaVersion, string> = {
  'draft-04': 'http://json-schema.org/draft-04/schema#',
  'draft-06': 'http://json-schema.org/draft-06/schema#',
  'draft-07': 'http://json-schema.org/draft-07/schema#',
};

export type JsonSchema = JsonSchemaDraft4 | JsonSchemaDraft6 | JsonSchemaDraft7;
export type JsonSchemaAll = JsonSchemaDraft4 & JsonSchemaDraft6 & JsonSchemaDraft7;

export type JsonSchemaInternal = JsonSchema & ZSchemaInternalProperties;
export type JsonSchemaInternalAll = JsonSchemaAll & ZSchemaInternalProperties;
export type JsonSchemaInternalD4 = JsonSchemaDraft4 & ZSchemaInternalProperties;
export type JsonSchemaInternalD6 = JsonSchemaDraft6 & ZSchemaInternalProperties;
export type JsonSchemaInternalD7 = JsonSchemaDraft7 & ZSchemaInternalProperties;

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
}

export interface JsonSchemaDraft7 extends JsonSchemaCommon {}
