import type { JsonSchema } from '../../src/json-schema-versions.ts';

import { describe, expect, it } from 'vitest';

import { ZSchema } from '../../src/z-schema.ts';
import { codesOf, interpreterOutcome, outcome } from '../lib/fast-validator.ts';
import { idItems, PADDED_ITEMS, stringFillers } from '../lib/unique-array-cases.ts';

const schema: JsonSchema = { type: 'array', uniqueItems: true };

const depth = (n: number, leaf: unknown): unknown => {
  let node: unknown = leaf;
  for (let i = 0; i < n; i++) {
    node = { value: 1, children: [node] };
  }
  return node;
};

const withCopies = (copies: Record<number, number>): unknown[] => {
  const items = idItems(100);
  for (const key of Object.keys(copies)) {
    const target = Number(key);
    items[target] = { ...items[copies[target]] };
  }
  return items;
};

describe('uniqueItems', () => {
  describe('reported indexes', () => {
    const rows: Array<[string, unknown[], number[]]> = [
      ['strings', ['a', 'b', 'b', 'a'], [1, 2]],
      ['strings and an object', ['a', 'b', 'b', 'a', {}], [0, 3]],
      ['one duplicated object among 100', withCopies({ 70: 10 }), [10, 70]],
      ['two duplicated groups among 100', withCopies({ 30: 5, 60: 5, 90: 2 }), [2, 90]],
    ];

    for (const [name, data, pair] of rows) {
      it(`${name}: ${pair.join(' and ')}`, () => {
        const v = ZSchema.create({ safe: true });
        const res = v.validate(data, schema);
        expect(res.valid).toBe(false);
        expect(res.err?.details).toHaveLength(1);
        expect(res.err?.details?.[0].code).toBe('ARRAY_UNIQUE');
        expect(res.err?.details?.[0].params).toEqual(pair);
      });
    }
  });

  describe('unique arrays', () => {
    const nested: Array<Record<string, unknown>> = [];
    for (let i = 0; i < 100; i++) {
      nested.push({ id: 1, meta: { tags: ['x', { n: i }] } });
    }
    const rows: Array<[string, unknown[]]> = [
      ['100 distinct objects', idItems(100)],
      ['100 objects differing in a nested value', nested],
      ['mixed numbers, strings and objects', [1, 2, '1', '2', { a: 1 }, { a: 2 }, [1], [2], null, true]],
    ];

    for (const [name, data] of rows) {
      it(`${name} are valid`, () => {
        const v = ZSchema.create({ safe: true });
        expect(v.validate(data, schema).valid).toBe(true);
      });
    }
  });

  describe('compile() agrees with validate()', () => {
    const rows: Array<[string, unknown[]]> = [
      ['strings', ['a', 'b', 'b', 'a']],
      ['one duplicated object among 100', withCopies({ 70: 10 })],
      ['two duplicated groups among 100', withCopies({ 30: 5, 60: 5, 90: 2 })],
      ['100 distinct objects', idItems(100)],
    ];

    for (const [name, data] of rows) {
      it(`${name} (validate and compile)`, () => {
        const v = ZSchema.create({ safe: true });
        const expected = v.validate(data, schema);
        const fn = v.compile(schema);
        for (let call = 0; call < 2; call++) {
          const res = fn(data);
          expect(res.valid).toBe(expected.valid);
          expect(codesOf(res)).toEqual(codesOf(expected));
          expect(res.err?.details?.[0]?.params).toEqual(expected.err?.details?.[0]?.params);
        }
      });
    }
  });

  describe('depth limit', () => {
    const options = { maxRecursionDepth: 10 };

    const compiledOutcome = (data: unknown) => {
      const fn = ZSchema.create({ safe: true, ...options }).compile(schema);
      return [outcome(() => fn(data)), outcome(() => fn(data))];
    };

    const expectDepthMessage = (data: unknown) => {
      const message = 'Maximum recursion depth (10) exceeded in areEqual';
      const v = ZSchema.create({ safe: true, ...options });
      expect(v.validate(data, schema).err?.message).toContain(message);
      const fn = ZSchema.create({ safe: true, ...options }).compile(schema);
      expect(fn(data).err?.message).toContain(message);
      expect(fn(data).err?.message).toContain(message);
    };

    const rows: Array<{ name: string; head: unknown[]; valid: boolean }> = [
      { name: 'two over-deep equal items are not valid', head: [depth(12, 1), depth(12, 1)], valid: false },
      { name: 'an over-deep item next to a number is valid', head: [depth(12, 1), 5], valid: true },
      { name: 'over-deep items with different leaves are not valid', head: [depth(12, 1), depth(12, 2)], valid: false },
    ];

    for (const { name, head, valid } of rows) {
      it(`${name}, on both paths`, () => {
        const data = head.concat(stringFillers(PADDED_ITEMS));
        const expected = interpreterOutcome(options, schema, data);
        const [first, second] = compiledOutcome(data);
        expect(first).toEqual(expected);
        expect(second).toEqual(expected);
        if (valid) {
          expect(expected).toMatchObject({ valid: true });
        } else {
          expect(expected).toEqual({ valid: false, codes: [] });
          expectDepthMessage(data);
        }
      });
    }
  });
});
