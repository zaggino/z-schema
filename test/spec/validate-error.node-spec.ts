import { runInNewContext } from 'node:vm';

import { toValidateError, ValidateError } from '../../src/errors.ts';

describe('toValidateError (node)', () => {
  it('keeps the plain message of an Error from another realm', () => {
    const foreign: unknown = runInNewContext("new Error('boom')");
    expect(foreign instanceof Error).toBe(false);
    const err = toValidateError(foreign);
    expect(err).toBeInstanceOf(ValidateError);
    expect(err.message).toBe('boom');
    expect(err.cause).toBe(foreign);
  });
});
