export default {
  description: 'registerFormat - Custom formats async support',
  async: true,
  options: {
    asyncTimeout: 500,
  },
  setup: function (validator: any, Class: any) {
    Class.registerFormat('xstring', function (str: any, callback: any) {
      setTimeout(function () {
        callback(str === 'xxx');
      }, 1);
    });
    Class.registerFormat('shouldTimeout', function (str: any, callback: any) {
      return typeof callback === 'function';
    });
  },
  schema: {
    type: 'string',
    format: 'xstring',
  },
  tests: [
    {
      description: 'should pass custom format async validation',
      data: 'xxx',
      valid: true,
    },
    {
      description: 'should fail custom format async validation',
      data: 'xxxx',
      valid: false,
    },
    {
      description: 'should timeout if callback is not called in default limit',
      data: 'xxx',
      schema: {
        type: 'string',
        format: 'shouldTimeout',
      },
      valid: false,
      after: function (err: any, valid: any) {
        expect(valid).toBe(false);
        expect(err.length).toBe(1);
        expect(err[0].code).toBe('ASYNC_TIMEOUT');
      },
    },
    {
      description: 'should execute callback even if no async format is found',
      data: 'xxx',
      schema: {
        type: 'string',
      },
      valid: true,
    },
  ],
};
