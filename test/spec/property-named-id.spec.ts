import type { JsonSchema } from '../../src/json-schema-versions.ts';

import { ZSchema } from '../../src/z-schema.ts';

// `findId` walks keyword maps such as `properties` as if they were schemas, so a property named
// `id` or `$id` holds a sub-schema object where a schema id is expected. Only string ids count.
// No root `$id`, so `findId` has no target base and checks every map it walks; the reversed key
// walk reaches the root `properties` map before `$defs`.
const dynamicRefSchema = (propertyName: string): JsonSchema => ({
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $defs: {
    node: {
      $dynamicAnchor: 'node',
      type: 'object',
      properties: {
        [propertyName]: { type: 'string' },
        children: { type: 'array', items: { $dynamicRef: '#node' } },
      },
    },
  },
  type: 'object',
  properties: {
    [propertyName]: { type: 'string' },
    tree: { $ref: '#/$defs/node' },
  },
});

describe('a property named id is not taken for a schema id', () => {
  for (const propertyName of ['id', '$id']) {
    it(`resolves $dynamicRef next to a property named ${propertyName}`, () => {
      const validator = ZSchema.create({ safe: true });
      const schema = dynamicRefSchema(propertyName);
      const tree = (leafValue: unknown) => ({
        [propertyName]: 'a',
        tree: { [propertyName]: 'b', children: [{ [propertyName]: leafValue, children: [] }] },
      });

      const ok = validator.validate(tree('c'), schema);
      expect(ok.err).toBeUndefined();
      expect(ok.valid).toBe(true);

      const bad = validator.validate(tree(1), schema);
      expect(bad.valid).toBe(false);
      expect(bad.err?.details?.[0]?.code).toBe('INVALID_TYPE');
    });
  }

  it('still resolves a draft-04 $ref by id next to a property named id', () => {
    const schema: JsonSchema = {
      $schema: 'http://json-schema.org/draft-04/schema#',
      id: 'http://example.com/root.json',
      properties: {
        id: { type: 'string' },
        value: { $ref: '#positive' },
      },
      definitions: {
        positive: { id: '#positive', type: 'integer', minimum: 1 },
      },
    };
    const validator = ZSchema.create({ safe: true, version: 'draft-04' });
    const ok = validator.validate({ id: 'x', value: 2 }, schema);
    expect(ok.err).toBeUndefined();
    expect(ok.valid).toBe(true);

    const bad = validator.validate({ id: 'x', value: 0 }, schema);
    expect(bad.valid).toBe(false);
    expect(bad.err?.details?.[0]?.code).toBe('MINIMUM');
  });
});
