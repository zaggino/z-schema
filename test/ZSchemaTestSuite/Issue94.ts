import isequal from 'lodash.isequal';

const schema1 = {
  id: 'long-string',
  type: 'string',
  maxLength: 4096,
};
const schema2 = {
  id: 'person-object',
  type: 'object',
  properties: {
    name: {
      $ref: 'long-string',
    },
  },
};
const expectedResult = {
  id: 'person-object',
  type: 'object',
  properties: {
    name: {
      id: 'long-string',
      type: 'string',
      maxLength: 4096,
    },
  },
};
export default {
  version: 'none',
  description: 'Issue #94 - get a resolved schema for documentation purposes',
  tests: [
    {
      description: 'should pass validation',
      schema: [schema1, schema2],
      validateSchemaOnly: true,
      valid: true,
      after: function (err: any, valid: any, data: any, validator: any) {
        const newSch = validator.getResolvedSchema('person-object');
        expect(isequal(newSch, expectedResult)).toBe(true);
      },
    },
  ],
};
