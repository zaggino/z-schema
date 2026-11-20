import type { JsonSchema } from './json-schema-versions.js';

import { bumpGlobalSchemaStateGeneration } from './compiled-schema-cache.js';

/**
 * A sync function that loads a schema by URI, for example from a map keyed by URI, or returns `undefined` when
 * it has none. It is called when a `$ref` names a URI that is not registered. z-schema compiles a copy of the
 * returned object and does not modify it.
 */
export type SchemaReader = (uri: string) => JsonSchema | undefined;

let _schemaReader: SchemaReader | undefined;

export function getSchemaReader(): SchemaReader | undefined {
  return _schemaReader;
}

export function setSchemaReader(schemaReader: SchemaReader | undefined) {
  _schemaReader = schemaReader;
  bumpGlobalSchemaStateGeneration();
}
