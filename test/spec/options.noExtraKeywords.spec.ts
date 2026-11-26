import { ZSchema } from '../../src/z-schema.ts';

const codesOf = (schema: Record<string, unknown>) => {
  const result = ZSchema.create({ safe: true, noExtraKeywords: true }).validateSchema(schema);
  return { valid: result.valid, codes: (result.err?.details ?? []).map((d) => [d.code, d.params]) };
};

describe('noExtraKeywords on a root schema', () => {
  it('reports an unknown keyword when the schema has no $schema of its own', () => {
    expect(codesOf({ type: 'string', foo: 1 })).toEqual({
      valid: false,
      codes: [['KEYWORD_UNEXPECTED', ['foo']]],
    });
  });

  it('leaves an unknown keyword to the meta-schema when the schema names its $schema', () => {
    expect(codesOf({ $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'string', foo: 1 })).toEqual({
      valid: true,
      codes: [],
    });
  });
});
