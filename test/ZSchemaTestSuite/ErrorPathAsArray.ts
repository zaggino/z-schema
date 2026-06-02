export default {
  version: 'none',
  description: 'reportPathAsArray - Report error paths as an array of path segments',
  options: {
    reportPathAsArray: true,
  },
  tests: [
    {
      description: 'should fail validation and report error paths as an array of path segments',
      schema: {
        type: 'object',
        properties: {
          name: {
            type: 'invalid',
          },
        },
      },
      valid: false,
      validateSchemaOnly: true,
      after(err: any) {
        expect(err[0].path).toEqual(['properties', 'name']);
      },
    },
  ],
};
