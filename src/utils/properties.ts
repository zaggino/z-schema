/** Sets `key` on `to` as an own enumerable data property. Unlike an assignment, an own `__proto__` key stays a key. */
export function defineOwn(to: object, key: PropertyKey, value: unknown): void {
  Object.defineProperty(to, key, { value, enumerable: true, writable: true, configurable: true });
}

export function copyProp(from: object, to: object, key: string | number | symbol, fn?: (value: unknown) => unknown) {
  if (Object.hasOwn(from, key)) {
    const value = (from as Record<PropertyKey, unknown>)[key];
    defineOwn(to, key, fn ? fn(value) : value);
  }
}

/**
 * Creates a dictionary for keys that come from a schema or a caller: it has no prototype, so every key, including
 * `constructor` or `__proto__`, is either an entry of its own or absent.
 */
export const createDict = <V>(entries?: Record<string, V>): Record<string, V> =>
  Object.assign(Object.create(null) as Record<string, V>, entries);
