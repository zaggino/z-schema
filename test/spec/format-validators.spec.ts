import { describe, it, expect } from 'vitest';
import ZSchema from '../../src/index.js';

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
      expect(options.version).toBe('draft-04');
      expect(options.asyncTimeout).toBe(2000);
    });
  });
});
