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

  const createValidator = () => {
    const validator = new ZSchema();

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

      const result = await new Promise<{ err: any; valid: boolean }>((resolve) => {
        validator.validate(validPayload, personSchema, (err, valid) => {
          resolve({ err, valid });
        });
      });

      expect(result.valid).toBe(true);
      expect(result.err).toBe(null);
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

      const result = await new Promise<{ err: any; valid: boolean }>((resolve) => {
        validator.validate(invalidPayload, personSchema, (err, valid) => {
          resolve({ err, valid });
        });
      });

      expect(result.valid).toBe(false);
      expect(result.err).toBeDefined();
      expect(result.err[0].path).toBe('#/personId');
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

      const result = await new Promise<{ err: any; valid: boolean }>((resolve) => {
        validator.validate(validPayload, personSchema, (err, valid) => {
          resolve({ err, valid });
        });
      });

      expect(result.valid).toBe(true);
      expect(result.err).toBe(null);
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

      const result = await new Promise<{ err: any; valid: boolean }>((resolve) => {
        validator.validate(invalidPayload, personSchema, (err, valid) => {
          resolve({ err, valid });
        });
      });

      expect(result.valid).toBe(false);
      expect(result.err).toBeDefined();
      expect(result.err[0].path).toBe('#/address/postcode');
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

      const result = await new Promise<{ err: any; valid: boolean }>((resolve) => {
        validator.validate(validPayload, personSchema, (err, valid) => {
          resolve({ err, valid });
        });
      });

      expect(result.valid).toBe(true);
      expect(result.err).toBe(null);
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

      const result = await new Promise<{ err: any; valid: boolean }>((resolve) => {
        validator.validate(invalidPayload, personSchema, (err, valid) => {
          resolve({ err, valid });
        });
      });

      expect(result.valid).toBe(false);
      expect(result.err).toBeDefined();
      expect(result.err[0].path).toBe('#/address/phone');
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

      const result = await new Promise<{ err: any; valid: boolean }>((resolve) => {
        validator.validate(validPayload, personSchema, (err, valid) => {
          resolve({ err, valid });
        });
      });

      expect(result.valid).toBe(true);
      expect(result.err).toBe(null);
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

      const result = await new Promise<{ err: any; valid: boolean }>((resolve) => {
        validator.validate(invalidPayload, personSchema, (err, valid) => {
          resolve({ err, valid });
        });
      });

      expect(result.valid).toBe(false);
      expect(result.err).toBeDefined();
      expect(result.err.length).toBeGreaterThan(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle database unavailability simulation', async () => {
      // For this test, we can mock a failing database check
      const validator = new ZSchema();

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

      const result = await new Promise<{ err: any; valid: boolean }>((resolve) => {
        validator.validate(payload, personSchema, (err, valid) => {
          resolve({ err, valid });
        });
      });

      expect(result.valid).toBe(false);
      expect(result.err).toBeDefined();
    });

    it('should handle malformed payload', async () => {
      const validator = createValidator();

      const malformedPayload = {
        personId: 123, // should be string
        address: 'not-an-object',
      };

      const result = await new Promise<{ err: any; valid: boolean }>((resolve) => {
        validator.validate(malformedPayload, personSchema, (err, valid) => {
          resolve({ err, valid });
        });
      });

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

        const result = await new Promise<{ err: any; valid: boolean }>((resolve) => {
          validator.validate(payload, personSchema, (err, valid) => {
            resolve({ err, valid });
          });
        });

        expect(result.valid).toBe(testCase.expected);
      }
    });
  });

  describe('validateAsync method', () => {
    it('should validate successfully with valid payload using Promise API', async () => {
      const validator = createValidator();

      const validPayload = {
        personId: 'user123',
        address: {
          postcode: 'SW1A 1AA',
          phone: '+441234567890',
        },
      };

      const result = await validator.validateAsync(validPayload, personSchema);

      expect(result).toBe(true);
      const errors = validator.getLastErrors();
      expect(errors).toBeNull();
    });

    it('should fail validation with invalid payload using Promise API', async () => {
      const validator = createValidator();

      const invalidPayload = {
        personId: 'invalid-user',
        address: {
          postcode: 'SW1A 1AA',
          phone: '+441234567890',
        },
      };

      await expect(validator.validateAsync(invalidPayload, personSchema)).rejects.toThrow();
    });

    it('should handle async validation with Promise API', async () => {
      const validator = createValidator();

      const payload = {
        personId: 'user123',
        address: {
          postcode: 'SW1A 1AA',
          phone: '+441234567890',
        },
      };

      const result = await validator.validateAsync(payload, personSchema);

      expect(result).toBe(true);
      const errors = validator.getLastErrors();
      expect(errors).toBeNull();
    });
  });

  describe('validateAsyncSafe method', () => {
    it('should validate successfully with valid payload using Promise API', async () => {
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
      expect(result.errs).toBeUndefined();
    });

    it('should fail validation with invalid payload using Promise API', async () => {
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
      // Note: For async validation, errs may be empty
    });
  });
});
