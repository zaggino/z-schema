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
  });

  describe('schema pre-compilation', () => {
    it('should throw at compile time for invalid schemas', () => {
      const compiler = new ZSchemaCompiler();
      // A schema referencing a non-existent $ref should fail at compile time
      expect(() => compiler.compile({ $ref: 'http://nonexistent/schema' })).toThrow();
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
      expect(() => compiler.addSchema({ type: 'not-a-valid-type' } as any)).toThrow();
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
      const schema = {
        type: 'object',
        required: ['a', 'b', 'c'],
      };

      // Without breakOnFirstError — all errors reported
      const compilerAll = new ZSchemaCompiler({ safe: true });
      const validateAll = compilerAll.compile(schema);
      const resultAll = validateAll({});
      expect(resultAll.valid).toBe(false);

      // With breakOnFirstError — fewer errors reported
      const compilerBreak = new ZSchemaCompiler({ safe: true, breakOnFirstError: true });
      const validateBreak = compilerBreak.compile(schema);
      const resultBreak = validateBreak({});
      expect(resultBreak.valid).toBe(false);
      expect(resultBreak.err!.details!.length).toBeLessThanOrEqual(resultAll.err!.details!.length);
    });
  });
});
