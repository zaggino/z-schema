export default {
  description: 'registerFormat - Custom formats support',
  version: 'draft-04',
  setup(validator: any, Class: any) {
    Class.registerFormat('xstring', function (str: any) {
      return str === 'xxx';
    });
    Class.registerFormat('emptystring', function (str: any) {
      return typeof str === 'string' && str.length === 0 && str === '';
    });
    Class.registerFormat('fillHello', function (obj: any) {
      obj.hello = 'world';
      return true;
    });
  },
  schema: {
    type: 'string',
    format: 'xstring',
  },
  tests: [
    {
      description: 'should pass custom format validation',
      data: 'xxx',
      valid: true,
    },
    {
      description: 'should fail custom format validation',
      data: 'xxxx',
      valid: false,
    },
    {
      description: 'should fail when using unknown format',
      data: 'xxx',
      schema: {
        type: 'string',
        format: 'xstring2',
      },
      valid: false,
    },
    {
      description: 'should pass validating empty string',
      data: '',
      schema: {
        type: 'string',
        format: 'emptystring',
      },
      valid: true,
    },
    {
      description: 'should be able to modify object using format',
      data: {},
      schema: {
        type: 'object',
        format: 'fillHello',
      },
      valid: true,
      after(_err: any, valid: any, obj: any) {
        expect(obj.hello).toBe('world');
      },
    },
  ],
};
