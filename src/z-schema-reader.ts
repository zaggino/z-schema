import type { JsonSchema } from './json-schema-versions.js';

// a sync function that loads schemas for future use, for example from schemas directory, during server startup
export type SchemaReader = (uri: string) => JsonSchema;

let _schemaReader: SchemaReader | undefined;

export function getSchemaReader(): SchemaReader | undefined {
  return _schemaReader;
}

export function setSchemaReader(schemaReader: SchemaReader | undefined) {
  _schemaReader = schemaReader;
}
