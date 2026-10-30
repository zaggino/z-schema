import type { ZSchemaOptions } from '../../src/z-schema-options.ts';

import { describe, expect, it } from 'vitest';

import { ZSchema } from '../../src/z-schema.ts';

/* oxlint-disable no-await-in-loop -- tests deliberately step resolution order across turns */

const nextTurn = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });

type Version = NonNullable<ZSchemaOptions['version']>;

interface Scenario {
  schema: unknown;
  data: unknown;
  version?: Version;
  /** Result per format name, or a function of the checked value. `'reject'` rejects (async) / false (sync). */
  formats: Record<string, unknown>;
  /** Names resolved in this order (each after a turn); anything left is drained in reverse call order. */
  order?: string[];
  breakOnFirstError?: boolean;
}

interface Call {
  name: string;
  value: string;
  deferred: PromiseWithResolvers<unknown>;
}

interface Summary {
  valid: boolean;
  details: Array<{ code: string; path: string | string[]; schemaPath: unknown }>;
}

const outcome = (fn: unknown, value: string) => (typeof fn === 'function' ? (fn as (v: string) => unknown)(value) : fn);

const summarize = (result: { valid: boolean; err?: { details?: unknown[] } }): Summary => ({
  valid: result.valid,
  details: ((result.err?.details ?? []) as Summary['details']).map((d) => ({
    code: d.code,
    path: d.path,
    schemaPath: d.schemaPath,
  })),
});

const sortDetails = (summary: Summary): Summary => ({
  valid: summary.valid,
  details: summary.details.toSorted((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
});

const runSync = (s: Scenario): Summary => {
  const validator = ZSchema.create({
    safe: true,
    version: s.version ?? 'draft2020-12',
    breakOnFirstError: s.breakOnFirstError ?? false,
  });
  for (const name of Object.keys(s.formats)) {
    validator.registerFormat(name, (value: unknown) => {
      const out = outcome(s.formats[name], String(value));
      return out === 'reject' ? false : (out as boolean);
    });
  }
  return summarize(validator.validate(s.data, s.schema as never));
};

const runAsync = async (s: Scenario): Promise<{ summary: Summary; calls: Call[] }> => {
  const validator = ZSchema.create({
    async: true,
    safe: true,
    version: s.version ?? 'draft2020-12',
    breakOnFirstError: s.breakOnFirstError ?? false,
  });
  const calls: Call[] = [];
  const done = new Set<Call>();
  for (const name of Object.keys(s.formats)) {
    validator.registerFormat(name, ((value: unknown) => {
      const call: Call = { name, value: String(value), deferred: Promise.withResolvers<unknown>() };
      calls.push(call);
      return call.deferred.promise;
    }) as never);
  }
  const resolveCall = (call: Call) => {
    done.add(call);
    const out = outcome(s.formats[call.name], call.value);
    if (out === 'reject') {
      call.deferred.reject(new Error('format lookup failed'));
    } else {
      call.deferred.resolve(out);
    }
  };
  const state = { settled: false };
  // oxlint-disable-next-line promise/prefer-await-to-then
  const pending = validator.validate(s.data, s.schema as never).then((result) => {
    state.settled = true;
    return result;
  });
  await nextTurn();
  for (const name of s.order ?? []) {
    for (let i = 0; i < 4; i += 1) {
      const found = calls.filter((c) => c.name === name && !done.has(c));
      if (found.length > 0) {
        for (const call of found) {
          resolveCall(call);
        }
        break;
      }
      await nextTurn();
    }
  }
  for (let i = 0; i < 50 && !state.settled; i += 1) {
    for (const call of calls.filter((c) => !done.has(c)).toReversed()) {
      resolveCall(call);
    }
    await nextTurn();
  }
  return { summary: summarize(await pending), calls };
};

/** Runs the scenario sync and async, asserts they agree on validity and details, returns the async summary. */
const parity = async (s: Scenario): Promise<Summary> => {
  const sync = runSync(s);
  const { summary } = await runAsync(s);
  expect(sortDetails(summary)).toEqual(sortDetails(sync));
  return summary;
};

const matching =
  (...hits: string[]) =>
  (value: string) =>
    hits.includes(value);

const setup = () => {
  const validator = ZSchema.create({ async: true, safe: true });
  const deferreds = new Map<string, PromiseWithResolvers<boolean>>();
  validator.registerFormat('g', ((value: string) => {
    const d = Promise.withResolvers<boolean>();
    deferreds.set(value, d);
    return d.promise;
  }) as never);
  return { validator, deferreds };
};

const codes = (summary: Summary) => summary.details.map((d) => d.code);

describe('async applicator coverage', () => {
  describe('deep nesting', () => {
    const schema = {
      anyOf: [{ oneOf: [{ not: { format: 'A' } }, { if: { format: 'B' }, then: { format: 'C' } }] }],
    };
    const orders = [
      ['A', 'B', 'C'],
      ['C', 'B', 'A'],
      ['B', 'A', 'C'],
      ['B', 'C', 'A'],
    ];

    it.each(orders)('passes when only the if/then branch matches (order %s)', async (...order) => {
      const summary = await parity({ schema, data: 'x', formats: { A: true, B: true, C: true }, order });
      expect(summary.valid).toBe(true);
      expect(summary.details).toEqual([]);
    });

    it.each(orders)('fails with ANY_OF_MISSING when no oneOf branch matches (order %s)', async (...order) => {
      const summary = await parity({ schema, data: 'x', formats: { A: true, B: true, C: false }, order });
      expect(summary.valid).toBe(false);
      expect(summary.details).toHaveLength(1);
      expect(summary.details[0]).toMatchObject({ code: 'ANY_OF_MISSING', path: '#/' });
    });

    it.each(orders)('fails with ANY_OF_MISSING when both oneOf branches match (order %s)', async (...order) => {
      const summary = await parity({ schema, data: 'x', formats: { A: false, B: false, C: true }, order });
      expect(summary.valid).toBe(false);
      expect(summary.details).toHaveLength(1);
      expect(codes(summary)).toEqual(['ANY_OF_MISSING']);
    });
  });

  describe('oneOf', () => {
    it('reports ONE_OF_MULTIPLE when two async branches pass', async () => {
      const summary = await parity({
        schema: { oneOf: [{ format: 'a' }, { format: 'b' }] },
        data: 'x',
        formats: { a: true, b: true },
        order: ['b', 'a'],
      });
      expect(summary.details).toHaveLength(1);
      expect(summary.details[0]).toMatchObject({ code: 'ONE_OF_MULTIPLE', path: '#/' });
    });

    it('reports ONE_OF_MISSING when no async branch passes', async () => {
      const summary = await parity({
        schema: { oneOf: [{ format: 'a' }, { format: 'b' }] },
        data: 'x',
        formats: { a: false, b: false },
        order: ['b', 'a'],
      });
      expect(summary.details).toHaveLength(1);
      expect(summary.details[0]).toMatchObject({ code: 'ONE_OF_MISSING', path: '#/' });
    });

    it('is valid with a sync failure plus an async pass', async () => {
      const summary = await parity({
        schema: { oneOf: [{ minLength: 10 }, { format: 'a' }] },
        data: 'x',
        formats: { a: true },
      });
      expect(summary).toEqual({ valid: true, details: [] });
    });

    it('treats a rejected promise as a failed branch', async () => {
      const summary = await parity({
        schema: { oneOf: [{ format: 'a' }, { format: 'b' }] },
        data: 'x',
        formats: { a: true, b: 'reject' },
        order: ['b', 'a'],
      });
      expect(summary).toEqual({ valid: true, details: [] });
    });
  });

  describe('contains', () => {
    const data = ['a', 'b', 'c', 'd'];
    it.each([
      ['plain, no match', {}, [], false],
      ['plain, one match', {}, ['c'], true],
      ['minContains 2, one match', { minContains: 2 }, ['b'], false],
      ['minContains 2, two matches', { minContains: 2 }, ['b', 'd'], true],
      ['maxContains 1, two matches', { maxContains: 1 }, ['a', 'd'], false],
      ['maxContains 1, one match', { maxContains: 1 }, ['a'], true],
      ['minContains 0, no match', { minContains: 0 }, [], true],
    ] as Array<[string, object, string[], boolean]>)('%s', async (_name, extra, hits, valid) => {
      const summary = await parity({
        schema: { contains: { format: 'm' }, ...extra },
        data,
        formats: { m: matching(...hits) },
        order: ['m'],
      });
      expect(summary.valid).toBe(valid);
      if (valid) {
        expect(summary.details).toEqual([]);
      } else {
        expect(summary.details).toHaveLength(1);
        expect(summary.details[0]).toMatchObject({ code: 'CONTAINS', path: '#/' });
      }
    });
  });

  it('reports the failing property name for async propertyNames', async () => {
    const summary = await parity({
      schema: { propertyNames: { format: 'n' } },
      data: { ok: 1, bad: 2, fine: 3 },
      formats: { n: (value: string) => value !== 'bad' },
    });
    expect(summary.valid).toBe(false);
    expect(summary.details).toHaveLength(1);
    expect(summary.details[0]).toMatchObject({ code: 'PROPERTY_NAMES' });
    expect(summary.details[0].path).toBe('#/');
  });

  describe('dependentSchemas / dependencies', () => {
    const cases: Array<[string, Version, string]> = [
      ['dependentSchemas', 'draft2020-12', 'dependentSchemas'],
      ['dependencies', 'draft-07', 'dependencies'],
    ];

    it.each(cases)('%s triggered with a failing async format', async (_n, version, keyword) => {
      const summary = await parity({
        schema: { [keyword]: { a: { properties: { b: { format: 'f' } } } } },
        data: { a: 1, b: 'x' },
        version,
        formats: { f: false },
      });
      expect(summary.valid).toBe(false);
      expect(summary.details).toHaveLength(1);
      expect(summary.details[0]).toMatchObject({ code: 'INVALID_FORMAT', path: '#/b' });
    });

    it.each(cases)('%s triggered with a passing async format', async (_n, version, keyword) => {
      const summary = await parity({
        schema: { [keyword]: { a: { properties: { b: { format: 'f' } } } } },
        data: { a: 1, b: 'x' },
        version,
        formats: { f: true },
      });
      expect(summary).toEqual({ valid: true, details: [] });
    });

    it.each(cases)('%s not triggered never consults the format', async (_n, version, keyword) => {
      const { summary, calls } = await runAsync({
        schema: { [keyword]: { a: { properties: { b: { format: 'f' } } } } },
        data: { b: 'x' },
        version,
        formats: { f: false },
      });
      expect(summary).toEqual({ valid: true, details: [] });
      expect(calls).toHaveLength(0);
    });
  });

  describe('unevaluatedProperties', () => {
    const nested = {
      type: 'object',
      properties: { p: {} },
      allOf: [
        {
          properties: { c: {} },
          oneOf: [
            { properties: { x: { format: 'f' } }, required: ['x'] },
            { properties: { y: { format: 'g' } }, required: ['y'] },
          ],
          unevaluatedProperties: false,
        },
      ],
      unevaluatedProperties: false,
    };

    it.each([
      ['branch passes', { c: 1, x: 'a' }, true],
      ['branch fails', { c: 1, x: 'a' }, false],
      ['extra property unevaluated at both levels', { c: 1, x: 'a', z: 1 }, true],
    ] as Array<[string, object, boolean]>)('nested levels with async oneOf: %s', async (_n, data, f) => {
      const summary = await parity({ schema: nested, data, formats: { f, g: true }, order: ['f'] });
      expect(summary.valid).toBe(f && !('z' in data));
      if (!summary.valid) {
        expect(summary.details.length).toBeGreaterThan(0);
      }
    });

    const refSchema = {
      $defs: { child: { properties: { a: {} }, unevaluatedProperties: { type: 'number' } } },
      $ref: '#/$defs/child',
      if: { properties: { k: { format: 'f' } }, required: ['k'] },
      then: { properties: { k: {} } },
      unevaluatedProperties: false,
    };

    it('keeps annotations from an async then alongside a $ref child', async () => {
      const summary = await parity({ schema: refSchema, data: { a: 1, k: 2 }, formats: { f: true } });
      expect(summary).toEqual({ valid: true, details: [] });
    });

    it('rejects the property left unevaluated when the async if fails', async () => {
      const summary = await parity({ schema: refSchema, data: { a: 1, k: 2 }, formats: { f: false } });
      expect(summary.valid).toBe(false);
      expect(codes(summary)).toEqual(['OBJECT_UNEVALUATED_PROPERTIES']);
      expect(summary.details).toHaveLength(1);
    });
  });

  describe('unevaluatedItems', () => {
    it.each([true, false])('async prefixItems (format result %s)', async (f) => {
      const summary = await parity({
        schema: { prefixItems: [{ format: 'p' }], unevaluatedItems: false },
        data: ['x'],
        formats: { p: f },
      });
      expect(summary.valid).toBe(f);
      if (!f) {
        expect(codes(summary)).toEqual(['INVALID_FORMAT']);
      }
    });

    it('rejects extra items beyond async prefixItems', async () => {
      const summary = await parity({
        schema: { prefixItems: [{ format: 'p' }], unevaluatedItems: false },
        data: ['x', 'y'],
        formats: { p: true },
      });
      expect(summary.valid).toBe(false);
      expect(codes(summary)).toEqual(['ARRAY_UNEVALUATED_ITEMS']);
    });

    it.each([true, false])('async if annotating items (condition %s)', async (f) => {
      const summary = await parity({
        schema: {
          if: { prefixItems: [{ format: 'p' }] },
          then: { prefixItems: [true, true] },
          unevaluatedItems: false,
        },
        data: ['x', 'y'],
        formats: { p: f },
      });
      expect(summary.valid).toBe(f);
      if (!f) {
        expect(codes(summary)).toEqual(['ARRAY_UNEVALUATED_ITEMS']);
      }
    });
  });

  describe('breakOnFirstError', () => {
    it.each([true, false])('oneOf with sync failure and pending async sibling (format %s)', async (f) => {
      const summary = await parity({
        schema: { oneOf: [{ minLength: 10 }, { format: 'a' }] },
        data: 'x',
        formats: { a: f },
        breakOnFirstError: true,
      });
      expect(summary.valid).toBe(f);
      if (!f) {
        expect(summary.details).toHaveLength(1);
        expect(summary.details[0]).toMatchObject({ code: 'ONE_OF_MISSING', path: '#/' });
      }
    });

    it('is deterministic regardless of resolution order', async () => {
      const s: Scenario = {
        schema: { oneOf: [{ allOf: [{ minLength: 10 }, { format: 'a' }] }, { format: 'b' }] },
        data: 'x',
        formats: { a: true, b: false },
        breakOnFirstError: true,
      };
      const { summary: first } = await runAsync({ ...s, order: ['a', 'b'] });
      const { summary: second } = await runAsync({ ...s, order: ['b', 'a'] });
      expect(first).toEqual(second);
      expect(first.details).toHaveLength(1);
      expect(first.details[0].code).toBe('ONE_OF_MISSING');
    });
  });

  describe('non-boolean async results', () => {
    const values: Array<[string, unknown]> = [
      ['undefined', undefined],
      ['string', 'yes'],
      ['null', null],
      ['zero', 0],
    ];

    it.each(values)('top-level %s is INVALID_FORMAT', async (_n, value) => {
      const { summary } = await runAsync({ schema: { format: 'f' }, data: 'x', formats: { f: value } });
      expect(summary.valid).toBe(false);
      expect(summary.details).toHaveLength(1);
      expect(summary.details[0]).toMatchObject({ code: 'INVALID_FORMAT', path: '#/' });
    });

    it.each(values)('%s inside not is valid', async (_n, value) => {
      const { summary } = await runAsync({
        schema: { not: { format: 'f' } },
        data: 'x',
        formats: { f: value },
      });
      expect(summary).toEqual({ valid: true, details: [] });
    });
  });

  describe('scope-sensitive dynamic references', () => {
    const dynamicSchema = {
      $id: 'https://example.com/outer',
      $dynamicAnchor: 'T',
      if: { properties: { gate: { format: 'cond' } }, required: ['gate'] },
      then: { $ref: 'inner' },
      properties: { n: { maximum: 10 } },
      $defs: {
        inner: {
          $id: 'https://example.com/inner',
          $dynamicAnchor: 'T',
          properties: { child: { $dynamicRef: '#T' } },
        },
      },
    };
    const recursiveSchema = {
      $id: 'https://example.com/outer',
      $recursiveAnchor: true,
      if: { properties: { gate: { format: 'cond' } }, required: ['gate'] },
      then: { $ref: 'inner' },
      properties: { n: { maximum: 10 } },
      $defs: {
        inner: {
          $id: 'https://example.com/inner',
          $recursiveAnchor: true,
          properties: { child: { $recursiveRef: '#' } },
        },
      },
    };
    const cases: Array<[string, Version, unknown]> = [
      ['$dynamicRef', 'draft2020-12', dynamicSchema],
      ['$recursiveRef', 'draft2019-09', recursiveSchema],
    ];

    it.each(cases)('%s resolves to the outer scope after a deferred if/then', async (_n, version, schema) => {
      const base = { schema, data: { gate: 'x', child: { n: 50 } }, version } as const;
      expect(runSync({ ...base, formats: { cond: true } }).valid).toBe(false);
      for (const order of [['cond'], []]) {
        const summary = await parity({ ...base, formats: { cond: true }, order });
        expect(summary.valid).toBe(false);
        expect(summary.details.length).toBeGreaterThan(0);
      }
    });

    it.each(cases)('%s is not applied when the deferred if fails', async (_n, version, schema) => {
      const summary = await parity({
        schema,
        data: { gate: 'x', child: { n: 50 } },
        version,
        formats: { cond: false },
        order: ['cond'],
      });
      expect(summary).toEqual({ valid: true, details: [] });
    });
  });

  describe('draft matrix', () => {
    const versions: Version[] = ['draft-04', 'draft-06', 'draft-07', 'draft2019-09', 'draft2020-12'];

    it.each(versions)('anyOf on %s', async (version) => {
      const schema = { anyOf: [{ format: 'a' }, { format: 'b' }] };
      const ok = await parity({ schema, data: 'x', version, formats: { a: false, b: true }, order: ['b', 'a'] });
      expect(ok.valid).toBe(true);
      const bad = await parity({ schema, data: 'x', version, formats: { a: false, b: false }, order: ['b', 'a'] });
      expect(codes(bad)).toEqual(['ANY_OF_MISSING']);
    });

    it.each(versions)('oneOf on %s', async (version) => {
      const schema = { oneOf: [{ format: 'a' }, { format: 'b' }] };
      const ok = await parity({ schema, data: 'x', version, formats: { a: false, b: true }, order: ['b', 'a'] });
      expect(ok.valid).toBe(true);
      const multi = await parity({ schema, data: 'x', version, formats: { a: true, b: true }, order: ['b', 'a'] });
      expect(codes(multi)).toEqual(['ONE_OF_MULTIPLE']);
      const none = await parity({ schema, data: 'x', version, formats: { a: false, b: false }, order: ['b', 'a'] });
      expect(codes(none)).toEqual(['ONE_OF_MISSING']);
    });

    it.each(versions.slice(2))('if/then/else on %s', async (version) => {
      const schema = { if: { format: 'c' }, then: { minLength: 5 }, else: { maxLength: 0 } };
      for (const c of [true, false]) {
        const summary = await parity({ schema, data: 'x', version, formats: { c }, order: ['c'] });
        expect(summary.valid).toBe(false);
        expect(codes(summary)).toEqual([c ? 'MIN_LENGTH' : 'MAX_LENGTH']);
      }
    });
  });

  describe('concurrency', () => {
    const schemaOne = { anyOf: [{ format: 'g' }, { minLength: 50 }] };
    const schemaTwo = { properties: { a: { format: 'g', maxLength: 1 } } };
    const optionsOne = { includeErrors: ['ANY_OF_MISSING', 'INVALID_FORMAT', 'MIN_LENGTH'] } as never;
    const optionsTwo = { excludeErrors: ['MAX_LENGTH'] } as never;

    const orders = [
      ['two first', ['two', 'one']],
      ['one first', ['one', 'two']],
    ] as Array<[string, string[]]>;

    it.each(orders)('keeps errors and options isolated across validate() calls (%s)', async (_n, order) => {
      const { validator, deferreds } = setup();
      const one = validator.validate('one', schemaOne, optionsOne);
      const two = validator.validate({ a: 'two' }, schemaTwo, optionsTwo);
      await nextTurn();
      for (const key of order) {
        deferreds.get(key)!.resolve(false);
        await nextTurn();
      }
      const [r1, r2] = [summarize(await one), summarize(await two)];
      expect(r1.valid).toBe(false);
      expect(r1.details).toHaveLength(1);
      expect(r1.details[0]).toMatchObject({ code: 'ANY_OF_MISSING', path: '#/' });
      expect(r2.valid).toBe(false);
      expect(r2.details).toHaveLength(1);
      expect(r2.details[0]).toMatchObject({ code: 'INVALID_FORMAT', path: '#/a' });
    });

    it.each(orders)('keeps errors and options isolated across compile()d validators (%s)', async (_n, order) => {
      const { validator, deferreds } = setup();
      const compiledOne = validator.compile(schemaOne);
      const compiledTwo = validator.compile(schemaTwo);
      const one = compiledOne('one', optionsOne);
      const two = compiledTwo({ a: 'two' }, optionsTwo);
      await nextTurn();
      for (const key of order) {
        deferreds.get(key)!.resolve(false);
        await nextTurn();
      }
      const [r1, r2] = [summarize(await one), summarize(await two)];
      expect(r1.details).toHaveLength(1);
      expect(r1.details[0]).toMatchObject({ code: 'ANY_OF_MISSING', path: '#/' });
      expect(r2.details).toHaveLength(1);
      expect(r2.details[0]).toMatchObject({ code: 'INVALID_FORMAT', path: '#/a' });
    });
  });

  describe('sync snapshots', () => {
    interface Expected {
      code: string;
      keyword?: string;
      inner?: number;
    }
    const cases: Array<[string, unknown, unknown, Expected]> = [
      [
        'anyOf',
        5,
        { anyOf: [{ type: 'string' }, { type: 'boolean' }] },
        { code: 'ANY_OF_MISSING', keyword: 'anyOf', inner: 2 },
      ],
      [
        'oneOf none',
        5,
        { oneOf: [{ type: 'string' }, { type: 'boolean' }] },
        { code: 'ONE_OF_MISSING', keyword: 'oneOf', inner: 2 },
      ],
      [
        'oneOf multiple',
        5,
        { oneOf: [{ type: 'number' }, { minimum: 1 }] },
        { code: 'ONE_OF_MULTIPLE', keyword: 'oneOf' },
      ],
      ['not', 5, { not: { type: 'number' } }, { code: 'NOT_PASSED', keyword: 'not' }],
      ['if/then', 5, { if: { type: 'number' }, then: { minimum: 10 } }, { code: 'MINIMUM', keyword: 'minimum' }],
      [
        'if/else',
        'x',
        { if: { type: 'number' }, else: { minLength: 3 } },
        { code: 'MIN_LENGTH', keyword: 'minLength' },
      ],
      ['contains', ['a', 'b'], { contains: { type: 'number' } }, { code: 'CONTAINS', inner: 2 }],
      ['minContains', ['a', 1], { contains: { type: 'number' }, minContains: 2 }, { code: 'CONTAINS', inner: 1 }],
      ['maxContains', [1, 2], { contains: { type: 'number' }, maxContains: 1 }, { code: 'CONTAINS' }],
    ];

    it.each(cases.flatMap((c) => [true, false].map((b) => [...c, b] as const)))(
      '%s (breakOnFirstError=%s)',
      (_n, data, schema, expected, breakOnFirstError) => {
        const validator = ZSchema.create({ safe: true, breakOnFirstError });
        const result = validator.validate(data, schema as never);
        expect(result.valid).toBe(false);
        const details = result.err!.details!;
        expect(details).toHaveLength(1);
        expect(details[0]).toMatchObject({ code: expected.code, path: '#/', schemaPath: [] });
        expect((details[0] as { keyword?: string }).keyword).toBe(expected.keyword);
        expect(details[0].inner?.length).toBe(expected.inner);
      }
    );
  });
});
