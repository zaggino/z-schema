import type { JsonSchema } from '../../src/json-schema-versions.ts';
import type { ZSchemaOptions } from '../../src/z-schema-options.ts';
import type { ZSchemaSafe } from '../../src/z-schema.ts';

import { ZSchema } from '../../src/z-schema.ts';
import { expectAgrees, fastFor, interpreterOutcome, outcome, sparseArray, suites } from '../lib/fast-validator.ts';

// false on the first call of each validator instance, true afterwards
const flip = (z: ZSchemaSafe) => {
  let calls = 0;
  z.registerFormat('flip', () => {
    calls++;
    return calls > 1;
  });
};

// a $ref chain nine hops long: the collector's depth passes the limit of 6 on the way to the last target
const chainOf = (last: JsonSchema, keyword: 'unevaluatedItems' | 'unevaluatedProperties'): JsonSchema => {
  const defs: Record<string, JsonSchema> = { r8: last };
  for (let i = 7; i >= 0; i--) {
    defs[`r${i}`] = { $ref: `#/$defs/r${i + 1}` };
  }
  return { $ref: '#/$defs/r0', $defs: defs, [keyword]: false };
};
const nest = (n: number): unknown => {
  let node: unknown = { a: 1 };
  for (let i = 0; i < n; i++) {
    node = { child: node, a: 1 };
  }
  return node;
};

describe('fast validator', () => {
  describe('unevaluatedProperties and unevaluatedItems', () => {
    const OBJECT_SAMPLES: unknown[] = [
      undefined,
      null,
      true,
      1,
      'a',
      [],
      [1],
      {},
      { a: 1 },
      { a: 'x' },
      { b: 2 },
      { b: 'x' },
      { a: 1, b: 2 },
      { a: 1, b: 'x' },
      { c: 1 },
      { foo: 1 },
      { x1: 1 },
      { x1: 'x' },
      { a: 1, x1: 1, z: 3 },
      { kind: 'a' },
      { kind: 'a', a: 1 },
      { kind: 'a', b: 1 },
      { kind: 'b', b: 1 },
      { kind: 'b', a: 1 },
      { a: 1, child: { a: 1 } },
      { a: 1, child: { a: 1, z: 1 } },
      { child: { child: { a: 1 } } },
      { child: { child: { z: 1 } } },
      Object.create({ a: 1 }) as unknown,
      Object.create({ z: 1 }) as unknown,
      Object.defineProperty({ a: 1 }, 'z', { value: 1, enumerable: false }),
      Object.defineProperty({}, 'z', { value: 1, enumerable: false }),
    ];
    const ARRAY_SAMPLES: unknown[] = [
      undefined,
      null,
      1,
      'a',
      {},
      { 0: 1, length: 1 },
      [],
      [1],
      ['a'],
      [1, 'a'],
      ['a', 1],
      [1, 2],
      [1, 2, 3],
      [1, 'a', 3],
      ['a', 'b'],
      ['a', 'b', 'c'],
      [[1, 'a']],
      [1, [1, 'a']],
      [1, [1, ['x']]],
      [1, [1, [1, 2]]],
      [null],
      [1, null],
      sparseArray(3, {}),
      sparseArray(3, { 0: 1, 2: 3 }),
      sparseArray(2, { 1: 'a' }),
    ];

    const PROPERTY_SCHEMAS: Array<[string, JsonSchema]> = [
      ['alone', { unevaluatedProperties: false }],
      ['properties', { properties: { a: {} }, unevaluatedProperties: false }],
      ['patternProperties', { patternProperties: { '^x': {} }, unevaluatedProperties: false }],
      ['additionalProperties', { additionalProperties: { type: 'number' }, unevaluatedProperties: false }],
      [
        'properties and patternProperties',
        { properties: { a: {} }, patternProperties: { '^x': {} }, unevaluatedProperties: false },
      ],
      [
        'all three object keywords',
        {
          properties: { a: {} },
          patternProperties: { '^x': {} },
          additionalProperties: { type: 'string' },
          unevaluatedProperties: false,
        },
      ],
      ['allOf', { allOf: [{ properties: { a: {} } }, { properties: { b: {} } }], unevaluatedProperties: false }],
      [
        'anyOf',
        {
          anyOf: [{ properties: { a: { type: 'number' } } }, { properties: { b: { type: 'string' } } }],
          unevaluatedProperties: false,
        },
      ],
      [
        'oneOf',
        {
          oneOf: [{ properties: { a: { type: 'number' } } }, { properties: { b: { type: 'number' } } }],
          unevaluatedProperties: false,
        },
      ],
      [
        'if then else',
        {
          if: { properties: { kind: { const: 'a' } }, required: ['kind'] },
          then: { properties: { a: {} } },
          else: { properties: { b: {} } },
          unevaluatedProperties: false,
        },
      ],
      ['a lone if', { if: { properties: { a: {} }, required: ['a'] }, unevaluatedProperties: false }],
      [
        'if and then',
        { if: { properties: { kind: { const: 'a' } } }, then: { properties: { a: {} } }, unevaluatedProperties: false },
      ],
      [
        'dependentSchemas',
        {
          properties: { a: {} },
          dependentSchemas: { a: { properties: { b: {} } }, kind: { properties: { c: {} } } },
          unevaluatedProperties: false,
        },
      ],
      [
        '$ref to $defs',
        { $ref: '#/$defs/base', $defs: { base: { properties: { a: {} } } }, unevaluatedProperties: false },
      ],
      ['a recursive $ref', { properties: { a: {}, child: { $ref: '#' } }, unevaluatedProperties: false }],
      [
        'a recursive allOf $ref',
        { allOf: [{ properties: { child: { $ref: '#' } } }], properties: { a: {} }, unevaluatedProperties: false },
      ],
      [
        'a nested unevaluatedProperties true',
        { allOf: [{ unevaluatedProperties: true }], unevaluatedProperties: false },
      ],
      [
        'a nested unevaluatedProperties false',
        { allOf: [{ properties: { a: {} }, unevaluatedProperties: false }], unevaluatedProperties: false },
      ],
      ['a schema', { properties: { a: {} }, unevaluatedProperties: { type: 'number' } }],
      ['a schema over combinators', { allOf: [{ properties: { a: {} } }], unevaluatedProperties: { type: 'string' } }],
      ['true', { properties: { a: {} }, unevaluatedProperties: true }],
      ['not contributes nothing', { not: { properties: { a: {} } }, unevaluatedProperties: false }],
      ['not with a property', { not: { required: ['z'] }, properties: { a: {} }, unevaluatedProperties: false }],
      ['a nested instance', { properties: { child: { properties: { a: {} }, unevaluatedProperties: false } } }],
      [
        'type and required alongside',
        { type: 'object', required: ['a'], properties: { a: {} }, unevaluatedProperties: false },
      ],
    ];

    const ITEM_SCHEMAS: Array<[string, JsonSchema]> = [
      ['alone', { unevaluatedItems: false }],
      ['prefixItems', { prefixItems: [{ type: 'number' }, { type: 'string' }], unevaluatedItems: false }],
      ['additionalItems without array items', { additionalItems: {}, unevaluatedItems: false }],
      ['schema-form items', { items: { type: 'number' }, unevaluatedItems: false }],
      ['items false', { items: false, unevaluatedItems: false }],
      ['contains', { contains: { type: 'number' }, unevaluatedItems: false }],
      ['contains false', { contains: false, unevaluatedItems: false } as JsonSchema],
      [
        'prefixItems and contains',
        { prefixItems: [{ type: 'number' }], contains: { type: 'string' }, unevaluatedItems: false },
      ],
      ['allOf', { allOf: [{ prefixItems: [{}] }, { prefixItems: [{}, {}] }], unevaluatedItems: false }],
      [
        'anyOf',
        {
          anyOf: [{ prefixItems: [{ type: 'number' }] }, { prefixItems: [{ type: 'string' }, {}] }],
          unevaluatedItems: false,
        },
      ],
      [
        'oneOf',
        {
          oneOf: [{ prefixItems: [{ type: 'number' }] }, { prefixItems: [{ type: 'string' }, {}] }],
          unevaluatedItems: false,
        },
      ],
      [
        'if then else',
        {
          if: { prefixItems: [{ const: 1 }] },
          then: { prefixItems: [{}, {}] },
          else: { prefixItems: [{}] },
          unevaluatedItems: false,
        },
      ],
      ['a lone if', { if: { prefixItems: [{ type: 'number' }] }, unevaluatedItems: false }],
      ['$ref to $defs', { $ref: '#/$defs/base', $defs: { base: { prefixItems: [{}, {}] } }, unevaluatedItems: false }],
      ['a recursive $ref', { prefixItems: [{}, { $ref: '#' }], unevaluatedItems: false }],
      ['a nested unevaluatedItems true', { allOf: [{ unevaluatedItems: true }], unevaluatedItems: false }],
      [
        'a nested unevaluatedItems false',
        { allOf: [{ prefixItems: [{}], unevaluatedItems: false }], unevaluatedItems: false },
      ],
      ['a schema', { prefixItems: [{}], unevaluatedItems: { type: 'number' } }],
      ['a schema over contains', { contains: { type: 'string' }, unevaluatedItems: { type: 'number' } }],
      ['true', { prefixItems: [{}], unevaluatedItems: true }],
      ['not contributes nothing', { not: { prefixItems: [{}] }, unevaluatedItems: false }],
      ['type alongside', { type: 'array', prefixItems: [{}], unevaluatedItems: false }],
    ];

    // array-form items is a 2019-09 / draft-07 construct
    const TUPLE_ITEM_SCHEMAS: Array<[string, JsonSchema]> = [
      ['array-form items', { items: [{ type: 'number' }, { type: 'string' }], unevaluatedItems: false }],
      [
        'array-form items and additionalItems',
        { items: [{ type: 'number' }], additionalItems: { type: 'string' }, unevaluatedItems: false },
      ],
      [
        'array-form items and additionalItems false',
        { items: [{ type: 'number' }], additionalItems: false, unevaluatedItems: false },
      ],
    ];

    const DRAFTS = ['draft2020-12', 'draft2019-09'] as const;
    suites('unevaluatedProperties', PROPERTY_SCHEMAS, OBJECT_SAMPLES, DRAFTS);
    suites('unevaluatedItems', ITEM_SCHEMAS, ARRAY_SAMPLES, DRAFTS);

    // The interpreter runs both keywords on every version, and the evaluated-annotation traversal reads
    // prefixItems, contains, dependentSchemas and the rest on every draft, not only on the drafts that define them.
    suites('unevaluatedProperties on draft-07', PROPERTY_SCHEMAS, OBJECT_SAMPLES, ['draft-07']);
    suites('unevaluatedItems on draft-07', ITEM_SCHEMAS, ARRAY_SAMPLES, ['draft-07']);
    suites('unevaluatedItems with array-form items', TUPLE_ITEM_SCHEMAS, ARRAY_SAMPLES, ['draft2019-09', 'draft-07']);

    it('agrees on a keyword value the schema also sees as an instance', () => {
      expectAgrees({ properties: { a: {} }, unevaluatedProperties: false }, {}, [
        { properties: 1, unevaluatedProperties: 2 },
        { a: { a: 1 } },
      ]);
    });

    describe('fallback', () => {
      const dynamic = { $dynamicRef: '#x', $defs: { x: { $dynamicAnchor: 'x' } } } as JsonSchema;
      it.each([
        ['a $dynamicRef member', { allOf: [dynamic], unevaluatedProperties: false }, {}],
        ['a $dynamicRef member for items', { allOf: [dynamic], unevaluatedItems: false }, {}],
        [
          'a $dynamicRef in a ref target',
          { $ref: '#/$defs/t', $defs: { t: dynamic }, unevaluatedProperties: false },
          {},
        ],
        [
          'a $recursiveRef member',
          { allOf: [{ $recursiveRef: '#' }], $recursiveAnchor: true, unevaluatedProperties: false },
          { version: 'draft2019-09' },
        ],
      ] as Array<[string, JsonSchema, ZSchemaOptions]>)('%s has no fast validator', (_name, schema, opts) => {
        expect(fastFor(schema, opts).fast).toBeUndefined();
      });
    });

    describe('recursion depth', () => {
      const chain = chainOf({ properties: { a: {} } }, 'unevaluatedProperties');
      const items = chainOf({ prefixItems: [{}] }, 'unevaluatedItems');
      const recursive: JsonSchema = {
        allOf: [{ properties: { child: { $ref: '#' } } }],
        properties: { a: {} },
        unevaluatedProperties: false,
      };

      it.each([
        ['a $ref chain deeper than the limit', chain, { a: 1 }, [6, 100]],
        ['a $ref chain deeper than the limit (items)', items, [1], [6, 100]],
        ['a recursive schema and deep data', recursive, nest(6), [8, 100]],
        ['a recursive schema and shallow data', recursive, nest(1), [8, 100]],
        ['a $ref chain within the limit', chain, {}, [6, 100]],
      ] as Array<[string, JsonSchema, unknown, number[]]>)(
        '%s: the compiled function equals validate',
        (_name, schema, data, limits) => {
          for (const limit of limits) {
            const { v, fast } = fastFor(schema, { maxRecursionDepth: limit });
            const fn = v.compile(schema);
            const expected = interpreterOutcome({ maxRecursionDepth: limit }, schema, data);
            expect(outcome(() => fn(data))).toEqual(expected);
            if (fast !== undefined) {
              let result: unknown;
              try {
                result = fast(data);
              } catch {
                result = 'threw';
              }
              // never `true` for an instance the interpreter rejects, and `true` for every one it accepts
              expect(result === true).toBe('valid' in expected && expected.valid);
            }
          }
        }
      );
    });
  });
  describe('recursion depth overflow', () => {
    it('defers the call without retiring the fast validator', () => {
      const schema = chainOf({ properties: { a: {} } }, 'unevaluatedProperties');
      const options: ZSchemaOptions = { maxRecursionDepth: 6 };
      const { v } = fastFor(schema, options);
      const fn = v.compile(schema);
      const data = { a: 1 };
      const expected = interpreterOutcome(options, schema, data);
      for (let i = 0; i < 3; i++) {
        expect(outcome(() => fn(data))).toEqual(expected);
        expect(outcome(() => v.validate(data, schema))).toEqual(expected);
      }
      const entry = v.compiledSchemaCache.getEntry(v.compiledSchemaCache.keyOf(schema)!, v.options);
      expect(typeof entry?.fast).toBe('function');
    });
  });

  describe('a custom format beside a collector that re-checks branches', () => {
    const options: ZSchemaOptions = { formatAssertions: null };

    it.each([
      [
        'unevaluatedProperties over an anyOf member',
        {
          anyOf: [{ format: 'flip', properties: { a: true } }, { type: 'object' }],
          unevaluatedProperties: false,
        },
        { a: 1 },
        'OBJECT_UNEVALUATED_PROPERTIES',
      ],
      ['unevaluatedItems over contains', { contains: { format: 'flip' }, unevaluatedItems: false }, ['x'], undefined],
    ] as Array<[string, JsonSchema, unknown, string | undefined]>)(
      '%s has no fast validator and the compiled call equals a fresh validator',
      (_name, schema, data, code) => {
        expect(fastFor(schema, options, flip).fast).toBeUndefined();
        const v = ZSchema.create({ ...options, safe: true });
        flip(v);
        const actual = outcome(() => v.compile(schema)(data));
        const expected = interpreterOutcome(options, schema, data, flip);
        expect(actual).toEqual(expected);
        expect('valid' in expected && expected.valid).toBe(false);
        if (code !== undefined) {
          expect('codes' in expected && expected.codes).toContain(code);
        }
      }
    );

    it('a custom format alone still builds a fast validator', () => {
      expect(fastFor({ format: 'flip' }, options, flip).fast).toBeDefined();
    });

    it('unevaluated keywords over a built-in format still build a fast validator', () => {
      const schema: JsonSchema = {
        anyOf: [{ format: 'date', properties: { a: true } }, { type: 'object' }],
        unevaluatedProperties: false,
      };
      expect(fastFor(schema, options).fast).toBeDefined();
    });
  });
});
