import ZSchema from '../../src/index.ts';

describe('Basic', function () {
  it('ZSchema constructor should take one argument - options', function () {
    expect(ZSchema.length).toBe(1);
  });

  it('Work in progress test...', function () {
    const validator = new ZSchema();

    const schema = [
      {
        id: 'schemaA',
        type: 'integer',
      },
      {
        id: 'schemaB',
        type: 'string',
      },
      {
        id: 'mainSchema',
        type: 'object',
        properties: {
          a: { $ref: 'schemaA' },
          b: { $ref: 'schemaB' },
          c: { enum: ['C'] },
        },
      },
    ];

    const data = {
      a: 1,
      b: 'str',
      c: 'C',
    };

    const validSchema = validator.validateSchema(schema);
    expect(validSchema).toBe(true);

    if (!validSchema) {
      console.log(validator.getLastErrors());
      return;
    }

    const valid = validator.validate(data, schema[2]);
    expect(valid).toBe(true);

    if (!valid) {
      console.log(validator.getLastErrors());
      return;
    }
  });
});
