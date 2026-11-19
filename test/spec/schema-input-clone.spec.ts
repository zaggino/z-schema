import type { JsonSchema } from '../../src/json-schema-versions.ts';

import { describe, expect, it } from 'vitest';

import { cloneInputSchema } from '../../src/json-schema.ts';
import { deepClone } from '../../src/utils/clone.ts';
import { deepFreeze, nest } from '../lib/object-helpers.ts';

type Schema = Record<string, unknown>;

// Boolean schemas and null reach the clone at run time although the type excludes them.
const asSchema = (value: unknown) => value as JsonSchema;

const MAP_KEYWORDS = [
  '$defs',
  'definitions',
  'dependencies',
  'dependentRequired',
  'dependentSchemas',
  'patternProperties',
  'properties',
];

describe('cloneInputSchema clones like deepClone', () => {
  it.each([true, false, null])('returns a value that is not an object as it is: %s', (value) => {
    expect(cloneInputSchema(asSchema(value))).toBe(value);
  });

  it('creates a different object at every level, arrays included', () => {
    const source: Schema = {
      properties: { a: { not: { type: 'string' } } },
      allOf: [{ minimum: 1 }, { items: [{ type: 'string' }] }],
    };
    const result = cloneInputSchema(source);

    expect(result).toEqual(source);
    expect(result).not.toBe(source);
    expect(result.properties).not.toBe(source.properties);
    expect(result.properties?.a).not.toBe((source.properties as Schema).a);
    expect(result.allOf).not.toBe(source.allOf);
    expect(result.allOf?.[0]).not.toBe((source.allOf as unknown[])[0]);
    expect(result.allOf?.[1]).not.toBe((source.allOf as unknown[])[1]);
  });

  it('sorts keys at every level', () => {
    const result = cloneInputSchema({
      properties: { z: { minimum: 1, type: 'integer' }, a: { type: 'string' } },
      type: 'object',
      allOf: [{ type: 'object', minProperties: 1 }],
    });

    expect(Object.keys(result)).toEqual(['allOf', 'properties', 'type']);
    expect(Object.keys(result.properties ?? {})).toEqual(['a', 'z']);
    expect(Object.keys(result.properties?.z ?? {})).toEqual(['minimum', 'type']);
    expect(Object.keys(result.allOf?.[0] ?? {})).toEqual(['minProperties', 'type']);
  });

  it('clones an object reached twice once', () => {
    const shared: Schema = { type: 'string' };
    const result = cloneInputSchema({ allOf: [shared, shared] });

    expect(result.allOf?.[0]).toBe(result.allOf?.[1]);
    expect(result.allOf?.[0]).not.toBe(shared);
    expect(result.allOf?.[0]).toEqual(shared);
  });

  it('keeps a cycle', () => {
    const source: Schema = { type: 'object' };
    source.not = source;
    const result = cloneInputSchema(source);

    expect(result).not.toBe(source);
    expect(result.not).toBe(result);
  });

  it('keeps an own __proto__ key as an own key', () => {
    const source = JSON.parse('{"__proto__": {"x": 1}}') as Schema;
    const result = cloneInputSchema(source);

    expect(Object.hasOwn(result, '__proto__')).toBe(true);
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect((result as Schema).x).toBeUndefined();
  });

  it('throws past maxDepth and accepts nesting up to it', () => {
    const message =
      'Maximum recursion depth (5) exceeded in deepClone. ' +
      'If your schema or data is deeply nested and valid, increase the maxRecursionDepth option.';

    expect(() => cloneInputSchema(nest(6), 5)).toThrow(message);
    expect(() => cloneInputSchema(nest(5), 5)).not.toThrow();
  });

  it('does not modify the source', () => {
    const source: Schema = {
      type: 'object',
      properties: { a: { enum: [{ b: 1 }], items: [{ c: 2 }] } },
      required: ['a'],
    };
    const before = structuredClone(source);
    deepFreeze(source);

    cloneInputSchema(source);

    expect(source).toEqual(before);
  });
});

describe('cloneInputSchema and deepClone agree on schemas without reserved keys', () => {
  const schemas: Array<[string, Schema]> = [
    [
      'nested properties, items and allOf',
      {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1 },
          tags: { type: 'array', items: { type: 'string' } },
          nested: { type: 'object', properties: { deep: { type: 'integer' } } },
        },
        allOf: [{ required: ['name'] }, { minProperties: 1 }],
      },
    ],
    [
      '$defs with $ref',
      {
        $defs: { positive: { type: 'integer', minimum: 1 }, text: { type: 'string' } },
        properties: { count: { $ref: '#/$defs/positive' }, label: { $ref: '#/$defs/text' } },
      },
    ],
    ['enum with objects', { enum: [{ b: 1, a: { d: 1, c: 2 } }, [1, { y: 1, x: 2 }], 'x'] }],
    ['default objects', { type: 'object', default: { z: 1, a: { q: [1, 2], b: 3 } } }],
    [
      'dependencies with array and schema values',
      {
        dependencies: { a: ['b', 'c'], d: { required: ['e'], properties: { e: { type: 'string' } } } },
      },
    ],
    ['an unknown keyword holding an object', { type: 'object', 'x-meta': { z: 1, a: { k: [1, { m: 1, l: 2 }] } } }],
  ];

  it.each(schemas)('%s', (_label, schema) => {
    const viaInput = cloneInputSchema(schema);
    const viaDeep = deepClone(schema);

    expect(viaInput).toEqual(viaDeep);
    expect(JSON.stringify(viaInput)).toBe(JSON.stringify(viaDeep));
  });
});

describe('cloneInputSchema drops reserved keys from schemas', () => {
  it('drops every name with the prefix, including the bare prefix', () => {
    const source: Schema = { __$compiled: true, __$validated: true, __$anything: 1, __$: 2, type: 'string' };

    expect(cloneInputSchema(source)).toEqual({ type: 'string' });
  });

  it('keeps names that only look similar to the prefix', () => {
    const source: Schema = { __x: 1, _$x: 2, $__x: 3 };

    expect(cloneInputSchema(source)).toEqual(source);
  });

  it.each<[string, Schema, Schema]>([
    [
      'properties.a',
      { properties: { a: { __$validated: true, type: 'string' } } },
      { properties: { a: { type: 'string' } } },
    ],
    ['items', { items: { __$validated: true, type: 'string' } }, { items: { type: 'string' } }],
    ['an items array element', { items: [{ __$validated: true, type: 'string' }] }, { items: [{ type: 'string' }] }],
    ['allOf[0]', { allOf: [{ __$validated: true, type: 'string' }] }, { allOf: [{ type: 'string' }] }],
    ['not', { not: { __$validated: true, type: 'string' } }, { not: { type: 'string' } }],
    [
      'additionalProperties',
      { additionalProperties: { __$validated: true, type: 'string' } },
      { additionalProperties: { type: 'string' } },
    ],
    [
      'a value inside $defs',
      { $defs: { d: { __$validated: true, type: 'string' } } },
      { $defs: { d: { type: 'string' } } },
    ],
    [
      'the value of an unknown keyword',
      { 'x-meta': { __$validated: true, type: 'string' } },
      { 'x-meta': { type: 'string' } },
    ],
    [
      'an object nested two levels inside an unknown keyword',
      { 'x-meta': { a: { b: { __$validated: true } } } },
      { 'x-meta': { a: { b: {} } } },
    ],
    [
      'an array nested in an array under anyOf',
      { anyOf: [[{ __$validated: true, type: 'string' }]] },
      { anyOf: [[{ type: 'string' }]] },
    ],
  ])('drops reserved keys at %s', (_label, source, expected) => {
    const before = structuredClone(source);

    expect(cloneInputSchema(source)).toEqual(expected);
    expect(source).toEqual(before);
  });

  it('does not read the value of a reserved key', () => {
    const schema: Schema = { type: 'string' };
    Object.defineProperty(schema, '__$validated', {
      enumerable: true,
      get() {
        throw new Error('read');
      },
    });

    expect(cloneInputSchema(schema)).toEqual({ type: 'string' });
  });

  it('does not count nesting under a reserved key', () => {
    const schema: Schema = { type: 'string', __$compiled: nest(20) };

    expect(cloneInputSchema(schema, 5)).toEqual({ type: 'string' });
  });
});

describe('cloneInputSchema keeps names and data', () => {
  it.each(MAP_KEYWORDS)('keeps a prefixed name inside %s and drops reserved keys under it', (keyword) => {
    const source: Schema = { [keyword]: { __$compiled: { type: 'string', __$validated: true } } };

    expect(cloneInputSchema(source)).toEqual({ [keyword]: { __$compiled: { type: 'string' } } });
  });

  it('clones dependencies and dependentRequired with array values intact', () => {
    const list = ['b', 'c'];
    const source: Schema = { dependencies: { a: list }, dependentRequired: { d: ['e'] } };
    const result = cloneInputSchema(source);

    expect(result).toEqual(source);
    expect(result.dependencies?.a).not.toBe(list);
  });

  it('does not throw when a map keyword holds an array or a string', () => {
    const withArray: Schema = { properties: [{ __$validated: true, type: 'string' }] };
    const withString: Schema = { properties: 'text' };

    expect(cloneInputSchema(withArray)).toEqual({ properties: [{ type: 'string' }] });
    expect(cloneInputSchema(withString)).toEqual({ properties: 'text' });
  });

  it('treats a property named enum or default as a schema', () => {
    const source: Schema = {
      properties: {
        enum: { __$validated: true, type: 'string' },
        default: { __$compiled: 1, type: 'string' },
      },
    };

    expect(cloneInputSchema(source)).toEqual({
      properties: { enum: { type: 'string' }, default: { type: 'string' } },
    });
  });

  it.each(['enum', 'const', 'default', 'examples'])('copies %s as it is at any depth', (keyword) => {
    const value = [{ __$validated: true, nested: { __$compiled: 1, list: [{ __$resourceRoot: 2 }] } }];
    const source: Schema = { [keyword]: value };
    const result = cloneInputSchema(source);

    expect(result).toEqual(source);
    expect(Object.values(result)[0]).not.toBe(value);
  });

  it('gives an object used as default and as a property one clone for each', () => {
    const shared: Schema = { __$validated: true, type: 'string' };
    const result = cloneInputSchema({ default: shared, properties: { a: shared } });

    expect(result).toEqual({
      default: { __$validated: true, type: 'string' },
      properties: { a: { type: 'string' } },
    });
    expect(result.default).not.toBe(result.properties?.a);
  });

  it('gives an object used as a map and as a schema one clone for each', () => {
    const shared: Schema = { __$compiled: { type: 'string' } };
    const source: Schema = { properties: shared, not: shared };
    const result = cloneInputSchema(source);

    expect(result).toEqual({ properties: { __$compiled: { type: 'string' } }, not: {} });
    expect(result.properties).not.toBe(result.not);
  });

  it('terminates on a cycle through default and keeps the cycle', () => {
    const source: Schema = { type: 'object' };
    source.default = { inner: source };
    const result = cloneInputSchema(source);
    const data = (result.default as { inner: { default: { inner: unknown } } }).inner;

    expect(data).not.toBe(result);
    expect(data).not.toBe(source);
    expect(data.default.inner).toBe(data);
  });
});
