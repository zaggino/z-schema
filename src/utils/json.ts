export const sortedKeys = (obj: Record<string, unknown>): string[] => Object.keys(obj).sort();

export const decodeJSONPointer = (str: string) =>
  decodeURIComponent(str).replaceAll(/~[0-1]/g, (x) => (x === '~1' ? '/' : '~'));

/**
 * `obj[key]` when `obj` is an object or array and `key` is one of its own properties, otherwise `undefined`.
 * Never follows the prototype chain and never descends into a function or a primitive.
 *
 * Every walk over a schema that is driven by a caller- or schema-supplied key must step through this: z-schema
 * attaches internal state to the nodes such a walk returns, so neither an inherited `__proto__` / `constructor`
 * nor a function's own `prototype` may lead it to a shared built-in object (CWE-1321).
 */
export const getOwn = (obj: unknown, key: string | number): unknown =>
  typeof obj === 'object' && obj !== null && Object.hasOwn(obj, key)
    ? (obj as Record<string | number, unknown>)[key]
    : undefined;

/**
 * Reads the value at `path` (dot-separated string or array of segments) in `obj`, following own properties only.
 * Returns `undefined` when a segment is missing, inherited, or reached through anything but an object or array.
 */
export const get = (obj: unknown, path: string | Array<string | number>): unknown => {
  if (typeof path === 'string') {
    path = path.split('.');
  }
  let acc: unknown = obj;
  for (let i = 0; i < path.length; i++) {
    acc = getOwn(acc, path[i]);
    if (acc === undefined) {
      return undefined;
    }
  }
  return acc;
};
