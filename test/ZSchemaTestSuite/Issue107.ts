export default {
  description: 'Issue #107 - add Support for Controlling Remote Schema Reading',
  setup(validator: any, ZSchema: any) {
    ZSchema.setSchemaReader((_uri: any) => ({
      type: 'string',
    }));
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
