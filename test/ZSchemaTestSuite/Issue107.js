export default {
  description: 'Issue #107 - add Support for Controlling Remote Schema Reading',
  setup: function (validator, ZSchema) {
    ZSchema.setSchemaReader(function (_uri) {
      return {
        type: 'string',
      };
    });
  },
  tests: [
    {
      description: 'should pass validation',
      schema: {
        $ref: 'schema-1',
      },
      data: "i'm a string",
      valid: true,
    },
  ],
};
