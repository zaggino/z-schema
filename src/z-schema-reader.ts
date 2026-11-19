import type { JsonSchema } from './json-schema-versions.js';

import { bumpGlobalSchemaStateGeneration } from './compiled-schema-cache.js';

// a sync function that returns the schema for a URI, or undefined when it has none
export type SchemaReader = (uri: string) => JsonSchema | undefined;

let _schemaReader: SchemaReader | undefined;

export function getSchemaReader(): SchemaReader | undefined {
  return _schemaReader;
}

export function setSchemaReader(schemaReader: SchemaReader | undefined) {
  _schemaReader = schemaReader;
  bumpGlobalSchemaStateGeneration();
}
