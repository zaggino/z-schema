import { describe, expect, it } from 'vitest';

import { isUniqueArray } from '../../src/utils/array.ts';

describe('isUniqueArray', () => {
  // --- empty / trivial ---
  it('should return true for empty array', () => {
    expect(isUniqueArray([])).toBe(true);
  });

  it('should return true for single-element array', () => {
    expect(isUniqueArray([1])).toBe(true);
  });

  // --- primitives (fast path) ---
  it('should return true for unique numbers', () => {
    expect(isUniqueArray([1, 2, 3, 4, 5])).toBe(true);
  });

  it('should detect duplicate numbers', () => {
    expect(isUniqueArray([1, 2, 3, 2])).toBe(false);
  });

  it('should return true for unique strings', () => {
    expect(isUniqueArray(['a', 'b', 'c'])).toBe(true);
  });

  it('should detect duplicate strings', () => {
    expect(isUniqueArray(['a', 'b', 'a'])).toBe(false);
  });

  it('should return true for unique booleans', () => {
    expect(isUniqueArray([true, false])).toBe(true);
  });

  it('should detect duplicate booleans', () => {
    expect(isUniqueArray([true, true])).toBe(false);
  });

  it('should return true for unique nulls mixed with other primitives', () => {
    expect(isUniqueArray([null, 0, false, ''])).toBe(true);
  });

  it('should detect duplicate nulls', () => {
    expect(isUniqueArray([null, 1, null])).toBe(false);
  });

  it('should distinguish between types with same string representation', () => {
    // 1 (number) vs '1' (string) vs true (boolean) — all different
    expect(isUniqueArray([1, '1', true])).toBe(true);
  });

  it('should distinguish 0, false, null, and empty string', () => {
    expect(isUniqueArray([0, false, null, ''])).toBe(true);
  });

  // --- objects/arrays (slow path) ---
  it('should return true for unique objects', () => {
    expect(isUniqueArray([{ a: 1 }, { a: 2 }, { b: 1 }])).toBe(true);
  });

  it('should detect duplicate objects', () => {
    expect(isUniqueArray([{ a: 1 }, { a: 1 }])).toBe(false);
  });

  it('should return true for unique arrays', () => {
    expect(isUniqueArray([[1, 2], [1, 3], [2]])).toBe(true);
  });

  it('should detect duplicate arrays', () => {
    expect(isUniqueArray([[1, 2], [3], [1, 2]])).toBe(false);
  });

  it('should detect duplicates in mixed primitive and object arrays', () => {
    expect(isUniqueArray([1, { a: 1 }, { a: 1 }])).toBe(false);
  });

  it('should return true for mixed unique primitive and object arrays', () => {
    expect(isUniqueArray([1, 'hello', { a: 1 }, [1, 2]])).toBe(true);
  });

  it('should detect deeply nested duplicate objects', () => {
    expect(isUniqueArray([{ a: { b: { c: 1 } } }, { a: { b: { c: 1 } } }])).toBe(false);
  });

  it('should distinguish objects with different key order', () => {
    // areEqual treats { a: 1, b: 2 } and { b: 2, a: 1 } as equal (uses sortedKeys)
    expect(
      isUniqueArray([
        { a: 1, b: 2 },
        { b: 2, a: 1 },
      ])
    ).toBe(false);
  });

  // --- indexes parameter ---
  it('should populate indexes for duplicate primitives', () => {
    const indexes: number[] = [];
    expect(isUniqueArray([10, 20, 30, 20], indexes)).toBe(false);
    expect(indexes).toEqual([1, 3]);
  });

  it('should populate indexes for duplicate objects', () => {
    const indexes: number[] = [];
    expect(isUniqueArray([{ x: 1 }, { x: 2 }, { x: 1 }], indexes)).toBe(false);
    expect(indexes).toEqual([0, 2]);
  });

  it('should not populate indexes when array is unique', () => {
    const indexes: number[] = [];
    expect(isUniqueArray([1, 2, 3], indexes)).toBe(true);
    expect(indexes).toEqual([]);
  });

  // --- large arrays (fast path performance validation) ---
  it('should handle large unique primitive arrays efficiently', () => {
    const arr = Array.from({ length: 10_000 }, (_, i) => i);
    expect(isUniqueArray(arr)).toBe(true);
  });

  it('should detect duplicate at end of large primitive array', () => {
    const arr = Array.from({ length: 10_000 }, (_, i) => i);
    arr.push(0); // duplicate of first element
    const indexes: number[] = [];
    expect(isUniqueArray(arr, indexes)).toBe(false);
    expect(indexes).toEqual([0, 10_000]);
  });
});
