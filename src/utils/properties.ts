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
