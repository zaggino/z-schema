import { describe, expect, it } from 'vitest';

import { deepClone, shallowClone } from '../../src/utils/clone.ts';
import { deepFreeze, nest } from '../lib/object-helpers.ts';

describe('shallowClone', () => {
  it('should return primitive values unchanged', () => {
    expect(shallowClone(null)).toBe(null);
    // eslint-disable-next-line unicorn/no-useless-undefined, typescript/no-confusing-void-expression -- explicitly testing the undefined input value
    expect(shallowClone(undefined)).toBe(undefined);
    expect(shallowClone(42)).toBe(42);
    expect(shallowClone('hello')).toBe('hello');
    expect(shallowClone(true)).toBe(true);
    expect(shallowClone(false)).toBe(false);
  });

  it('should clone arrays', () => {
    const original = [1, 2, 3, { a: 1 }];
    const cloned = shallowClone(original);

    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
    expect(cloned[3]).toBe(original[3]); // shallow clone
  });

  it('should clone objects and sort keys', () => {
    const original = { z: 3, a: 1, m: 2 };
    const cloned = shallowClone(original);

    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
    expect(Object.keys(cloned)).toEqual(['a', 'm', 'z']); // keys should be sorted
  });

  it('should handle nested objects (shallow)', () => {
    const original = { a: { b: 1 }, c: 2 };
    const cloned = shallowClone(original);

    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
    expect(cloned.a).toBe(original.a); // shallow clone
  });

  it('should handle empty objects and arrays', () => {
    expect(shallowClone({})).toEqual({});
    expect(shallowClone([])).toEqual([]);
  });
});

describe('deepClone', () => {
  it('should return primitive values unchanged', () => {
    expect(deepClone(null)).toBe(null);
    // eslint-disable-next-line unicorn/no-useless-undefined, typescript/no-confusing-void-expression -- explicitly testing the undefined input value
    expect(deepClone(undefined)).toBe(undefined);
    expect(deepClone(42)).toBe(42);
    expect(deepClone('hello')).toBe('hello');
    expect(deepClone(true)).toBe(true);
    expect(deepClone(false)).toBe(false);
  });

  it('should deeply clone arrays', () => {
    const original = [1, 2, 3, { a: 1 }];
    const cloned = deepClone(original);

    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
    expect(cloned[3]).not.toBe(original[3]); // deep clone
    expect(cloned[3]).toEqual(original[3]);
  });

  it('should deeply clone objects and sort keys', () => {
    const original = { z: 3, a: 1, m: 2 };
    const cloned = deepClone(original);

    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
    expect(Object.keys(cloned)).toEqual(['a', 'm', 'z']); // keys should be sorted
  });

  it('should handle deeply nested objects', () => {
    const original = { a: { b: { c: 1 } }, d: [1, { e: 2 }] };
    const cloned = deepClone(original);

    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
    expect(cloned.a).not.toBe(original.a);
    expect(cloned.a.b).not.toBe(original.a.b);
    expect(cloned.d).not.toBe(original.d);
    expect(cloned.d[1]).not.toBe(original.d[1]);
  });

  it('should handle circular references', () => {
    const original: any = { a: 1 };
    original.self = original;
    const cloned = deepClone(original);

    expect(cloned.a).toBe(1);
    expect(cloned.self).toBe(cloned); // circular reference preserved
  });

  it('should handle empty objects and arrays', () => {
    expect(deepClone({})).toEqual({});
    expect(deepClone([])).toEqual([]);
  });

  it('should sort keys in nested objects', () => {
    const original = {
      z: { c: 3, a: 1, b: 2 },
      a: 1,
      m: [1, { z: 1, a: 2 }],
    };
    const cloned = deepClone(original);

    expect(Object.keys(cloned)).toEqual(['a', 'm', 'z']);
    expect(Object.keys(cloned.z)).toEqual(['a', 'b', 'c']);
    expect(Object.keys(cloned.m[1])).toEqual(['a', 'z']);
  });

  it('should clone an object reached twice once', () => {
    const shared = { type: 'string' };
    const result = deepClone({ allOf: [shared, shared] });

    expect(result.allOf[0]).toBe(result.allOf[1]);
    expect(result.allOf[0]).not.toBe(shared);
    expect(result.allOf[0]).toEqual(shared);
  });

  it('should keep an own __proto__ key as an own key', () => {
    const source = JSON.parse('{"__proto__": {"x": 1}}') as Record<string, unknown>;
    const result = deepClone(source);

    expect(Object.hasOwn(result, '__proto__')).toBe(true);
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(result.x).toBeUndefined();
  });

  it('should throw past maxDepth and accept nesting up to it', () => {
    const message =
      'Maximum recursion depth (5) exceeded in deepClone. ' +
      'If your schema or data is deeply nested and valid, increase the maxRecursionDepth option.';

    expect(() => deepClone(nest(6), 5)).toThrow(message);
    expect(() => deepClone(nest(5), 5)).not.toThrow();
  });

  it('should not modify the source', () => {
    const source = {
      type: 'object',
      properties: { a: { enum: [{ b: 1 }], items: [{ c: 2 }] } },
      required: ['a'],
    };
    const before = structuredClone(source);
    deepFreeze(source);

    deepClone(source);

    expect(source).toEqual(before);
  });
});
