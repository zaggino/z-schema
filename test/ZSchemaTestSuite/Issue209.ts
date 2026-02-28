const testAsync = true;

export default {
  description: 'Issue #209 - async validator returns wrong path',
  async: true,
  options: {
    asyncTimeout: 2000,
  },
  setup: function (validator: any, Class: any) {
    if (testAsync) {
      // asynchronous validator
      Class.registerFormat('string-length', function (str: any, callback: any) {
        setTimeout(function () {
          callback(str.length > 10);
        }, 1);
      });
    } else {
      // same as above but synchronous (comment out the validator above and try with this instead)
      Class.registerFormat('string-length', function (str: any) {
        return str.length > 10;
      });
    }
  },
  schema: {
    description: 'Some schema',
    type: 'object',
    properties: {
      userId: {
        type: 'string',
        format: 'string-length',
      },
    },
    required: ['userId'],
  },
  tests: [
    {
      description: 'Wrong path in custom format async validator',
      data: { userId: '1' },
      valid: false,
      after: function (err: any) {
        expect(err[0].path).toEqual('#/userId');
      },
    },
  ],
};
