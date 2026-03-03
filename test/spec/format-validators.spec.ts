import { describe, expect, it } from 'vitest';

import { ZSchema } from '../../src/z-schema.ts';

describe('Format Validators', () => {
  describe('Async Format Validator Registration', () => {
    it('should register an async format validator', () => {
      const validator = ZSchema.create();

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
      const validator = ZSchema.create();

      const schema = {
        type: 'string',
        format: 'email',
      };

      const result = validator.validate('test@example.com', schema);
      expect(result).toBe(true);
    });

    it('should fail validation with built-in sync format validators', () => {
      const validator = ZSchema.create();

      const schema = {
        type: 'string',
        format: 'email',
      };

      const result = validator.validateSafe('invalid-email', schema);
      expect(result.valid).toBe(false);
    });

    it('should skip format assertion when formatAssertions is false', () => {
      const validator = ZSchema.create({ formatAssertions: false });

      const schema = {
        type: 'string',
        format: 'email',
      };

      const result = validator.validateSafe('invalid-email', schema);
      expect(result.valid).toBe(true);
    });

    it('should ignore unknown format by default for draft2020-12', () => {
      const validator = ZSchema.create({ version: 'draft2020-12' });

      const schema = {
        format: 'definitely-unknown-format',
      };

      const result = validator.validateSafe('value', schema);
      expect(result.valid).toBe(true);
    });
  });

  describe('Async Timeout Handling', () => {
    it('should timeout async format validation', async () => {
      const validator = ZSchema.create({ async: true, safe: true, asyncTimeout: 10 }); // 10ms timeout

      const slowValidator = async (): Promise<boolean> => {
        await new Promise((resolve) => setTimeout(resolve, 50)); // 50ms delay
        return true;
      };

      validator.registerFormat('slow-async', slowValidator);

      const schema = {
        type: 'string',
        format: 'slow-async',
      };

      const result = await validator.validate('test', schema);
      expect(result.valid).toBe(false);
      expect(result.err!.details).toHaveLength(1);
      expect(result.err!.details![0].code).toBe('ASYNC_TIMEOUT');
    });
  });
  describe('Format Registration and Unregistration', () => {
    it('should unregister a format validator', () => {
      const validator = ZSchema.create();

      validator.registerFormat('test-format', (input) => typeof input === 'string');

      let registered = validator.getRegisteredFormats();
      expect(registered).toContain('test-format');

      validator.unregisterFormat('test-format');

      registered = validator.getRegisteredFormats();
      expect(registered).not.toContain('test-format');
    });

    it('should unregister a inbuilt format validator', () => {
      const validator = ZSchema.create();
      const before = validator.getSupportedFormats();
      expect(before).toContain('ipv4');
      expect(before).toContain('ipv6');
      validator.unregisterFormat('ipv4');
      validator.unregisterFormat('ipv6');
      const after = validator.getSupportedFormats();
      expect(after).not.toContain('ipv4');
      expect(after).not.toContain('ipv6');
    });

    it('should get supported formats', () => {
      const validator = ZSchema.create();

      const supported = validator.getSupportedFormats();
      expect(supported).toContain('email');
      expect(supported).toContain('uri');
      expect(Array.isArray(supported)).toBe(true);
    });

    it('should get default options', () => {
      const options = ZSchema.getDefaultOptions();
      expect(options).toBeDefined();
      expect(options.asyncTimeout).toBe(2000);
    });

    it('should clamp asyncTimeout to MAX_ASYNC_TIMEOUT (60 000 ms)', () => {
      const validator = ZSchema.create({ asyncTimeout: 999_999_999 });
      expect(validator.options.asyncTimeout).toBe(60_000);
    });

    it('should clamp negative asyncTimeout to 0', () => {
      const validator = ZSchema.create({ asyncTimeout: -500 });
      expect(validator.options.asyncTimeout).toBe(0);
    });

    it('should keep asyncTimeout when within allowed range', () => {
      const validator = ZSchema.create({ asyncTimeout: 5000 });
      expect(validator.options.asyncTimeout).toBe(5000);
    });
  });
});
