import { ValidateError } from '../../src/errors.ts';

const REF_NAME = 'int.json';

export default {
  description: 'Issue #126 - do not add UNRESOLVABLE_REFERENCE error when set through setRemoteReference',
  tests: [
    {
      description: 'should fail compilation with unresolvable reference',
      setup: function (validator: any) {
        validator.setRemoteReference(REF_NAME, {
          $schema: 'http://json-schema.org/draft-04/schema#',
          id: REF_NAME,
          type: 'object',
          required: ['number'],
          properties: {
            number: {
              $ref: 'data-types.json#/definitions/number',
            },
          },
        });
      },
      schema: {
        $schema: 'http://json-schema.org/draft-04/schema#',
        id: 'ints.json',
        type: 'array',
        items: {
          $ref: REF_NAME,
        },
      },
      validateSchemaOnly: true,
      valid: false,
      after: function (err: any, valid: any, data: any, validator: any) {
        err.forEach(function (e: any) {
          if (e.params.indexOf(REF_NAME) !== -1) {
            expect(e.code).not.toBe('UNRESOLVABLE_REFERENCE');
          }
        });
        expect(validator.getMissingRemoteReferences(new ValidateError('', err)).length).toBe(1);
      },
    },
  ],
};
