export default {
  description: 'getRegisteredFormats - return an array of format names',
  setup(validator: any, Class: any) {
    Class.registerFormat('phone', (_str: any) => true);
  },

  tests: [
    {
      description: 'should pass validation for new format',
      valid: true,
      data: '01234567',
      schema: {
        type: 'string',
        format: 'phone',
      },
    },
  ],
};
