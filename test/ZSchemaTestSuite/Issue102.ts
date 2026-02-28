export default {
  description: 'Issue #102 - circular references',
  tests: [
    {
      description: 'should pass without an error',
      schema: {},
      data: {},
      valid: true,
      after: function (err: any, valid: any, data: any, validator: any) {
        validator.getResolvedSchema('http://json-schema.org/draft-04/schema#');
      },
    },
  ],
};
