import type { JsonSchema } from '../../src/json-schema-versions.ts';
import type { ValidateOptions, ValidateResponse } from '../../src/z-schema-base.ts';
import type { ZSchemaOptions } from '../../src/z-schema-options.ts';
import type { ZSchemaSafe } from '../../src/z-schema.ts';

import { ValidateError } from '../../src/index.ts';
import { ZSchema } from '../../src/z-schema.ts';

const numberSchema: JsonSchema = { type: 'number' };

const codesOf = (res: ValidateResponse): string[] => (res.err?.details ?? []).map((d) => d.code);

const walk = (o: unknown): string[] =>
  o && typeof o === 'object' ? Object.keys(o).flatMap((k) => [k, ...walk((o as Record<string, unknown>)[k])]) : [];

const createPair = (setup: (v: ZSchemaSafe) => void, schema: JsonSchema) => {
  const ref = ZSchema.create({ safe: true });
  const cmp = ZSchema.create({ safe: true });
  setup(ref);
  setup(cmp);
  return { ref, cmp, fn: cmp.compile(schema) };
};

const expectSameResults = (
  ref: ZSchemaSafe,
  fn: (json: unknown) => ValidateResponse,
  schema: JsonSchema,
  data: unknown[]
) => {
  for (const d of data) {
    const expected = ref.validate(d, schema);
    const actual = fn(d);
    expect(actual.valid).toBe(expected.valid);
    expect(codesOf(actual)).toEqual(codesOf(expected));
  }
};

const markerCounter = (into: number[]) => (_report: unknown, schema: unknown) => {
  const node = schema as { 'x-marker'?: boolean; __seen?: number };
  if (node['x-marker']) {
    node.__seen = (node.__seen ?? 0) + 1;
    into.push(node.__seen);
  }
};

describe('compile()', () => {
  describe('variants', () => {
    it('ZSchema: returns true or throws', () => {
      const v = ZSchema.create({});
      const fn = v.compile(numberSchema);
      expect(fn(1)).toBe(true);
      expect(() => fn('x')).toThrow(ValidateError);
      expect(() => fn('x', { includeErrors: ['INVALID_TYPE'] })).toThrow(ValidateError);
      expect(() => fn('x', { includeErrors: ['MIN_LENGTH'] })).not.toThrow();
    });

    it('ZSchemaSafe: returns a response', () => {
      const v = ZSchema.create({ safe: true });
      const fn = v.compile(numberSchema);
      expect(fn(1)).toEqual({ valid: true });
      const res = fn('x');
      expect(res.valid).toBe(false);
      expect(codesOf(res)).toEqual(['INVALID_TYPE']);
      expect(fn('x', { includeErrors: ['MIN_LENGTH'] }).valid).toBe(true);
    });

    it('ZSchemaAsync: resolves or rejects', async () => {
      const v = ZSchema.create({ async: true });
      const fn = v.compile(numberSchema);
      await expect(fn(1)).resolves.toBe(true);
      await expect(fn('x')).rejects.toThrow(ValidateError);
      await expect(fn('x', { includeErrors: ['MIN_LENGTH'] })).resolves.toBe(true);
    });

    it('ZSchemaAsyncSafe: resolves a response', async () => {
      const v = ZSchema.create({ async: true, safe: true });
      const fn = v.compile(numberSchema);
      await expect(fn(1)).resolves.toEqual({ valid: true });
      const res = await fn('x');
      expect(res.valid).toBe(false);
      expect(codesOf(res)).toEqual(['INVALID_TYPE']);
      await expect(fn('x', { includeErrors: ['MIN_LENGTH'] })).resolves.toMatchObject({ valid: true });
    });
  });

  describe('boolean schemas', () => {
    it('compile(true) accepts anything', () => {
      expect(ZSchema.create({}).compile(true)(42)).toBe(true);
    });

    it('compile(false) fails with SCHEMA_IS_FALSE like validate(x, false)', () => {
      const v = ZSchema.create({ safe: true });
      const res = v.compile(false)(1);
      expect(res.valid).toBe(false);
      expect(codesOf(res)).toEqual(['SCHEMA_IS_FALSE']);
      expect(codesOf(v.validate(1, false as unknown as JsonSchema))).toEqual(['SCHEMA_IS_FALSE']);
    });
  });

  describe('invalid schema', () => {
    const bad = { type: 'nope' } as unknown as JsonSchema;
    it('throws at compile time for all variants', () => {
      expect(() => ZSchema.create({}).compile(bad)).toThrow(ValidateError);
      expect(() => ZSchema.create({ safe: true }).compile(bad)).toThrow(ValidateError);
      expect(() => ZSchema.create({ async: true }).compile(bad)).toThrow(ValidateError);
      expect(() => ZSchema.create({ async: true, safe: true }).compile(bad)).toThrow(ValidateError);
    });
  });

  describe('schema handling', () => {
    it('does not mutate the caller schema', () => {
      const schema: JsonSchema = {
        type: 'object',
        properties: { a: { $ref: '#/$defs/x' } },
        $defs: { x: { type: 'string' } },
      };
      const before = structuredClone(schema);
      const fn = ZSchema.create({ safe: true }).compile(schema);
      expect(fn({ a: 'x' }).valid).toBe(true);
      expect(fn({ a: 1 }).valid).toBe(false);
      expect(schema).toEqual(before);
      expect(walk(schema).filter((k) => k.startsWith('__$'))).toEqual([]);
    });

    it('two compiles sharing the same $id validate against their own schema', () => {
      const v = ZSchema.create({ safe: true });
      const a = v.compile({ $id: 'http://example.com/same', type: 'string' });
      const b = v.compile({ $id: 'http://example.com/same', type: 'number' });
      expect(a('s').valid).toBe(true);
      expect(a(1).valid).toBe(false);
      expect(b(1).valid).toBe(true);
      expect(b('s').valid).toBe(false);
    });

    it('resolves $ref to a schema registered via validateSchema', () => {
      const v = ZSchema.create({ safe: true });
      v.validateSchema({ $id: 'http://example.com/known', type: 'string' });
      const fn = v.compile({ $ref: 'http://example.com/known' });
      expect(fn('s').valid).toBe(true);
      expect(fn(1).valid).toBe(false);
    });

    it('unknown remote $ref throws the same code as validateSchema', () => {
      const schema: JsonSchema = { $ref: 'http://example.com/unknown-remote' };
      let expected: unknown;
      try {
        ZSchema.create({}).validateSchema(schema);
      } catch (error) {
        expected = (error as ValidateError).details!.map((d) => d.code);
      }
      expect(expected).toBeDefined();
      let actual: unknown;
      try {
        ZSchema.create({}).compile(schema);
      } catch (error) {
        actual = (error as ValidateError).details!.map((d) => d.code);
      }
      expect(actual).toEqual(expected);
    });

    it('ignores changes to the caller schema made after compile', () => {
      const schema: { type: string } = { type: 'string' };
      const fn = ZSchema.create({ safe: true }).compile(schema);
      schema.type = 'number';
      expect(fn('s').valid).toBe(true);
      expect(fn(1).valid).toBe(false);
    });

    it('compiles once: calls reuse the compiled schema without clearing the cache', () => {
      const v = ZSchema.create({ safe: true });
      const fn = v.compile({ $id: 'http://example.com/once', type: 'object', properties: { a: { type: 'string' } } });
      const compileSpy = vi.spyOn(v.sc, 'compileSchema');
      const clearSpy = vi.spyOn(v.compiledSchemaCache, 'clear');
      expect(fn({ a: 's' }).valid).toBe(true);
      expect(fn({ a: 1 }).valid).toBe(false);
      expect(compileSpy).not.toHaveBeenCalled();
      expect(clearSpy).not.toHaveBeenCalled();
    });
  });

  describe('parity with validate(data, schema) across cache changes', () => {
    it('relative $ref resolves against the schema $id', () => {
      expect.hasAssertions();
      const schema: JsonSchema = { $id: 'http://example.com/dir/root.json', $ref: 'other.json' };
      const { ref, fn } = createPair((v) => {
        v.setRemoteReference('http://example.com/dir/other.json', { type: 'string' });
      }, schema);
      expectSameResults(ref, fn, schema, ['abc', 1]);
    });

    it('relative $id with a relative $ref', () => {
      expect.hasAssertions();
      const schema: JsonSchema = { $id: 'dir/root.json', $ref: 'other.json' };
      const { ref, fn } = createPair((v) => {
        v.setRemoteReference('dir/other.json', { type: 'string' });
      }, schema);
      expectSameResults(ref, fn, schema, ['abc', 1]);
    });

    it('picks up a replaced remote reference', () => {
      const uri = 'http://example.com/replaced.json';
      const schema: JsonSchema = { $ref: uri };
      const { ref, cmp, fn } = createPair((v) => {
        v.setRemoteReference(uri, { type: 'string' });
      }, schema);
      expectSameResults(ref, fn, schema, ['a', 1]);
      ref.setRemoteReference(uri, { type: 'number' });
      cmp.setRemoteReference(uri, { type: 'number' });
      expectSameResults(ref, fn, schema, ['a', 1]);
      expect(fn(1).valid).toBe(true);
    });

    it('hands a customValidator a fresh schema on every call', () => {
      const compiledSeen: number[] = [];
      const validatedSeen: number[] = [];
      // Only the marked user-schema node is counted; meta-schema nodes are shared across calls.
      const schema = { type: 'string', 'x-marker': true } as JsonSchema;
      const ref = ZSchema.create({ safe: true, customValidator: markerCounter(validatedSeen) });
      const fn = ZSchema.create({ safe: true, customValidator: markerCounter(compiledSeen) }).compile(schema);
      for (let i = 0; i < 3; i++) {
        ref.validate('a', schema);
        fn('a');
      }
      expect(validatedSeen).toEqual([1, 1, 1]);
      expect(compiledSeen).toEqual(validatedSeen);
    });

    it('runs async format validators like validate()', async () => {
      const schema: JsonSchema = { type: 'string', format: 'slow-even-length' };
      const v = ZSchema.create({ async: true, safe: true });
      v.registerFormat('slow-even-length', (value) =>
        Promise.resolve(typeof value === 'string' && value.length % 2 === 0)
      );
      const fn = v.compile(schema);
      const [okRes, badRes] = await Promise.all([fn('ab'), fn('abc')]);
      expect(okRes).toEqual(await v.validate('ab', schema));
      expect(badRes.valid).toBe(false);
      expect(codesOf(badRes)).toEqual(codesOf(await v.validate('abc', schema)));
    });
  });

  describe('parity with validate(data, schema)', () => {
    const cases: Array<{ name: string; schema: JsonSchema; options?: ZSchemaOptions; data: unknown[] }> = [
      { name: 'no $id', schema: { type: 'object', required: ['a'] }, data: [{ a: 1 }, {}, 1] },
      {
        name: 'with $id',
        schema: { $id: 'http://example.com/p1', type: 'object', properties: { a: { type: 'string' } } },
        data: [{ a: 's' }, { a: 1 }],
      },
      {
        name: 'internal $ref to $defs, no $id',
        schema: { type: 'object', properties: { a: { $ref: '#/$defs/x' } }, $defs: { x: { type: 'integer' } } },
        data: [{ a: 1 }, { a: 'x' }],
      },
      {
        name: 'internal $ref to $defs, with $id',
        schema: {
          $id: 'http://example.com/p2',
          properties: { a: { $ref: '#/$defs/x' } },
          $defs: { x: { type: 'integer' } },
        },
        data: [{ a: 1 }, { a: 'x' }],
      },
      {
        name: 'strictMode',
        schema: {
          type: 'object',
          properties: { a: { type: 'string', maxLength: 5 } },
          additionalProperties: false,
        },
        options: { strictMode: true },
        data: [{ a: 's' }, { a: 1 }, { a: 's', b: 1 }, { a: 'toolong' }],
      },
      {
        name: 'strictMode with $defs',
        schema: {
          type: 'object',
          properties: { a: { $ref: '#/$defs/x' } },
          additionalProperties: false,
          $defs: { x: { type: 'string', maxLength: 5 } },
        },
        options: { strictMode: true },
        data: [{ a: 's' }, { a: 1 }],
      },
      {
        name: 'noExtraKeywords',
        schema: { type: 'string' },
        options: { noExtraKeywords: true },
        data: ['s', 1],
      },
      {
        name: 'draft-04 with id',
        schema: { id: 'http://example.com/d4', type: 'object', properties: { a: { type: 'number' } } },
        options: { version: 'draft-04' },
        data: [{ a: 1 }, { a: 'x' }],
      },
      {
        name: 'draft-04 without id',
        schema: {
          type: 'object',
          properties: { a: { $ref: '#/definitions/x' } },
          definitions: { x: { type: 'number' } },
        },
        options: { version: 'draft-04' },
        data: [{ a: 1 }, { a: 'x' }],
      },
    ];

    it.each(cases)('$name', (c) => {
      const opts = { ...c.options, safe: true as const };
      const ref = ZSchema.create(opts);
      const fn = ZSchema.create(opts).compile(c.schema);
      for (const d of c.data) {
        const expected = ref.validate(d, c.schema);
        const actual = fn(d);
        expect(actual.valid).toBe(expected.valid);
        expect(codesOf(actual)).toEqual(codesOf(expected));
      }
    });
  });

  describe('types', () => {
    it('has the right return types per variant', () => {
      expectTypeOf(ZSchema.create({}).compile(true)).toEqualTypeOf<
        (json: unknown, options?: ValidateOptions) => true
      >();
      expectTypeOf(ZSchema.create({ safe: true }).compile(true)).toEqualTypeOf<
        (json: unknown, options?: ValidateOptions) => ValidateResponse
      >();
      expectTypeOf(ZSchema.create({ async: true }).compile(true)).toEqualTypeOf<
        (json: unknown, options?: ValidateOptions) => Promise<true>
      >();
      expectTypeOf(ZSchema.create({ async: true, safe: true }).compile(true)).toEqualTypeOf<
        (json: unknown, options?: ValidateOptions) => Promise<ValidateResponse>
      >();
    });
  });
});
