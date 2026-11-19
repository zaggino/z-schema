import { describe, expect, it } from 'vitest';

import { cloneInputSchema } from '../../src/json-schema.ts';
import { deepClone } from '../../src/utils/clone.ts';

const clones = [
  ['deepClone', deepClone],
  ['cloneInputSchema', cloneInputSchema],
] as const;

const RESERVED_NAMES = [
  '__$compiled',
  '__$missingReferences',
  '__$refResolved',
  '__$dynamicRefResolved',
  '__$recursiveRefResolved',
  '__$resourceRoot',
  '__$schemaResolved',
  '__$validated',
  '__$validationOptions',
];

const MAP_KEYWORDS = [
  '$defs',
  'definitions',
  'dependencies',
  'dependentRequired',
  'dependentSchemas',
  'patternProperties',
  'properties',
];

const deepFreeze = <T>(value: T): T => {
  if (typeof value === 'object' && value !== null) {
    Object.freeze(value);
    const children = Object.values(value);
    for (let i = 0; i < children.length; i++) {
      deepFreeze(children[i]);
    }
  }
  return value;
};

// An object with `count` nested levels: the innermost one sits at depth count - 1.
const nest = (count: number): Record<string, unknown> => {
  const root: Record<string, unknown> = {};
  let current = root;
  for (let i = 1; i < count; i++) {
    const next: Record<string, unknown> = {};
    current.not = next;
    current = next;
  }
  return root;
};

describe.each(clones)('%s', (_name, clone) => {
  it('returns primitives, null and undefined as they are', () => {
    expect(clone(null)).toBe(null);
    // eslint-disable-next-line unicorn/no-useless-undefined, typescript/no-confusing-void-expression -- explicitly testing the undefined input value
    expect(clone(undefined)).toBe(undefined);
    expect(clone(42)).toBe(42);
    expect(clone('text')).toBe('text');
    expect(clone(true)).toBe(true);
  });

  it('creates a different object at every level, arrays included', () => {
    const source = { a: { b: { c: 1 } }, list: [{ d: 1 }, [2]] };
    const result = clone(source);

    expect(result).toEqual(source);
    expect(result).not.toBe(source);
    expect(result.a).not.toBe(source.a);
    expect(result.a.b).not.toBe(source.a.b);
    expect(result.list).not.toBe(source.list);
    expect(result.list[0]).not.toBe(source.list[0]);
    expect(result.list[1]).not.toBe(source.list[1]);
  });

  it('sorts keys at every level', () => {
    const result = clone({
      z: { c: 3, a: 1, b: 2 },
      a: 1,
      m: [{ z: 1, a: 2 }],
    });

    expect(Object.keys(result)).toEqual(['a', 'm', 'z']);
    expect(Object.keys(result.z)).toEqual(['a', 'b', 'c']);
    expect(Object.keys(result.m[0])).toEqual(['a', 'z']);
  });

  it('clones an object reached twice once', () => {
    const shared = { type: 'string' };
    const result = clone({ allOf: [shared, shared] });

    expect(result.allOf[0]).toBe(result.allOf[1]);
    expect(result.allOf[0]).not.toBe(shared);
    expect(result.allOf[0]).toEqual(shared);
  });

  it('keeps a cycle', () => {
    const source: Record<string, unknown> = { type: 'object' };
    source.not = source;
    const result = clone(source);

    expect(result).not.toBe(source);
    expect(result.not).toBe(result);
  });

  it('keeps an own __proto__ key as an own key', () => {
    const source = JSON.parse('{"__proto__": {"x": 1}}') as Record<string, unknown>;
    const result = clone(source);

    expect(Object.hasOwn(result, '__proto__')).toBe(true);
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(result.x).toBeUndefined();
  });

  it('throws past maxDepth and accepts nesting up to it', () => {
    const message =
      'Maximum recursion depth (5) exceeded in deepClone. ' +
      'If your schema or data is deeply nested and valid, increase the maxRecursionDepth option.';

    expect(() => clone(nest(6), 5)).toThrow(message);
    expect(() => clone(nest(5), 5)).not.toThrow();
  });

  it('does not modify the source', () => {
    const source = {
      type: 'object',
      properties: { a: { enum: [{ b: 1 }], items: [{ c: 2 }] } },
      required: ['a'],
    };
    const before = structuredClone(source);
    deepFreeze(source);

    clone(source);

    expect(source).toEqual(before);
  });
});

describe('cloneInputSchema and deepClone agree on schemas without reserved keys', () => {
  const schemas: Array<[string, unknown]> = [
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
  it.each(RESERVED_NAMES)('drops %s at the root and keeps the other keys', (name) => {
    const result = cloneInputSchema({ type: 'string', minLength: 1, [name]: { x: 1 } });

    expect(result).toEqual({ type: 'string', minLength: 1 });
    expect(Object.hasOwn(result, name)).toBe(false);
  });

  it('drops any name with the prefix, including the bare prefix', () => {
    const result = cloneInputSchema({ __$anything: 1, __$: 2, type: 'string' });

    expect(result).toEqual({ type: 'string' });
  });

  it('keeps names that only look similar to the prefix', () => {
    const source = { __x: 1, _$x: 2, $__x: 3 };

    expect(cloneInputSchema(source)).toEqual(source);
  });

  it.each([
    ['properties.a', () => ({ properties: { a: { __$validated: true, type: 'string' } } })],
    ['items', () => ({ items: { __$validated: true, type: 'string' } })],
    ['an items array element', () => ({ items: [{ __$validated: true, type: 'string' }] })],
    ['allOf[0]', () => ({ allOf: [{ __$validated: true, type: 'string' }] })],
    ['not', () => ({ not: { __$validated: true, type: 'string' } })],
    ['additionalProperties', () => ({ additionalProperties: { __$validated: true, type: 'string' } })],
    ['a value inside $defs', () => ({ $defs: { d: { __$validated: true, type: 'string' } } })],
    ['the value of an unknown keyword', () => ({ 'x-meta': { __$validated: true, type: 'string' } })],
    [
      'an object nested two levels inside an unknown keyword',
      () => ({ 'x-meta': { a: { b: { __$validated: true } } } }),
    ],
    ['an array nested in an array under anyOf', () => ({ anyOf: [[{ __$validated: true, type: 'string' }]] })],
  ])('drops reserved keys at %s', (_label, make) => {
    const source = make();
    const before = structuredClone(source);
    // The source without the reserved key, everything else in place.
    const expected: unknown = JSON.parse(
      JSON.stringify(source, (key, value: unknown) => (key === '__$validated' ? undefined : value))
    );
    const result = cloneInputSchema(source);

    expect(result).toEqual(expected);
    expect(JSON.stringify(result)).not.toContain('__$validated');
    expect(source).toEqual(before);
  });
});

describe('cloneInputSchema keeps names and data', () => {
  it.each(MAP_KEYWORDS)('keeps a prefixed name inside %s and drops reserved keys under it', (keyword) => {
    const result = cloneInputSchema({
      [keyword]: { __$compiled: { type: 'string', __$validated: true } },
    }) as Record<string, Record<string, unknown>>;

    expect(result[keyword]).toEqual({ __$compiled: { type: 'string' } });
  });

  it('clones dependencies and dependentRequired with array values intact', () => {
    const source = { dependencies: { a: ['b', 'c'] }, dependentRequired: { d: ['e'] } };
    const result = cloneInputSchema(source);

    expect(result).toEqual(source);
    expect(result.dependencies.a).not.toBe(source.dependencies.a);
  });

  it('does not throw when a map keyword holds an array or a string', () => {
    const withArray = cloneInputSchema({ properties: [{ __$validated: true, type: 'string' }] });
    const withString = cloneInputSchema({ properties: 'text' });

    expect(withArray).toEqual({ properties: [{ type: 'string' }] });
    expect(withString).toEqual({ properties: 'text' });
  });

  it('treats a property named enum or default as a schema', () => {
    const result = cloneInputSchema({
      properties: {
        enum: { __$validated: true, type: 'string' },
        default: { __$compiled: 1, type: 'string' },
      },
    });

    expect(result).toEqual({ properties: { enum: { type: 'string' }, default: { type: 'string' } } });
  });

  it.each(['enum', 'const', 'default', 'examples'])('copies %s as it is at any depth', (keyword) => {
    const value = [{ __$validated: true, nested: { __$compiled: 1, list: [{ __$resourceRoot: 2 }] } }];
    const source = { [keyword]: value };
    const result = cloneInputSchema(source) as Record<string, unknown>;

    expect(result).toEqual(source);
    expect(result[keyword]).not.toBe(value);
  });

  it('gives an object used as default and as a property one clone for each', () => {
    const shared = { __$validated: true, type: 'string' };
    const result = cloneInputSchema({ default: shared, properties: { a: shared } }) as {
      default: Record<string, unknown>;
      properties: { a: Record<string, unknown> };
    };

    expect(result.default).not.toBe(result.properties.a);
    expect(result.default).toEqual({ __$validated: true, type: 'string' });
    expect(result.properties.a).toEqual({ type: 'string' });
  });

  it('terminates on a cycle through default and keeps the cycle', () => {
    const source: Record<string, unknown> = { type: 'object' };
    source.default = { inner: source };
    const result = cloneInputSchema(source) as { default: { inner: unknown } };

    expect(result.default.inner).toBeDefined();
    expect(result.default.inner).not.toBe(source);
    const data = result.default.inner as { default: { inner: unknown } };
    expect(data.default.inner).toBe(data);
  });
});
