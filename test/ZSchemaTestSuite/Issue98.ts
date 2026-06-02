export default {
  description: 'Issue #98 - oneOf',
  tests: [
    {
      description: 'should return only one error for each branch',
      schema: {
        type: 'object',
        oneOf: [
          {
            type: 'object',
            required: ['a', 'b'],
          },
          {
            type: 'object',
            required: ['c', 'd'],
          },
        ],
      },
      data: {},
      valid: false,
      after(err: any, _valid: any, _data: any, _validator: any) {
        expect(err.length).toBe(1);
        expect(err[0].code).toBe('ONE_OF_MISSING');
        expect(err[0].inner.length).toBe(4);
      },
    },
  ],
};
