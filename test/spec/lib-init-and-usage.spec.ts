import type { ZSchemaAsync, ZSchemaAsyncSafe, ZSchemaSafe } from '../../src/z-schema.ts';

import ZSchema from '../../src/index.ts';

describe('Initialization and usage', function () {
  it('Should not allow to use new', function () {
    expect(() => new ZSchema()).toThrow();
  });

  it('Should construct validator from factory', async function () {
    const validator: ZSchema = ZSchema.create({ version: 'none' });

    // validate - should return true for valid
    expect(validator.validate(1, { type: 'number' })).toBe(true);
    // validate - should throw for invalid
    expect(() => validator.validate('not-a-number', { type: 'number' })).toThrow();

    // validateSafe - should return true for valid
    expect(validator.validateSafe(1, { type: 'number' }).valid).toBe(true);
    // validateSafe - should return false for invalid
    expect(validator.validateSafe('not-a-number', { type: 'number' }).valid).toBe(false);

    // validateAsync - should return true for valid
    await expect(validator.validateAsync(1, { type: 'number' })).resolves.toBe(true);
    // validateAsync - should throw for invalid
    await expect(validator.validateAsync('not-a-number', { type: 'number' })).rejects.toThrow();

    // validateAsyncSafe - should return true for valid
    await expect(validator.validateAsyncSafe(1, { type: 'number' })).resolves.toEqual({ valid: true });
    // validateAsyncSafe - should return false for invalid
    await expect(validator.validateAsyncSafe('not-a-number', { type: 'number' })).resolves.toMatchObject({
      valid: false,
    });
  });

  it('Should create a safe validator from factory', async function () {
    const validator: ZSchemaSafe = ZSchema.create({ safe: true, version: 'none' });
    // validate - should return true for valid
    expect(validator.validate(1, { type: 'number' }).valid).toBe(true);
    // validate - should return false for invalid
    expect(validator.validate('not-a-number', { type: 'number' }).valid).toBe(false);
  });

  it('Should create an async validator from factory', async function () {
    const validator: ZSchemaAsync = ZSchema.create({ async: true, version: 'none' });
    // validate - should return true for valid
    await expect(validator.validate(1, { type: 'number' })).resolves.toBe(true);
    // validate - should throw for invalid
    await expect(validator.validate('not-a-number', { type: 'number' })).rejects.toThrow();
  });

  it('Should create an async-safe validator from factory', async function () {
    const validator: ZSchemaAsyncSafe = ZSchema.create({ async: true, safe: true, version: 'none' });
    // validate - should return true for valid
    await expect(validator.validate(1, { type: 'number' })).resolves.toEqual({ valid: true });
    // validate - should return false for invalid
    await expect(validator.validate('not-a-number', { type: 'number' })).resolves.toMatchObject({
      valid: false,
    });
  });
});
