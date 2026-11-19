import type { JsonSchema } from '../../src/json-schema-versions.ts';

import { vi } from 'vitest';

import { ZSchema } from '../../src/z-schema.ts';
import { listenForUnhandledRejections } from '../lib/fast-validator.ts';

// A promise-like object that is not a native Promise.
const thenable = <T>(
  settle: (resolve: (value: T) => void, reject: (reason: unknown) => void) => void
): PromiseLike<T> => ({
  then(onFulfilled, onRejected) {
    return new Promise<T>(settle).then(onFulfilled).catch(onRejected);
  },
});
const resolvesTo = (value: boolean) =>
  thenable<boolean>((resolve) => {
    resolve(value);
  });

const schema: JsonSchema = { type: 'string', format: 'custom' };
const negated: JsonSchema = { not: { type: 'string', format: 'custom' } };

const makeAsync = (fn: (value: unknown) => unknown) => {
  const v = ZSchema.create({ async: true, safe: true, formatAssertions: null });
  v.registerFormat('custom', fn as (value: unknown) => boolean);
  return v;
};
const makeSync = (fn: (value: unknown) => unknown) => {
  const v = ZSchema.create({ safe: true, formatAssertions: null });
  v.registerFormat('custom', fn as (value: unknown) => boolean);
  return v;
};

describe('format validator returning a thenable', () => {
  it('an async validator awaits a thenable that resolves false', async () => {
    const result = await makeAsync(() => resolvesTo(false)).validate('x', schema);
    expect(result.valid).toBe(false);
    expect(result.err?.details?.[0]?.code).toBe('INVALID_FORMAT');
  });

  it('an async validator awaits a thenable that resolves true', async () => {
    const result = await makeAsync(() => resolvesTo(true)).validate('x', schema);
    expect(result.valid).toBe(true);
  });

  it('an async validator treats a thenable that rejects as invalid without an unhandled rejection', async () => {
    const v = makeAsync(() =>
      thenable<boolean>((_resolve, reject) => {
        reject(new Error('nope'));
      })
    );
    const unhandled = vi.fn<(reason: unknown) => void>();
    const unsubscribe = listenForUnhandledRejections(unhandled);
    try {
      const result = await v.validate('x', schema);
      expect(result.valid).toBe(false);
      expect(result.err?.details?.[0]?.code).toBe('INVALID_FORMAT');
      // an unhandled rejection is reported after a macrotask turn, so wait for two
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });
    } finally {
      unsubscribe();
    }
    expect(unhandled).not.toHaveBeenCalled();
  });

  it('a thenable under not that resolves false is valid', async () => {
    const result = await makeAsync(() => resolvesTo(false)).validate('x', negated);
    expect(result.valid).toBe(true);
  });

  it('a thenable under not that resolves true is invalid', async () => {
    const result = await makeAsync(() => resolvesTo(true)).validate('x', negated);
    expect(result.valid).toBe(false);
    expect(result.err?.details?.[0]?.code).toBe('NOT_PASSED');
  });

  it('a sync validator reports a thenable like a native promise', () => {
    const viaThenable = makeSync(() => resolvesTo(false)).validate('x', schema);
    const viaPromise = makeSync(() => Promise.resolve(false)).validate('x', schema);
    expect(viaPromise.valid).toBe(false);
    expect(viaThenable.valid).toBe(viaPromise.valid);
    expect(viaThenable.err?.message).toBe(viaPromise.err?.message);
  });

  it('an object whose then is not a function is a plain truthy result', async () => {
    const notFunction = await makeAsync(() => ({ then: 1 })).validate('x', schema);
    const plainObject = await makeAsync(() => ({})).validate('x', schema);
    const falsy = await makeAsync(() => 0).validate('x', schema);
    expect(notFunction.valid).toBe(true);
    expect(plainObject.valid).toBe(true);
    expect(falsy.valid).toBe(false);
  });

  it('a then getter that throws fails the validation on every call', async () => {
    const v = makeAsync(() => ({
      get then(): never {
        throw new Error('boom');
      },
    }));
    const outcomes: Array<{ valid: boolean; message: string | undefined }> = [];
    for (let i = 0; i < 3; i++) {
      // sequential on purpose: each call must see the cache state the previous one left
      // oxlint-disable-next-line no-await-in-loop -- order matters, see above
      const result = await v.validate('x', schema);
      outcomes.push({ valid: result.valid, message: result.err?.message });
    }
    expect(outcomes.map((o) => o.valid)).toEqual([false, false, false]);
    expect(outcomes[0].message).toContain('boom');
    expect(outcomes[1]).toEqual(outcomes[0]);
    expect(outcomes[2]).toEqual(outcomes[0]);
  });

  it('a function with a then method is awaited too', async () => {
    const callable = Object.assign(() => 0, {
      then(onFulfilled: (value: boolean) => unknown) {
        return Promise.resolve(false).then(onFulfilled);
      },
    });
    const result = await makeAsync(() => callable).validate('x', schema);
    expect(result.valid).toBe(false);
  });
});
