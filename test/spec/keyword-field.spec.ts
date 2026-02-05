import ZSchema from '../../src/index.ts';

describe('Error objects include `keyword` field', function () {
  it('JSON validation errors include the keyword that caused the error', function () {
    const validator = new ZSchema({ version: 'draft-04' });
    const schema = {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string' },
      },
    };

    const data = {}; // missing 'name'
    const valid = validator.validate(data, schema);
    expect(valid).toBe(false);
    const errors = validator.getLastErrors();
    expect(errors).not.toBeNull();
    // find the missing required property error
    const missing = errors!.find((e) => e.code === 'OBJECT_MISSING_REQUIRED_PROPERTY');
    expect(missing).toBeDefined();
    expect(missing!.keyword).toBe('required');
  });

  it('Schema validation errors include the keyword that caused the schema validation error', function () {
    const validator = new ZSchema({ version: 'draft-04' });
    const badSchema = {
      type: 'array',
      maxItems: -1, // invalid value should trigger schema validation error
    } as any;

    const valid = validator.validateSchema(badSchema as any);
    expect(valid).toBe(false);
    const errors = validator.getLastErrors();
    expect(errors).not.toBeNull();
    const schemaErr = errors!.find((e) => e.code === 'KEYWORD_MUST_BE' || e.code === 'KEYWORD_TYPE_EXPECTED');
    expect(schemaErr).toBeDefined();
    // The schema keyword responsible should be 'maxItems'
    expect(schemaErr!.keyword).toBe('maxItems');
  });
});
