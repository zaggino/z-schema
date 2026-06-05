import type { ZSchemaAsync, ZSchemaAsyncSafe, ZSchemaSafe } from '../../src/z-schema.ts';

import { ValidateError } from '../../src/index.ts';
import { ZSchema } from '../../src/z-schema.ts';

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

  it('Should not store the factory-only async/safe flags on the instance options', () => {
    // async/safe are dispatch-only flags consumed by create(); they must not leak
    // into the validator's stored options (nothing reads them post-dispatch).
    const asyncSafe = ZSchema.create({ async: true, safe: true, version: 'none' }) as unknown as {
      options: Record<string, unknown>;
    };
    expect('async' in asyncSafe.options).toBe(false);
    expect('safe' in asyncSafe.options).toBe(false);

    const safe = ZSchema.create({ safe: true, version: 'none' }) as unknown as { options: Record<string, unknown> };
    expect('safe' in safe.options).toBe(false);

    const plain = ZSchema.create({ version: 'none' }) as unknown as { options: Record<string, unknown> };
    expect('async' in plain.options).toBe(false);
    expect('safe' in plain.options).toBe(false);
  });

  it('Should not mutate the caller options object passed to create()', () => {
    const opts = { async: true, safe: true, version: 'none' as const };
    ZSchema.create(opts);
    // create() strips async/safe onto a copy — the caller's object is untouched.
    expect(opts).toEqual({ async: true, safe: true, version: 'none' });
  });
});
