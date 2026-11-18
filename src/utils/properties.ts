export function copyProp(from: object, to: object, key: string | number | symbol, fn?: (value: unknown) => unknown) {
  if (Object.hasOwn(from, key)) {
    Object.defineProperty(to, key, {
      value: fn ? fn((from as Record<PropertyKey, unknown>)[key]) : (from as Record<PropertyKey, unknown>)[key],
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
}

/**
 * Creates a dictionary for keys that come from a schema or a caller: it has no prototype, so every key, including
 * `constructor` or `__proto__`, is either an entry of its own or absent.
 */
export const createDict = <V>(entries?: Record<string, V>): Record<string, V> =>
  Object.assign(Object.create(null) as Record<string, V>, entries);
