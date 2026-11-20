import type { JsonSchema } from '../../src/json-schema-versions.ts';

import { ValidateError } from '../../src/errors.ts';
import { resolveMaxDataDepth } from '../../src/z-schema-options.ts';
import { ZSchema } from '../../src/z-schema.ts';

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

      // Paths inside nested sub-reports (contains, unevaluated*) carry only one parent prefix, so their length
      // is not the depth.
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

    it('delivers the error in async mode with an async format in the schema', async () => {
      const validator = ZSchema.create({
        async: true,
        safe: true,
        maxDataDepth: 5,
        customFormats: { slow: () => Promise.resolve(true) },
      });
      const withFormat: JsonSchema = { items: { $ref: '#' }, properties: { a: { format: 'slow' } } };
      expectExceeded(await validator.validate(arrays(6, 1), withFormat), 5);
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
