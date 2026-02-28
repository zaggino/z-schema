// var REF_NAME = 'int.json';

export default {
  description: 'Issue #125 - Why process format if type validation fails',
  setup: function (validator: any, Class: any) {
    Class.registerFormat('test', function (item: any) {
      return typeof item === 'string';
    });
  },
  tests: [
    {
      description: 'should fail with one error',
      schema: {
        type: 'object',
        properties: {
          callbacks: {
            type: 'array',
            items: {
              type: 'string',
              format: 'test',
            },
          },
        },
      },
      data: {
        callbacks: [true],
      },
      valid: false,
      after: function (err: any, _valid: any, _data: any, _validator: any) {
        expect(err.length).toBe(1);
        expect(err[0].code).toBe('INVALID_TYPE');
      },
    },
  ],
};
