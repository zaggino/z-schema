import type { JsonSchema } from '../../src/json-schema-versions.ts';

import { describe, expect, it } from 'vitest';

import { ZSchema } from '../../src/z-schema.ts';

const nextTurn = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });

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
    expect(result.err).toBe(error);
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
