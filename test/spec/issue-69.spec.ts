import type { JsonSchema } from '../../src/json-schema-versions.ts';

import { ZSchema } from '../../src/z-schema.js';

describe('Issue #69: Floating point precision in multipleOf validation', () => {
  it('should validate 136.67 as multiple of 0.01', () => {
    const validator = ZSchema.create();

    const schema: JsonSchema = {
      type: 'object',
      properties: {
        decimal: {
          type: 'number',
          multipleOf: 0.01,
        },
      },
    };

    const validData = { decimal: 136.67 };
    const result = validator.validateSafe(validData, schema);
    expect(result.valid).toBe(true);
  });

  it('should not validate 136.675 as multiple of 0.01', () => {
    const validator = ZSchema.create();

    const schema: JsonSchema = {
      type: 'object',
      properties: {
        decimal: {
          type: 'number',
          multipleOf: 0.01,
        },
      },
    };

    const invalidData = { decimal: 136.675 };
    const result = validator.validateSafe(invalidData, schema);
    expect(result.valid).toBe(false);
  });

  it('should handle overflow cases correctly', () => {
    const validator = ZSchema.create();

    const schema: JsonSchema = {
      type: 'integer',
      multipleOf: 0.123456789,
    };

    const data = 1e308;
    const result = validator.validateSafe(data, schema);
    expect(result.valid).toBe(false);
  });
});
