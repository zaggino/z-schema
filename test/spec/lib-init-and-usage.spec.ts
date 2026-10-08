import type { ZSchemaOptions } from '../../src/z-schema-options.ts';

import { ValidateError } from '../../src/index.ts';
import { ZSchema, ZSchemaAsync, ZSchemaAsyncSafe, ZSchemaSafe } from '../../src/z-schema.ts';

describe('Initialization and usage', () => {
  it('Should not allow to use new', () => {
    // @ts-expect-error: intentionally testing that private constructor throws at runtime
    expect(() => new ZSchema()).toThrow('do not use new ZSchema()');
  });

  it('Should construct validator from factory', async () => {
    const validator: ZSchema = ZSchema.create({ version: 'none' });

    // validate - should return true for valid
    expect(validator.validate(1, { type: 'number' })).toBe(true);
    // validate - should throw for invalid
    expect(() => validator.validate('not-a-number', { type: 'number' })).toThrow('JSON_OBJECT_VALIDATION_FAILED');

    // validateSafe - should return true for valid
    expect(validator.validateSafe(1, { type: 'number' }).valid).toBe(true);
    // validateSafe - should return false for invalid
    expect(validator.validateSafe('not-a-number', { type: 'number' }).valid).toBe(false);

    // validateAsync - should return true for valid
    await expect(validator.validateAsync(1, { type: 'number' })).resolves.toBe(true);
    // validateAsync - should throw for invalid
    await expect(validator.validateAsync('not-a-number', { type: 'number' })).rejects.toThrow(ValidateError);

    // validateAsyncSafe - should return true for valid
    await expect(validator.validateAsyncSafe(1, { type: 'number' })).resolves.toEqual({ valid: true });
    // validateAsyncSafe - should return false for invalid
    await expect(validator.validateAsyncSafe('not-a-number', { type: 'number' })).resolves.toMatchObject({
      valid: false,
    });
  });

  it('Should create a safe validator from factory', () => {
    const validator: ZSchemaSafe = ZSchema.create({ safe: true, version: 'none' });
    // validate - should return true for valid
    expect(validator.validate(1, { type: 'number' }).valid).toBe(true);
    // validate - should return false for invalid
    expect(validator.validate('not-a-number', { type: 'number' }).valid).toBe(false);
  });

  it('Should create an async validator from factory', async () => {
    const validator: ZSchemaAsync = ZSchema.create({ async: true, version: 'none' });
    // validate - should return true for valid
    await expect(validator.validate(1, { type: 'number' })).resolves.toBe(true);
    // validate - should throw for invalid
    await expect(validator.validate('not-a-number', { type: 'number' })).rejects.toThrow(ValidateError);
  });

  it('Should create an async-safe validator from factory', async () => {
    const validator: ZSchemaAsyncSafe = ZSchema.create({ async: true, safe: true, version: 'none' });
    // validate - should return true for valid
    await expect(validator.validate(1, { type: 'number' })).resolves.toEqual({ valid: true });
    // validate - should return false for invalid
    await expect(validator.validate('not-a-number', { type: 'number' })).resolves.toMatchObject({
      valid: false,
    });
  });

  describe('options object passed to create', () => {
    it('keeps async/safe on the caller object so it can be reused for every variant', () => {
      const variants = [
        [{ async: true }, ZSchemaAsync],
        [{ safe: true }, ZSchemaSafe],
        [{ async: true, safe: true }, ZSchemaAsyncSafe],
      ] as const;
      for (const [flags, Variant] of variants) {
        const options: ZSchemaOptions & { async?: true; safe?: true } = { ...flags, version: 'none' };
        expect(ZSchema.create(options)).toBeInstanceOf(Variant);
        expect(options).toMatchObject(flags);
        expect(ZSchema.create(options)).toBeInstanceOf(Variant);
      }
    });

    it('accepts validator.options as setRemoteReference validation options', () => {
      const validator = ZSchema.create({ safe: true });
      expect(() => {
        validator.setRemoteReference('http://example.com/remote', { type: 'string' }, validator.options);
      }).not.toThrow();
      expect(validator.validate('x', { $ref: 'http://example.com/remote' }).valid).toBe(true);
    });

    it('still stores the caller object and fills defaults into it', () => {
      const options: ZSchemaOptions & { safe?: true } = { safe: true };
      const validator = ZSchema.create(options);
      expect(validator.options).toBe(options);
      expect(options.breakOnFirstError).toBe(false);
    });

    it('does not add async/safe keys the caller did not pass', () => {
      const options: ZSchemaOptions = {};
      ZSchema.create(options);
      expect(Object.hasOwn(options, 'async')).toBe(false);
      expect(Object.hasOwn(options, 'safe')).toBe(false);
    });

    it('still rejects unknown options alongside async/safe', () => {
      const options = { safe: true, bogus: 1 } as ZSchemaOptions & { safe: true };
      expect(() => ZSchema.create(options)).toThrow(/Unexpected option passed to constructor: bogus/);
    });
  });
});
