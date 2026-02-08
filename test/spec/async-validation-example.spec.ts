import { describe, it, expect } from 'vitest';
import ZSchema from '../../src/index.ts';

describe('Async Validation Example', () => {
  // Mock functions for testing
  const mockDatabaseCheck = async (userId: string): Promise<boolean> => {
    const validUsers = ['user123', 'user456'];
    return validUsers.includes(userId);
  };

  const mockPostcodeCheck = async (postcode: string): Promise<boolean> => {
    const validPostcodes = ['SW1A 1AA', 'B1 1AA'];
    return validPostcodes.includes(postcode);
  };

  const phoneRegex = /^\+?[1-9]\d{1,14}$/;

  const registerFormats = (validator: {
    registerFormat: (name: string, validatorFunction: (input: unknown) => boolean | Promise<boolean>) => void;
  }) => {
    validator.registerFormat('user-exists', async (input: unknown): Promise<boolean> => {
      if (typeof input !== 'string') return false;
      return await mockDatabaseCheck(input);
    });

    validator.registerFormat('valid-postcode', async (input: unknown): Promise<boolean> => {
      if (typeof input !== 'string') return false;
      return await mockPostcodeCheck(input);
    });

    validator.registerFormat('phone-number', (input: unknown): boolean => {
      if (typeof input !== 'string') return false;
      return phoneRegex.test(input);
    });
  };

  const createValidator = () => {
    const validator = ZSchema.create();
    registerFormats(validator);
    return validator;
  };

  const createAsyncValidator = () => {
    const validator = ZSchema.create({ async: true });
    registerFormats(validator);
    return validator;
  };

  const createAsyncSafeValidator = () => {
    const validator = ZSchema.create({ async: true, safe: true });
    registerFormats(validator);
    return validator;
  };

  const personSchema = {
    type: 'object',
    required: ['personId', 'address'],
    properties: {
      personId: {
        type: 'string',
        format: 'user-exists',
      },
      address: {
        type: 'object',
        required: ['postcode', 'phone'],
        properties: {
          postcode: {
            type: 'string',
            format: 'valid-postcode',
          },
          phone: {
            type: 'string',
            format: 'phone-number',
          },
        },
      },
    },
  };

  describe('Async User ID Validation', () => {
    it('should validate successfully with valid user ID', async () => {
      const validator = createValidator();

      const validPayload = {
        personId: 'user123',
        address: {
          postcode: 'SW1A 1AA',
          phone: '+441234567890',
        },
      };

      const result = await validator.validateAsyncSafe(validPayload, personSchema);

      expect(result.valid).toBe(true);
      expect(result.err).toBeUndefined();
    });

    it('should fail validation with invalid user ID', async () => {
      const validator = createValidator();

      const invalidPayload = {
        personId: 'invalid-user',
        address: {
          postcode: 'SW1A 1AA',
          phone: '+441234567890',
        },
      };

      const result = await validator.validateAsyncSafe(invalidPayload, personSchema);

      expect(result.valid).toBe(false);
      expect(result.err).toBeDefined();
      expect(result.err!.details?.[0].path).toBe('#/personId');
    });
  });

  describe('Async Postcode Validation', () => {
    it('should validate successfully with valid postcode', async () => {
      const validator = createValidator();

      const validPayload = {
        personId: 'user123',
        address: {
          postcode: 'SW1A 1AA',
          phone: '+441234567890',
        },
      };

      const result = await validator.validateAsyncSafe(validPayload, personSchema);

      expect(result.valid).toBe(true);
      expect(result.err).toBeUndefined();
    });

    it('should fail validation with invalid postcode', async () => {
      const validator = createValidator();

      const invalidPayload = {
        personId: 'user123',
        address: {
          postcode: 'INVALID',
          phone: '+441234567890',
        },
      };

      const result = await validator.validateAsyncSafe(invalidPayload, personSchema);

      expect(result.valid).toBe(false);
      expect(result.err).toBeDefined();
      expect(result.err!.details?.[0].path).toBe('#/address/postcode');
    });
  });

  describe('Sync Phone Number Validation', () => {
    it('should validate successfully with valid phone number', async () => {
      const validator = createValidator();

      const validPayload = {
        personId: 'user123',
        address: {
          postcode: 'SW1A 1AA',
          phone: '+441234567890',
        },
      };

      const result = await validator.validateAsyncSafe(validPayload, personSchema);

      expect(result.valid).toBe(true);
      expect(result.err).toBeUndefined();
    });

    it('should fail validation with invalid phone number', async () => {
      const validator = createValidator();

      const invalidPayload = {
        personId: 'user123',
        address: {
          postcode: 'SW1A 1AA',
          phone: 'invalid-phone',
        },
      };

      const result = await validator.validateAsyncSafe(invalidPayload, personSchema);

      expect(result.valid).toBe(false);
      expect(result.err).toBeDefined();
      expect(result.err!.details?.[0].path).toBe('#/address/phone');
    });
  });

  describe('Complete Payload Validation', () => {
    it('should validate successfully with all valid fields', async () => {
      const validator = createValidator();

      const validPayload = {
        personId: 'user123',
        address: {
          postcode: 'SW1A 1AA',
          phone: '+441234567890',
        },
      };

      const result = await validator.validateAsyncSafe(validPayload, personSchema);

      expect(result.valid).toBe(true);
      expect(result.err).toBeUndefined();
    });

    it('should fail validation with multiple invalid fields', async () => {
      const validator = createValidator();

      const invalidPayload = {
        personId: 'invalid-user',
        address: {
          postcode: 'INVALID',
          phone: 'invalid-phone',
        },
      };

      const result = await validator.validateAsyncSafe(invalidPayload, personSchema);

      expect(result.valid).toBe(false);
      expect(result.err).toBeDefined();
      expect(result.err!.details?.length).toBeGreaterThan(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle database unavailability simulation', async () => {
      // For this test, we can mock a failing database check
      const validator = ZSchema.create();

      validator.registerFormat('user-exists', async (): Promise<boolean> => {
        throw new Error('Database unavailable');
      });

      validator.registerFormat('valid-postcode', async (input: unknown): Promise<boolean> => {
        if (typeof input !== 'string') return false;
        return await mockPostcodeCheck(input);
      });

      validator.registerFormat('phone-number', (input: unknown): boolean => {
        if (typeof input !== 'string') return false;
        return phoneRegex.test(input);
      });

      const payload = {
        personId: 'user123',
        address: {
          postcode: 'SW1A 1AA',
          phone: '+441234567890',
        },
      };

      const result = await validator.validateAsyncSafe(payload, personSchema);

      expect(result.valid).toBe(false);
      expect(result.err).toBeDefined();
    });

    it('should handle malformed payload', async () => {
      const validator = createValidator();

      const malformedPayload = {
        personId: 123, // should be string
        address: 'not-an-object',
      };

      const result = await validator.validateAsyncSafe(malformedPayload, personSchema);

      expect(result.valid).toBe(false);
      expect(result.err).toBeDefined();
    });

    it('should handle phone number variations', async () => {
      const validator = createValidator();

      const testCases = [
        { phone: '+441234567890', expected: true },
        { phone: '441234567890', expected: true },
        { phone: '+1234567890', expected: true },
        { phone: '123', expected: true },
        { phone: '+', expected: false },
        { phone: 'abc', expected: false },
        { phone: '', expected: false },
      ];

      for (const testCase of testCases) {
        const payload = {
          personId: 'user123',
          address: {
            postcode: 'SW1A 1AA',
            phone: testCase.phone,
          },
        };

        const result = await validator.validateAsyncSafe(payload, personSchema);

        expect(result.valid).toBe(testCase.expected);
      }
    });
  });

  describe('validate method (async validator)', () => {
    it('should validate successfully with valid payload using Promise API', async () => {
      const validator = createAsyncValidator();

      const validPayload = {
        personId: 'user123',
        address: {
          postcode: 'SW1A 1AA',
          phone: '+441234567890',
        },
      };

      const result = await validator.validate(validPayload, personSchema);

      expect(result).toBe(true);
    });

    it('should fail validation with invalid payload using Promise API', async () => {
      const validator = createAsyncValidator();

      const invalidPayload = {
        personId: 'invalid-user',
        address: {
          postcode: 'SW1A 1AA',
          phone: '+441234567890',
        },
      };

      await expect(validator.validate(invalidPayload, personSchema)).rejects.toThrow();
    });

    it('should handle async validation with Promise API', async () => {
      const validator = createAsyncValidator();

      const payload = {
        personId: 'user123',
        address: {
          postcode: 'SW1A 1AA',
          phone: '+441234567890',
        },
      };

      const result = await validator.validate(payload, personSchema);

      expect(result).toBe(true);
    });
  });

  describe('validate method (async-safe validator)', () => {
    it('should validate successfully with valid payload using Promise API', async () => {
      const validator = createAsyncSafeValidator();

      const validPayload = {
        personId: 'user123',
        address: {
          postcode: 'SW1A 1AA',
          phone: '+441234567890',
        },
      };

      const result = await validator.validate(validPayload, personSchema);

      expect(result.valid).toBe(true);
      expect(result.err).toBeUndefined();
    });

    it('should fail validation with invalid payload using Promise API', async () => {
      const validator = createAsyncSafeValidator();

      const invalidPayload = {
        personId: 'invalid-user',
        address: {
          postcode: 'SW1A 1AA',
          phone: '+441234567890',
        },
      };

      const result = await validator.validate(invalidPayload, personSchema);

      expect(result.valid).toBe(false);
      // Note: For async validation, errs may be empty
    });
  });
});
