// Test for https://github.com/zaggino/z-schema/issues/224
// Not getting all schema errors from optional parent object

import { ZSchema } from '../../src/z-schema.ts';

describe('Issue #224: Not getting all schema errors from optional parent object', function () {
  it('should report all errors for optional object with oneOf including null', function () {
    const options = { breakOnFirstError: false };
    const validator = ZSchema.create(options);
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
              default: 1_415_273_168,
              type: 'number',
            },
          },
          required: ['name', 'name2'],
          additionalProperties: false,
        },
      },
    };
    const data = { anotherField: 10, optionalFatherObject: { birthUnixTime: 'not_unix_date', name: 5 } };
    const result = validator.validateSafe(data, schema);
    const error = result.err;
    expect(result.valid).toBe(false);
    expect(error).not.toBeNull();
    expect(error!.details).toBeDefined();
    expect(error!.details!.length).toBe(1);
    expect(error!.details![0].code).toBe('ONE_OF_MISSING');
    expect(error!.details![0].inner).toBeDefined();
    const inner = error!.details![0].inner!;
    expect(inner.length).toBe(4);
    // Error order is not guaranteed — assert presence regardless of position
    const innerMessages = inner.map((e) => e.message);
    const innerPaths = inner.map((e) => e.path);
    expect(innerMessages).toContain('Expected type number but found type string');
    expect(innerMessages).toContain('Expected type string but found type integer');
    expect(innerMessages).toContain('Missing required property: name2');
    expect(innerMessages).toContain('Expected type null but found type object');
    expect(innerPaths).toContain('#/optionalFatherObject/birthUnixTime');
    expect(innerPaths).toContain('#/optionalFatherObject/name');
  });

  it('should report all errors for optional object without oneOf', function () {
    const options = { breakOnFirstError: false };
    const validator = ZSchema.create(options);
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
              default: 1_415_273_168,
              type: 'number',
            },
          },
          required: ['name', 'name2'],
          additionalProperties: false,
        },
      },
    };
    const data = { anotherField: 10, optionalFatherObject: { birthUnixTime: 'not_unix_date', name: 5 } };
    const result = validator.validateSafe(data, schema);
    const error = result.err;
    expect(result.valid).toBe(false);
    expect(error).not.toBeNull();
    expect(error!.details).toBeDefined();
    const details = error!.details!;
    expect(details.length).toBe(3);
    // Error order is not guaranteed — assert presence regardless of position
    const codes = details.map((e) => e.code);
    const paths = details.map((e) => e.path);
    expect(codes).toContain('OBJECT_MISSING_REQUIRED_PROPERTY');
    expect(codes.filter((c) => c === 'INVALID_TYPE').length).toBe(2);
    expect(paths).toContain('#/optionalFatherObject/name');
    expect(paths).toContain('#/optionalFatherObject/birthUnixTime');
    const missingProp = details.find((e) => e.code === 'OBJECT_MISSING_REQUIRED_PROPERTY');
    expect(missingProp!.params![0]).toBe('name2');
  });
});
