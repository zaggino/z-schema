import { resolveMaxErrors } from '../../src/z-schema-options.ts';
import { ZSchema } from '../../src/z-schema.ts';

interface DetailLike {
  code?: string;
  path?: string | Array<string | number>;
  inner?: DetailLike[];
}

const countDetails = (details: DetailLike[] | undefined): number => {
  let total = 0;
  if (!details) {
    return total;
  }
  for (let i = 0; i < details.length; i++) {
    total += 1 + countDetails(details[i].inner);
  }
  return total;
};

const project = (details: DetailLike[] | undefined) => (details ?? []).map(({ code, path }) => ({ code, path }));

const projectDeep = (details: DetailLike[] | undefined): unknown[] =>
  (details ?? []).map(({ code, path, inner }) => ({ code, path, inner: projectDeep(inner) }));

const run = (options: Record<string, unknown>, schema: Record<string, unknown>, data: unknown) => {
  const validator = ZSchema.create({ safe: true, breakOnFirstError: false, ...options });
  return validator.validate(data, schema);
};

const numbers = (count: number) => Array.from({ length: count }, (_, i) => i);
const strings = (count: number) => Array.from({ length: count }, (_, i) => `s${i}`);

const runAsyncFormat = (options: Record<string, unknown>, data: unknown) =>
  ZSchema.create({
    async: true,
    safe: true,
    customFormats: { slow: () => Promise.resolve(false) },
    ...options,
  }).validate(data, { items: { format: 'slow' } });

const itemsAreStrings = { type: 'array', items: { type: 'string' } };
const anyOfItems = { anyOf: [{ items: { type: 'integer' } }, { items: { type: 'boolean' } }] };
const itemsAnyOf = { items: { anyOf: [{ type: 'integer' }, { type: 'boolean' }] } };

describe('maxErrors option', () => {
  it('defaults to 1000', () => {
    expect(ZSchema.getDefaultOptions().maxErrors).toBe(1000);
    expect(ZSchema.create().options.maxErrors).toBe(1000);
  });

  it.each([
    [1000, 1000],
    [1, 1],
    [2.9, 2],
    [Infinity, Infinity],
    [0, 1],
    [-5, 1],
    [0.5, 1],
    [-Infinity, 1],
    [Number.NaN, 1000],
    ['10', 1000],
    [null, 1000],
    [undefined, 1000],
    [true, 1000],
  ])('resolves %j to %j', (value, expected) => {
    expect(resolveMaxErrors(value)).toBe(expected);
  });

  it('normalizes the option at creation', () => {
    expect(ZSchema.create({ maxErrors: 2.9 }).options.maxErrors).toBe(2);
    expect(ZSchema.create({ maxErrors: 0 }).options.maxErrors).toBe(1);
    expect(ZSchema.create({ maxErrors: Infinity }).options.maxErrors).toBe(Infinity);
  });

  it('accepts the option', () => {
    expect(() => ZSchema.create({ maxErrors: 5 })).not.toThrow();
  });
});

describe('maxErrors applied to data validation', () => {
  it('reports the first 1000 of 1500 errors', () => {
    const limited = run({}, itemsAreStrings, numbers(1500));
    const unlimited = run({ maxErrors: Infinity }, itemsAreStrings, numbers(1500));
    expect(limited.valid).toBe(false);
    expect(limited.err?.details).toHaveLength(1000);
    expect(limited.err?.truncated).toBe(true);
    expect(project(limited.err?.details)).toEqual(project(unlimited.err?.details).slice(0, 1000));
  });

  it('leaves truncated absent when everything fits', () => {
    const result = run({}, itemsAreStrings, numbers(1000));
    expect(result.err?.details).toHaveLength(1000);
    expect(result.err).toBeDefined();
    expect(result.err).not.toHaveProperty('truncated');
  });

  it('Infinity turns the limit off', () => {
    const result = run({ maxErrors: Infinity }, itemsAreStrings, numbers(1500));
    expect(result.err?.details).toHaveLength(1500);
    expect(result.err).not.toHaveProperty('truncated');
  });

  it('counts nested details', () => {
    const result = run({ maxErrors: 10 }, anyOfItems, strings(50));
    const details = result.err?.details as DetailLike[];
    expect(result.valid).toBe(false);
    expect(details).toHaveLength(1);
    expect(details[0].inner).toHaveLength(9);
    expect(countDetails(details)).toBeLessThanOrEqual(10);
    expect(result.err?.truncated).toBe(true);
  });

  it('keeps a prefix of each nested list when items each fail an anyOf', () => {
    const limited = run({ maxErrors: 10 }, itemsAnyOf, strings(20));
    const unlimited = run({ maxErrors: Infinity }, itemsAnyOf, strings(20));
    const details = limited.err?.details as DetailLike[];
    const full = unlimited.err?.details as DetailLike[];
    expect(countDetails(details)).toBeLessThanOrEqual(10);
    expect(limited.err?.truncated).toBe(true);
    expect(project(details)).toEqual(project(full.slice(0, details.length)));
    for (let i = 0; i < details.length; i++) {
      const inner = details[i].inner ?? [];
      expect(projectDeep(inner)).toEqual(projectDeep((full[i].inner ?? []).slice(0, inner.length)));
    }
    // Details are adopted whole while they fit: three with two inner details each (9 nodes), then a fourth
    // whose inner list is cut to nothing (10 nodes).
    expect(details).toHaveLength(4);
    expect(details.map((d) => d.inner?.length)).toEqual([2, 2, 2, undefined]);
    expect(countDetails(details)).toBe(10);
  });

  describe('the verdict does not depend on the limit', () => {
    const corpus: Array<[string, Record<string, unknown>, unknown]> = [
      ['not valid', { not: { type: 'string' } }, 1],
      ['not invalid', { not: { type: 'string' } }, 'x'],
      ['anyOf valid', { anyOf: [{ type: 'string' }, { minimum: 5 }] }, 'x'],
      ['anyOf invalid', { anyOf: [{ type: 'string' }, { minimum: 5 }] }, 1],
      ['oneOf valid', { oneOf: [{ type: 'string' }, { type: 'number' }] }, 1],
      ['oneOf invalid', { oneOf: [{ type: 'string' }, { type: 'number' }] }, true],
      ['oneOf multiple', { oneOf: [{ type: 'number' }, { minimum: 0 }] }, 1],
      ['if then else valid', { if: { type: 'number' }, then: { minimum: 0 }, else: { type: 'string' } }, 3],
      [
        'if then else invalid',
        { if: { type: 'number' }, then: { minimum: 0, multipleOf: 2 }, else: { type: 'string' } },
        -3,
      ],
      ['contains valid', { contains: { type: 'string' }, minContains: 2 }, ['a', 'b', 1]],
      ['contains invalid', { contains: { type: 'string' }, minContains: 2 }, [1, 2, 3, 'a']],
      ['propertyNames valid', { propertyNames: { maxLength: 3 } }, { a: 1, bb: 2 }],
      ['propertyNames invalid', { propertyNames: { maxLength: 3 } }, { aaaa: 1, bbbbb: 2, cccccc: 3 }],
      ['unevaluatedProperties valid', { properties: { a: true }, unevaluatedProperties: false }, { a: 1 }],
      [
        'unevaluatedProperties invalid',
        { properties: { a: true }, unevaluatedProperties: false },
        { a: 1, b: 2, c: 3, d: 4 },
      ],
      ['unevaluatedItems valid', { prefixItems: [true], unevaluatedItems: false }, [1]],
      ['unevaluatedItems invalid', { prefixItems: [true], unevaluatedItems: false }, [1, 2, 3, 4]],
      ['dependentSchemas valid', { dependentSchemas: { a: { required: ['b'] } } }, { a: 1, b: 2 }],
      [
        'dependentSchemas invalid',
        { dependentSchemas: { a: { required: ['b', 'c', 'd'] }, e: { required: ['f'] } } },
        { a: 1, e: 2 },
      ],
      [
        'allOf nesting valid',
        { allOf: [{ allOf: [{ type: 'object' }, { required: ['a'] }] }, { properties: { a: { type: 'string' } } }] },
        { a: 'x' },
      ],
      [
        'allOf nesting invalid',
        { allOf: [{ allOf: [{ type: 'array' }, { minItems: 5 }] }, { items: { type: 'string' } }, { maxItems: 1 }] },
        [1, 2, 3],
      ],
    ];

    it.each(corpus)('%s', (_name, schema, data) => {
      for (const breakOnFirstError of [false, true]) {
        const unlimited = run({ maxErrors: Infinity, breakOnFirstError }, schema, data);
        const expectedDetails = project(unlimited.err?.details);
        for (const maxErrors of [1, 2, 3]) {
          const limited = run({ maxErrors, breakOnFirstError }, schema, data);
          expect(limited.valid).toBe(unlimited.valid);
          const kept = project(limited.err?.details);
          expect(kept).toEqual(expectedDetails.slice(0, kept.length));
        }
      }
    });
  });

  it('deferred and eager sub-reports agree', () => {
    const cases: Array<[Record<string, unknown>, unknown]> = [
      [anyOfItems, strings(50)],
      [itemsAnyOf, strings(20)],
    ];
    for (const [schema, data] of cases) {
      const deferred = run({ maxErrors: 10 }, schema, data);
      const eager = run({ maxErrors: 10, customValidator: () => {} }, schema, data);
      expect(projectDeep(eager.err?.details)).toEqual(projectDeep(deferred.err?.details));
      expect(eager.err?.truncated).toBe(deferred.err?.truncated);
    }
  });

  it('async format failures are limited too', async () => {
    const result = await runAsyncFormat({ maxErrors: 5, breakOnFirstError: false }, strings(50));
    expect(result.valid).toBe(false);
    expect(result.err?.details).toHaveLength(5);
    expect(result.err?.truncated).toBe(true);
  });

  it('a custom format is not called with a value its type keyword rejects, at any limit', () => {
    const argumentTypes: string[] = [];
    const schema = { items: { type: 'string', format: 'f' } };
    const data = [...numbers(1000).map(() => 1), null];
    const create = (options: Record<string, unknown>) =>
      ZSchema.create({
        safe: true,
        breakOnFirstError: false,
        customFormats: {
          f: (value: unknown) => {
            argumentTypes.push(typeof value);
            return (value as string).startsWith('a');
          },
        },
        ...options,
      });

    const unlimited = create({ maxErrors: Infinity }).validate(data, schema);
    const limited = create({}).validate(data, schema);
    expect(unlimited.valid).toBe(false);
    expect(unlimited.err?.details).toHaveLength(1001);
    expect(limited.valid).toBe(false);
    expect(limited.err?.details).toHaveLength(1000);
    expect(limited.err?.truncated).toBe(true);
    expect(project(limited.err?.details)).toEqual(project(unlimited.err?.details).slice(0, 1000));
    expect(argumentTypes.filter((type) => type !== 'string')).toEqual([]);
  });

  it('an async custom format is not called with a value its type keyword rejects, at a small limit', async () => {
    const argumentTypes: string[] = [];
    const validator = ZSchema.create({
      async: true,
      safe: true,
      maxErrors: 5,
      breakOnFirstError: false,
      customFormats: {
        f: (value: unknown) => {
          argumentTypes.push(typeof value);
          return Promise.resolve(typeof value === 'string' && value.startsWith('a'));
        },
      },
    });
    const result = await validator.validate([...numbers(20), null], { items: { type: 'string', format: 'f' } });
    expect(result.valid).toBe(false);
    expect(result.err?.details?.length).toBeLessThanOrEqual(5);
    expect(argumentTypes.filter((type) => type !== 'string')).toEqual([]);
  });

  it('an async format is not started for a value its type keyword rejects', () => {
    const validator = ZSchema.create({
      safe: true,
      maxErrors: 1,
      breakOnFirstError: false,
      customFormats: { slow: () => Promise.resolve(true) },
    });
    const result = validator.validate([false, 1], { type: 'array', items: { type: 'string', format: 'slow' } });
    expect(result.valid).toBe(false);
    expect(result.err?.details).toHaveLength(1);
    expect(result.err?.details?.[0].code).toBe('INVALID_TYPE');
    expect(result.err?.details?.[0].path).toBe('#/0');
    expect(result.err?.truncated).toBe(true);
    expect(result.err?.message).not.toMatch(/async/i);
  });

  it('breakOnFirstError is independent of the limit', async () => {
    // The synchronous path does not cut to one error; the limit applies on top of it.
    const limited = run({ maxErrors: 3, breakOnFirstError: true }, itemsAreStrings, numbers(20));
    const unlimited = run({ maxErrors: Infinity, breakOnFirstError: true }, itemsAreStrings, numbers(20));
    expect(limited.err?.details).toHaveLength(3);
    expect(limited.err?.truncated).toBe(true);
    expect(project(limited.err?.details)).toEqual(project(unlimited.err?.details).slice(0, 3));
    expect(unlimited.err).not.toHaveProperty('truncated');

    // The asynchronous path reports one error. Cutting to it is not a truncation; errors the limit
    // dropped before the cut still are.
    const roomy = await runAsyncFormat({ maxErrors: 100, breakOnFirstError: true }, strings(20));
    expect(roomy.err?.details).toHaveLength(1);
    expect(roomy.err).not.toHaveProperty('truncated');
    const tight = await runAsyncFormat({ maxErrors: 3, breakOnFirstError: true }, strings(20));
    expect(tight.err?.details).toHaveLength(1);
    expect(tight.err?.truncated).toBe(true);
  });

  it('excluded codes neither count nor truncate', () => {
    const validator = ZSchema.create({ safe: true, maxErrors: 2, breakOnFirstError: false });
    const result = validator.validate(
      numbers(10),
      { ...itemsAreStrings, minItems: 20, maxItems: 5 },
      { excludeErrors: ['INVALID_TYPE'] }
    );
    expect(result.err?.details?.map((d) => d.code).toSorted()).toEqual(['ARRAY_LENGTH_LONG', 'ARRAY_LENGTH_SHORT']);
    expect(result.err).not.toHaveProperty('truncated');
  });

  it('schema validation is not limited', () => {
    const schema = JSON.parse('{"type":"nope","minimum":"x","properties":5}');
    const limited = ZSchema.create({ safe: true, maxErrors: 1, breakOnFirstError: false }).validateSchema(schema);
    const unlimited = ZSchema.create({ safe: true, maxErrors: Infinity, breakOnFirstError: false }).validateSchema(
      schema
    );
    expect(limited.valid).toBe(false);
    expect(limited.err?.details?.length).toBeGreaterThan(1);
    expect(projectDeep(limited.err?.details)).toEqual(projectDeep(unlimited.err?.details));
    expect(limited.err).not.toHaveProperty('truncated');
  });

  it('a changed option is picked up', () => {
    const validator = ZSchema.create({ safe: true, breakOnFirstError: false });
    validator.options.maxErrors = 2;
    const result = validator.validate(numbers(5), itemsAreStrings);
    expect(result.err?.details).toHaveLength(2);
    expect(result.err?.truncated).toBe(true);
  });

  it('a changed option is picked up on a validator that has already validated', () => {
    const validator = ZSchema.create({ safe: true, breakOnFirstError: false });
    const data = numbers(1500);
    expect(validator.validate(data, itemsAreStrings).err?.details).toHaveLength(1000);

    validator.options.maxErrors = 5;
    const limited = validator.validate(data, itemsAreStrings);
    expect(limited.err?.details).toHaveLength(5);
    expect(limited.err?.truncated).toBe(true);

    validator.options.maxErrors = Infinity;
    const unlimited = validator.validate(data, itemsAreStrings);
    expect(unlimited.err?.details).toHaveLength(1500);
    expect(unlimited.err).not.toHaveProperty('truncated');
  });

  it('keeps a large invalid instance bounded', () => {
    const result = run(
      {},
      anyOfItems,
      Array.from({ length: 20_000 }, () => 'x')
    );
    expect(result.valid).toBe(false);
    expect(countDetails(result.err?.details)).toBeLessThanOrEqual(1000);
    expect(result.err?.truncated).toBe(true);
  });
});
