import type { JsonSchema } from '../../src/json-schema-versions.ts';
import type { Report } from '../../src/report.ts';

import { describe, expect, it } from 'vitest';

import { ValidateError } from '../../src/errors.ts';
import { ZSchema } from '../../src/z-schema.ts';
import { nextTurn } from '../lib/async.ts';

describe('async format applicators', () => {
  it('accepts a value rejected by an asynchronous not subschema', async () => {
    const validator = ZSchema.create({ async: true, safe: true, version: 'draft-07' });
    const condition = Promise.withResolvers<boolean>();
    validator.registerFormat('corporate-email', () => condition.promise);

    const pending = validator.validate('guest@outside.test', { not: { format: 'corporate-email' } });
    await nextTurn();
    condition.resolve(false);

    const result = await pending;
    expect(result.valid).toBe(true);
  });

  it('rejects a value accepted by an asynchronous not subschema', async () => {
    const validator = ZSchema.create({ async: true, safe: true, version: 'draft-07' });
    validator.registerFormat('corporate-email', () => Promise.resolve(true));

    const result = await validator.validate('employee@example.com', { not: { format: 'corporate-email' } });

    expect(result.valid).toBe(false);
    expect(result.err?.details?.[0]?.code).toBe('NOT_PASSED');
  });

  it('waits for both oneOf alternatives before counting matches', async () => {
    const validator = ZSchema.create({ async: true, safe: true, version: 'draft-07' });
    const corporate = Promise.withResolvers<boolean>();
    const guest = Promise.withResolvers<boolean>();
    validator.registerFormat('corporate-email', () => corporate.promise);
    validator.registerFormat('guest-email', () => guest.promise);

    const pending = validator.validate('guest@outside.test', {
      oneOf: [{ format: 'corporate-email' }, { format: 'guest-email' }],
    });
    await nextTurn();
    corporate.resolve(false);
    guest.resolve(true);

    const result = await pending;
    expect(result.valid).toBe(true);
  });

  it('rejects anyOf when every asynchronous alternative fails', async () => {
    const validator = ZSchema.create({ async: true, safe: true, version: 'draft-07' });
    const condition = Promise.withResolvers<boolean>();
    validator.registerFormat('known-email', () => condition.promise);

    const pending = validator.validate('unknown@outside.test', { anyOf: [{ format: 'known-email' }] });
    await nextTurn();
    condition.resolve(false);
    const result = await pending;

    expect(result.valid).toBe(false);
    expect(result.err?.details?.[0]?.code).toBe('ANY_OF_MISSING');
  });

  it.each([false, true])(
    'consumes a rejected format in a synchronously failing alternative with breakOnFirstError=%s',
    async (breakOnFirstError) => {
      const validator = ZSchema.create({ async: true, safe: true, version: 'draft-07', breakOnFirstError });
      const condition = Promise.withResolvers<boolean>();
      validator.registerFormat('unavailable', () => condition.promise);

      const pending = validator.validate('x', {
        anyOf: [{ allOf: [{ format: 'unavailable' }, { minLength: 10 }] }, {}],
      });
      await nextTurn();
      condition.reject(new Error('format lookup failed'));
      const result = await pending;
      await nextTurn();

      expect(result.valid).toBe(true);
    }
  );

  it('selects else after an asynchronous condition fails', async () => {
    const validator = ZSchema.create({ async: true, safe: true, version: 'draft-07' });
    const condition = Promise.withResolvers<boolean>();
    validator.registerFormat('corporate-email', () => condition.promise);
    const pending = validator.validate(
      { email: 'guest@outside.test', guestId: 'guest-1' },
      {
        if: { properties: { email: { format: 'corporate-email' } } },
        then: { required: ['employeeId'] },
        else: { required: ['guestId'] },
      }
    );
    await nextTurn();
    condition.resolve(false);

    const result = await pending;
    expect(result.valid).toBe(true);
  });

  it('waits for an asynchronous format in the selected branch only', async () => {
    const validator = ZSchema.create({ async: true, safe: true, version: 'draft-07' });
    const condition = Promise.withResolvers<boolean>();
    const branch = Promise.withResolvers<boolean>();
    const calls: string[] = [];
    validator.registerFormat('condition', () => condition.promise);
    validator.registerFormat('then-check', () => {
      calls.push('then');
      return branch.promise;
    });
    validator.registerFormat('else-check', () => {
      calls.push('else');
      return Promise.resolve(true);
    });
    const pending = validator.validate('value', {
      if: { format: 'condition' },
      then: { format: 'then-check' },
      else: { format: 'else-check' },
    });
    const callsBeforeResolution = calls.slice();
    condition.resolve(true);
    await nextTurn();
    branch.resolve(false);
    const result = await pending;

    expect(callsBeforeResolution).toEqual([]);
    expect(calls).toEqual(['then']);
    expect(result.valid).toBe(false);
    expect(result.err?.details?.[0]?.code).toBe('INVALID_FORMAT');
  });

  it('keeps errors at the conditional property after asynchronous resolution', async () => {
    const validator = ZSchema.create({ async: true, safe: true, version: 'draft-07' });
    validator.registerFormat('condition', () => Promise.resolve(true));
    const result = await validator.validate(
      { customer: {} },
      { properties: { customer: { if: { format: 'condition' }, then: { required: ['id'] } } } }
    );

    expect(result.valid).toBe(false);
    expect(result.err?.details?.[0]?.path).toBe('#/customer');
  });

  it('keeps per-call filters when another validation runs before the condition settles', async () => {
    const validator = ZSchema.create({ async: true, safe: true, version: 'draft-07' });
    const condition = Promise.withResolvers<boolean>();
    validator.registerFormat('condition', () => condition.promise);
    const pending = validator.validate('a', { if: { format: 'condition' }, then: { minLength: 5 } });
    await validator.validate('other', {}, { includeErrors: ['INVALID_TYPE'] });
    condition.resolve(true);
    const result = await pending;

    expect(result.valid).toBe(false);
    expect(result.err?.details?.[0]?.code).toBe('MIN_LENGTH');
  });

  it('propagates a synchronous exception from a delayed branch', async () => {
    const validator = ZSchema.create({ async: true, safe: true, version: 'draft-07' });
    const error = new Error('branch unavailable');
    validator.registerFormat('condition', () => Promise.resolve(true));
    validator.registerFormat('branch', () => {
      throw error;
    });
    const result = await validator.validate('value', {
      if: { format: 'condition' },
      then: { format: 'branch' },
    });

    expect(result.valid).toBe(false);
    expect(result.err).toBeInstanceOf(ValidateError);
    expect(result.err!.cause).toBe(error);
  });

  it('does not turn a timed-out not subschema into a passing result', async () => {
    const validator = ZSchema.create({ async: true, safe: true, version: 'draft-07', asyncTimeout: 10 });
    validator.registerFormat('never-settles', () => new Promise<boolean>(() => {}));
    const result = await validator.validate('value', { not: { format: 'never-settles' } });

    expect(result.valid).toBe(false);
    expect(result.err?.details?.[0]?.code).toBe('ASYNC_TIMEOUT');
  });

  it('uses settled oneOf matches to collect evaluated properties', async () => {
    const validator = ZSchema.create({ async: true, safe: true, version: 'draft2020-12' });
    const condition = Promise.withResolvers<boolean>();
    validator.registerFormat('guest-email', () => condition.promise);
    const pending = validator.validate(
      { email: 'guest@outside.test' },
      {
        oneOf: [{ properties: { email: { format: 'guest-email' } } }, { required: ['employeeId'] }],
        unevaluatedProperties: false,
      }
    );
    await nextTurn();
    condition.resolve(true);

    const result = await pending;
    expect(result.valid).toBe(true);
  });

  it('collects the selected conditional branch before checking unevaluated properties', async () => {
    const validator = ZSchema.create({ async: true, safe: true, version: 'draft2020-12' });
    const condition = Promise.withResolvers<boolean>();
    validator.registerFormat('corporate-email', () => condition.promise);
    const pending = validator.validate(
      { email: 'guest@outside.test', guestId: 'guest-1' },
      {
        properties: { email: true },
        if: { properties: { email: { format: 'corporate-email' } } },
        then: { properties: { employeeId: true } },
        else: { properties: { guestId: true } },
        unevaluatedProperties: false,
      }
    );
    await nextTurn();
    condition.resolve(false);

    const result = await pending;
    expect(result.valid).toBe(true);
  });

  it.each(['draft-04', 'draft-06', 'draft-07', 'draft2019-09', 'draft2020-12'] as const)(
    'keeps asynchronous not semantics in %s',
    async (version) => {
      const validator = ZSchema.create({ async: true, safe: true, version });
      validator.registerFormat('does-not-match', () => Promise.resolve(false));
      const result = await validator.validate('value', { not: { format: 'does-not-match' } });

      expect(result.valid).toBe(true);
    }
  );

  it('keeps synchronous not behavior when a false-schema error is filtered', () => {
    const validator = ZSchema.create({ safe: true, version: 'draft-07' });
    const result = validator.validate(
      'value',
      { not: false as unknown as JsonSchema },
      {
        excludeErrors: ['SCHEMA_IS_FALSE'],
      }
    );

    expect(result.valid).toBe(true);
  });

  it('waits through nested allOf and negation', async () => {
    const validator = ZSchema.create({ async: true, safe: true, version: 'draft-07' });
    validator.registerFormat('matches', () => Promise.resolve(true));
    const result = await validator.validate('value', { allOf: [{ not: { not: { format: 'matches' } } }] });

    expect(result.valid).toBe(true);
  });

  it('treats a rejected predicate promise as a failed not subschema', async () => {
    const validator = ZSchema.create({ async: true, safe: true, version: 'draft-07' });
    validator.registerFormat('unavailable', () => Promise.reject(new Error('lookup unavailable')));
    const result = await validator.validate('value', { not: { format: 'unavailable' } });

    expect(result.valid).toBe(true);
  });

  it('retains asynchronous decisions in a compiled validator', async () => {
    const validator = ZSchema.create({ async: true, safe: true, version: 'draft-07' });
    validator.registerFormat('corporate-email', (value) => Promise.resolve(String(value).endsWith('@example.com')));
    const validate = validator.compile({
      if: { properties: { email: { format: 'corporate-email' } } },
      then: { required: ['employeeId'] },
      else: { required: ['guestId'] },
    });
    const result = await validate({ email: 'guest@outside.test', guestId: 'guest-1' });

    expect(result.valid).toBe(true);
  });

  it('does not mark properties of a failed asynchronous alternative as evaluated', async () => {
    const validator = ZSchema.create({ async: true, safe: true, version: 'draft2020-12' });
    validator.registerFormat('matches', () => Promise.resolve(true));
    validator.registerFormat('does-not-match', () => Promise.resolve(false));
    const result = await validator.validate(
      { allowed: 1, extra: 2 },
      {
        oneOf: [
          { properties: { allowed: true }, format: 'matches' },
          { properties: { extra: true }, format: 'does-not-match' },
        ],
        unevaluatedProperties: false,
      }
    );

    expect(result.valid).toBe(false);
    expect(result.err?.details?.[0]?.code).toBe('OBJECT_UNEVALUATED_PROPERTIES');
  });

  it('collects only settled contains matches before checking unevaluated items', async () => {
    const validator = ZSchema.create({ async: true, safe: true, version: 'draft2020-12' });
    validator.registerFormat('guest-email', (value) => Promise.resolve(value === 'guest@outside.test'));
    const result = await validator.validate(['guest@outside.test', 'employee@example.com'], {
      contains: { format: 'guest-email' },
      unevaluatedItems: false,
    });

    expect(result.valid).toBe(false);
    expect(result.err?.details?.[0]?.code).toBe('ARRAY_UNEVALUATED_ITEMS');
  });

  it('preserves dynamic-reference scope while validating the selected branch', async () => {
    const validator = ZSchema.create({ async: true, safe: true, version: 'draft2020-12' });
    validator.registerFormat('has-child', (value) => Promise.resolve(typeof value === 'object'));
    const result = await validator.validate(
      { child: { child: 1 } },
      {
        $id: 'https://example.test/tree',
        $dynamicAnchor: 'node',
        if: { format: 'has-child' },
        then: { properties: { child: { $dynamicRef: '#node' } } },
        else: { type: 'integer' },
      }
    );

    expect(result.valid).toBe(true);
  });
});

/** Narrows an unknown schema to an object carrying `key: value`. */
const hasKeyword = (schema: unknown, key: string, value: unknown): schema is Record<string, unknown> =>
  typeof schema === 'object' && schema !== null && key in schema && (schema as Record<string, unknown>)[key] === value;

interface ResultLike {
  err?: { details?: Array<{ code: string }> };
}
const details = (r: ResultLike) => r.err?.details ?? [];
const codes = (r: ResultLike) => details(r).map((d) => d.code);

const throwingOptions = (thrown: unknown) => ({
  async: true as const,
  version: 'draft2020-12' as const,
  customValidator: (_report: Report, schema: unknown) => {
    if (hasKeyword(schema, 'title', 'boom')) {
      throw thrown;
    }
  },
});

const withGatedFormats = <T extends Pick<ZSchema, 'registerFormat'>>(validator: T) => {
  const g = Promise.withResolvers<boolean>();
  const f = Promise.withResolvers<boolean>();
  validator.registerFormat('g', () => g.promise);
  validator.registerFormat('f', () => f.promise);
  return { validator, g, f };
};

const createThrowing = (thrown: unknown) =>
  withGatedFormats(ZSchema.create({ ...throwingOptions(thrown), safe: true }));

const createRejecting = (thrown: unknown) => withGatedFormats(ZSchema.create(throwingOptions(thrown)));

describe('async hardening', () => {
  const throwingSchema: JsonSchema = {
    anyOf: [{ allOf: [{ format: 'g' }, { if: { format: 'f' }, then: { title: 'boom' } }] }, {}],
  };

  // A throw inside a nested deferred decision must surface as an error, not become a pass (valid: true).
  it('surfaces a throw from a nested deferred decision (safe)', async () => {
    const error = new TypeError('boom');
    const { validator, g, f } = createThrowing(error);
    const pending = validator.validate('x', throwingSchema);
    await nextTurn();
    f.resolve(true);
    await nextTurn();
    g.resolve(false);

    const result = await pending;
    expect(result.valid).toBe(false);
    expect(result.err).toBeInstanceOf(ValidateError);
    expect(result.err!.cause).toBe(error);
  });

  it('rejects with a throw from a nested deferred decision (non-safe)', async () => {
    const error = new TypeError('boom');
    const { validator, g, f } = createRejecting(error);
    const pending = validator.validate('x', throwingSchema);
    const outcome = pending.then(
      () => {},
      (error_: unknown) => error_
    );
    await nextTurn();
    g.resolve(false);
    await nextTurn();
    f.resolve(true);

    const rejected = await outcome;
    expect(rejected).toBeInstanceOf(ValidateError);
    expect((rejected as ValidateError).cause).toBe(error);
  });

  // Anything thrown is converted to a ValidateError with the thrown value as cause.
  it.each([['str'], [undefined]])('converts non-Error throw %s to a ValidateError with cause', async (thrown) => {
    const { validator, g, f } = createThrowing(thrown);
    const pending = validator.validate('x', throwingSchema);
    await nextTurn();
    f.resolve(true);
    g.resolve(false);

    const result = await pending;
    expect(result.valid).toBe(false);
    expect(result.err).toBeInstanceOf(ValidateError);
    expect(result.err!.cause).toBe(thrown);
  });

  // A synchronous throw from a callback-style format must not hang or settle twice.
  it('reports a sync throw from a callback-style format exactly once', async () => {
    const validator = ZSchema.create({ async: true, safe: true, version: 'draft2020-12' });
    const error = new Error('cb boom');
    // Deliberately an undocumented shape: the 2-argument callback-style format is not part of the public type.
    validator.registerFormat('cb', ((_value: unknown, _cb: (r: boolean) => void) => {
      throw error;
    }) as never);
    let settled = 0;
    const result = await validator.validate('x', { anyOf: [{ allOf: [{ format: 'cb' }] }, {}] }).finally(() => {
      settled += 1;
    });
    await nextTurn();
    await nextTurn();

    expect(settled).toBe(1);
    expect(result.valid).toBe(false);
    expect(result.err).toBeInstanceOf(ValidateError);
    expect(result.err!.cause).toBe(error);
  });

  // A nested timeout must not discard sibling errors.
  it('keeps sibling errors when a nested format times out', async () => {
    const validator = ZSchema.create({ async: true, safe: true, version: 'draft2020-12', asyncTimeout: 50 });
    validator.registerFormat('never', () => new Promise<boolean>(() => {}));
    const result = await validator.validate(
      { a: 'x', b: 'y' },
      {
        properties: {
          a: { type: 'number' },
          b: { anyOf: [{ allOf: [{ format: 'never' }] }] },
        },
      }
    );

    expect(result.valid).toBe(false);
    expect(codes(result)).toContain('ASYNC_TIMEOUT');
    expect(result.err!.details!.find((d) => d.code === 'INVALID_TYPE')?.path).toBe('#/a');
  });

  // unevaluatedProperties / unevaluatedItems as schemas must wait for async formats.
  it('fails unevaluatedProperties schema when an async format rejects', async () => {
    const validator = ZSchema.create({ async: true, safe: true, version: 'draft2020-12' });
    const bad = Promise.withResolvers<boolean>();
    validator.registerFormat('bad', () => bad.promise);
    const pending = validator.validate({ a: 'x' }, { unevaluatedProperties: { format: 'bad' } });
    await nextTurn();
    bad.resolve(false);

    const result = await pending;
    expect(result.valid).toBe(false);
    const errs = result.err!.details!;
    expect(errs).toHaveLength(1);
    expect(errs[0].code).toBe('OBJECT_UNEVALUATED_PROPERTIES');
    expect(errs[0].params).toEqual(['a']);
    expect(errs[0].path).toBe('#/');
    expect(errs[0].schemaPath).toEqual([]);
    expect(errs[0].keyword).toBe('unevaluatedProperties');
  });

  it('passes unevaluatedProperties schema when an async format accepts', async () => {
    const validator = ZSchema.create({ async: true, safe: true, version: 'draft2020-12' });
    const good = Promise.withResolvers<boolean>();
    validator.registerFormat('good', () => good.promise);
    const pending = validator.validate({ a: 'x' }, { unevaluatedProperties: { format: 'good' } });
    await nextTurn();
    good.resolve(true);

    const result = await pending;
    expect(result.valid).toBe(true);
  });

  it('reports sync unevaluatedProperties failures first, then async ones in key order', async () => {
    const validator = ZSchema.create({ async: true, safe: true, version: 'draft2020-12' });
    const a = Promise.withResolvers<boolean>();
    const c = Promise.withResolvers<boolean>();
    validator.registerFormat('lookup', (value) => (value === 'a' ? a.promise : c.promise));
    const pending = validator.validate(
      { a: 'a', b: 1, c: 'c' },
      { unevaluatedProperties: { type: 'string', format: 'lookup' } }
    );
    await nextTurn();
    c.resolve(false);
    await nextTurn();
    a.resolve(false);

    const result = await pending;
    expect(result.valid).toBe(false);
    expect(codes(result)).toEqual([
      'OBJECT_UNEVALUATED_PROPERTIES',
      'OBJECT_UNEVALUATED_PROPERTIES',
      'OBJECT_UNEVALUATED_PROPERTIES',
    ]);
    // Sync-failing key b is reported immediately; async keys a and c follow in key order regardless of settle order.
    expect(result.err!.details!.map((d) => d.params)).toEqual([['b'], ['a'], ['c']]);
  });

  it('reports exactly one ARRAY_UNEVALUATED_ITEMS for async failing items', async () => {
    const validator = ZSchema.create({ async: true, safe: true, version: 'draft2020-12' });
    const bad = Promise.withResolvers<boolean>();
    validator.registerFormat('bad', () => bad.promise);
    const pending = validator.validate(['p', 'x', 'y'], {
      prefixItems: [{}],
      unevaluatedItems: { format: 'bad' },
    });
    await nextTurn();
    bad.resolve(false);

    const result = await pending;
    expect(result.valid).toBe(false);
    const errs = result.err!.details!;
    expect(errs).toHaveLength(1);
    expect(errs[0].code).toBe('ARRAY_UNEVALUATED_ITEMS');
    expect(errs[0].schemaPath).toEqual([]);
    expect(errs[0].keyword).toBe('unevaluatedItems');
  });

  // A passing lone `if` contributes evaluated properties, even when its condition is async.
  it.each([
    [true, []],
    [false, ['OBJECT_UNEVALUATED_PROPERTIES']],
  ])('lone async if resolving %s gives codes %j with unevaluatedProperties:false', async (condition, expectedCodes) => {
    const validator = ZSchema.create({ async: true, safe: true, version: 'draft2020-12' });
    const af = Promise.withResolvers<boolean>();
    validator.registerFormat('af', () => af.promise);
    const pending = validator.validate(
      { a: 'x' },
      { if: { properties: { a: { format: 'af' } } }, unevaluatedProperties: false }
    );
    await nextTurn();
    af.resolve(condition);

    const result = await pending;
    expect(result.valid).toBe(expectedCodes.length === 0);
    expect(codes(result)).toEqual(expectedCodes);
  });

  // customValidator runs only after the async results of its node have settled.
  it('lets customValidator see async format errors of its node', async () => {
    const seen: string[][] = [];
    const validator = ZSchema.create({
      async: true,
      safe: true,
      version: 'draft2020-12',
      customValidator: (report, schema) => {
        if (hasKeyword(schema, 'format', 'bad')) {
          seen.push(report.errors.map((e) => e.code));
        }
      },
    });
    const bad = Promise.withResolvers<boolean>();
    validator.registerFormat('bad', () => bad.promise);
    const pending = validator.validate('x', { format: 'bad' });
    await nextTurn();
    bad.resolve(false);
    const result = await pending;

    expect(result.valid).toBe(false);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain('INVALID_FORMAT');
  });

  // breakOnFirstError truncates late async errors to one.
  it('truncates to one detail with breakOnFirstError for two async failures', async () => {
    const validator = ZSchema.create({ async: true, safe: true, version: 'draft2020-12', breakOnFirstError: true });
    const x = Promise.withResolvers<boolean>();
    const y = Promise.withResolvers<boolean>();
    validator.registerFormat('fx', () => x.promise);
    validator.registerFormat('fy', () => y.promise);
    const pending = validator.validate(
      { x: 'a', y: 'b' },
      { properties: { x: { format: 'fx' }, y: { format: 'fy' } } }
    );
    await nextTurn();
    y.resolve(false);
    x.resolve(false);

    const result = await pending;
    expect(result.valid).toBe(false);
    expect(details(result)).toHaveLength(1);
  });

  it('truncates to one detail with breakOnFirstError for sync type error plus async failure', async () => {
    const validator = ZSchema.create({ async: true, safe: true, version: 'draft2020-12', breakOnFirstError: true });
    const y = Promise.withResolvers<boolean>();
    validator.registerFormat('fy', () => y.promise);
    const pending = validator.validate(
      { x: 'a', y: 'b' },
      { properties: { x: { type: 'number' }, y: { format: 'fy' } } }
    );
    await nextTurn();
    y.resolve(false);

    const result = await pending;
    expect(result.valid).toBe(false);
    expect(details(result)).toHaveLength(1);
  });

  it('does not call the format of a lone if when nothing consumes its result', async () => {
    const validator = ZSchema.create({ async: true, safe: true, version: 'draft2020-12' });
    let calls = 0;
    validator.registerFormat('never', () => {
      calls += 1;
      return new Promise<boolean>(() => {});
    });
    const result = await validator.validate('x', { if: { format: 'never' } });

    expect(result.valid).toBe(true);
    expect(calls).toBe(0);
  });

  it('accepts a lone async-format if in sync mode without throwing', () => {
    const validator = ZSchema.create({ safe: true, version: 'draft2020-12' });
    validator.registerFormat('af', () => Promise.resolve(true));

    expect(validator.validate('x', { if: { format: 'af' } }).valid).toBe(true);
  });

  // The lone `if` sits in an allOf branch, so its evaluated properties must reach the ancestor's unevaluatedProperties.
  it.each([
    [true, []],
    [false, ['OBJECT_UNEVALUATED_PROPERTIES']],
  ])(
    'lone async if inside allOf resolving %s gives codes %j under parent unevaluatedProperties:false',
    async (condition, expectedCodes) => {
      const validator = ZSchema.create({ async: true, safe: true, version: 'draft2020-12' });
      const af = Promise.withResolvers<boolean>();
      validator.registerFormat('af', () => af.promise);
      const pending = validator.validate(
        { a: 'x' },
        { allOf: [{ if: { properties: { a: { format: 'af' } } } }], unevaluatedProperties: false }
      );
      await nextTurn();
      af.resolve(condition);

      const result = await pending;
      expect(result.valid).toBe(expectedCodes.length === 0);
      expect(codes(result)).toEqual(expectedCodes);
    }
  );

  it('lets customValidator see OBJECT_UNEVALUATED_PROPERTIES from a deferred unevaluatedProperties schema', async () => {
    const seen: string[][] = [];
    const validator = ZSchema.create({
      async: true,
      safe: true,
      version: 'draft2020-12',
      customValidator: (report, schema) => {
        if (hasKeyword(schema, 'type', 'object') && 'anyOf' in schema) {
          seen.push(report.errors.map((e) => e.code));
        }
      },
    });
    const deferreds = new Map<string, PromiseWithResolvers<boolean>>();
    validator.registerFormat('af', (value: unknown) => {
      const d = Promise.withResolvers<boolean>();
      deferreds.set(String(value), d);
      return d.promise;
    });
    const pending = validator.validate(
      { b: 'ok', a: 'bad' },
      {
        type: 'object',
        anyOf: [{ properties: { b: { format: 'af' } } }],
        unevaluatedProperties: { type: 'string', format: 'af' },
      }
    );
    await nextTurn();
    deferreds.get('ok')?.resolve(true);
    await nextTurn();
    deferreds.get('bad')?.resolve(false);

    const result = await pending;
    expect(result.valid).toBe(false);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain('OBJECT_UNEVALUATED_PROPERTIES');
  });

  it('reports ARRAY_UNEVALUATED_ITEMS for a sync failure while an earlier item format never settles', async () => {
    const validator = ZSchema.create({ async: true, safe: true, version: 'draft2020-12', asyncTimeout: 50 });
    validator.registerFormat('never', () => new Promise<boolean>(() => {}));
    const result = await validator.validate(['long-enough', 5], {
      unevaluatedItems: { type: 'string', format: 'never' },
    });

    expect(result.valid).toBe(false);
    expect(codes(result)).toContain('ARRAY_UNEVALUATED_ITEMS');
  });

  it('reports ARRAY_UNEVALUATED_ITEMS for an item that failed synchronously while its own format never settles', async () => {
    const validator = ZSchema.create({ async: true, safe: true, version: 'draft2020-12', asyncTimeout: 50 });
    validator.registerFormat('never', () => new Promise<boolean>(() => {}));
    const result = await validator.validate(['long-enough', 'x'], {
      unevaluatedItems: { minLength: 3, format: 'never' },
    });

    expect(result.valid).toBe(false);
    expect(codes(result)).toContain('ARRAY_UNEVALUATED_ITEMS');
  });

  it('passes a null-prototype throw from customValidator in a deferred decision to the caller without hanging', async () => {
    const thrown = Object.create(null);
    const { validator, g, f } = createThrowing(thrown);
    const pending = validator.validate('x', throwingSchema);
    await nextTurn();
    f.resolve(true);
    g.resolve(false);

    const result = await pending;
    expect(result.valid).toBe(false);
    expect(result.err).toBeInstanceOf(ValidateError);
    expect(result.err!.cause).toBe(thrown);
  });

  // A lone `if` is only evaluated when an enclosing unevaluated* node sits at the same instance.
  const childLoneIf: JsonSchema = {
    properties: { a: { if: { format: 'asyncFmt' } } },
    unevaluatedProperties: false,
  };

  it('does not call or throw on a lone async if at a child instance in sync mode', () => {
    const validator = ZSchema.create({ version: 'draft2020-12' });
    let calls = 0;
    validator.registerFormat('asyncFmt', () => {
      calls += 1;
      return Promise.resolve(true);
    });

    expect(validator.validate({ a: 'x' }, childLoneIf)).toBe(true);
    expect(calls).toBe(0);
  });

  it('does not call a lone async if at a child instance in async mode', async () => {
    const validator = ZSchema.create({ async: true, safe: true, version: 'draft2020-12' });
    let calls = 0;
    validator.registerFormat('asyncFmt', () => {
      calls += 1;
      return Promise.resolve(true);
    });
    const result = await validator.validate({ a: 'x' }, childLoneIf);

    expect(result.valid).toBe(true);
    expect(calls).toBe(0);
  });

  // The sub-report of an anyOf branch inherits the unevaluated scope, so the lone `if` still contributes.
  it.each([
    [true, []],
    [false, ['OBJECT_UNEVALUATED_PROPERTIES']],
  ])('lone async if inside anyOf branch resolving %s gives codes %j', async (condition, expectedCodes) => {
    const validator = ZSchema.create({ async: true, safe: true, version: 'draft2020-12' });
    const af = Promise.withResolvers<boolean>();
    validator.registerFormat('af', () => af.promise);
    const pending = validator.validate(
      { a: 'x' },
      {
        anyOf: [{ if: { properties: { a: { format: 'af' } } } }],
        unevaluatedProperties: false,
      }
    );
    await nextTurn();
    af.resolve(condition);

    const result = await pending;
    expect(result.valid).toBe(expectedCodes.length === 0);
    expect(codes(result)).toEqual(expectedCodes);
  });

  // Deferred restoration: the lone `if` sits in a then-branch selected by an async condition.
  it.each([
    [true, []],
    [false, ['OBJECT_UNEVALUATED_PROPERTIES']],
  ])(
    'lone async if inside async-selected then resolving %s gives codes %j (async equals sync)',
    async (condition, expectedCodes) => {
      const schema: JsonSchema = {
        if: { format: 'sel' },
        then: { if: { properties: { a: { format: 'af' } } } },
        unevaluatedProperties: false,
      };
      const syncValidator = ZSchema.create({ safe: true, version: 'draft2020-12' });
      syncValidator.registerFormat('sel', () => true);
      syncValidator.registerFormat('af', () => condition);
      const syncResult = syncValidator.validate({ a: 'x' }, schema);
      expect(codes(syncResult)).toEqual(expectedCodes);

      const validator = ZSchema.create({ async: true, safe: true, version: 'draft2020-12' });
      const sel = Promise.withResolvers<boolean>();
      const af = Promise.withResolvers<boolean>();
      validator.registerFormat('sel', () => sel.promise);
      validator.registerFormat('af', () => af.promise);
      const pending = validator.validate({ a: 'x' }, schema);
      await nextTurn();
      sel.resolve(true);
      await nextTurn();
      af.resolve(condition);

      const result = await pending;
      expect(result.valid).toBe(syncResult.valid);
      expect(codes(result)).toEqual(expectedCodes);
    }
  );

  // Deferred tasks run nested-first: the root hook runs after the nested deferred unevaluatedProperties work settled.
  it('lets the root customValidator see errors from nested deferred unevaluatedProperties', async () => {
    // The schema is cloned before it reaches the hook, so nodes are matched by shape, not identity.
    const schema: JsonSchema = {
      allOf: [{ if: { format: 'af' }, then: {}, unevaluatedProperties: { format: 'bad' } }],
    };
    const calls: Array<[boolean, string[]]> = [];
    const validator = ZSchema.create({
      async: true,
      safe: true,
      version: 'draft2020-12',
      customValidator: (report, s) => {
        const isRoot = typeof s === 'object' && s !== null && 'allOf' in s && !('$id' in s);
        const isChild = typeof s === 'object' && s !== null && 'unevaluatedProperties' in s && 'then' in s;
        if (isRoot || isChild) {
          calls.push([isRoot, report.errors.map((e) => e.code)]);
        }
      },
    });
    validator.registerFormat('af', () => Promise.resolve(true));
    validator.registerFormat('bad', () => Promise.resolve(false));
    const result = await validator.validate({ x: 'y' }, schema);

    expect(result.valid).toBe(false);
    const rootIndex = calls.findIndex(([isRoot]) => isRoot);
    const childIndex = calls.findIndex(([isRoot]) => !isRoot);
    expect(childIndex).toBeGreaterThanOrEqual(0);
    expect(rootIndex).toBeGreaterThan(childIndex);
    expect(calls[rootIndex][1]).toContain('OBJECT_UNEVALUATED_PROPERTIES');
  });

  it('reports OBJECT_UNEVALUATED_PROPERTIES for a key failing synchronously while another key format never settles', async () => {
    const validator = ZSchema.create({ async: true, safe: true, version: 'draft2020-12', asyncTimeout: 50 });
    validator.registerFormat('never', () => new Promise<boolean>(() => {}));
    const result = await validator.validate(
      { a: 'long-enough', b: 'x' },
      { unevaluatedProperties: { minLength: 3, format: 'never' } }
    );

    expect(result.valid).toBe(false);
    const unevaluated = result.err!.details!.filter((d) => d.code === 'OBJECT_UNEVALUATED_PROPERTIES');
    expect(unevaluated.map((d) => d.params)).toContainEqual(['b']);
  });
});
