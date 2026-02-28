const draft4 = import('./files/Issue47/draft4.json');
const modifiedSchema = import('./files/Issue47/swagger_draft_modified.json');
const realSchema = import('./files/Issue47/swagger_draft.json');
const json = import('./files/Issue47/sample.json');

export default {
  description: 'Issue #47 - references to draft4 subschema are not working',
  setup: function (validator: any) {
    validator.setRemoteReference('http://json-schema.orgx/draft-04/schema', draft4);
  },
  tests: [
    {
      description: 'should pass validation #1',
      schema: modifiedSchema,
      data: json,
      valid: true,
    },
    {
      description: 'should pass validation #1',
      schema: realSchema,
      data: json,
      valid: true,
    },
  ],
};
