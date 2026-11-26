import { describe, expect, it } from 'vitest';

import { createSafe } from '../lib/validate-results.ts';

const outcomeOf = (schema: Record<string, unknown>) => {
  const result = createSafe({ noExtraKeywords: true }).validateSchema(schema);
  return { valid: result.valid, codes: (result.err?.details ?? []).map((d) => [d.code, d.params]) };
};

describe('noExtraKeywords', () => {
  it('reports an unknown keyword on a root schema that has no $schema of its own', () => {
    expect(outcomeOf({ type: 'string', foo: 1 })).toEqual({
      valid: false,
      codes: [['KEYWORD_UNEXPECTED', ['foo']]],
    });
  });

  it('leaves an unknown keyword to the meta-schema when the schema names its $schema', () => {
    expect(outcomeOf({ $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'string', foo: 1 })).toEqual({
      valid: true,
      codes: [],
    });
  });

  it('accepts standard keywords that only the data validator or no validator reads', () => {
    const sub = {
      $anchor: 'item',
      $comment: 'c',
      const: 1,
      deprecated: false,
      examples: [1],
      readOnly: true,
      writeOnly: false,
    };
    const schema = {
      $id: 'http://example.com/no-extra-keywords.json',
      prefixItems: [sub],
      contains: { const: 1 },
      minContains: 1,
      unevaluatedItems: false,
      properties: { a: { dependentRequired: { b: ['c'] }, propertyNames: { maxLength: 3 } } },
    };
    expect(outcomeOf(schema)).toEqual({ valid: true, codes: [] });
  });
});
