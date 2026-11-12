import type { FastValidator } from '../../src/fast-validator.ts';
import type { JsonSchema } from '../../src/json-schema-versions.ts';
import type { ZSchemaBase } from '../../src/z-schema-base.ts';

import { buildFastValidator } from '../../src/fast-validator.ts';

/**
 * Builds the fast validator for the compiled clone that `validator` cached for `schema`. The schema must
 * already have been validated or compiled on `validator`; `undefined` when it is not cached or the builder
 * rejects it.
 */
export const buildFastFor = (validator: ZSchemaBase, schema: JsonSchema): FastValidator | undefined => {
  const key = validator.compiledSchemaCache.keyOf(schema);
  if (key === undefined) {
    return undefined;
  }
  const compiled = validator.compiledSchemaCache.get(key, validator.options);
  return compiled ? buildFastValidator(compiled, validator) : undefined;
};
