import type { JsonSchema } from '../../src/json-schema-versions.ts';
import type { ZSchemaBase } from '../../src/z-schema-base.ts';
import type { ZSchemaSafe } from '../../src/z-schema.ts';

import { vi } from 'vitest';

import { ZSchema } from '../../src/z-schema.ts';
import {
  buildFastFor,
  expectAgrees,
  fastFor,
  interpreterOutcome,
  listenForUnhandledRejections,
  outcome,
  SAMPLES,
} from '../lib/fast-validator.ts';

const makeAsyncFormat = (impl: (value: unknown) => Promise<boolean>) => {
  const v = ZSchema.create({ async: true, safe: true, formatAssertions: null });
  const fn = vi.fn<(value: unknown) => Promise<boolean>>(impl);
  v.registerFormat('mine', fn);
  return { v, fn };
};
const isOkAsync = (value: unknown) => Promise.resolve(value === 'ok');
// the inputs are ASCII, so btoa agrees with a Buffer-based encoding
const b64 = (text: string) => btoa(text);
const registerThrowingMine = (z: ZSchemaSafe) => {
  z.registerFormat('mine', (value) => {
    if (value === 'boom') {
      throw new Error('boom');
    }
    return value === 'ok';
  });
};
const entryOf = (v: ZSchemaBase, target: JsonSchema) =>
  v.compiledSchemaCache.getEntry(v.compiledSchemaCache.keyOf(target)!, v.options);

describe('fast validator', () => {
  describe('format', () => {
    it('built-in format gets a validator under formatAssertions null', () => {
      const { fast } = fastFor({ format: 'date' }, { formatAssertions: null });
      expect(fast).toBeDefined();
      expect(fast!('2020-01-01')).toBe(true);
      expect(fast!('nope')).toBe(false);
    });

    it('formatAssertions false drops the check', () => {
      const { fast } = fastFor({ format: 'date' }, { formatAssertions: false });
      expect(fast!('nope')).toBe(true);
    });

    it('formatAssertions true without the format-assertion vocabulary drops the check', () => {
      expectAgrees({ format: 'date' }, { formatAssertions: true });
    });

    it('a sync custom format registered on the instance builds a fast validator', () => {
      const schema: JsonSchema = { format: 'mine' };
      const { fast, reference } = fastFor(schema, { formatAssertions: null }, (z) => {
        z.registerFormat('mine', (value) => value === 'ok');
      });
      expect(fast).toBeDefined();
      for (const sample of SAMPLES.concat(['ok'])) {
        expect(fast!(sample)).toBe(reference(sample));
      }
    });

    it('a truthy non-boolean return is valid on both paths', () => {
      const schema: JsonSchema = { format: 'mine' };
      const { fast, reference } = fastFor(schema, { formatAssertions: null }, (z) => {
        z.registerFormat('mine', (() => 1) as unknown as () => boolean);
      });
      expect(fast).toBeDefined();
      expect(fast!('x')).toBe(true);
      expect(reference('x')).toBe(true);
    });

    it('a sync custom format overriding a built-in one builds a fast validator', () => {
      const schema: JsonSchema = { format: 'date' };
      const { fast, reference } = fastFor(schema, { formatAssertions: null }, (z) => {
        z.registerFormat('date', (value) => value === 'anything');
      });
      expect(fast).toBeDefined();
      for (const sample of ['anything', '2020-01-01', 1]) {
        expect(fast!(sample)).toBe(reference(sample));
      }
    });

    it('a callback-style custom format has no fast validator', () => {
      const { fast } = fastFor({ format: 'mine' }, { formatAssertions: null }, (v) => {
        v.registerFormat('mine', ((_value: unknown, callback: (result: boolean) => void) => {
          callback(true);
        }) as unknown as () => boolean);
      });
      expect(fast).toBeUndefined();
    });

    it('a throwing sync custom format gives the same outcome on both paths', () => {
      const schema: JsonSchema = { format: 'mine' };
      const { v, fast } = fastFor(schema, { formatAssertions: null }, registerThrowingMine);
      expect(fast).toBeDefined();
      expect(() => fast!('boom')).toThrow('boom');
      expect(fast!('ok')).toBe(true);
      expect(fast!('no')).toBe(false);
      // the compiled path hands the throw to the interpreter, which reproduces the throw of a fresh validator
      const compiled = v.compile(schema);
      expect(outcome(() => compiled('boom') as never)).toEqual(
        interpreterOutcome({ formatAssertions: null }, schema, 'boom', registerThrowingMine)
      );
    });

    describe('with a promise-returning custom format', () => {
      const schema: JsonSchema = { format: 'mine' };

      it('an async function validator builds no fast validator and is called once per validation', async () => {
        let calls = 0;
        // declared async on purpose: the builder recognises async functions without calling them
        const validator = async (value: unknown) => {
          calls++;
          await Promise.resolve();
          return value === 'ok';
        };
        const v = ZSchema.create({ async: true, safe: true, formatAssertions: null });
        v.registerFormat('mine', validator);
        const first = await v.validate('ok', schema);
        expect(buildFastFor(v, schema)).toBeUndefined();
        const second = await v.validate('no', schema);
        const third = await v.validate('ok', schema);
        const freshOk = await makeAsyncFormat(isOkAsync).v.validate('ok', schema);
        const freshNo = await makeAsyncFormat(isOkAsync).v.validate('no', schema);
        expect([first.valid, second.valid, third.valid]).toEqual([freshOk.valid, freshNo.valid, freshOk.valid]);
        expect([first.valid, second.valid, third.valid]).toEqual([true, false, true]);
        expect(buildFastFor(v, schema)).toBeUndefined();
        expect(typeof entryOf(v, schema)?.fast).not.toBe('function');
        expect(calls).toBe(3);
      });

      it('a plain function returning a promise builds one, retires it on the first cached call, costs one extra call', async () => {
        const { v, fn } = makeAsyncFormat(isOkAsync);
        const first = await v.validate('ok', schema);
        expect(buildFastFor(v, schema)).toBeDefined();
        const second = await v.validate('no', schema);
        const third = await v.validate('ok', schema);
        const freshOk = await makeAsyncFormat(isOkAsync).v.validate('ok', schema);
        const freshNo = await makeAsyncFormat(isOkAsync).v.validate('no', schema);
        expect([first.valid, second.valid, third.valid]).toEqual([freshOk.valid, freshNo.valid, freshOk.valid]);
        expect([first.valid, second.valid, third.valid]).toEqual([true, false, true]);
        expect(entryOf(v, schema)?.fast).toBeNull();
        expect(fn).toHaveBeenCalledTimes(4);
      });

      it('a promise reached only through an anyOf member beside unevaluatedProperties falls back and is correct', async () => {
        const nested: JsonSchema = {
          anyOf: [{ properties: { a: { format: 'mine' } } }, { type: 'object' }],
          unevaluatedProperties: false,
        };
        const inputs = [{ a: 'ok' }, { a: 'no' }, { a: 'ok' }, { a: 'no' }];
        const { v } = makeAsyncFormat(isOkAsync);
        const results: boolean[] = [];
        const expected: boolean[] = [];
        // sequential on purpose: each call must see the cache state the previous one left
        for (const data of inputs) {
          // oxlint-disable-next-line no-await-in-loop -- order matters, see above
          const result = await v.validate(data, nested);
          // oxlint-disable-next-line no-await-in-loop -- order matters, see above
          const reference = await makeAsyncFormat(isOkAsync).v.validate(data, nested);
          results.push(result.valid);
          expected.push(reference.valid);
        }
        expect(results).toEqual(expected);
        expect(results).toEqual([true, false, true, false]);
        expect(entryOf(v, nested)?.fast).toBeNull();
      });

      it('a rejecting promise is invalid and does not surface as an unhandled rejection', async () => {
        const { v } = makeAsyncFormat(() => Promise.reject(new Error('nope')));
        const unhandled = vi.fn<(reason: unknown) => void>();
        const unsubscribe = listenForUnhandledRejections(unhandled);
        try {
          const first = await v.validate('x', schema);
          const second = await v.validate('x', schema);
          const third = await v.validate('x', schema);
          expect([first.valid, second.valid, third.valid]).toEqual([false, false, false]);
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
    });

    describe('with a globally registered format', () => {
      afterEach(() => {
        ZSchema.unregisterFormat('global-mine');
      });
      it('builds a fast validator for a sync one', () => {
        ZSchema.registerFormat('global-mine', (value) => value === 'ok');
        const { fast, reference } = fastFor({ format: 'global-mine' }, { formatAssertions: null });
        expect(fast).toBeDefined();
        expect(fast!('ok')).toBe(true);
        expect(fast!('no')).toBe(reference('no'));
      });
    });
  });

  describe('contentEncoding and contentMediaType on draft-07', () => {
    const inputs: unknown[] = [
      'aGVsbG8=',
      'not base64!!',
      '',
      'a',
      1,
      null,
      {},
      [],
      '{"a":1}',
      '{bad json',
      b64('{"a":1}'),
      b64('{bad json'),
      b64('hello'),
      'e30=',
      'e30',
    ];
    const cases: Array<[string, JsonSchema]> = [
      ['base64', { contentEncoding: 'base64' }],
      ['application/json', { contentMediaType: 'application/json' }],
      ['base64 and application/json', { contentEncoding: 'base64', contentMediaType: 'application/json' }],
      ['unknown encoding', { contentEncoding: '7bit' }],
      ['unknown media type', { contentMediaType: 'text/plain' }],
      ['unknown encoding with application/json', { contentEncoding: '7bit', contentMediaType: 'application/json' }],
      ['base64 with unknown media type', { contentEncoding: 'base64', contentMediaType: 'text/plain' }],
    ];
    it.each(cases)('%s agrees with the interpreter', (_name, schema) => {
      expectAgrees(schema, { version: 'draft-07' }, inputs);
    });

    it('is ignored on draft2020-12 and a fast validator is built', () => {
      const { fast } = fastFor({ contentEncoding: 'base64', contentMediaType: 'application/json' });
      expect(fast).toBeDefined();
      expect(fast!('not base64!!')).toBe(true);
    });
  });
});
