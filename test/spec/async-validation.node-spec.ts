import { describe, expect, it } from 'vitest';

import { ZSchema } from '../../src/z-schema.ts';
import { nextTurn } from '../lib/async-harness.ts';

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

describe('Async rejection handling', () => {
  // A rejected format promise whose task never runs (skipped after a sync error) must not become an unhandled rejection.
  it('does not emit an unhandled rejection for a rejected format after a sync error', async () => {
    const validator = ZSchema.create({ async: true, safe: true, breakOnFirstError: true, version: 'draft2020-12' });
    validator.registerFormat('rejects', () => Promise.reject(new Error('x')));
    let unhandled = 0;
    const spy = () => {
      unhandled += 1;
    };
    process.on('unhandledRejection', spy);
    try {
      const result = await validator.validate(
        { a: 1, b: 'y' },
        { properties: { a: { type: 'string' }, b: { format: 'rejects' } } }
      );
      await nextTurn();
      await nextTurn();

      expect(result.valid).toBe(false);
      expect(unhandled).toBe(0);
    } finally {
      process.off('unhandledRejection', spy);
    }
  });
});
