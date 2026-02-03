// Safe own-property check utility
// Returns true if the object has the property as its own (not inherited)
export function hasOwn(obj: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

export function copyProp(from: object, to: object, key: string | number | symbol, fn?: <T>(obj: T) => T) {
  if (hasOwn(from, key)) {
    Object.defineProperty(to, key, {
      value: fn ? fn((from as any)[key]) : (from as any)[key],
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
}
