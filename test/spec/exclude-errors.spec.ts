import ZSchema from '../../src/index.ts';

describe('JSON Validation excludeErrors integration', function () {
  it('should exclude multiple error codes correctly', function () {
    const validator = ZSchema.create({ version: 'draft-04' });
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 3 },
        age: { type: 'number', minimum: 0 },
        email: { type: 'string', format: 'email' },
      },
      required: ['name', 'age'],
    };
    const invalidData = {
      name: 'A', // INVALID_TYPE? wait, 'A' is string, but minLength 3: STRING_LENGTH_SHORT
      age: -5, // NUMBER_MINIMUM
      // missing email, but not required
    };

    // Without excludeErrors
    const resultWithout = validator.validateSafe(invalidData, schema);
    expect(resultWithout.valid).toBe(false);
    const errorsWithout = resultWithout.err!.details;
    expect(errorsWithout!.length).toBe(2);
    const codesWithout = errorsWithout!.map((e) => e.code);
    expect(codesWithout).toContain('MIN_LENGTH');
    expect(codesWithout).toContain('MINIMUM');

    // With excludeErrors excluding both
    const resultWith = validator.validateSafe(invalidData, schema, { excludeErrors: ['MIN_LENGTH', 'MINIMUM'] });
    expect(resultWith.valid).toBe(true); // No errors left
    const errorsWith = resultWith.err?.details || null;
    expect(errorsWith).toBe(null);
  });
});
