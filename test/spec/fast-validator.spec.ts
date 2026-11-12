import type { JsonSchema } from '../../src/json-schema-versions.ts';
import type { ValidateOptions, ValidateResponse } from '../../src/z-schema-base.ts';
import type { ZSchemaOptions } from '../../src/z-schema-options.ts';
import type { ZSchemaSafe } from '../../src/z-schema.ts';

import { vi } from 'vitest';

import { buildFastValidator } from '../../src/fast-validator.ts';
import { Report } from '../../src/report.ts';
import { ZSchema } from '../../src/z-schema.ts';
import { buildFastFor } from '../lib/fast-validator.ts';

// The interpreter path always ends by asking its Report whether it is valid; the fast path has no Report.
const spyOnInterpreter = () => vi.spyOn(Report.prototype, 'isValid');

const lone = String.fromCharCode(0xd8_3d);
const astral = String.fromCharCode(0xd8_3d, 0xde_00);

const SAMPLES: unknown[] = [
  undefined,
  null,
  true,
  false,
  Number.NaN,
  Number.POSITIVE_INFINITY,
  Number.NEGATIVE_INFINITY,
  -0,
  0,
  1,
  1.5,
  -3,
  10,
  0.1,
  0.3,
  1e21,
  Number.MAX_SAFE_INTEGER,
  1n,
  () => 1,
  [],
  [1],
  [1, 2],
  {},
  { a: 1 },
  new Date(0),
  '',
  'a',
  'abc',
  'abcdef',
  'aa',
  'foo',
  'foo-bar',
  '2020-01-01',
  'not a date',
  'a@b.co',
  astral,
  astral + astral,
  lone,
  `${lone}${lone}`,
  `a${astral}`,
];

const codesOf = (res: ValidateResponse): string[] => (res.err?.details ?? []).map((d) => d.code);
const depth = (n: number, leaf: unknown): unknown => {
  let node: unknown = leaf;
  for (let i = 0; i < n; i++) {
    node = { value: 1, children: [node] };
  }
  return node;
};

const lookups = (v: ZSchemaSafe) => {
  const getEntry = vi.spyOn(v.compiledSchemaCache, 'getEntry');
  const get = vi.spyOn(v.compiledSchemaCache, 'get');
  return () => getEntry.mock.calls.length + get.mock.calls.length;
};

const outcome = (run: () => ValidateResponse): { valid: boolean; codes: string[] } | { thrown: string } => {
  try {
    const res = run();
    return { valid: res.valid, codes: codesOf(res) };
  } catch (error) {
    return { thrown: (error as Error).message };
  }
};

/** Compiles `schema` on a fresh validator and returns the fast validator built for the compiled clone. */
const fastFor = (schema: JsonSchema, opts: ZSchemaOptions = {}, setup?: (v: ZSchemaSafe) => void) => {
  const v = ZSchema.create({ safe: true, ...opts });
  setup?.(v);
  const compiled = v.compile(schema);
  compiled(1);
  v.validate(1, schema);
  return { v, fast: buildFastFor(v, schema) };
};

const expectAgrees = (schema: JsonSchema, opts: ZSchemaOptions = {}, samples: unknown[] = SAMPLES) => {
  const { v, fast } = fastFor(schema, opts);
  expect(fast).toBeDefined();
  for (const sample of samples) {
    expect(fast!(sample), `${Object.prototype.toString.call(sample)} against ${JSON.stringify(schema)}`).toBe(
      v.validate(sample, schema).valid
    );
  }
};

describe('fast validator', () => {
  describe('builder: supported keywords agree with the interpreter', () => {
    const cases: Array<[string, JsonSchema, ZSchemaOptions?]> = [
      ['empty schema', {}],
      ['type string', { type: 'string' }],
      ['type number', { type: 'number' }],
      ['type integer', { type: 'integer' }],
      ['type boolean', { type: 'boolean' }],
      ['type null', { type: 'null' }],
      ['type array', { type: 'array' }],
      ['type object', { type: 'object' }],
      ['type union', { type: ['string', 'null'] }],
      ['type union with number', { type: ['number', 'string'] }],
      ['enum', { enum: [1, 'a', null, { a: 1 }, [1]] }],
      ['const scalar', { const: 1 }],
      ['const object', { const: { a: 1 } }],
      ['minimum', { minimum: 1 }],
      ['maximum', { maximum: 1 }],
      ['minimum and maximum', { minimum: 0, maximum: 10 }],
      ['exclusiveMinimum number', { exclusiveMinimum: 1 }],
      ['exclusiveMaximum number', { exclusiveMaximum: 1 }],
      ['draft-04 exclusiveMinimum', { minimum: 1, exclusiveMinimum: true }, { version: 'draft-04' }],
      ['draft-04 exclusiveMaximum', { maximum: 1, exclusiveMaximum: true }, { version: 'draft-04' }],
      ['draft-04 minimum', { minimum: 1 }, { version: 'draft-04' }],
      ['multipleOf int', { multipleOf: 2 }],
      ['multipleOf decimal', { multipleOf: 0.1 }],
      ['multipleOf fraction', { multipleOf: 1.5 }],
      ['minLength', { minLength: 2 }],
      ['maxLength', { maxLength: 2 }],
      ['minLength and maxLength', { minLength: 1, maxLength: 1 }],
      ['pattern', { pattern: '^a' }],
      ['unicode pattern', { pattern: '^.$' }],
      ['format date', { format: 'date' }, { formatAssertions: null }],
      ['format email', { format: 'email' }, { formatAssertions: null }],
      ['format date on draft-07', { format: 'date' }, { version: 'draft-07' }],
      ['combined', { type: 'string', minLength: 1, maxLength: 5, pattern: '^[a-z]+$' }],
      ['unknown keyword', { 'x-foo': { properties: {} }, type: 'string' } as JsonSchema],
      ['annotations', { title: 't', description: 'd', default: 1, examples: [1], $defs: { a: {} }, type: 'number' }],
    ];
    it.each(cases)('%s', (_name, schema, opts) => {
      expectAgrees(schema, opts);
    });
  });

  describe('arrays and objects', () => {
    const sparse: unknown[] = [1];
    sparse[2] = 3;
    const holes = Array.from({ length: 3 });
    const arrayLike = { 0: 1, 1: 2, length: 2 };
    const inherited = Object.create({ a: 1, b: 'x' });
    const nonEnumerable = Object.defineProperty({}, 'a', { value: 1, enumerable: false });
    const protoKey = JSON.parse('{"__proto__": 1}');
    const protoKeyObject = JSON.parse('{"__proto__": {"a": 1}, "b": 2}');
    const nullProto = Object.assign(Object.create(null), { a: 1, b: 'x' });
    const emoji = String.fromCodePoint(128_512);

    const COLLECTIONS: unknown[] = [
      ...SAMPLES,
      [undefined],
      [null],
      [1, 1],
      [1, '1'],
      [0, false],
      [{ a: 1 }, { a: 1 }],
      [{ a: 1 }, { a: 2 }],
      [[1], [1]],
      [1, 2, 3],
      [1, 2, 3, 4, 5],
      ['a', 'b', 'c'],
      [1, 'a', true],
      ['a', 1],
      [1, 'a', null, 2],
      [[1, 2], [3]],
      [{ a: 1 }, 2],
      [-1, 5],
      sparse,
      holes,
      arrayLike,
      new Map([['a', 1]]),
      new Set([1]),
      inherited,
      nonEnumerable,
      protoKey,
      protoKeyObject,
      nullProto,
      { a: 1, b: 'x' },
      { a: 'x', b: 1 },
      { a: 1, b: 2, c: 3 },
      { a: [1, 2], b: [{ c: 1 }] },
      { a: [{ c: 'x' }] },
      { a: [{ c: 1 }, { c: 2 }] },
      { x: 1 },
      { x: 1, a: 1 },
      { foo: 1 },
      { foo: 'a', bar: 2 },
      { bar: 1 },
      { aa: 1 },
      { [emoji]: 1 },
      { [emoji]: 'x' },
      { a: undefined },
      { a: null },
      { b: 1 },
      { a: 1, b: 1 },
      { a: 1, c: 1 },
      { c: 1 },
      { ab: 1, a: 1 },
    ];

    const cases: Array<[string, JsonSchema, ZSchemaOptions?]> = [
      ['minItems', { minItems: 2 }],
      ['maxItems', { maxItems: 2 }],
      ['minItems 0', { minItems: 0 }],
      ['uniqueItems', { uniqueItems: true }],
      ['uniqueItems false', { uniqueItems: false }],
      ['items schema', { items: { type: 'integer' } }],
      ['items true', { items: true }],
      ['items false', { items: false }],
      ['items empty', { items: {} }],
      ['items nested', { items: { type: 'object', properties: { a: { type: 'integer' } } } }],
      ['prefixItems on 2020-12', { prefixItems: [{ type: 'integer' }, { type: 'string' }] }],
      ['prefixItems with items', { prefixItems: [{ type: 'integer' }], items: { type: 'string' } }],
      [
        'prefixItems ignored on 2019-09',
        { prefixItems: [{ type: 'integer' }], items: { type: 'string' } },
        { version: 'draft2019-09' },
      ],
      [
        'prefixItems with own $schema',
        {
          $schema: 'https://json-schema.org/draft/2020-12/schema',
          prefixItems: [{ type: 'integer' }],
          items: { type: 'string' },
        },
      ],
      ['tuple items on 2019-09', { items: [{ type: 'integer' }, { type: 'string' }] }, { version: 'draft2019-09' }],
      ['tuple items alone on 2019-09', { items: [{ type: 'integer' }] }, { version: 'draft2019-09' }],
      [
        'tuple items with additionalItems false',
        { items: [{ type: 'integer' }, { type: 'string' }], additionalItems: false },
        { version: 'draft-07' },
      ],
      [
        'tuple items with additionalItems schema',
        { items: [{ type: 'integer' }], additionalItems: { type: 'string' } },
        { version: 'draft-07' },
      ],
      [
        'tuple items with additionalItems true',
        { items: [{ type: 'integer' }], additionalItems: true },
        { version: 'draft-07' },
      ],
      [
        'additionalItems without tuple items',
        { additionalItems: false, items: { type: 'integer' } },
        { version: 'draft-07' },
      ],
      ['additionalItems alone', { additionalItems: false }, { version: 'draft-07' }],
      ['draft-04 tuple', { items: [{ type: 'integer' }], additionalItems: false }, { version: 'draft-04' }],
      ['contains', { contains: { type: 'integer' } }],
      ['contains true', { contains: true } as JsonSchema],
      ['contains false', { contains: false } as JsonSchema],
      ['contains minContains 0', { contains: { type: 'integer' }, minContains: 0 }],
      ['contains minContains 2', { contains: { type: 'integer' }, minContains: 2 }],
      ['contains maxContains 1', { contains: { type: 'integer' }, maxContains: 1 }],
      ['contains min and max', { contains: { type: 'integer' }, minContains: 1, maxContains: 2 }],
      ['contains maxContains 0', { contains: { type: 'integer' }, maxContains: 0 }],
      [
        'contains bounds on 2019-09',
        { contains: { type: 'integer' }, minContains: 2, maxContains: 3 },
        { version: 'draft2019-09' },
      ],
      [
        'contains bounds ignored on draft-07',
        { contains: { type: 'integer' }, minContains: 0, maxContains: 0 },
        { version: 'draft-07' },
      ],
      ['minContains without contains', { minContains: 3 }],
      ['required', { required: ['a'] }],
      ['required several', { required: ['a', 'b'] }],
      ['required empty', { required: [] }],
      ['required __proto__', { required: ['__proto__'] }],
      ['minProperties', { minProperties: 1 }],
      ['maxProperties', { maxProperties: 1 }],
      ['min and max properties', { minProperties: 1, maxProperties: 2 }],
      ['properties', { properties: { a: { type: 'integer' }, b: { type: 'string' } } }],
      ['properties true and false', { properties: { a: true, b: false } }],
      ['properties __proto__', { properties: JSON.parse('{"__proto__": {"type": "integer"}}') }],
      ['properties nested arrays', { properties: { a: { type: 'array', items: { type: 'object' } } } }],
      ['additionalProperties false', { additionalProperties: false }],
      ['additionalProperties schema', { additionalProperties: { type: 'integer' } }],
      ['additionalProperties true', { additionalProperties: true }],
      ['properties and additionalProperties false', { properties: { a: {} }, additionalProperties: false }],
      [
        'properties and additionalProperties schema',
        { properties: { a: { type: 'integer' } }, additionalProperties: { type: 'string' } },
      ],
      ['patternProperties', { patternProperties: { '^a': { type: 'integer' } } }],
      ['patternProperties several', { patternProperties: { '^a': { type: 'integer' }, b$: { minimum: 2 } } }],
      [
        'patternProperties and additionalProperties false',
        { patternProperties: { '^a': {} }, additionalProperties: false },
      ],
      [
        'patternProperties overlapping properties',
        { properties: { aa: { type: 'integer' } }, patternProperties: { '^a': { minimum: 5 } } },
      ],
      [
        'patternProperties overlapping properties with additionalProperties false',
        { properties: { a: {} }, patternProperties: { '^f': {} }, additionalProperties: false },
      ],
      [
        'patternProperties with additionalProperties schema',
        { patternProperties: { '^a': { type: 'integer' } }, additionalProperties: { type: 'string' } },
      ],
      [
        'astral patternProperties',
        { patternProperties: { [`^${emoji}$`]: { type: 'integer' } }, additionalProperties: false },
      ],
      ['propertyNames', { propertyNames: { maxLength: 1 } }],
      ['propertyNames pattern', { propertyNames: { pattern: '^[a-b]+$' } }],
      ['propertyNames false', { propertyNames: false } as JsonSchema],
      ['dependencies array', { dependencies: { a: ['b'] } }],
      ['dependencies schema', { dependencies: { a: { required: ['b'] } } }],
      ['dependencies on draft-07', { dependencies: { a: ['b'], b: { minProperties: 2 } } }, { version: 'draft-07' }],
      ['dependentRequired', { dependentRequired: { a: ['b'] } }],
      ['dependentRequired ignored on draft-07', { dependentRequired: { a: ['b'] } }, { version: 'draft-07' }],
      ['dependentSchemas', { dependentSchemas: { a: { required: ['b'] } } }],
      [
        'dependentSchemas ignored on draft-07',
        { dependentSchemas: { a: { required: ['b'] } } },
        { version: 'draft-07' },
      ],
      [
        'object of arrays of objects',
        {
          type: 'object',
          required: ['a'],
          properties: {
            a: {
              type: 'array',
              minItems: 1,
              uniqueItems: true,
              items: {
                type: 'object',
                properties: { c: { type: 'integer', minimum: 1 } },
                additionalProperties: false,
              },
            },
          },
        },
      ],
      [
        'combined object and array keywords on one node',
        { type: ['object', 'array'], minItems: 1, minProperties: 1, items: { type: 'integer' }, required: ['a'] },
      ],
    ];
    it.each(cases)('%s', (_name, schema, opts) => {
      expectAgrees(schema, opts, COLLECTIONS);
    });

    it('assumeAdditional array excludes the listed keys from additionalProperties false', () => {
      const schema: JsonSchema = { properties: { a: {} }, additionalProperties: false };
      expectAgrees(schema, { assumeAdditional: ['x'] }, COLLECTIONS);
      const { fast } = fastFor(schema, { assumeAdditional: ['x'] });
      expect(fast!({ a: 1, x: 1 })).toBe(true);
      expect(fast!({ a: 1, y: 1 })).toBe(false);
    });

    it('assumeAdditional true agrees with the interpreter', () => {
      expectAgrees({ properties: { a: {} } }, { assumeAdditional: true }, COLLECTIONS);
      expectAgrees({ properties: { a: {} }, patternProperties: { '^b': {} } }, { assumeAdditional: true }, COLLECTIONS);
    });

    it('does not read schema property names off the instance', () => {
      const { v, fast } = fastFor({ properties: { constructor: { type: 'integer' }, toString: { type: 'string' } } });
      for (const sample of [
        {},
        { constructor: 1 },
        { constructor: 'x' },
        { toString: 1 },
        Object.create({ toString: 1 }),
      ]) {
        expect(fast!(sample)).toBe(
          v.validate(sample, { properties: { constructor: { type: 'integer' }, toString: { type: 'string' } } }).valid
        );
      }
    });

    it('ignores inherited and non-enumerable properties', () => {
      const { fast } = fastFor({ required: ['a'], additionalProperties: false, properties: { a: { type: 'string' } } });
      expect(fast!(inherited)).toBe(false);
      // an own non-enumerable property satisfies required and is invisible to the additionalProperties scan
      expect(fast!(nonEnumerable)).toBe(true);
      expect(fast!({ a: 'x' })).toBe(true);
    });

    it('counts a __proto__ own key as a property', () => {
      const { v, fast } = fastFor({ maxProperties: 0 });
      expect(fast!(protoKey)).toBe(false);
      expect(fast!(protoKey)).toBe(v.validate(protoKey, { maxProperties: 0 }).valid);
    });

    it('recursive schemas without $ref are not applicable, deep trees agree', () => {
      let schema: JsonSchema = { type: 'integer' };
      let value: unknown = 1;
      for (let i = 0; i < 20; i++) {
        schema = { type: 'object', properties: { n: schema }, required: ['n'] };
        value = { n: value };
      }
      expectAgrees(schema, {}, [value, { n: value }, {}]);
    });
  });

  describe('format', () => {
    it('built-in format gets a validator under formatAssertions null', () => {
      const { fast } = fastFor({ format: 'date' }, { formatAssertions: null });
      expect(fast).toBeDefined();
      expect(fast!('2020-01-01')).toBe(true);
      expect(fast!('nope')).toBe(false);
    });

    it('formatAssertions false drops the check', () => {
      const { fast } = fastFor({ format: 'date' }, { formatAssertions: false });
      expect(fast!('nope')).toBe(true);
    });

    it('formatAssertions true without the format-assertion vocabulary drops the check', () => {
      expectAgrees({ format: 'date' }, { formatAssertions: true });
    });

    it('custom format registered on the instance has no fast validator', () => {
      const { fast } = fastFor({ format: 'mine' }, { formatAssertions: null }, (v) => {
        v.registerFormat('mine', () => true);
      });
      expect(fast).toBeUndefined();
    });

    it('a custom format overriding a built-in one has no fast validator', () => {
      const { fast } = fastFor({ format: 'date' }, { formatAssertions: null }, (v) => {
        v.registerFormat('date', () => true);
      });
      expect(fast).toBeUndefined();
    });

    describe('with a globally registered format', () => {
      afterEach(() => {
        ZSchema.unregisterFormat('global-mine');
      });
      it('has no fast validator', () => {
        ZSchema.registerFormat('global-mine', () => true);
        const { fast } = fastFor({ format: 'global-mine' }, { formatAssertions: null });
        expect(fast).toBeUndefined();
      });
    });

    it('unknown format on draft-07 fails at compile time, so no fast validator is ever built', () => {
      const v = ZSchema.create({ safe: true, version: 'draft-07' });
      expect(() => v.compile({ format: 'nope-format' })).toThrow(/SCHEMA_VALIDATION_FAILED/);
    });

    it('unknown format on the default version is ignored', () => {
      const { fast } = fastFor({ format: 'nope-format' });
      expect(fast!('x')).toBe(true);
    });

    it('ignoreUnknownFormats true ignores an unknown format', () => {
      const { fast } = fastFor({ format: 'nope-format' }, { version: 'draft-07', ignoreUnknownFormats: true });
      expect(fast!('x')).toBe(true);
    });
  });

  describe('combinators', () => {
    const cases: Array<[string, unknown, ZSchemaOptions?]> = [
      ['allOf', { allOf: [{ type: 'integer' }, { minimum: 3 }] }],
      ['allOf with boolean members', { allOf: [true, { type: 'string' }] }],
      ['allOf with a false member', { allOf: [{}, false] }],
      ['allOf empty-object members', { allOf: [{}, {}] }],
      ['anyOf', { anyOf: [{ type: 'string' }, { type: 'integer' }, { type: 'null' }] }],
      ['anyOf single', { anyOf: [{ type: 'string' }] }],
      ['anyOf with true', { anyOf: [false, true] }],
      ['anyOf all false', { anyOf: [false, false] }],
      ['oneOf', { oneOf: [{ type: 'string' }, { type: 'integer' }] }],
      ['oneOf with two matching branches', { oneOf: [{ type: 'number' }, { type: 'integer' }] }],
      ['oneOf single', { oneOf: [{ type: 'string' }] }],
      ['oneOf with empty object and false', { oneOf: [{}, false] }],
      ['oneOf with two empty objects', { oneOf: [{}, {}] }],
      ['not', { not: { type: 'string' } }],
      ['not true', { not: true }],
      ['not false', { not: false }],
      ['not empty object', { not: {} }],
      [
        'nested combinators',
        { anyOf: [{ not: { type: 'string' } }, { allOf: [{ minLength: 3 }, { oneOf: [{ type: 'string' }, true] }] }] },
      ],
      [
        'combinators beside siblings',
        { type: 'integer', anyOf: [{ minimum: 3 }, { maximum: -3 }], not: { enum: [5] } },
      ],
      ['combinators in properties', { properties: { a: { oneOf: [{ type: 'string' }, { type: 'null' }] } } }],
      ['if only', { if: { type: 'string' } }],
      ['if then', { if: { type: 'integer' }, then: { minimum: 3 } }],
      ['if else', { if: { type: 'integer' }, else: { type: 'string' } }],
      ['if then else', { if: { type: 'integer' }, then: { minimum: 3 }, else: { type: 'string' } }],
      ['if false then else', { if: false, then: false, else: { type: 'null' } }],
      ['then and else without if', { then: false, else: false }],
      [
        'if then else on draft-07',
        { if: { type: 'integer' }, then: { minimum: 3 }, else: { type: 'string' } },
        { version: 'draft-07' },
      ],
      [
        'if then else on draft-06 is ignored',
        { if: { type: 'integer' }, then: false, else: false },
        { version: 'draft-06' },
      ],
      [
        'if then else on draft-04 is ignored',
        { if: { type: 'integer' }, then: false, else: false },
        { version: 'draft-04' },
      ],
      ['allOf on draft-04', { allOf: [{ type: 'integer' }, { minimum: 3 }] }, { version: 'draft-04' }],
      ['not on draft-07', { not: { type: 'string' } }, { version: 'draft-07' }],
      ['contentEncoding is ignored on 2020-12', { contentEncoding: 'base64', contentMediaType: 'application/json' }],
    ];
    it.each(cases)('%s', (_name, schema, opts) => {
      expectAgrees(schema as JsonSchema, opts);
    });
  });

  describe('$ref', () => {
    const treeSamples: unknown[] = [
      { value: 1 },
      { value: 1, children: [] },
      { value: 1, children: [{ value: 2 }, { value: 3, children: [{ value: 4 }] }] },
      { value: 1, children: [{ value: 2, children: [{ value: 'x' }] }] },
      { value: 'x' },
      { children: [{}] },
      { children: 5 },
      [],
      null,
    ];

    const cases: Array<[string, unknown, ZSchemaOptions?]> = [
      ['$defs target', { $defs: { x: { type: 'string' } }, $ref: '#/$defs/x' }],
      [
        'definitions target',
        { definitions: { x: { type: 'string' } }, $ref: '#/definitions/x' },
        { version: 'draft-07' },
      ],
      [
        'definitions target on draft-04',
        { definitions: { x: { type: 'string' } }, $ref: '#/definitions/x' },
        { version: 'draft-04' },
      ],
      ['$ref inside properties', { $defs: { x: { type: 'integer' } }, properties: { a: { $ref: '#/$defs/x' } } }],
      ['$ref to true', { $defs: { x: true }, $ref: '#/$defs/x' }],
      ['$ref to false', { $defs: { x: false }, properties: { a: { $ref: '#/$defs/x' } } }],
      [
        '$ref with siblings on 2020-12 (both apply)',
        { $defs: { x: { type: 'integer' } }, $ref: '#/$defs/x', minimum: 3 },
      ],
      [
        '$ref with siblings on 2019-09 (both apply)',
        { $defs: { x: { type: 'integer' } }, $ref: '#/$defs/x', minimum: 3 },
        { version: 'draft2019-09' },
      ],
      [
        '$ref with siblings on draft-07 (siblings ignored)',
        { definitions: { x: { type: 'integer' } }, $ref: '#/definitions/x', minimum: 3, type: 'string' },
        { version: 'draft-07' },
      ],
      [
        '$ref with siblings on draft-04 (siblings ignored)',
        { definitions: { x: { type: 'integer' } }, $ref: '#/definitions/x', maximum: 1 },
        { version: 'draft-04' },
      ],
      [
        'chained refs on 2020-12',
        { $defs: { a: { $ref: '#/$defs/b' }, b: { $ref: '#/$defs/c' }, c: { type: 'string' } }, $ref: '#/$defs/a' },
      ],
      [
        'chained refs on draft-07',
        {
          definitions: {
            a: { $ref: '#/definitions/b', type: 'null' },
            b: { $ref: '#/definitions/c' },
            c: { type: 'string' },
          },
          $ref: '#/definitions/a',
        },
        { version: 'draft-07' },
      ],
      [
        'ref inside combinators',
        { $defs: { s: { type: 'string' } }, anyOf: [{ $ref: '#/$defs/s' }, { type: 'integer' }] },
      ],
      ['empty $ref on draft-07 is inert', { $ref: '', type: 'string' }, { version: 'draft-07' }],
      [
        'tree via $ref to root',
        {
          type: 'object',
          properties: { value: { type: 'integer' }, children: { type: 'array', items: { $ref: '#' } } },
        },
      ],
      [
        'tree via $ref to root on draft-07',
        {
          type: 'object',
          properties: { value: { type: 'integer' }, children: { type: 'array', items: { $ref: '#' } } },
        },
        { version: 'draft-07' },
      ],
      [
        'mutually recursive refs',
        {
          $defs: {
            a: { properties: { b: { $ref: '#/$defs/b' } } },
            b: { properties: { a: { $ref: '#/$defs/a' }, n: { type: 'integer' } } },
          },
          $ref: '#/$defs/a',
        },
      ],
    ];
    it.each(cases)('%s', (_name, schema, opts) => {
      expectAgrees(schema as JsonSchema, opts);
    });

    it('recursive tree agrees on shallow and deep data', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: { value: { type: 'integer' }, children: { type: 'array', items: { $ref: '#' } } },
      };
      expectAgrees(schema, {}, treeSamples);
      const { v, fast } = fastFor(schema);
      expect(fast).toBeDefined();
      const deepValid = depth(200, { value: 1 });
      const deepInvalid = depth(200, { value: 'x' });
      expect(fast!(deepValid)).toBe(true);
      expect(fast!(deepInvalid)).toBe(false);
      expect(fast!(deepValid)).toBe(v.validate(deepValid, schema).valid);
      expect(fast!(deepInvalid)).toBe(v.validate(deepInvalid, schema).valid);
    });

    it('$ref to a schema registered with setRemoteReference', () => {
      const remote: JsonSchema = { type: 'string', minLength: 2 };
      const schema: JsonSchema = { properties: { a: { $ref: 'http://example.com/remote.json' } } };
      const { v, fast } = fastFor(schema, {}, (zs) => {
        zs.setRemoteReference('http://example.com/remote.json', remote);
      });
      expect(fast).toBeDefined();
      for (const sample of [{ a: 'ab' }, { a: 'a' }, { a: 1 }, {}, 1]) {
        expect(fast!(sample)).toBe(v.validate(sample, schema).valid);
      }
    });

    it('a deep $ref chain on draft-07 agrees or has no validator', () => {
      const definitions: Record<string, JsonSchema> = { end: { type: 'string' } };
      let previous = 'end';
      for (let i = 0; i < 120; i++) {
        definitions[`r${i}`] = { $ref: `#/definitions/${previous}` };
        previous = `r${i}`;
      }
      const schema: JsonSchema = { definitions, properties: { a: { $ref: `#/definitions/${previous}` } } };
      const { fast } = fastFor(schema, { version: 'draft-07' });
      expect(fast).toBeUndefined();
    });
  });

  describe('fallback', () => {
    const unsupported: Array<[string, JsonSchema, ZSchemaOptions?]> = [
      ['properties with an unsupported child', { properties: { a: { unevaluatedProperties: false } } }],
      ['items with an unsupported child', { items: { unevaluatedItems: false } }],
      ['contains with an unsupported child', { contains: { unevaluatedItems: false } }],
      ['propertyNames with an unsupported child', { propertyNames: { unevaluatedProperties: false } }],
      ['dependencies with an unsupported child', { dependencies: { a: { unevaluatedProperties: false } } }],
      ['allOf with an unsupported member', { allOf: [{ unevaluatedProperties: false }] }],
      ['not with an unsupported child', { not: { unevaluatedItems: false } }],
      ['unevaluatedProperties', { unevaluatedProperties: false }],
      ['unevaluatedItems', { unevaluatedItems: false }],
      ['$dynamicRef', { $dynamicRef: '#x', $dynamicAnchor: 'x' }],
      ['$recursiveRef', { $recursiveRef: '#', $recursiveAnchor: true }, { version: 'draft2019-09' }],
      ['contentEncoding on draft-07', { contentEncoding: 'base64' }, { version: 'draft-07' }],
      ['contentMediaType on draft-07', { contentMediaType: 'application/json' }, { version: 'draft-07' }],
      ['self-referential legacy $ref', { $ref: '#' }, { version: 'draft-07' }],
    ];
    it.each(unsupported)('%s has no fast validator', (_name, schema, opts) => {
      expect(fastFor(schema, opts).fast).toBeUndefined();
    });

    it('customValidator has no fast validator', () => {
      const v = ZSchema.create({ safe: true, customValidator: () => {} });
      const schema: JsonSchema = { type: 'string' };
      const res = v.compile(schema)('a');
      expect(res.valid).toBe(true);
      expect(buildFastValidator({ type: 'string' }, v)).toBeUndefined();
    });
  });

  it('ignores unknown keywords', () => {
    const { fast } = fastFor({ 'x-foo': { type: 'string' }, 'x-bar': 1 } as JsonSchema);
    expect(fast).toBeDefined();
    expect(fast!(1)).toBe(true);
  });

  describe('compile() public level', () => {
    const schema: JsonSchema = { type: 'string', minLength: 2 };

    it('ZSchema returns true for valid data and throws for invalid data', () => {
      const v = ZSchema.create();
      const fn = v.compile(schema);
      expect(fn('abc')).toBe(true);
      expect(() => fn(1)).toThrow(/JSON_OBJECT_VALIDATION_FAILED/);
    });

    it('ZSchemaSafe returns a fresh success object and the unchanged failure', () => {
      const v = ZSchema.create({ safe: true });
      const fn = v.compile(schema);
      const a = fn('abc');
      const b = fn('abc');
      expect(a).toEqual({ valid: true });
      expect(a).not.toBe(b);
      expect(codesOf(fn(1))).toEqual(codesOf(v.validate(1, schema)));
      expect(codesOf(fn('a'))).toEqual(['MIN_LENGTH']);
    });

    it('ZSchemaAsync resolves true and rejects with the same codes', async () => {
      const v = ZSchema.create({ async: true });
      const fn = v.compile(schema);
      await expect(fn('abc')).resolves.toBe(true);
      const rejected = await fn(1).catch((error: unknown) => error as { details: Array<{ code: string }> });
      expect((rejected as { details: Array<{ code: string }> }).details.map((d) => d.code)).toEqual(['INVALID_TYPE']);
    });

    it('ZSchemaAsyncSafe resolves the success shape and the failure', async () => {
      const v = ZSchema.create({ async: true, safe: true });
      const fn = v.compile(schema);
      await expect(fn('abc')).resolves.toEqual({ valid: true });
      const bad = await fn(1);
      expect(bad.valid).toBe(false);
      expect(codesOf(bad)).toEqual(['INVALID_TYPE']);
    });

    it('an options argument, even {}, gives the same result', () => {
      const v = ZSchema.create({ safe: true });
      const fn = v.compile(schema);
      for (const data of ['abc', 'a', 1]) {
        const expected = v.validate(data, schema);
        const optionVariants: Array<ValidateOptions | undefined> = [undefined, {}, { excludeErrors: ['MIN_LENGTH'] }];
        for (const options of optionVariants) {
          const actual = fn(data, options);
          expect(actual.valid).toBe(v.validate(data, schema, options ?? {}).valid);
          if (options === undefined || Object.keys(options).length === 0) {
            expect(codesOf(actual)).toEqual(codesOf(expected));
          }
        }
      }
    });

    it('a schema with unsupported keywords still validates correctly', () => {
      const v = ZSchema.create({ safe: true });
      const unsupportedSchema: JsonSchema = { type: 'object', unevaluatedProperties: false, properties: { a: {} } };
      const fn = v.compile(unsupportedSchema);
      expect(fn({ a: 1 }).valid).toBe(true);
      expect(codesOf(fn({ b: 1 }))).toEqual(codesOf(v.validate({ b: 1 }, unsupportedSchema)));
      expect(codesOf(fn({ b: 1 }))).not.toEqual([]);
    });

    it('boolean schemas still work', () => {
      const v = ZSchema.create({ safe: true });
      expect(v.compile(true)(1).valid).toBe(true);
      expect(codesOf(v.compile(false)(1))).toEqual(['SCHEMA_IS_FALSE']);
    });
  });

  describe('assumeAdditional is read at call time', () => {
    it('removing an entry from the option array in place is honoured', () => {
      const assumeAdditional = ['x'];
      const v = ZSchema.create({ safe: true, assumeAdditional });
      const schema: JsonSchema = { type: 'object', additionalProperties: false };
      const fn = v.compile(schema);
      expect(fn({ x: 1 }).valid).toBe(true);
      assumeAdditional.splice(0, 1);
      const expected = v.validate({ x: 1 }, schema).valid;
      expect(expected).toBe(false);
      expect(fn({ x: 1 }).valid).toBe(expected);
    });
  });

  describe('hand-off to the interpreter', () => {
    it('invalid data on a supported schema costs one cache lookup', () => {
      const v = ZSchema.create({ safe: true });
      const fn = v.compile({ type: 'string', minLength: 2 });
      const count = lookups(v);
      expect(fn(1).valid).toBe(false);
      expect(count()).toBe(1);
    });

    it('an unsupported schema costs one cache lookup', () => {
      const v = ZSchema.create({ safe: true });
      const fn = v.compile({ unevaluatedProperties: false, properties: { a: {} } });
      const count = lookups(v);
      expect(fn({ a: 1 }).valid).toBe(true);
      expect(count()).toBe(1);
    });

    it('registerFormat after a failed call is honoured', () => {
      const v = ZSchema.create({ safe: true, formatAssertions: null });
      const schema: JsonSchema = { type: 'string', format: 'date' };
      const fn = v.compile(schema);
      expect(fn(1).valid).toBe(false);
      v.registerFormat('date', () => false);
      expect(fn('2020-01-01').valid).toBe(false);
      expect(fn('2020-01-01').valid).toBe(v.validate('2020-01-01', schema).valid);
      expect(codesOf(fn('2020-01-01'))).toEqual(codesOf(v.validate('2020-01-01', schema)));
    });

    it('setRemoteReference after a failed call is honoured', () => {
      const v = ZSchema.create({ safe: true });
      const schema: JsonSchema = { type: 'string' };
      const fn = v.compile(schema);
      expect(fn(1).valid).toBe(false);
      v.setRemoteReference('http://example.com/other.json', { type: 'number' });
      for (const data of ['a', 1]) {
        expect(fn(data).valid).toBe(v.validate(data, schema).valid);
        expect(codesOf(fn(data))).toEqual(codesOf(v.validate(data, schema)));
      }
    });

    it('a failed compiled call does not affect a later plain validate', () => {
      const v = ZSchema.create({ safe: true });
      const fn = v.compile({ type: 'string' });
      expect(fn(1).valid).toBe(false);
      const other: JsonSchema = { type: 'number' };
      expect(v.validate(1, other).valid).toBe(true);
      expect(codesOf(v.validate('x', other))).toEqual(['INVALID_TYPE']);
      expect(codesOf(fn(1))).toEqual(['INVALID_TYPE']);
    });
  });

  describe('a fast validator that throws', () => {
    // the catch in _fastValidate hands a throwing fast validator over to the interpreter, whose result must stand
    // (uniqueItems throws past maxRecursionDepth)
    // a const schema cannot hold data nested deeper than the limit (compiling it would fail first), so the
    // const case makes the equality check throw through a throwing accessor instead
    const throwing = {
      get a(): number {
        throw new Error('unreadable');
      },
    };
    it.each([
      ['const', { const: { a: 1 } }, throwing],
      ['uniqueItems', { uniqueItems: true }, [depth(12, 1), depth(12, 1)]],
    ])('%s makes the fast validator throw and still gives the interpreter result', (_name, schema, data) => {
      const { v, fast } = fastFor(schema, { maxRecursionDepth: 10 });
      const fn = v.compile(schema);
      expect(fast).toBeDefined();
      expect(() => fast!(data)).toThrow(/.+/);
      expect(outcome(() => fn(data))).toEqual(outcome(() => v.validate(data, schema)));
    });
  });

  describe('invalidation', () => {
    it('registerFormat after compile is honoured', () => {
      const v = ZSchema.create({ safe: true, formatAssertions: null });
      const schema: JsonSchema = { format: 'date' };
      const fn = v.compile(schema);
      expect(fn('2020-01-01').valid).toBe(true);
      v.registerFormat('date', () => false);
      expect(fn('2020-01-01').valid).toBe(v.validate('2020-01-01', schema).valid);
      expect(fn('2020-01-01').valid).toBe(false);
    });

    it('setRemoteReference after compile is honoured', () => {
      const v = ZSchema.create({ safe: true });
      const schema: JsonSchema = { type: 'string' };
      const fn = v.compile(schema);
      expect(fn('a').valid).toBe(true);
      v.setRemoteReference('http://example.com/other.json', { type: 'number' });
      expect(fn('a').valid).toBe(v.validate('a', schema).valid);
      expect(fn(1).valid).toBe(v.validate(1, schema).valid);
    });

    it('mutating options after compile is honoured', () => {
      const v = ZSchema.create({ safe: true, formatAssertions: null });
      const schema: JsonSchema = { format: 'date' };
      const fn = v.compile(schema);
      expect(fn('nope').valid).toBe(false);
      v.options.formatAssertions = false;
      expect(fn('nope').valid).toBe(v.validate('nope', schema).valid);
      expect(fn('nope').valid).toBe(true);
      v.options.formatAssertions = null;
      expect(fn('nope').valid).toBe(false);
    });
  });

  describe('the fast path is taken', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('skips the interpreter for valid data on a supported schema', () => {
      const v = ZSchema.create({ safe: true });
      const fn = v.compile({ type: 'string', minLength: 2 });
      const spy = spyOnInterpreter();
      expect(fn('abc').valid).toBe(true);
      expect(spy).not.toHaveBeenCalled();
      expect(fn(1).valid).toBe(false);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('runs the interpreter for an unsupported schema', () => {
      const v = ZSchema.create({ safe: true });
      const fn = v.compile({ unevaluatedProperties: false, properties: { a: {} } });
      const spy = spyOnInterpreter();
      expect(fn({ a: 1 }).valid).toBe(true);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('skips the interpreter for valid data on an object schema', () => {
      const v = ZSchema.create({ safe: true });
      const fn = v.compile({
        type: 'object',
        required: ['a'],
        properties: { a: { type: 'array', items: { type: 'integer' } } },
      });
      const spy = spyOnInterpreter();
      expect(fn({ a: [1, 2] }).valid).toBe(true);
      expect(spy).not.toHaveBeenCalled();
      expect(fn({ a: [1, 'x'] }).valid).toBe(false);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('validate(data, schemaObject) takes the fast path once the schema is cached', () => {
      const v = ZSchema.create({ safe: true });
      const schema: JsonSchema = { type: 'object', properties: { a: { type: 'integer' } } };
      // first call compiles, meta-validates and caches the schema through the interpreter
      expect(v.validate({ a: 1 }, schema).valid).toBe(true);
      const spy = spyOnInterpreter();
      // a structurally equal schema object hits the cache entry and its fast validator
      expect(v.validate({ a: 2 }, { type: 'object', properties: { a: { type: 'integer' } } }).valid).toBe(true);
      expect(spy).not.toHaveBeenCalled();
      expect(v.validate({ a: 'x' }, schema).valid).toBe(false);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('includeErrors and excludeErrors do not disable it, schemaPath does', () => {
      const v = ZSchema.create({ safe: true });
      const schema: JsonSchema = { type: 'object', properties: { a: { type: 'integer' } } };
      const fn = v.compile(schema);
      const spy = spyOnInterpreter();
      expect(fn({ a: 1 }, { excludeErrors: ['INVALID_TYPE'] }).valid).toBe(true);
      expect(fn({ a: 1 }, { includeErrors: ['INVALID_TYPE'] }).valid).toBe(true);
      expect(spy).not.toHaveBeenCalled();
      // the sub-schema is what gets validated, so the root's fast validator must not answer
      expect(fn('x', { schemaPath: 'properties.a' }).valid).toBe(false);
      expect(fn(1, { schemaPath: 'properties.a' }).valid).toBe(true);
      expect(spy).toHaveBeenCalledTimes(2);
    });

    it('filtered calls agree with validate() on invalid data', () => {
      const ref = ZSchema.create({ safe: true });
      const v = ZSchema.create({ safe: true });
      const schema: JsonSchema = { type: 'object', properties: { a: { type: 'integer', minimum: 5 } } };
      const fn = v.compile(schema);
      const optionSets: ValidateOptions[] = [
        { excludeErrors: ['INVALID_TYPE'] },
        { includeErrors: ['MINIMUM'] },
        { excludeErrors: ['MINIMUM'] },
      ];
      for (const options of optionSets) {
        for (const data of [{ a: 'x' }, { a: 1 }, { a: 7 }, 'nope']) {
          expect(fn(data, options).valid).toBe(ref.validate(data, schema, options).valid);
        }
      }
    });

    it('async variants resolve through the fast path', async () => {
      const v = ZSchema.create({ async: true });
      const fn = v.compile({ type: 'string' });
      const spy = spyOnInterpreter();
      await expect(fn('abc')).resolves.toBe(true);
      expect(spy).not.toHaveBeenCalled();
      await expect(fn(1)).rejects.toBeInstanceOf(Error);
    });
  });
});
