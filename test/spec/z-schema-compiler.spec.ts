import type {
  AsyncSafeValidateFunction,
  AsyncValidateFunction,
  SafeValidateFunction,
  ValidateFunction,
} from '../../src/z-schema-compiler.ts';

import { ZSchemaCompiler } from '../../src/z-schema-compiler.ts';

const objectSchema = { type: 'object', required: ['name'], properties: { name: { type: 'string' } } };

describe('ZSchemaCompiler', () => {
  describe('constructor', () => {
    it('should create a compiler with default options', () => {
      const compiler = new ZSchemaCompiler();
      expect(compiler).toBeInstanceOf(ZSchemaCompiler);
    });

    it('should create a compiler with custom options', () => {
      const compiler = new ZSchemaCompiler({ version: 'draft-07' });
      expect(compiler).toBeInstanceOf(ZSchemaCompiler);
    });
  });

  describe('compile (sync, throw mode)', () => {
    it('should return a validation function', () => {
      const compiler = new ZSchemaCompiler();
      const validate = compiler.compile(objectSchema);
      expect(typeof validate).toBe('function');
    });

    it('should return true for valid data', () => {
      const compiler = new ZSchemaCompiler();
      const validate = compiler.compile(objectSchema);
      expect(validate({ name: 'Alice' })).toBe(true);
    });

    it('should throw for invalid data', () => {
      const compiler = new ZSchemaCompiler();
      const validate = compiler.compile(objectSchema);
      expect(() => validate({})).toThrow();
    });

    it('should validate type constraints', () => {
      const compiler = new ZSchemaCompiler();
      const validate = compiler.compile({ type: 'number' });
      expect(validate(42)).toBe(true);
      expect(() => validate('not a number')).toThrow();
    });
  });

  describe('compile (safe mode)', () => {
    it('should return { valid: true } for valid data', () => {
      const compiler = new ZSchemaCompiler({ safe: true });
      const validate = compiler.compile(objectSchema);
      const result = validate({ name: 'Alice' });
      expect(result.valid).toBe(true);
    });

    it('should return { valid: false, err } for invalid data', () => {
      const compiler = new ZSchemaCompiler({ safe: true });
      const validate = compiler.compile(objectSchema);
      const result = validate({});
      expect(result.valid).toBe(false);
      expect(result.err).toBeDefined();
      expect(result.err!.details).toBeInstanceOf(Array);
      expect(result.err!.details!.length).toBeGreaterThan(0);
    });

    it('should never throw for invalid data', () => {
      const compiler = new ZSchemaCompiler({ safe: true });
      const validate = compiler.compile(objectSchema);
      expect(() => validate('completely wrong')).not.toThrow();
    });
  });

  describe('compile (async, throw mode)', () => {
    it('should resolve true for valid data', async () => {
      const compiler = new ZSchemaCompiler({ async: true });
      const validate = compiler.compile(objectSchema);
      await expect(validate({ name: 'Bob' })).resolves.toBe(true);
    });

    it('should reject for invalid data', async () => {
      const compiler = new ZSchemaCompiler({ async: true });
      const validate = compiler.compile(objectSchema);
      await expect(validate({})).rejects.toThrow();
    });
  });

  describe('compile (async + safe mode)', () => {
    it('should resolve { valid: true } for valid data', async () => {
      const compiler = new ZSchemaCompiler({ async: true, safe: true });
      const validate = compiler.compile(objectSchema);
      await expect(validate({ name: 'Carol' })).resolves.toEqual({ valid: true });
    });

    it('should resolve { valid: false } for invalid data (never rejects)', async () => {
      const compiler = new ZSchemaCompiler({ async: true, safe: true });
      const validate = compiler.compile(objectSchema);
      const result = await validate({});
      expect(result.valid).toBe(false);
      expect(result.err).toBeDefined();
    });
  });

  describe('boolean schemas', () => {
    it('should accept everything with true schema', () => {
      const compiler = new ZSchemaCompiler({ version: 'none' });
      const validate = compiler.compile(true);
      expect(validate('anything')).toBe(true);
      expect(validate(42)).toBe(true);
      expect(validate(null)).toBe(true);
      expect(validate({})).toBe(true);
    });

    it('should reject everything with false schema', () => {
      const compiler = new ZSchemaCompiler({ version: 'none' });
      const validate = compiler.compile(false);
      expect(() => validate('anything')).toThrow();
      expect(() => validate(42)).toThrow();
      expect(() => validate(null)).toThrow();
    });

    it('should work with boolean schemas in safe mode', () => {
      const compiler = new ZSchemaCompiler({ safe: true, version: 'none' });
      const validateTrue = compiler.compile(true);
      expect(validateTrue('anything').valid).toBe(true);

      const validateFalse = compiler.compile(false);
      expect(validateFalse('anything').valid).toBe(false);
    });

    it('should work with boolean schemas in async mode', async () => {
      const compiler = new ZSchemaCompiler({ async: true, version: 'none' });
      await expect(compiler.compile(true)('anything')).resolves.toBe(true);
      await expect(compiler.compile(false)('anything')).rejects.toThrow();
    });

    it('should work with boolean schemas in async + safe mode', async () => {
      const compiler = new ZSchemaCompiler({ async: true, safe: true, version: 'none' });
      await expect(compiler.compile(true)('anything')).resolves.toEqual({ valid: true });
      const result = await compiler.compile(false)('anything');
      expect(result.valid).toBe(false);
    });
  });

  describe('schema pre-compilation', () => {
    it('should throw at compile time for invalid schemas', () => {
      const compiler = new ZSchemaCompiler();
      // A $ref to an unreachable remote schema fails during the eager compile-time
      // validateSchema call (the remote can't be resolved), so compile() throws.
      expect(() => compiler.compile({ $ref: 'http://nonexistent/schema' })).toThrow();
    });

    it('should reuse the compiled schema across repeated calls', () => {
      const compiler = new ZSchemaCompiler();
      const validate = compiler.compile(objectSchema);
      // The compiled function caches the schema by id and must return stable
      // results no matter how many times — and in which order — it is called.
      for (let i = 0; i < 5; i++) {
        expect(validate({ name: 'Alice' })).toBe(true);
        expect(() => validate({})).toThrow();
      }
    });

    it('should not mutate the caller schema object when compiling', () => {
      const compiler = new ZSchemaCompiler();
      const schema = { type: 'object', required: ['name'] };
      compiler.compile(schema);
      // The internal id is assigned to a private clone, never the input.
      expect(schema).toEqual({ type: 'object', required: ['name'] });
    });

    it('should compile multiple schemas independently', () => {
      const compiler = new ZSchemaCompiler();
      const validateString = compiler.compile({ type: 'string' });
      const validateNumber = compiler.compile({ type: 'number' });

      expect(validateString('hello')).toBe(true);
      expect(() => validateString(42)).toThrow();

      expect(validateNumber(42)).toBe(true);
      expect(() => validateNumber('hello')).toThrow();
    });
  });

  describe('complex schemas', () => {
    it('should handle nested object schemas', () => {
      const compiler = new ZSchemaCompiler();
      const schema = {
        type: 'object',
        properties: {
          address: {
            type: 'object',
            required: ['street'],
            properties: {
              street: { type: 'string' },
              zip: { type: 'string' },
            },
          },
        },
        required: ['address'],
      };
      const validate = compiler.compile(schema);

      expect(validate({ address: { street: '123 Main St' } })).toBe(true);
      expect(() => validate({ address: {} })).toThrow();
      expect(() => validate({})).toThrow();
    });

    it('should handle array schemas', () => {
      const compiler = new ZSchemaCompiler();
      const schema = {
        type: 'array',
        items: { type: 'number' },
        minItems: 1,
      };
      const validate = compiler.compile(schema);

      expect(validate([1, 2, 3])).toBe(true);
      expect(() => validate([])).toThrow();
      expect(() => validate(['not', 'numbers'])).toThrow();
    });

    it('should handle enum schemas', () => {
      const compiler = new ZSchemaCompiler();
      const validate = compiler.compile({ enum: ['red', 'green', 'blue'] });

      expect(validate('red')).toBe(true);
      expect(() => validate('yellow')).toThrow();
    });
  });

  describe('addSchema + validate', () => {
    it('should register a schema and validate by $id reference', () => {
      const compiler = new ZSchemaCompiler({ version: 'none' });
      const schema = { $id: 'person', type: 'object', required: ['name'], properties: { name: { type: 'string' } } };
      compiler.addSchema(schema);

      expect(compiler.validate({ name: 'Alice' }, 'person')).toBe(true);
      expect(() => compiler.validate({}, 'person')).toThrow();
    });

    it('should support chaining on addSchema', () => {
      const compiler = new ZSchemaCompiler({ version: 'none' });
      const result = compiler.addSchema({ $id: 'str', type: 'string' }).addSchema({ $id: 'num', type: 'number' });
      expect(result).toBe(compiler);
    });

    it('should work in safe mode', () => {
      const compiler = new ZSchemaCompiler({ safe: true, version: 'none' });
      compiler.addSchema({ $id: 'num', type: 'number' });

      const valid = compiler.validate(42, 'num');
      expect(valid.valid).toBe(true);

      const invalid = compiler.validate('hello', 'num');
      expect(invalid.valid).toBe(false);
      expect(invalid.err).toBeDefined();
    });

    it('should work in async mode', async () => {
      const compiler = new ZSchemaCompiler({ async: true, version: 'none' });
      compiler.addSchema({ $id: 'bool', type: 'boolean' });

      await expect(compiler.validate(true, 'bool')).resolves.toBe(true);
      await expect(compiler.validate('nope', 'bool')).rejects.toThrow();
    });

    it('should work in async + safe mode', async () => {
      const compiler = new ZSchemaCompiler({ async: true, safe: true, version: 'none' });
      compiler.addSchema({ $id: 'arr', type: 'array' });

      const valid = await compiler.validate([], 'arr');
      expect(valid.valid).toBe(true);

      const invalid = await compiler.validate('not-array', 'arr');
      expect(invalid.valid).toBe(false);
    });

    it('should throw on addSchema with an invalid schema', () => {
      const compiler = new ZSchemaCompiler();
      expect(() => compiler.addSchema({ type: 'not-a-valid-type', $id: 'bad' } as any)).toThrow();
    });

    it('should warn when addSchema is called without a $id', () => {
      const compiler = new ZSchemaCompiler({ version: 'none' });
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        compiler.addSchema({ type: 'string' } as any);
        expect(warn).toHaveBeenCalledOnce();
      } finally {
        warn.mockRestore();
      }
    });

    it('should throw for an unregistered ref (sync)', () => {
      const compiler = new ZSchemaCompiler({ version: 'none' });
      expect(() => compiler.validate({}, 'never-registered')).toThrow();
    });

    it('should report invalid for an unregistered ref (safe)', () => {
      const compiler = new ZSchemaCompiler({ safe: true, version: 'none' });
      const result = compiler.validate({}, 'never-registered');
      expect(result.valid).toBe(false);
      expect(result.err).toBeDefined();
    });

    it('should reject for an unregistered ref (async)', async () => {
      const compiler = new ZSchemaCompiler({ async: true, version: 'none' });
      await expect(compiler.validate({}, 'never-registered')).rejects.toThrow();
    });
  });

  describe('data edge cases', () => {
    it('should reject undefined data against an object schema', () => {
      const validate = new ZSchemaCompiler().compile(objectSchema);
      const undefinedData: unknown = undefined;
      expect(() => validate(undefinedData)).toThrow();
    });

    it('should reject null data against an object schema', () => {
      const validate = new ZSchemaCompiler().compile(objectSchema);
      expect(() => validate(null)).toThrow();
    });

    it('should accept null when the schema allows null', () => {
      const validate = new ZSchemaCompiler().compile({ type: 'null' });
      expect(validate(null)).toBe(true);
    });
  });

  describe('customFormats passthrough', () => {
    it('should honor a custom format passed via options', () => {
      const compiler = new ZSchemaCompiler({
        safe: true,
        version: 'draft-04',
        customFormats: { 'only-foo': (value: unknown) => value === 'foo' },
      });
      const validate = compiler.compile({ type: 'string', format: 'only-foo' });
      expect(validate('foo').valid).toBe(true);
      expect(validate('bar').valid).toBe(false);
    });
  });

  describe('compile() return-type inference', () => {
    it('infers the function type from the constructor options', () => {
      expectTypeOf(new ZSchemaCompiler().compile(objectSchema)).toEqualTypeOf<ValidateFunction>();
      expectTypeOf(new ZSchemaCompiler({ safe: true }).compile(objectSchema)).toEqualTypeOf<SafeValidateFunction>();
      expectTypeOf(new ZSchemaCompiler({ async: true }).compile(objectSchema)).toEqualTypeOf<AsyncValidateFunction>();
      expectTypeOf(
        new ZSchemaCompiler({ async: true, safe: true }).compile(objectSchema)
      ).toEqualTypeOf<AsyncSafeValidateFunction>();
    });
  });

  describe('options passthrough', () => {
    it('should respect version option', () => {
      const compiler = new ZSchemaCompiler({ version: 'draft-04' });
      // draft-04 uses 'id' not '$id' — a valid draft-04 schema should compile fine
      const validate = compiler.compile({ type: 'string' });
      expect(validate('hello')).toBe(true);
    });

    it('should respect breakOnFirstError option', () => {
      // Three independent keyword failures on a single value: without the option
      // all three are collected; with it, validation stops after the first.
      const schema = { type: 'string', minLength: 5, pattern: '^x', enum: ['zzz'] };
      const badValue = 'a';

      const compilerAll = new ZSchemaCompiler({ safe: true });
      const resultAll = compilerAll.compile(schema)(badValue);
      expect(resultAll.valid).toBe(false);
      expect(resultAll.err!.details!.length).toBeGreaterThan(1);

      const compilerBreak = new ZSchemaCompiler({ safe: true, breakOnFirstError: true });
      const resultBreak = compilerBreak.compile(schema)(badValue);
      expect(resultBreak.valid).toBe(false);
      expect(resultBreak.err!.details!.length).toBeLessThan(resultAll.err!.details!.length);
    });
  });
});
