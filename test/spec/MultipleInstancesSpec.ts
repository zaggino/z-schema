import ZSchema from '../../src/index.ts';

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

    let v;
    v = new ZSchema({ strictMode: true });
    // Should fail because "additionalProperties" is missing
    expect(v.validateSchema(schema)).toBe(false);

    v = new ZSchema();
    expect(v.validateSchema(schema)).toBe(true);

    v = new ZSchema({ strictMode: true });
    expect(v.validateSchema(schema)).toBe(false);
  });
});
