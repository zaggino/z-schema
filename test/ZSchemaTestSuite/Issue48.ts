export default {
  description: 'Issue #48 - email validation too strict',
  schema: {
    type: 'string',
    format: 'email',
  },
  tests: [
    {
      description: 'should pass validation #1',
      data: 'zaggino@gmail.com',
      valid: true,
    },
    {
      description: 'should pass validation #2',
      data: 'foo@bar.baz',
      valid: true,
    },
    {
      // A single-label domain is a valid address per RFC 5321, and the official
      // JSON-Schema-Test-Suite asserts it ("a single-label domain is valid",
      // optional/format/email.json). This case previously expected `false`, back
      // when the validator ran with validator.js `require_tld: true`.
      description: 'should pass validation #3',
      data: 'foo@bar',
      valid: true,
    },
    {
      description: 'should fail validation #1',
      data: 'foobar.baz',
      valid: false,
    },
    {
      description: 'should fail validation #2',
      data: 'foo@bar..baz',
      valid: false,
    },
  ],
};
