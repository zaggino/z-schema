import { ZSchema } from '../../src/z-schema.ts';
import { ValidateError } from '../../src/errors.ts';
import { SchemaErrorDetail } from '../../src/report.ts';

export default {
  description: 'Issue #58 - getMissingReferences should return all missing references',
  tests: [
    {
      description: 'should fail validation',
      schema: {
        id: 'root.json',
        person: {
          id: 'personDetails',
          type: 'object',
          properties: {
            firstName: {
              type: 'string',
            },
            lastName: {
              type: 'string',
            },
          },
          required: ['firstName', 'lastName'],
        },
        addr: {
          id: 'addressDetails',
          type: 'object',
          properties: {
            street: {
              type: 'string',
            },
            city: {
              type: 'string',
            },
          },
          required: ['street', 'city'],
        },
        peraddr: {
          id: 'personWithAddress',
          allOf: [
            {
              $ref: '#personDetails',
            },
            {
              $ref: '#addressDetails',
            },
            {
              $ref: '#/yy',
            },
            {
              $ref: '#xx',
            },
          ],
        },
      },
      validateSchemaOnly: true,
      valid: false,
      after: function (err: Error, valid: boolean, data: unknown, validator: ZSchema) {
        const missingReferences = validator.getMissingReferences(
          new ValidateError('', err as unknown as SchemaErrorDetail[])
        );
        expect(missingReferences.length).toBe(2);
        expect(missingReferences[0]).toBe('root.json#/yy');
        expect(missingReferences[1]).toBe('root.json#xx');
      },
    },
  ],
};
