import type { JsonSchema } from '../../src/json-schema-versions.ts';
import type { ValidateOptions, ValidateResponse } from '../../src/z-schema-base.ts';
import type { ZSchemaOptions } from '../../src/z-schema-options.ts';

import { vi } from 'vitest';

import { ZSchema } from '../../src/z-schema.ts';
import { fastFor } from '../lib/fast-validator.ts';

interface DetailLike {
  code?: string;
  inner?: DetailLike[];
}

const collect = (details: DetailLike[] | undefined, out: string[]): string[] => {
  for (let i = 0; i < (details ?? []).length; i++) {
    out.push(details![i].code!);
    collect(details![i].inner, out);
  }
  return out;
};

/** Every code of the result, nested ones included, in alphabetical order. */
const codesOf = (res: ValidateResponse): string[] => collect(res.err?.details, []).toSorted();

const run = (
  schema: JsonSchema,
  data: unknown,
  options: ZSchemaOptions = {},
  validateOptions?: ValidateOptions
): ValidateResponse => {
  const validator = ZSchema.create({ safe: true, breakOnFirstError: false, ...options });
  return validateOptions ? validator.validate(data, schema, validateOptions) : validator.validate(data, schema);
};

const both = (schema: JsonSchema, data: unknown, options: ZSchemaOptions = {}) => ({
  on: codesOf(run(schema, data, { ...options, sizeLimitsFirst: true })),
  off: codesOf(run(schema, data, { ...options, sizeLimitsFirst: false })),
});

const sorted = (codes: string[]): string[] => codes.toSorted();

const longString = 'bbbbbb';

const shrinkOnTitle = (_report: unknown, node: unknown, json: unknown) => {
  if ((node as { title?: string }).title === 'shrink') {
    (json as unknown[]).pop();
  }
};

describe('sizeLimitsFirst option', () => {
  it('defaults to true', () => {
    expect(ZSchema.getDefaultOptions().sizeLimitsFirst).toBe(true);
    expect(ZSchema.create().options.sizeLimitsFirst).toBe(true);
  });

  describe('rows', () => {
    it('string over maxLength skips pattern and format', () => {
      const schema: JsonSchema = { type: 'string', maxLength: 3, pattern: '^a+$', format: 'ipv4' };
      const { on, off } = both(schema, longString);
      expect(on).toEqual(sorted(['MAX_LENGTH']));
      expect(off).toEqual(sorted(['INVALID_FORMAT', 'MAX_LENGTH', 'PATTERN']));
    });

    it('string over maxLength skips contentEncoding', () => {
      const schema: JsonSchema = { maxLength: 3, contentEncoding: 'base64' };
      const { on, off } = both(schema, '!!!!!!', { version: 'draft-07' });
      expect(on).toEqual(sorted(['MAX_LENGTH']));
      expect(off).toEqual(sorted(['MAX_LENGTH', 'INVALID_FORMAT']));
    });

    it('array over maxItems skips uniqueItems, contains and the items', () => {
      const schema: JsonSchema = {
        type: 'array',
        maxItems: 2,
        uniqueItems: true,
        contains: { type: 'string' },
        items: { type: 'boolean' },
      };
      const { on, off } = both(schema, [1, 1, 2]);
      expect(on).toEqual(sorted(['ARRAY_LENGTH_LONG']));
      expect(off).toEqual(
        sorted([
          'CONTAINS',
          'INVALID_TYPE',
          'INVALID_TYPE',
          'INVALID_TYPE',
          'ARRAY_LENGTH_LONG',
          'ARRAY_UNIQUE',
          'INVALID_TYPE',
          'INVALID_TYPE',
          'INVALID_TYPE',
        ])
      );
    });

    it('array over maxItems skips unevaluatedItems', () => {
      const schema: JsonSchema = { maxItems: 1, unevaluatedItems: false };
      const { on, off } = both(schema, [1, 2]);
      expect(on).toEqual(sorted(['ARRAY_LENGTH_LONG']));
      expect(off).toEqual(sorted(['ARRAY_LENGTH_LONG', 'ARRAY_UNEVALUATED_ITEMS']));
    });

    it('object over maxProperties skips the property checks and the property values', () => {
      const schema: JsonSchema = {
        type: 'object',
        maxProperties: 1,
        properties: { a: { type: 'string' } },
        patternProperties: { '^b': { type: 'string' } },
        additionalProperties: false,
        propertyNames: { maxLength: 1 },
      };
      const { on, off } = both(schema, { a: 1, bb: 2, c: 3 });
      expect(on).toEqual(sorted(['OBJECT_PROPERTIES_MAXIMUM']));
      expect(off).toEqual(
        sorted([
          'OBJECT_PROPERTIES_MAXIMUM',
          'OBJECT_ADDITIONAL_PROPERTIES',
          'PROPERTY_NAMES',
          'MAX_LENGTH',
          'INVALID_TYPE',
          'INVALID_TYPE',
        ])
      );
    });

    it('object over maxProperties skips unevaluatedProperties', () => {
      const schema: JsonSchema = { maxProperties: 1, unevaluatedProperties: false };
      const { on, off } = both(schema, { a: 1, b: 2 });
      expect(on).toEqual(sorted(['OBJECT_PROPERTIES_MAXIMUM']));
      expect(off).toEqual(sorted(['OBJECT_PROPERTIES_MAXIMUM', 'OBJECT_UNEVALUATED_PROPERTIES']));
    });
  });

  describe('skipped work', () => {
    const schema: JsonSchema = { type: 'string', maxLength: 3, format: 'spy' };

    it('does not call a format function for an over-long string, on the first and cached calls', () => {
      const spy = vi.fn<() => boolean>(() => true);
      const validator = ZSchema.create({ safe: true, customFormats: { spy } });
      expect(validator.validate(longString, schema).valid).toBe(false);
      expect(validator.validate(longString, schema).valid).toBe(false);
      expect(validator.validate(longString, schema).valid).toBe(false);
      expect(spy).not.toHaveBeenCalled();
      expect(validator.validate('abc', schema).valid).toBe(true);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('does not call a format function through compile()', () => {
      const spy = vi.fn<() => boolean>(() => true);
      const validator = ZSchema.create({ safe: true, customFormats: { spy } });
      const compiled = validator.compile(schema);
      expect(compiled(longString).valid).toBe(false);
      expect(compiled(longString).valid).toBe(false);
      expect(spy).not.toHaveBeenCalled();
    });

    it('does not call a format function for the items of an over-limit array', () => {
      const spy = vi.fn<() => boolean>(() => true);
      const listSchema: JsonSchema = { maxItems: 1, items: { format: 'spy' } };
      const validator = ZSchema.create({ safe: true, customFormats: { spy } });
      expect(validator.validate(['a', 'b'], listSchema).valid).toBe(false);
      expect(validator.validate(['a', 'b'], listSchema).valid).toBe(false);
      expect(spy).not.toHaveBeenCalled();
      expect(run(listSchema, ['a', 'b'], { customFormats: { spy }, sizeLimitsFirst: false }).valid).toBe(false);
      expect(spy).toHaveBeenCalledTimes(2);
    });

    it('does not call a format function for the property values of an over-limit object', () => {
      const spy = vi.fn<() => boolean>(() => true);
      const mapSchema: JsonSchema = { maxProperties: 1, additionalProperties: { format: 'spy' } };
      const validator = ZSchema.create({ safe: true, customFormats: { spy } });
      expect(validator.validate({ a: 'x', b: 'y' }, mapSchema).valid).toBe(false);
      expect(validator.validate({ a: 'x', b: 'y' }, mapSchema).valid).toBe(false);
      expect(spy).not.toHaveBeenCalled();
      expect(run(mapSchema, { a: 'x', b: 'y' }, { customFormats: { spy }, sizeLimitsFirst: false }).valid).toBe(false);
      expect(spy).toHaveBeenCalledTimes(2);
    });
  });

  describe('customValidator', () => {
    const rows: Array<[string, JsonSchema, unknown, number]> = [
      ['string', { type: 'string', maxLength: 3, pattern: '^a+$', format: 'ipv4' }, longString, 0],
      ['array', { maxItems: 1, uniqueItems: true, items: { type: 'integer' } }, [7001, 7001], 7001],
      ['object', { maxProperties: 1, additionalProperties: { type: 'string' } }, { a: 7001, b: 7002 }, 7001],
    ];

    it.each(rows)('skips nothing for a %s over its limit', (_name, schema, data, child) => {
      const seen: unknown[] = [];
      const customValidator = (_report: unknown, _schema: unknown, json: unknown) => {
        seen.push(json);
      };
      const withHook = codesOf(run(schema, data, { customValidator }));
      expect(withHook).toEqual(codesOf(run(schema, data, { sizeLimitsFirst: false })));
      expect(withHook.length).toBeGreaterThan(1);
      expect(seen).toContain(data);
      if (child !== 0) {
        expect(seen).toContain(child);
      }
    });

    it('has the same validity when it changes the value', () => {
      const schema: JsonSchema = { allOf: [{ title: 'shrink' }], maxItems: 1, items: false };
      const verdict = (sizeLimitsFirst: boolean) => {
        const data = [1, 2];
        return run(schema, data, { customValidator: shrinkOnTitle, sizeLimitsFirst }).valid;
      };
      expect(verdict(true)).toBe(verdict(false));
    });
  });

  describe('values at the limit', () => {
    it('validates a string of exactly maxLength fully', () => {
      expect(both({ maxLength: 6, pattern: '^a+$' }, longString).on).toEqual(sorted(['PATTERN']));
    });

    it('validates an array of exactly maxItems fully', () => {
      expect(both({ maxItems: 2, uniqueItems: true }, [1, 1]).on).toEqual(sorted(['ARRAY_UNIQUE']));
      expect(both({ maxItems: 2, items: { type: 'string' } }, [1, 2]).on).toEqual(
        sorted(['INVALID_TYPE', 'INVALID_TYPE'])
      );
    });

    it('validates an object of exactly maxProperties fully', () => {
      expect(both({ maxProperties: 1, additionalProperties: false }, { a: 1 }).on).toEqual(
        sorted(['OBJECT_ADDITIONAL_PROPERTIES'])
      );
    });

    it('counts code points of a string that is longer in UTF-16 units', () => {
      const astral = String.fromCodePoint(0x1_f6_00);
      expect(both({ maxLength: 2, pattern: '^a+$' }, astral + astral).on).toEqual(sorted(['PATTERN']));
    });
  });

  describe('not gated', () => {
    const schema: JsonSchema = { maxLength: 3, pattern: '^a+$' };

    it('excludeErrors naming the limit code', () => {
      const res = run(schema, longString, {}, { excludeErrors: ['MAX_LENGTH'] });
      expect(codesOf(res)).toEqual(sorted(['PATTERN']));
    });

    it('includeErrors without the limit code', () => {
      const res = run(schema, longString, {}, { includeErrors: ['PATTERN'] });
      expect(codesOf(res)).toEqual(sorted(['PATTERN']));
    });

    it('includeErrors with the limit code', () => {
      const res = run(schema, longString, {}, { includeErrors: ['MAX_LENGTH', 'PATTERN'] });
      expect(codesOf(res)).toEqual(sorted(['MAX_LENGTH']));
    });

    it('excludeErrors naming ARRAY_LENGTH_LONG and OBJECT_PROPERTIES_MAXIMUM', () => {
      const arr = run({ maxItems: 1, items: { type: 'string' } }, [1, 2], {}, { excludeErrors: ['ARRAY_LENGTH_LONG'] });
      expect(codesOf(arr)).toEqual(sorted(['INVALID_TYPE', 'INVALID_TYPE']));
      const obj = run(
        { maxProperties: 1, additionalProperties: false },
        { a: 1, b: 2 },
        {},
        { excludeErrors: ['OBJECT_PROPERTIES_MAXIMUM'] }
      );
      expect(codesOf(obj)).toEqual(sorted(['OBJECT_ADDITIONAL_PROPERTIES', 'OBJECT_ADDITIONAL_PROPERTIES']));
    });

    it('validation vocabulary disabled for the node', () => {
      const metaUri = 'http://localhost:1234/size-limits-first-meta.json';
      const validator = ZSchema.create({
        safe: true,
        breakOnFirstError: false,
        version: 'draft2020-12',
        formatAssertions: true,
      });
      validator.setRemoteReference(metaUri, {
        $id: metaUri,
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        $vocabulary: {
          'https://json-schema.org/draft/2020-12/vocab/core': true,
          'https://json-schema.org/draft/2020-12/vocab/format-assertion': true,
        },
        $dynamicAnchor: 'meta',
        allOf: [{ $ref: 'https://json-schema.org/draft/2020-12/meta/core' }],
      });
      const res = validator.validate(['x', 'y'], { $schema: metaUri, maxItems: 1, items: { format: 'ipv4' } });
      expect(codesOf(res)).toEqual(sorted(['INVALID_FORMAT', 'INVALID_FORMAT']));
    });

    it('limit and expensive keyword in different nodes', () => {
      const res = run({ maxItems: 1, allOf: [{ items: { type: 'string' } }] }, [1, 2]);
      expect(codesOf(res)).toEqual(sorted(['ARRAY_LENGTH_LONG', 'INVALID_TYPE', 'INVALID_TYPE']));
    });

    it('lower limits gate nothing', () => {
      expect(both({ minLength: 10, pattern: '^a+$' }, longString).on).toEqual(sorted(['MIN_LENGTH', 'PATTERN']));
      expect(both({ minItems: 5, uniqueItems: true }, [1, 1]).on).toEqual(
        sorted(['ARRAY_LENGTH_SHORT', 'ARRAY_UNIQUE'])
      );
      expect(both({ minProperties: 5, additionalProperties: false }, { a: 1 }).on).toEqual(
        sorted(['OBJECT_PROPERTIES_MINIMUM', 'OBJECT_ADDITIONAL_PROPERTIES'])
      );
    });
  });

  describe('still run on an over-limit value', () => {
    it('enum, required, minItems', () => {
      expect(both({ maxItems: 1, minItems: 5, enum: [[0]] }, [1, 2]).on).toEqual(
        sorted(['ARRAY_LENGTH_LONG', 'ARRAY_LENGTH_SHORT', 'ENUM_MISMATCH'])
      );
      expect(both({ maxProperties: 1, required: ['z'] }, { a: 1, b: 2 }).on).toEqual(
        sorted(['OBJECT_PROPERTIES_MAXIMUM', 'OBJECT_MISSING_REQUIRED_PROPERTY'])
      );
    });

    it('allOf, anyOf, not and $ref on the same node', () => {
      const schema: JsonSchema = {
        maxItems: 1,
        allOf: [{ maxItems: 0 }],
        anyOf: [{ maxItems: 0 }],
        not: {},
        $ref: '#/definitions/shortArray',
        definitions: { shortArray: { maxItems: 0 } },
      };
      const codes = both(schema, [1, 2], { version: 'draft2020-12' }).on;
      expect(codes).toContain('ARRAY_LENGTH_LONG');
      expect(codes).toContain('ANY_OF_MISSING');
      expect(codes).toContain('NOT_PASSED');
    });
  });

  describe('breakOnFirstError', () => {
    it('reports the limit error instead of the format error', () => {
      const schema: JsonSchema = { format: 'ipv4', maxLength: 2 };
      expect(codesOf(run(schema, longString, { breakOnFirstError: true, sizeLimitsFirst: true }))).toEqual([
        'MAX_LENGTH',
      ]);
      expect(codesOf(run(schema, longString, { breakOnFirstError: true, sizeLimitsFirst: false }))).toEqual([
        'INVALID_FORMAT',
      ]);
    });

    it('reports an earlier keyword that still runs', () => {
      const schema: JsonSchema = { enum: [[0]], maxItems: 1 };
      for (const sizeLimitsFirst of [true, false]) {
        expect(codesOf(run(schema, [1, 2], { breakOnFirstError: true, sizeLimitsFirst }))).toEqual(['ENUM_MISMATCH']);
      }
    });
  });

  describe('maxDataDepth', () => {
    it('does not descend into an over-limit array', () => {
      let deep: unknown = 1;
      for (let i = 0; i < 6; i++) {
        deep = [deep];
      }
      const schema: JsonSchema = { maxItems: 1, items: { $ref: '#' } };
      const data = [deep, deep];
      expect(codesOf(run(schema, data, { maxDataDepth: 3, sizeLimitsFirst: true }))).toEqual(['ARRAY_LENGTH_LONG']);
      const off = ZSchema.create({ safe: true, maxDataDepth: 3, sizeLimitsFirst: false }).validate(data, schema);
      expect(codesOf(off)).toEqual(['MAX_DATA_DEPTH_EXCEEDED']);
    });
  });

  describe('legacy $ref', () => {
    it('applies the limit of the $ref target', () => {
      const schema: JsonSchema = {
        $ref: '#/definitions/list',
        definitions: { list: { maxItems: 1, items: { type: 'string' } } },
      };
      const { on, off } = both(schema, [1, 2], { version: 'draft-07' });
      expect(on).toEqual(['ARRAY_LENGTH_LONG']);
      expect(off).toEqual(sorted(['ARRAY_LENGTH_LONG', 'INVALID_TYPE', 'INVALID_TYPE']));
    });
  });

  describe('inherited keys', () => {
    const schema: JsonSchema = { maxProperties: 1, additionalProperties: false };

    it('does not count them against the limit', () => {
      const atLimit = Object.create({ inherited: 1 }) as Record<string, unknown>;
      atLimit.a = 1;
      expect(codesOf(run(schema, atLimit))).toEqual(['OBJECT_ADDITIONAL_PROPERTIES']);
    });

    it('counts the own keys over the limit', () => {
      const over = Object.create({ inherited: 1 }) as Record<string, unknown>;
      over.a = 1;
      over.b = 2;
      expect(codesOf(run(schema, over))).toEqual(['OBJECT_PROPERTIES_MAXIMUM']);
    });
  });

  describe('async mode', () => {
    it('resolves invalid with only MAX_LENGTH and does not call the async format', async () => {
      const spy = vi.fn<() => Promise<boolean>>(() => Promise.resolve(true));
      const validator = ZSchema.create({ async: true, safe: true, customFormats: { slow: spy } });
      const res = await validator.validate(longString, { maxLength: 3, format: 'slow' });
      expect(res.valid).toBe(false);
      expect(codesOf(res)).toEqual(sorted(['MAX_LENGTH']));
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('maxErrors', () => {
    it('does not call the format function for any over-long string of an array', () => {
      const spy = vi.fn<() => boolean>(() => true);
      const data = Array.from({ length: 20 }, () => longString);
      const res = run({ items: { maxLength: 3, format: 'spy' } }, data, { maxErrors: 1, customFormats: { spy } });
      expect(res.valid).toBe(false);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('validity', () => {
    const cases: Array<[string, JsonSchema, unknown]> = [];
    const limits: Array<[string, JsonSchema, unknown, unknown]> = [
      ['string pattern', { maxLength: 2, pattern: '^a+$' }, 'bbbb', 'aa'],
      ['string format', { maxLength: 2, format: 'ipv4' }, 'bbbb', 'aa'],
      ['string contentEncoding', { maxLength: 2, contentEncoding: 'base64' }, '!!!!', 'aa'],
      ['string contentMediaType', { maxLength: 2, contentMediaType: 'application/json' }, '{{{{', 'aa'],
      ['array uniqueItems', { maxItems: 1, uniqueItems: true }, [1, 1], [1]],
      ['array contains', { maxItems: 1, contains: { type: 'string' } }, [1, 2], [1]],
      ['array items', { maxItems: 1, items: { type: 'string' } }, [1, 2], ['a']],
      ['array prefixItems', { maxItems: 1, prefixItems: [{ type: 'string' }] }, [1, 2], ['a']],
      ['object properties', { maxProperties: 1, properties: { a: { type: 'string' } } }, { a: 1, b: 2 }, { a: 'x' }],
      [
        'object patternProperties',
        { maxProperties: 1, patternProperties: { '^a': { type: 'string' } } },
        { a: 1, b: 2 },
        { a: 'x' },
      ],
      ['object additionalProperties', { maxProperties: 1, additionalProperties: false }, { a: 1, b: 2 }, { a: 1 }],
      ['object propertyNames', { maxProperties: 1, propertyNames: { maxLength: 1 } }, { aa: 1, bb: 2 }, { a: 1 }],
    ];
    for (const [name, schema, bad, good] of limits) {
      cases.push([`${name}: over limit`, schema, bad], [`${name}: within limit`, schema, good]);
      cases.push([`not ${name}`, { not: schema }, bad], [`anyOf ${name}`, { anyOf: [schema, { type: 'null' }] }, bad]);
      cases.push([`oneOf ${name}`, { oneOf: [schema, { type: 'null' }] }, good]);
      cases.push([`if ${name}`, { if: schema, then: { type: 'null' }, else: {} }, bad]);
    }
    cases.push(
      [
        'unevaluatedItems parent',
        { unevaluatedItems: false, anyOf: [{ maxItems: 1, items: { type: 'string' } }] },
        [1, 2],
      ],
      ['unevaluatedItems allOf', { unevaluatedItems: false, allOf: [{ maxItems: 1, uniqueItems: true }] }, [1, 1]],
      [
        'unevaluatedProperties parent',
        { unevaluatedProperties: false, allOf: [{ maxProperties: 1, properties: { a: {} } }] },
        { a: 1, b: 2 },
      ],
      [
        'unevaluatedProperties anyOf',
        { unevaluatedProperties: false, anyOf: [{ maxProperties: 5, properties: { a: {} } }] },
        { a: 1, b: 2 },
      ]
    );

    it('has at least 30 cases', () => {
      expect(cases.length).toBeGreaterThanOrEqual(30);
    });

    it.each(cases)('%s: same validity with the option on and off', (_name, schema, data) => {
      const options: ZSchemaOptions = { version: 'draft2020-12', formatAssertions: true };
      const verdicts = (sizeLimitsFirst: boolean) => {
        const validator = ZSchema.create({ safe: true, breakOnFirstError: false, ...options, sizeLimitsFirst });
        return [
          validator.validate(data, schema).valid,
          validator.validate(data, schema).valid,
          validator.validate(data, schema).valid,
        ];
      };
      expect(verdicts(true)).toEqual(verdicts(false));
    });
  });

  describe('older drafts', () => {
    it('draft-04 items array and additionalItems', () => {
      const schema: JsonSchema = {
        maxItems: 2,
        items: [{ type: 'string' }],
        additionalItems: { type: 'string' },
      };
      const { on, off } = both(schema, [1, 2, 3], { version: 'draft-04' });
      expect(on).toEqual(sorted(['ARRAY_LENGTH_LONG']));
      expect(off.length).toBeGreaterThan(1);
      expect(off[0]).toBe('ARRAY_LENGTH_LONG');
    });

    it('draft2019-09 items and unevaluatedItems', () => {
      const schema: JsonSchema = { maxItems: 1, items: { type: 'string' }, unevaluatedItems: false };
      const { on, off } = both(schema, [1, 2], { version: 'draft2019-09' });
      expect(on).toEqual(sorted(['ARRAY_LENGTH_LONG']));
      expect(off).toEqual(sorted(['ARRAY_LENGTH_LONG', 'INVALID_TYPE', 'INVALID_TYPE']));
    });
  });

  describe('fast validator order', () => {
    it('rejects an over-long string before the format function runs', () => {
      const spy = vi.fn<() => boolean>(() => true);
      const { fast } = fastFor({ format: 'spy', maxLength: 3 }, { customFormats: { spy } });
      expect(fast).toBeDefined();
      spy.mockClear();
      expect(fast!(longString)).toBe(false);
      expect(spy).not.toHaveBeenCalled();
      expect(fast!('abc')).toBe(true);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('rejects an over-long array before the items are checked', () => {
      const spy = vi.fn<() => boolean>(() => true);
      const { fast } = fastFor({ items: { format: 'spy' }, maxItems: 1 }, { customFormats: { spy } });
      expect(fast).toBeDefined();
      expect(fast!(['a', 'b'])).toBe(false);
      expect(spy).not.toHaveBeenCalled();
      expect(fast!(['a'])).toBe(true);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('compiles the object group before the other keywords of the node', () => {
      const spy = vi.fn<() => boolean>(() => true);
      const { fast } = fastFor(
        { allOf: [{ properties: { a: { format: 'spy' } } }], maxProperties: 1 },
        { customFormats: { spy } }
      );
      expect(fast).toBeDefined();
      spy.mockClear();
      expect(fast!({ a: 'x', b: 'y' })).toBe(false);
      expect(spy).not.toHaveBeenCalled();
      expect(fast!({ a: 'x' })).toBe(true);
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
});
