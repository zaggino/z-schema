export function copyProp(from: object, to: object, key: string | number | symbol, fn?: <T>(obj: T) => T) {
  if (Object.hasOwn(from, key)) {
    Object.defineProperty(to, key, {
      value: fn ? fn((from as any)[key]) : (from as any)[key],
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
}
