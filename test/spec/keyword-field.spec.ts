import { ValidateError } from '../../src/errors.ts';
import { ZSchema } from '../../src/z-schema.ts';

describe('Error objects include `keyword` field', function () {
  it('JSON validation errors include the keyword that caused the error', function () {
    const validator = ZSchema.create({ version: 'draft-04' });
    const schema = {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string' },
      },
    };

    const data = {}; // missing 'name'
    const result = validator.validateSafe(data, schema);
    expect(result.valid).toBe(false);
    const errors = result.err!.details;
    expect(errors).not.toBeNull();
    // find the missing required property error
    const missing = errors!.find((e) => e.code === 'OBJECT_MISSING_REQUIRED_PROPERTY');
    expect(missing).toBeDefined();
    expect(missing!.keyword).toBe('required');
  });

  it('Schema validation errors include the keyword that caused the schema validation error', function () {
    const validator = ZSchema.create({ version: 'draft-04' });
    const badSchema = {
      type: 'array',
      maxItems: -1, // invalid value should trigger schema validation error
    } as any;

    try {
      validator.validateSchema(badSchema as any);
      expect.fail('Expected validateSchema to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidateError);
      const validateError = error as ValidateError;
      expect(validateError.details).toBeDefined();
      const schemaErr = validateError.details!.find(
        (e) => e.code === 'KEYWORD_MUST_BE' || e.code === 'KEYWORD_TYPE_EXPECTED'
      );
      expect(schemaErr).toBeDefined();
      // The schema keyword responsible should be 'maxItems'
      expect(schemaErr!.keyword).toBe('maxItems');
    }
  });
});
