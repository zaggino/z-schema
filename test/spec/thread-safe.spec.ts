import { describe, expect, it } from 'vitest';

import { ZSchema } from '../../src/z-schema.js';

describe('Thread Safety', () => {
  it('should not leak errors between concurrent validations', async () => {
    const validator = ZSchema.create();
    const invalidSchema = { type: 'string' };
    const validSchema = { type: 'string' };

    // First validation: invalid data
    const result1 = validator.validateSafe(123, invalidSchema);
    expect(result1.valid).toBe(false);
    expect(result1.err).toBeDefined();
    expect(result1.err!.details?.length).toBeGreaterThan(0);

    // Second validation: valid data
    const result2 = validator.validateSafe('valid string', validSchema);
    expect(result2.valid).toBe(true);
    expect(result2.err).toBeUndefined();

    // Verify that results are independent
    expect(result1.valid).toBe(false); // Still false, not affected by second validation
    expect(result2.valid).toBe(true);
  });

  it('should handle concurrent async validations across multiple instances without interference', async () => {
    const validator1 = ZSchema.create({ async: true, safe: true });
    const validator2 = ZSchema.create({ async: true, safe: true });
    const stringSchema = { type: 'string' };

    // Prepare four async validations:
    // validator1: invalid data (fail), valid data (pass)
    // validator2: valid data (pass), invalid data (fail)
    const promise1 = validator1.validate(123, stringSchema); // should fail
    const promise2 = validator1.validate('hello', stringSchema); // should pass
    const promise3 = validator2.validate('world', stringSchema); // should pass
    const promise4 = validator2.validate(456, stringSchema); // should fail

    // Run all concurrently
    const [result1, result2, result3, result4] = await Promise.all([promise1, promise2, promise3, promise4]);

    // Verify results are correct regardless of completion order
    expect(result1.valid).toBe(false);
    expect(result1.err).toBeDefined();
    expect(result1.err!.details?.length).toBeGreaterThan(0);

    expect(result2.valid).toBe(true);
    expect(result2.err).toBeUndefined();

    expect(result3.valid).toBe(true);
    expect(result3.err).toBeUndefined();

    expect(result4.valid).toBe(false);
    expect(result4.err).toBeDefined();
    expect(result4.err!.details?.length).toBeGreaterThan(0);
  });

  it('should handle concurrent async format validations without interference', async () => {
    const validator1 = ZSchema.create({ async: true, safe: true });
    const validator2 = ZSchema.create({ async: true, safe: true });

    // Register async format that waits random 0-100ms then checks if string
    const asyncStringFormat = async (input: unknown): Promise<boolean> => {
      const delay = Math.random() * 100;
      await new Promise((resolve) => {
        setTimeout(resolve, delay);
      });
      return typeof input === 'string';
    };

    validator1.registerFormat('async-string', asyncStringFormat);
    validator2.registerFormat('async-string', asyncStringFormat);

    const asyncStringSchema = { type: 'string', format: 'async-string' };

    // Prepare four async validations with format:
    // validator1: invalid data (fail), valid data (pass)
    // validator2: valid data (pass), invalid data (fail)
    const promise1 = validator1.validate(123, asyncStringSchema); // should fail
    const promise2 = validator1.validate('hello', asyncStringSchema); // should pass
    const promise3 = validator2.validate('world', asyncStringSchema); // should pass
    const promise4 = validator2.validate(456, asyncStringSchema); // should fail

    // Run all concurrently
    const [result1, result2, result3, result4] = await Promise.all([promise1, promise2, promise3, promise4]);

    // Verify results are correct regardless of completion order
    expect(result1.valid).toBe(false);
    expect(result1.err).toBeDefined();
    expect(result1.err!.details?.length).toBeGreaterThan(0);

    expect(result2.valid).toBe(true);
    expect(result2.err).toBeUndefined();

    expect(result3.valid).toBe(true);
    expect(result3.err).toBeUndefined();

    expect(result4.valid).toBe(false);
    expect(result4.err).toBeDefined();
    expect(result4.err!.details?.length).toBeGreaterThan(0);
  });
});
