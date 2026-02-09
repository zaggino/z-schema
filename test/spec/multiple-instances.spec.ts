import { ValidateError } from '../../src/errors.ts';
import { ZSchema } from '../../src/z-schema.ts';

describe('Using multiple instances of Z-Schema', function () {
  it('Should pass all tests', function () {
    const schema = {
      $schema: 'http://json-schema.org/draft-04/schema#',
      type: 'object',
      properties: {
        options: {
          enum: ['a', 'b', 'c'],
        },
      },
    };

    let v: ZSchema;
    v = ZSchema.create({ strictMode: true });
    // Should fail because "additionalProperties" is missing
    expect(() => v.validateSchema(schema)).toThrow(ValidateError);

    v = ZSchema.create();
    expect(v.validateSchema(schema)).toBe(true);

    v = ZSchema.create({ strictMode: true });
    expect(() => v.validateSchema(schema)).toThrow(ValidateError);
  });
});
