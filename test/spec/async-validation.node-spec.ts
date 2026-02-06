import { describe, it, expect } from 'vitest';
import ZSchema, { SchemaErrorDetail } from '../../src/index.js';

describe('Async Format Validation Integration', () => {
  it('should validate successfully with async format validator', async () => {
    const validator = new ZSchema();

    const asyncValidator = async (input: unknown): Promise<boolean> => {
      // Simulate async check
      return typeof input === 'string' && input === 'valid';
    };

    validator.registerFormat('async-check', asyncValidator);

    const schema = {
      type: 'string',
      format: 'async-check',
    };

    const result = await new Promise<{ err: SchemaErrorDetail[] | null; valid: boolean }>((resolve) => {
      validator.validate('valid', schema, (err, valid) => {
        resolve({ err: err as SchemaErrorDetail[] | null, valid });
      });
    });

    expect(result.valid).toBe(true);
    expect(result.err).toBe(null);
  });

  it('should fail validation with async format validator', async () => {
    const validator = new ZSchema();

    const asyncValidator = async (input: unknown): Promise<boolean> => {
      return typeof input === 'string' && input === 'valid';
    };

    validator.registerFormat('async-check', asyncValidator);

    const schema = {
      type: 'string',
      format: 'async-check',
    };

    const result = await new Promise<{ err: SchemaErrorDetail[] | null; valid: boolean }>((resolve) => {
      validator.validate('invalid', schema, (err, valid) => {
        resolve({ err: err as SchemaErrorDetail[] | null, valid });
      });
    });

    expect(result.valid).toBe(false);
    expect(result.err).toHaveLength(1);
  });

  it('should work with async format validators in oneOf', async () => {
    const validator = new ZSchema();

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
    const result = await new Promise<{ err: SchemaErrorDetail[] | null; valid: boolean }>((resolve) => {
      validator.validate('async-valid', schema, (err, valid) => {
        resolve({ err: err as SchemaErrorDetail[] | null, valid });
      });
    });

    expect(result.valid).toBe(true);
    expect(result.err).toBe(null);
  });
});
