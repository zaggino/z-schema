import type { JsonSchema } from '../../src/json-schema-versions.ts';
import type { ZSchemaSafe } from '../../src/z-schema.ts';

import { ValidateError } from '../../src/errors.ts';
import { resolveMaxDataDepth } from '../../src/z-schema-options.ts';
import { ZSchema } from '../../src/z-schema.ts';
import { buildFastFor, fastFor, outcome } from '../lib/fast-validator.ts';

const CODE = 'MAX_DATA_DEPTH_EXCEEDED';

/** `n` arrays around `leaf`: the innermost array is at depth `n - 1`, the leaf at depth `n`. */
const arrays = (n: number, leaf: unknown): unknown => {
  let node = leaf;
  for (let i = 0; i < n; i++) {
    node = [node];
  }
  return node;
};

/** `n` objects (key `c`) around `leaf`. */
const objects = (n: number, leaf: unknown): unknown => {
  let node = leaf;
  for (let i = 0; i < n; i++) {
    node = { c: node };
  }
  return node;
};

/** `n` two-item arrays `[head, next]` around `1`. */
const pairs = (n: number, head: unknown): unknown => {
  let node: unknown = 1;
  for (let i = 0; i < n; i++) {
    node = [head, node];
  }
  return node;
};

const run = (options: Record<string, unknown>, schema: JsonSchema, data: unknown) =>
  ZSchema.create({ safe: true, ...options }).validate(data, schema);

/** Asserts the result is invalid with exactly one detail carrying the code and the limit. */
const expectExceeded = (result: ReturnType<typeof run>, limit: number) => {
  expect(result.valid).toBe(false);
  expect(result.err?.details?.length).toBe(1);
  expect(result.err?.details?.[0].code).toBe(CODE);
  expect(result.err?.details?.[0].params).toEqual([limit]);
};

interface Shape {
  name: string;
  schema: JsonSchema;
  build: (n: number) => unknown;
}

const shapes: Shape[] = [
  { name: 'items with $ref', schema: { items: { $ref: '#' } }, build: (n) => arrays(n, 1) },
  { name: 'properties with $ref', schema: { properties: { c: { $ref: '#' } } }, build: (n) => objects(n, 1) },
  {
    name: 'additionalProperties with $ref',
    schema: { additionalProperties: { $ref: '#' } },
    build: (n) => objects(n, 1),
  },
  {
    name: 'patternProperties with $ref',
    schema: { patternProperties: { '^c$': { $ref: '#' } } },
    build: (n) => objects(n, 1),
  },
  {
    name: 'contains with $ref',
    schema: { type: ['array', 'number'], contains: { $ref: '#' } },
    build: (n) => arrays(n, 1),
  },
  { name: 'unevaluatedItems with $ref', schema: { unevaluatedItems: { $ref: '#' } }, build: (n) => arrays(n, 1) },
  {
    name: 'unevaluatedProperties with $ref',
    schema: { unevaluatedProperties: { $ref: '#' } },
    build: (n) => objects(n, 1),
  },
];

/** `n` levels of an object holding an array holding the next level; the innermost value is `{}`. */
const tree = (n: number): unknown => {
  let node: unknown = {};
  for (let i = 0; i < n; i++) {
    node = { children: [node] };
  }
  return node;
};

const noopValidator = () => {};

/** `n` levels of an object with a `children` array, ending in `1`. */
const deepItem = (n: number): unknown => {
  let node: unknown = 1;
  for (let i = 0; i < n; i++) {
    node = { value: 1, children: [node] };
  }
  return node;
};

describe('maxDataDepth option', () => {
  it('defaults to 500', () => {
    expect(ZSchema.getDefaultOptions().maxDataDepth).toBe(500);
    expect(ZSchema.create().options.maxDataDepth).toBe(500);
  });

  for (const { name, schema, build } of shapes) {
    describe(`shape: ${name}`, () => {
      it('accepts data nested up to the limit and rejects one level more', () => {
        expect(run({ maxDataDepth: 5 }, schema, build(5)).valid).toBe(true);
        expectExceeded(run({ maxDataDepth: 5 }, schema, build(6)), 5);
      });

      it('applies the default limit of 500', () => {
        expect(run({}, schema, build(500)).valid).toBe(true);
        expectExceeded(run({}, schema, build(501)), 500);
      });

      // An item validated by contains or unevaluated* adds no path segment, so there the length is not the depth.
      const inSubReport = /contains|unevaluated/.test(name);

      it('reports the path of the container whose children were not validated', () => {
        const asArray = run({ maxDataDepth: 5, reportPathAsArray: true }, schema, build(6));
        const asString = run({ maxDataDepth: 5 }, schema, build(6));
        const arrayPath = asArray.err?.details?.[0].path;
        const stringPath = asString.err?.details?.[0].path;
        expect(typeof stringPath).toBe('string');
        expect(Array.isArray(arrayPath)).toBe(true);
        if (!inSubReport) {
          expect((arrayPath as unknown[]).length).toBe(5);
        }
      });
    });
  }

  it('measures a mixed tree', () => {
    const schema: JsonSchema = { properties: { children: { items: { $ref: '#' } } } };
    // Each level is an object plus an array: two data levels.
    expect(run({ maxDataDepth: 6 }, schema, tree(3)).valid).toBe(true);
    expectExceeded(run({ maxDataDepth: 5 }, schema, tree(3)), 5);
  });

  it('measures draft-07 data', () => {
    const schema: JsonSchema = { items: { $ref: '#' } };
    expect(run({ version: 'draft-07', maxDataDepth: 5 }, schema, arrays(5, 1)).valid).toBe(true);
    expectExceeded(run({ version: 'draft-07', maxDataDepth: 5 }, schema, arrays(6, 1)), 5);
  });

  it('does not measure data the schema never descends into', () => {
    expect(run({ maxDataDepth: 2 }, { type: 'array' }, arrays(50, 1)).valid).toBe(true);
    expect(run({ maxDataDepth: 2 }, { properties: { other: {} } }, objects(50, 1)).valid).toBe(true);
    expect(run({ maxDataDepth: 0 }, { items: {} }, []).valid).toBe(true);
  });

  it('turns the limit off with Infinity', () => {
    expect(run({ maxDataDepth: Infinity }, shapes[0].schema, arrays(800, 1)).valid).toBe(true);
    expect(ZSchema.create({ maxDataDepth: Infinity }).options.maxDataDepth).toBe(Infinity);
  });

  it('with 0 validates the root value and nothing below it', () => {
    expect(run({ maxDataDepth: 0 }, { type: 'number' }, 1).valid).toBe(true);
    expect(run({ maxDataDepth: 0 }, { type: 'array', items: {} }, []).valid).toBe(true);
    expectExceeded(run({ maxDataDepth: 0 }, { items: {} }, [1]), 0);
  });

  describe('normalisation', () => {
    it('treats a negative number as 0', () => {
      expectExceeded(run({ maxDataDepth: -1 }, { items: {} }, [1]), 0);
      expect(run({ maxDataDepth: -1 }, { type: 'number' }, 1).valid).toBe(true);
    });

    it('rounds a fraction down', () => {
      const [{ schema }] = shapes;
      expect(run({ maxDataDepth: 2.7 }, schema, arrays(2, 1)).valid).toBe(true);
      expectExceeded(run({ maxDataDepth: 2.7 }, schema, arrays(3, 1)), 2);
    });

    it('uses the default for a value that is not a number', () => {
      const [{ schema }] = shapes;
      for (const value of [Number.NaN, 'deep', undefined]) {
        const options = { maxDataDepth: value as unknown as number };
        expect(run(options, schema, arrays(500, 1)).valid).toBe(true);
        expectExceeded(run(options, schema, arrays(501, 1)), 500);
      }
    });

    it('resolves the counter start value', () => {
      expect(resolveMaxDataDepth(Infinity)).toBe(2 ** 30 - 1);
      expect(resolveMaxDataDepth(2 ** 40)).toBe(2 ** 30 - 1);
      expect(resolveMaxDataDepth(-5)).toBe(0);
      expect(resolveMaxDataDepth(3.9)).toBe(3);
      expect(resolveMaxDataDepth(undefined)).toBe(500);
    });
  });

  describe('combinators', () => {
    const data = arrays(10, 1);
    const inner: JsonSchema = { items: { $ref: '#' } };
    const cases: Array<[string, JsonSchema]> = [
      ['not', { not: { not: inner } }],
      ['oneOf', { oneOf: [inner] }],
      ['anyOf', { anyOf: [inner] }],
      ['allOf', { allOf: [inner] }],
      ['if and then', { if: inner, then: true }],
    ];
    for (const [name, schema] of cases) {
      it(`reports over-deep data under ${name}`, () => {
        expectExceeded(run({ maxDataDepth: 5 }, schema, data), 5);
      });
    }
  });

  describe('modes', () => {
    const [{ schema }] = shapes;

    it('throws a ValidateError with the detail', () => {
      const validator = ZSchema.create({ maxDataDepth: 5 });
      let thrown: unknown;
      try {
        validator.validate(arrays(6, 1), schema);
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(ValidateError);
      const { details } = thrown as ValidateError;
      expect(details?.length).toBe(1);
      expect(details?.[0].code).toBe(CODE);
      expect(details?.[0].params).toEqual([5]);
    });

    it('returns the error in safe mode', () => {
      expectExceeded(run({ maxDataDepth: 5 }, schema, arrays(6, 1)), 5);
    });

    it('delivers the error in async mode', async () => {
      const validator = ZSchema.create({ async: true, safe: true, maxDataDepth: 5 });
      expectExceeded(await validator.validate(arrays(6, 1), schema), 5);
    });

    it('counts levels entered after an async format has settled', async () => {
      const validator = ZSchema.create({
        async: true,
        safe: true,
        maxDataDepth: 5,
        customFormats: { slow: () => Promise.resolve(true) },
      });
      // every level is ['x', next]: `if` waits for the async format of 'x', and `then` descends into next afterwards
      const withFormat: JsonSchema = {
        if: { prefixItems: [{ format: 'slow' }] },
        then: { prefixItems: [{}, { $ref: '#' }] },
      };
      const atLimit = await validator.validate(pairs(5, 'x'), withFormat);
      expect(atLimit.valid).toBe(true);
      expectExceeded(await validator.validate(pairs(6, 'x'), withFormat), 5);
      expectExceeded(await validator.validate(pairs(9, 'x'), withFormat), 5);
    });

    it('rejects in async throwing mode', async () => {
      const validator = ZSchema.create({ async: true, maxDataDepth: 5 });
      let thrown: unknown;
      try {
        await validator.validate(arrays(6, 1), schema);
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(ValidateError);
      expect((thrown as ValidateError).details?.[0].code).toBe(CODE);
    });
  });

  it('gives the same single detail with breakOnFirstError', () => {
    expectExceeded(run({ maxDataDepth: 5, breakOnFirstError: true }, shapes[0].schema, arrays(6, 1)), 5);
  });

  it('is not suppressed by excludeErrors', () => {
    const validator = ZSchema.create({ safe: true, maxDataDepth: 5 });
    const result = validator.validate(arrays(6, 1), shapes[0].schema, { excludeErrors: [CODE] });
    expectExceeded(result, 5);
  });

  it('reports the limit with a customValidator present', () => {
    const customValidator = noopValidator;
    expectExceeded(run({ maxDataDepth: 5, customValidator }, shapes[0].schema, arrays(6, 1)), 5);
    expect(run({ maxDataDepth: 5, customValidator }, shapes[0].schema, arrays(5, 1)).valid).toBe(true);
  });

  describe('very deep data', () => {
    const picked = [shapes[0], shapes[1], shapes[4], shapes[5]];
    for (const { name, schema, build } of picked) {
      it(`ends with the defined error for 10000 levels (${name})`, () => {
        expectExceeded(run({}, schema, build(10_000)), 500);
      });
    }
  });

  describe('maxRecursionDepth', () => {
    const uniqueSchema: JsonSchema = { type: 'array', uniqueItems: true };

    it('still limits areEqual', () => {
      const data = [deepItem(12), deepItem(12)];
      for (const maxDataDepth of [5, 500]) {
        const result = run({ maxRecursionDepth: 10, maxDataDepth }, uniqueSchema, data);
        expect(result.valid).toBe(false);
        expect(result.err?.message).toContain('Maximum recursion depth (10) exceeded in areEqual');
      }
    });

    it('still limits the collection of evaluated properties', () => {
      const defs: Record<string, JsonSchema> = {};
      for (let i = 0; i < 12; i++) {
        defs[`n${i}`] = { $ref: `#/$defs/n${i + 1}` };
      }
      defs.n12 = { properties: { a: true } };
      const schema: JsonSchema = { $defs: defs, $ref: '#/$defs/n0', unevaluatedProperties: false };
      for (const maxDataDepth of [5, 500]) {
        const result = run({ maxRecursionDepth: 6, maxDataDepth }, schema, { a: 1, b: 2 });
        const codes = (result.err?.details ?? []).map((d) => d.code);
        expect(codes).toContain('COLLECT_EVALUATED_DEPTH_EXCEEDED');
        expect(codes).not.toContain(CODE);
      }
    });
  });

  describe('schemas', () => {
    it('does not apply the limit to schema validation or compilation', () => {
      let schema: JsonSchema = { type: 'number' };
      for (let i = 0; i < 10; i++) {
        schema = { properties: { p: schema } };
      }
      const validator = ZSchema.create({ safe: true, maxDataDepth: 2 });
      expect(validator.validateSchema(schema).valid).toBe(true);
      expect(validator.validate({ p: { p: 1 } }, schema).valid).toBe(true);
    });
  });
});

/** What the cached fast validator answers; a deferral or any other throw means "the interpreter decides". */
const fastVerdict = (fast: (json: unknown) => boolean, data: unknown): boolean => {
  try {
    return fast(data);
  } catch {
    return false;
  }
};

const fastEntryOf = (v: ZSchemaSafe, schema: JsonSchema) =>
  v.compiledSchemaCache.getEntry(v.compiledSchemaCache.keyOf(schema)!, v.options);

describe('maxDataDepth option on the compiled-schema cache path', () => {
  type Opts = Record<string, unknown>;

  const fresh = (options: Opts, schema: JsonSchema, data: unknown) =>
    outcome(() => ZSchema.create({ safe: true, ...options }).validate(data, schema));

  const mixed: Shape = {
    name: 'mixed tree',
    schema: { properties: { children: { items: { $ref: '#' } } } },
    build: (n) => tree(n),
  };

  describe.each([5, 500])('repeated calls with the limit at %i', (limit) => {
    for (const { name, schema, build } of shapes.concat(mixed)) {
      for (const n of [limit, limit + 1]) {
        it(`${name}: data nested ${n} levels gives the same result on every call of one validator`, () => {
          const data = build(n);
          const expected = fresh({ maxDataDepth: limit }, schema, data);
          const v = ZSchema.create({ safe: true, maxDataDepth: limit });
          for (let i = 0; i < 3; i++) {
            expect(outcome(() => v.validate(data, schema))).toEqual(expected);
          }
        });

        it(`${name}: data nested ${n} levels gives the same result on every call of a compiled function`, () => {
          const data = build(n);
          const expected = fresh({ maxDataDepth: limit }, schema, data);
          const v = ZSchema.create({ safe: true, maxDataDepth: limit });
          const fn = v.compile(schema);
          for (let i = 0; i < 3; i++) {
            expect(outcome(() => fn(data))).toEqual(expected);
          }
        });
      }
    }
  });

  describe('children whose check is trivially true', () => {
    const limit = 4;
    const tables: Array<[string, JsonSchema, (n: number) => unknown]> = [
      ['items: {}', { items: {} }, (n) => arrays(n, 1)],
      ['items: true', { items: true }, (n) => arrays(n, 1)],
      ['properties: { c: {} }', { properties: { c: {} } }, (n) => objects(n, 1)],
      ['properties: { c: true }', { properties: { c: true } }, (n) => objects(n, 1)],
      ['additionalProperties: {}', { additionalProperties: {} }, (n) => objects(n, 1)],
      ['patternProperties: { ^c$: {} }', { patternProperties: { '^c$': {} } }, (n) => objects(n, 1)],
      ['contains: {} with minContains: 0', { contains: {}, minContains: 0 }, (n) => arrays(n, 1)],
      ['unevaluatedItems: {}', { unevaluatedItems: {} }, (n) => arrays(n, 1)],
      ['unevaluatedProperties: {}', { unevaluatedProperties: {} }, (n) => objects(n, 1)],
      [
        'trivial contains beside a recursive items',
        { items: { $ref: '#' }, contains: {}, minContains: 0 },
        (n) => arrays(n, 1),
      ],
      [
        'additionalProperties: {} beside a recursive property',
        { properties: { c: { $ref: '#' } }, additionalProperties: {} },
        (n) => objects(n, 1),
      ],
      [
        'trivial items under a recursive $ref',
        { $defs: { r: { items: { $ref: '#/$defs/r' }, contains: {}, minContains: 0 } }, $ref: '#/$defs/r' },
        (n) => arrays(n, 1),
      ],
      [
        'trivial properties under a recursive $ref',
        { $defs: { r: { properties: { c: { $ref: '#/$defs/r' }, d: {} } } }, $ref: '#/$defs/r' },
        (n) => objects(n, 1),
      ],
    ];
    it.each(tables)('%s agrees with the interpreter at the limit', (_name, schema, build) => {
      const { v, fast, reference } = fastFor(schema, { maxDataDepth: limit });
      expect(fast).toBeDefined();
      for (const n of [limit - 1, limit, limit + 1]) {
        const data = build(n);
        expect(fastVerdict(fast!, data), `nested ${n} levels`).toBe(reference(data));
        // the same through the validator, three times
        const expected = fresh({ maxDataDepth: limit }, schema, data);
        for (let i = 0; i < 3; i++) {
          expect(outcome(() => v.validate(data, schema))).toEqual(expected);
        }
      }
    });
  });

  describe('over the limit', () => {
    it('defers the call and keeps the fast validator', () => {
      const schema: JsonSchema = { items: { $ref: '#' } };
      const { v, fast } = fastFor(schema, { maxDataDepth: 3 });
      expect(() => fast!(arrays(4, 1))).toThrow('deferred');
      expect(fast!(arrays(3, 1))).toBe(true);
      const fn = v.compile(schema);
      for (let i = 0; i < 3; i++) {
        expectExceeded(fn(arrays(4, 1)), 3);
        expect(fn(arrays(3, 1)).valid).toBe(true);
      }
      expect(typeof fastEntryOf(v, schema)?.fast?.check).toBe('function');
    });

    const rejecting: Array<{ name: string; first: JsonSchema; data: unknown }> = [
      { name: 'items', first: { items: { type: 'string' } }, data: [[1]] },
      { name: 'prefixItems', first: { prefixItems: [{ type: 'string' }] }, data: [[1]] },
      { name: 'prefixItems and items', first: { prefixItems: [{}], items: { type: 'string' } }, data: [[1, 1]] },
      { name: 'properties', first: { properties: { c: { type: 'string' } } }, data: [{ c: 1 }] },
      { name: 'patternProperties', first: { patternProperties: { c: { type: 'string' } } }, data: [{ c: 1 }] },
      { name: 'additionalProperties', first: { additionalProperties: { type: 'string' } }, data: [{ c: 1 }] },
      { name: 'additionalProperties: false', first: { additionalProperties: false }, data: [{ c: 1 }] },
      { name: 'contains with maxContains', first: { contains: {}, maxContains: 1 }, data: [[1, 2]] },
      { name: 'unevaluatedItems', first: { unevaluatedItems: { type: 'string' } }, data: [[1]] },
      { name: 'unevaluatedProperties', first: { unevaluatedProperties: { type: 'string' } }, data: [{ c: 1 }] },
    ];
    for (const { name, first, data } of rejecting) {
      it(`restores the count when ${name} rejects, so a later branch can use the same level`, () => {
        // root array (depth 0) -> item (depth 1) -> its children: the first branch rejects below depth 1, and the
        // second branch needs that level again. With maxDataDepth 2, a count left one short would defer the call.
        const second: JsonSchema = { items: { type: 'number' }, additionalProperties: { type: 'number' } };
        const schema: JsonSchema = { items: { anyOf: [first, second] } };
        const { fast } = fastFor(schema, { maxDataDepth: 2 });
        expect(fast!(data)).toBe(true);
      });
    }

    it('rejects over-deep data under not on every call', () => {
      const schema: JsonSchema = { not: { items: { $ref: '#' } } };
      const data = arrays(6, 1);
      const expected = fresh({ maxDataDepth: 3 }, schema, data);
      expect(expected).toEqual({ valid: false, codes: [CODE] });
      const v = ZSchema.create({ safe: true, maxDataDepth: 3 });
      for (let i = 0; i < 3; i++) {
        expect(outcome(() => v.validate(data, schema))).toEqual(expected);
      }
    });
  });

  describe('maxDataDepth: Infinity', () => {
    it('accepts 2000 levels on cached calls and builds a validator', () => {
      const schema: JsonSchema = { items: { $ref: '#' } };
      const v = ZSchema.create({ safe: true, maxDataDepth: Infinity });
      const data = arrays(2000, 1);
      // a shallow call primes the cache entry, so the deep calls below are answered by the fast validator
      expect(v.validate(arrays(3, 1), schema).valid).toBe(true);
      for (let i = 0; i < 3; i++) {
        expect(v.validate(data, schema).valid).toBe(true);
      }
      expect(typeof buildFastFor(v, schema)).toBe('function');
      expect(typeof fastEntryOf(v, schema)?.fast?.check).toBe('function');
    });
  });

  describe('a custom format function that validates against the same schema', () => {
    it('does not change the outer result', () => {
      const schema: JsonSchema = { type: ['array', 'string'], items: { $ref: '#' }, format: 'reenter' };
      for (const n of [4, 5]) {
        const data = arrays(n, 'x');
        const expected = fresh({ maxDataDepth: 4, formatAssertions: null }, schema, data);
        const v = ZSchema.create({ safe: true, maxDataDepth: 4, formatAssertions: null });
        let inner = 0;
        let reentered = false;
        v.registerFormat('reenter', () => {
          if (!reentered) {
            reentered = true;
            inner++;
            expect(v.validate(['y'], schema).valid).toBe(true);
            reentered = false;
          }
          return true;
        });
        for (let i = 0; i < 3; i++) {
          expect(outcome(() => v.validate(data, schema))).toEqual(expected);
        }
        expect(inner).toBeGreaterThan(0);
      }
    });
  });

  describe('checks that decide the result before the data is descended into', () => {
    const deciding: Array<{ name: string; schema: JsonSchema; data: unknown }> = [
      {
        name: 'an anyOf branch that accepts',
        schema: { anyOf: [{ type: 'array' }, { items: { $ref: '#' } }] },
        data: arrays(6, 1),
      },
      {
        name: 'a keyword that fails under not',
        schema: { not: { required: ['x'], properties: { c: { $ref: '#' } } } },
        data: objects(6, 1),
      },
      {
        name: 'a keyword that fails in a oneOf branch',
        schema: { oneOf: [{ required: ['x'], properties: { c: { $ref: '#' } } }, { required: ['c'] }] },
        data: objects(6, 1),
      },
      {
        name: 'a keyword that fails in if',
        schema: { if: { required: ['x'], properties: { c: { $ref: '#' } } }, then: false },
        data: objects(6, 1),
      },
    ];
    for (const { name, schema, data } of deciding) {
      it(`${name}: the first call reports the limit, cached calls do not descend and accept`, () => {
        const v = ZSchema.create({ safe: true, maxDataDepth: 3 });
        expectExceeded(v.validate(data, schema), 3);
        expect(v.validate(data, schema).valid).toBe(true);
        expect(v.validate(data, schema).valid).toBe(true);
      });
    }
  });

  describe('error detail', () => {
    it('has the full path when the limit is reached inside nested combinators', () => {
      const schema: JsonSchema = { items: { anyOf: [{ items: { allOf: [{ $ref: '#' }] } }] } };
      const result = run({ maxDataDepth: 6, reportPathAsArray: true }, schema, arrays(8, 1));
      expectExceeded(result, 6);
      expect(result.err?.details?.[0].path).toEqual([0, 0, 0, 0, 0, 0]);
      expect(run({ maxDataDepth: 2 }, schema, arrays(8, 1)).err?.details?.[0].path).toBe('#/0/0');
    });

    it('reports the limit in force after the option was changed in place', () => {
      const v = ZSchema.create({ safe: true, maxDataDepth: 3 });
      const schema: JsonSchema = { items: { $ref: '#' } };
      v.options.maxDataDepth = 2.7;
      expectExceeded(v.validate(arrays(4, 1), schema), 2);
      expect(v.validate(arrays(2, 1), schema).valid).toBe(true);
    });
  });

  describe('sites reached only through the evaluated-items collection', () => {
    const viaCollector: Array<{ name: string; schema: JsonSchema }> = [
      { name: 'contains', schema: { contains: { $ref: '#' }, unevaluatedItems: false } },
      { name: 'contains with unevaluatedItems: true', schema: { contains: { $ref: '#' }, unevaluatedItems: true } },
    ];
    for (const { name, schema } of viaCollector) {
      it(`${name}: the same result on the first and on cached calls`, () => {
        for (const n of [2, 3, 4, 5]) {
          const data = arrays(n, 1);
          const first = outcome(() => run({ maxDataDepth: 3 }, schema, data));
          const v = ZSchema.create({ safe: true, maxDataDepth: 3 });
          for (let i = 0; i < 3; i++) {
            expect(outcome(() => v.validate(data, schema))).toEqual(first);
          }
        }
      });
    }
  });

  describe('tuple keywords', () => {
    const tuples: Array<{ name: string; options: Record<string, unknown>; schema: JsonSchema }> = [
      { name: 'prefixItems', options: {}, schema: { prefixItems: [{ $ref: '#' }] } },
      { name: 'draft-04 items array', options: { version: 'draft-04' }, schema: { items: [{ $ref: '#' }] } },
      { name: 'draft2019-09 items array', options: { version: 'draft2019-09' }, schema: { items: [{ $ref: '#' }] } },
    ];
    for (const { name, options, schema } of tuples) {
      it(`${name}: depth N passes and N+1 reports the limit, on every call`, () => {
        const v = ZSchema.create({ safe: true, maxDataDepth: 3, ...options });
        for (let i = 0; i < 3; i++) {
          expect(v.validate(arrays(3, 1), schema).valid).toBe(true);
          expectExceeded(v.validate(arrays(4, 1), schema), 3);
        }
      });
    }

    it('draft-04 additionalItems: depth N passes and N+1 reports the limit, on every call', () => {
      const schema: JsonSchema = { items: [{}], additionalItems: { $ref: '#' } };
      // every level is [0, next]: next is validated by additionalItems
      const v = ZSchema.create({ safe: true, maxDataDepth: 3, version: 'draft-04' });
      for (let i = 0; i < 3; i++) {
        expect(v.validate(pairs(3, 0), schema).valid).toBe(true);
        expectExceeded(v.validate(pairs(4, 0), schema), 3);
      }
    });

    it('with 0 an object is entered only for a key that has a schema', () => {
      const v = ZSchema.create({ safe: true, maxDataDepth: 0 });
      const schema: JsonSchema = { properties: { c: {} } };
      for (let i = 0; i < 3; i++) {
        expectExceeded(v.validate({ c: 1 }, schema), 0);
        expect(v.validate({ other: 1 }, schema).valid).toBe(true);
        expect(v.validate({}, schema).valid).toBe(true);
      }
    });
  });
});
