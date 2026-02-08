import { describe, it, expect } from 'vitest';
import ZSchema from '../../src/index.js';

describe('Async Format Validation Integration', () => {
  it('should validate successfully with async format validator', async () => {
    const validator = ZSchema.create({ async: true, safe: true });

    const asyncValidator = async (input: unknown): Promise<boolean> => {
      // Simulate async check
      return typeof input === 'string' && input === 'valid';
    };

    validator.registerFormat('async-check', asyncValidator);

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

    const asyncValidator = async (input: unknown): Promise<boolean> => {
      return typeof input === 'string' && input === 'valid';
    };

    validator.registerFormat('async-check', asyncValidator);

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

    const syncValidator = (input: unknown): boolean => {
      return typeof input === 'string' && input === 'sync-valid';
    };

    const asyncValidator = async (input: unknown): Promise<boolean> => {
      return typeof input === 'string' && input === 'async-valid';
    };

    validator.registerFormat('sync-check', syncValidator);
    validator.registerFormat('async-check', asyncValidator);

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

    const asyncValidator = async (input: unknown): Promise<boolean> => {
      return typeof input === 'string' && input === 'async-valid';
    };

    validator.registerFormat('async-check', asyncValidator);

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

    const asyncValidator = async (input: unknown): Promise<boolean> => {
      return typeof input === 'string' && input === 'async-valid';
    };

    validator.registerFormat('async-check', asyncValidator);

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
