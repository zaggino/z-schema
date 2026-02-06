import { describe, it, expect } from 'vitest';
import ZSchema from '../../src/index.js';
import type { SchemaErrorDetail } from '../../src/report.js';

describe('Format Validators', () => {
  describe('Async Format Validator Registration', () => {
    it('should register an async format validator', () => {
      const validator = new ZSchema();

      const asyncValidator = async (input: unknown): Promise<boolean> => {
        return typeof input === 'string' && input.length > 3;
      };

      validator.registerFormat('async-test', asyncValidator);

      const registered = validator.getRegisteredFormats();
      expect(registered).toContain('async-test');
    });
  });

  describe('Sync Format Validators Regression', () => {
    it('should validate with built-in sync format validators', () => {
      const validator = new ZSchema();

      const schema = {
        type: 'string',
        format: 'email',
      };

      const result = validator.validate('test@example.com', schema);
      expect(result).toBe(true);
    });

    it('should fail validation with built-in sync format validators', () => {
      const validator = new ZSchema();

      const schema = {
        type: 'string',
        format: 'email',
      };

      const result = validator.validate('invalid-email', schema);
      expect(result).toBe(false);
    });
  });

  describe('Async Timeout Handling', () => {
    it('should timeout async format validation', async () => {
      const validator = new ZSchema({ asyncTimeout: 10 }); // 10ms timeout

      const slowValidator = async (): Promise<boolean> => {
        await new Promise((resolve) => setTimeout(resolve, 50)); // 50ms delay
        return true;
      };

      validator.registerFormat('slow-async', slowValidator);

      const schema = {
        type: 'string',
        format: 'slow-async',
      };

      const result = await new Promise<{ err: SchemaErrorDetail[] | null; valid: boolean }>((resolve) => {
        validator.validate('test', schema, (err, valid) => {
          resolve({ err: err as SchemaErrorDetail[] | null, valid });
        });
      });

      expect(result.valid).toBe(false);
      expect(result.err).toHaveLength(1);
      expect(result.err![0].code).toBe('ASYNC_TIMEOUT');
    });
  });
});
