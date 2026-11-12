import type { JsonSchema } from '../../src/json-schema-versions.ts';
import type { ValidateOptions, ValidateResponse } from '../../src/z-schema-base.ts';
import type { ZSchemaOptions } from '../../src/z-schema-options.ts';
import type { ZSchemaSafe } from '../../src/z-schema.ts';

import { vi } from 'vitest';

import { ValidateError } from '../../src/errors.ts';
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

const sparseArray = (length: number, entries: Record<number, unknown>): unknown[] => {
  const arr: unknown[] = [];
  arr.length = length;
  for (const key of Object.keys(entries)) {
    arr[Number(key)] = entries[Number(key)];
  }
  return arr;
};

const makeAsyncFormat = (impl: (value: unknown) => Promise<boolean>) => {
  const v = ZSchema.create({ async: true, safe: true, formatAssertions: null });
  const fn = vi.fn<(value: unknown) => Promise<boolean>>(impl);
  v.registerFormat('mine', fn);
  return { v, fn };
};
const isOkAsync = (value: unknown) => Promise.resolve(value === 'ok');
const b64 = (text: string) => Buffer.from(text).toString('base64');

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

const suites = (
  title: string,
  schemas: Array<[string, JsonSchema]>,
  samples: unknown[],
  drafts: ReadonlyArray<ZSchemaOptions['version']>
) => {
  describe(title, () => {
    for (const version of drafts) {
      for (const [name, schema] of schemas) {
        it(`${version}: ${name} has a fast validator`, () => {
          expect(fastFor(schema, { version }).fast).toBeDefined();
        });
        it(`${version}: ${name} agrees with the interpreter`, () => {
          const { v, fast } = fastFor(schema, { version });
          if (fast === undefined) {
            return;
          }
          for (const sample of samples) {
            expect(fast(sample), `${JSON.stringify(sample)} against ${JSON.stringify(schema)}`).toBe(
              v.validate(sample, schema).valid
            );
          }
        });
      }
    }
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

    it('a sync custom format registered on the instance builds a fast validator', () => {
      const schema: JsonSchema = { format: 'mine' };
      const { v, fast } = fastFor(schema, { formatAssertions: null }, (z) => {
        z.registerFormat('mine', (value) => value === 'ok');
      });
      expect(fast).toBeDefined();
      for (const sample of SAMPLES.concat(['ok'])) {
        expect(fast!(sample)).toBe(v.validate(sample, schema).valid);
      }
    });

    it('a truthy non-boolean return is valid on both paths', () => {
      const schema: JsonSchema = { format: 'mine' };
      const { v, fast } = fastFor(schema, { formatAssertions: null }, (z) => {
        z.registerFormat('mine', (() => 1) as unknown as () => boolean);
      });
      expect(fast).toBeDefined();
      expect(fast!('x')).toBe(true);
      expect(v.validate('x', schema).valid).toBe(true);
    });

    it('a sync custom format overriding a built-in one builds a fast validator', () => {
      const schema: JsonSchema = { format: 'date' };
      const { v, fast } = fastFor(schema, { formatAssertions: null }, (z) => {
        z.registerFormat('date', (value) => value === 'anything');
      });
      expect(fast).toBeDefined();
      for (const sample of ['anything', '2020-01-01', 1]) {
        expect(fast!(sample)).toBe(v.validate(sample, schema).valid);
      }
    });

    it('a callback-style custom format has no fast validator', () => {
      const { fast } = fastFor({ format: 'mine' }, { formatAssertions: null }, (v) => {
        v.registerFormat('mine', ((_value: unknown, callback: (result: boolean) => void) => {
          callback(true);
        }) as unknown as () => boolean);
      });
      expect(fast).toBeUndefined();
    });

    it('a throwing sync custom format gives the same outcome on both paths', () => {
      const schema: JsonSchema = { format: 'mine' };
      const { v, fast } = fastFor(schema, { formatAssertions: null }, (z) => {
        z.registerFormat('mine', (value) => {
          if (value === 'boom') {
            throw new Error('boom');
          }
          return value === 'ok';
        });
      });
      expect(fast).toBeDefined();
      expect(() => fast!('boom')).toThrow('boom');
      expect(fast!('ok')).toBe(true);
      expect(fast!('no')).toBe(false);
      // the compiled path hands the throw to the interpreter, which reproduces it exactly as v.validate does
      const compiled = v.compile(schema);
      expect(outcome(() => compiled('boom') as never)).toEqual(outcome(() => v.validate('boom', schema)));
    });

    describe('with a promise-returning custom format', () => {
      const schema: JsonSchema = { format: 'mine' };

      it('disables the fast validator after the first hit and calls the format one extra time in total', async () => {
        const { v, fn } = makeAsyncFormat(isOkAsync);
        const first = await v.validate('ok', schema);
        const second = await v.validate('no', schema);
        const third = await v.validate('ok', schema);
        const freshOk = await makeAsyncFormat(isOkAsync).v.validate('ok', schema);
        const freshNo = await makeAsyncFormat(isOkAsync).v.validate('no', schema);
        expect([first.valid, second.valid, third.valid]).toEqual([freshOk.valid, freshNo.valid, freshOk.valid]);
        expect([first.valid, second.valid, third.valid]).toEqual([true, false, true]);
        const entry = v.compiledSchemaCache.getEntry(v.compiledSchemaCache.keyOf(schema)!, v.options);
        expect(entry?.fast).toBeNull();
        expect(fn).toHaveBeenCalledTimes(4);
      });

      it('a rejecting promise is invalid and does not surface as an unhandled rejection', async () => {
        const { v } = makeAsyncFormat(() => Promise.reject(new Error('nope')));
        const unhandled = vi.fn<(reason: unknown) => void>();
        process.on('unhandledRejection', unhandled);
        try {
          const first = await v.validate('x', schema);
          const second = await v.validate('x', schema);
          const third = await v.validate('x', schema);
          expect([first.valid, second.valid, third.valid]).toEqual([false, false, false]);
          await new Promise<void>((resolve) => {
            setTimeout(resolve, 10);
          });
        } finally {
          process.off('unhandledRejection', unhandled);
        }
        expect(unhandled).not.toHaveBeenCalled();
      });
    });

    describe('with a globally registered format', () => {
      afterEach(() => {
        ZSchema.unregisterFormat('global-mine');
      });
      it('builds a fast validator for a sync one', () => {
        ZSchema.registerFormat('global-mine', (value) => value === 'ok');
        const { v, fast } = fastFor({ format: 'global-mine' }, { formatAssertions: null });
        expect(fast).toBeDefined();
        expect(fast!('ok')).toBe(true);
        expect(fast!('no')).toBe(v.validate('no', { format: 'global-mine' }).valid);
      });
    });
  });

  describe('contentEncoding and contentMediaType on draft-07', () => {
    const inputs: unknown[] = [
      'aGVsbG8=',
      'not base64!!',
      '',
      'a',
      1,
      null,
      {},
      [],
      '{"a":1}',
      '{bad json',
      b64('{"a":1}'),
      b64('{bad json'),
      b64('hello'),
      'e30=',
      'e30',
    ];
    const cases: Array<[string, JsonSchema]> = [
      ['base64', { contentEncoding: 'base64' }],
      ['application/json', { contentMediaType: 'application/json' }],
      ['base64 and application/json', { contentEncoding: 'base64', contentMediaType: 'application/json' }],
      ['unknown encoding', { contentEncoding: '7bit' }],
      ['unknown media type', { contentMediaType: 'text/plain' }],
      ['unknown encoding with application/json', { contentEncoding: '7bit', contentMediaType: 'application/json' }],
      ['base64 with unknown media type', { contentEncoding: 'base64', contentMediaType: 'text/plain' }],
    ];
    it.each(cases)('%s agrees with the interpreter', (_name, schema) => {
      expectAgrees(schema, { version: 'draft-07' }, inputs);
    });

    it('is ignored on draft2020-12 and a fast validator is built', () => {
      const { fast } = fastFor({ contentEncoding: 'base64', contentMediaType: 'application/json' });
      expect(fast).toBeDefined();
      expect(fast!('not base64!!')).toBe(true);
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

    // The interpreter runs both keywords on every version; only the keywords the version knows contribute.
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
            const expected = outcome(() => v.validate(data, schema));
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

  describe('fallback', () => {
    const unsupported: Array<[string, JsonSchema, ZSchemaOptions?]> = [
      ['properties with an unsupported child', { properties: { a: { $dynamicRef: '#x', $dynamicAnchor: 'x' } } }],
      ['items with an unsupported child', { items: { $dynamicRef: '#x', $dynamicAnchor: 'x' } }],
      ['contains with an unsupported child', { contains: { $dynamicRef: '#x', $dynamicAnchor: 'x' } }],
      ['propertyNames with an unsupported child', { propertyNames: { $dynamicRef: '#x', $dynamicAnchor: 'x' } }],
      ['dependencies with an unsupported child', { dependencies: { a: { $dynamicRef: '#x', $dynamicAnchor: 'x' } } }],
      ['allOf with an unsupported member', { allOf: [{ $dynamicRef: '#x', $dynamicAnchor: 'x' }] }],
      ['not with an unsupported child', { not: { $dynamicRef: '#x', $dynamicAnchor: 'x' } }],
      ['unevaluatedItems with an unsupported child', { unevaluatedItems: { $dynamicRef: '#x', $dynamicAnchor: 'x' } }],
      ['$dynamicRef', { $dynamicRef: '#x', $dynamicAnchor: 'x' }],
      ['$recursiveRef', { $recursiveRef: '#', $recursiveAnchor: true }, { version: 'draft2019-09' }],
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
      const unsupportedSchema: JsonSchema = {
        type: 'object',
        additionalProperties: false,
        properties: { a: { $dynamicRef: '#x' } },
        $defs: { x: { $dynamicAnchor: 'x' } },
      };
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
      const fn = v.compile({ properties: { a: { $dynamicRef: '#x' } }, $defs: { x: { $dynamicAnchor: 'x' } } });
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
      const fn = v.compile({ properties: { a: { $dynamicRef: '#x' } }, $defs: { x: { $dynamicAnchor: 'x' } } });
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

    it('an error filter or a schemaPath disables it, empty filters do not', () => {
      const v = ZSchema.create({ safe: true });
      const schema: JsonSchema = { type: 'object', properties: { a: { type: 'integer' } } };
      const fn = v.compile(schema);
      const spy = spyOnInterpreter();
      expect(fn({ a: 1 }, { includeErrors: [], excludeErrors: [] }).valid).toBe(true);
      expect(spy).not.toHaveBeenCalled();
      expect(fn({ a: 1 }, { excludeErrors: ['INVALID_TYPE'] }).valid).toBe(true);
      expect(fn({ a: 1 }, { includeErrors: ['INVALID_TYPE'] }).valid).toBe(true);
      expect(spy).toHaveBeenCalledTimes(2);
      spy.mockClear();
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
      // callback mode never calls isValid: the interpreter path completes through processAsyncTasks
      const spy = vi.spyOn(Report.prototype, 'processAsyncTasks');
      await expect(fn('abc')).resolves.toBe(true);
      expect(spy).not.toHaveBeenCalled();
      await expect(fn(1)).rejects.toBeInstanceOf(ValidateError);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('callback mode completes on a later task, like a validation that ran the interpreter', async () => {
      const v = ZSchema.create({ async: true });
      const schema: JsonSchema = { type: 'string' };
      await v.validate('warm', schema);
      const spy = vi.spyOn(Report.prototype, 'processAsyncTasks');
      const order: string[] = [];
      const done = new Promise<void>((resolve) => {
        v._validate('abc', schema, (err, valid) => {
          order.push(`callback ${String(err)} ${String(valid)}`);
          resolve();
        });
      });
      order.push('returned');
      await Promise.resolve();
      order.push('microtask');
      await done;
      expect(order).toEqual(['returned', 'microtask', 'callback undefined true']);
      expect(spy).not.toHaveBeenCalled();
    });

    it('a filtered call on a cached schema returns what an uncached validator returns', () => {
      const schema: JsonSchema = { oneOf: [{ type: 'string' }, { type: 'number' }] };
      const filters: ValidateOptions[] = [{ excludeErrors: ['INVALID_TYPE'] }, { includeErrors: ['MINIMUM'] }];
      for (const filter of filters) {
        const warm = ZSchema.create({ safe: true });
        expect(warm.validate('x', schema).valid).toBe(true);
        const cold = ZSchema.create({ safe: true }).validate('x', schema, filter);
        // with INVALID_TYPE filtered out both branches count as passing
        expect(cold.valid).toBe(false);
        expect(warm.validate('x', schema, filter).valid).toBe(false);
        expect(warm.compile(schema)('x', filter).valid).toBe(false);
      }
    });
  });
});
