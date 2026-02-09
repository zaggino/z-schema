import { ZSchema } from '../../src/z-schema.ts';

describe('Option breakOnFirstError tests', () => {
  it('Should break on first error when breakOnFirstError is true', function () {
    const validator = ZSchema.create({ breakOnFirstError: true });
    const schema = { type: 'number', maximum: 5, minimum: 15 };
    const invalidData = 10; // violates maximum, would violate minimum too

    const result = validator.validateSafe(invalidData, schema);
    expect(result.valid).toBe(false);
    expect(result.err!.details!.length).toBe(1); // Only maximum error
  });

  it('Should not break on first error when breakOnFirstError is false', function () {
    const validator = ZSchema.create({ breakOnFirstError: false });
    const schema = { type: 'number', maximum: 5, minimum: 15 };
    const invalidData = 10;

    const result = validator.validateSafe(invalidData, schema);
    expect(result.valid).toBe(false);
    expect(result.err!.details!.length).toBe(2); // Both maximum and minimum errors
  });
});
