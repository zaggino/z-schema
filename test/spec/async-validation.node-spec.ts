import { describe, expect, it } from 'vitest';

import { ZSchema } from '../../src/z-schema.js';

const asyncValidValid = (input: unknown): Promise<boolean> =>
  Promise.resolve(typeof input === 'string' && input === 'valid');

const syncValidatorSyncValid = (input: unknown): boolean => typeof input === 'string' && input === 'sync-valid';

const asyncValidAsyncValid = (input: unknown): Promise<boolean> =>
  Promise.resolve(typeof input === 'string' && input === 'async-valid');

describe('Async Format Validation Integration', () => {
  it('should validate successfully with async format validator', async () => {
    const validator = ZSchema.create({ async: true, safe: true });

    validator.registerFormat('async-check', asyncValidValid);

    const schema = {
      type: 'string',
      format: 'async-check',
    };

    const result = await validator.validate('valid', schema);
    expect(result.valid).toBe(true);
    expect(result.err).toBeUndefined();
  });

  it('should fail validation with async format validator', async () => {
    const validator = ZSchema.create({ async: true, safe: true });

    validator.registerFormat('async-check', asyncValidValid);

    const schema = {
      type: 'string',
      format: 'async-check',
    };

    const result = await validator.validate('invalid', schema);
    expect(result.valid).toBe(false);
    expect(result.err!.details).toHaveLength(1);
  });

  it('should work with async format validators in oneOf', async () => {
    const validator = ZSchema.create({ async: true, safe: true });

    validator.registerFormat('sync-check', syncValidatorSyncValid);
    validator.registerFormat('async-check', asyncValidAsyncValid);

    const schema = {
      oneOf: [
        { type: 'string', format: 'sync-check' },
        { type: 'string', format: 'async-check' },
      ],
    };

    // Test data that matches the async option
    const result = await validator.validate('async-valid', schema);
    expect(result.valid).toBe(true);
    expect(result.err).toBeUndefined();
  });

  it('should work with async format validators in anyOf', async () => {
    const validator = ZSchema.create({ async: true, safe: true });

    validator.registerFormat('async-check', asyncValidAsyncValid);

    const schema = {
      anyOf: [{ type: 'number' }, { type: 'string', format: 'async-check' }],
    };

    // Test data that matches the async option
    const result = await validator.validate('async-valid', schema);
    expect(result.valid).toBe(true);
    expect(result.err).toBeUndefined();
  });

  it('should fail validation when async format validator in oneOf fails', async () => {
    const validator = ZSchema.create({ async: true, safe: true });

    validator.registerFormat('async-check', asyncValidAsyncValid);

    const schema = {
      oneOf: [{ type: 'string', format: 'async-check' }, { type: 'number' }],
    };

    // Test data that doesn't match any option
    const result = await validator.validate('invalid', schema);
    expect(result.valid).toBe(false);
    expect(result.err!.details).toHaveLength(1);
    expect(result.err!.details![0].code).toBe('ONE_OF_MISSING');
  });
});
