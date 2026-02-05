// Test for https://github.com/zaggino/z-schema/issues/224
// Not getting all schema errors from optional parent object

import ZSchema from '../../src/index.ts';

describe('Issue #224: Not getting all schema errors from optional parent object', function () {
  it('should report all errors for optional object with oneOf including null', function () {
    const options = { breakOnFirstError: false };
    const validator = new ZSchema(options);
    const schema = {
      $schema: 'http://json-schema.org/draft-04/schema#',
      id: 'OptionalFatherOptionalSon',
      type: 'object',
      description: '',
      properties: {
        optionalFatherObject: {
          oneOf: [
            {
              description: '',
              $ref: '#/definitions/OptionalFatherObject',
            },
            {
              type: 'null',
            },
          ],
        },
        anotherField: {
          description: '',
          type: 'number',
        },
      },
      required: ['anotherField'],
      additionalProperties: false,
      definitions: {
        OptionalFatherObject: {
          id: 'OptionalFatherObject',
          type: 'object',
          description: '',
          properties: {
            name: {
              description: '',
              default: 'John',
              maxLength: 45,
              type: 'string',
            },
            name2: {
              description: '',
              default: 'John',
              maxLength: 45,
              type: 'string',
            },
            birthUnixTime: {
              description: '',
              default: 1415273168,
              type: 'number',
            },
          },
          required: ['name', 'name2'],
          additionalProperties: false,
        },
      },
    };
    const data = { anotherField: 10, optionalFatherObject: { birthUnixTime: 'not_unix_date', name: 5 } };
    const valid = validator.validate(data, schema);
    const error = validator.getLastError();
    expect(valid).toBe(false);
    expect(error).not.toBeNull();
    expect(error!.details).toBeDefined();
    expect(error!.details!.length).toBe(1);
    expect(error!.details![0].code).toBe('ONE_OF_MISSING');
    expect(error!.details![0].inner).toBeDefined();
    expect(error!.details![0].inner!.length).toBe(4);
    expect(error!.details![0].inner![0].path).toBe('#/optionalFatherObject/birthUnixTime');
    expect(error!.details![0].inner![0].message).toBe('Expected type number but found type string');
    expect(error!.details![0].inner![1].path).toBe('#/optionalFatherObject/name');
    expect(error!.details![0].inner![1].message).toBe('Expected type string but found type integer');
    expect(error!.details![0].inner![2].message).toBe('Missing required property: name2');
    expect(error!.details![0].inner![3].message).toBe('Expected type null but found type object');
  });

  it('should report all errors for optional object without oneOf', function () {
    const options = { breakOnFirstError: false };
    const validator = new ZSchema(options);
    const schema = {
      $schema: 'http://json-schema.org/draft-04/schema#',
      id: 'OptionalFatherOptionalSon',
      type: 'object',
      description: '',
      properties: {
        optionalFatherObject: {
          description: '',
          $ref: '#/definitions/OptionalFatherObject',
        },
        anotherField: {
          description: '',
          type: 'number',
        },
      },
      required: ['anotherField'],
      additionalProperties: false,
      definitions: {
        OptionalFatherObject: {
          id: 'OptionalFatherObject',
          type: 'object',
          description: '',
          properties: {
            name: {
              description: '',
              default: 'John',
              maxLength: 45,
              type: 'string',
            },
            name2: {
              description: '',
              default: 'John',
              maxLength: 45,
              type: 'string',
            },
            birthUnixTime: {
              description: '',
              default: 1415273168,
              type: 'number',
            },
          },
          required: ['name', 'name2'],
          additionalProperties: false,
        },
      },
    };
    const data = { anotherField: 10, optionalFatherObject: { birthUnixTime: 'not_unix_date', name: 5 } };
    const valid = validator.validate(data, schema);
    const error = validator.getLastError();
    expect(valid).toBe(false);
    expect(error).not.toBeNull();
    expect(error!.details).toBeDefined();
    expect(error!.details!.length).toBe(3);
    expect(error!.details![0].code).toBe('OBJECT_MISSING_REQUIRED_PROPERTY');
    expect(error!.details![0].params![0]).toBe('name2');
    expect(error!.details![1].code).toBe('INVALID_TYPE');
    expect(error!.details![1].path).toBe('#/optionalFatherObject/name');
    expect(error!.details![2].code).toBe('INVALID_TYPE');
    expect(error!.details![2].path).toBe('#/optionalFatherObject/birthUnixTime');
  });
});
