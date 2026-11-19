import { DEFAULT_MAX_RECURSION_DEPTH } from './constants.js';
import { isObject } from './what-is.js';

interface AreEqualOptions {
  caseInsensitiveComparison?: boolean;
  maxDepth?: number;
}

export const sortedKeys = (obj: Record<string, unknown>): string[] => Object.keys(obj).sort();

// `writeKey` in ./array.ts writes values in the order this function compares them and repeats its depth checks.
// Change the two together.
export const areEqual = (json1: unknown, json2: unknown, options?: AreEqualOptions, _depth = 0): boolean => {
  const caseInsensitiveComparison = options?.caseInsensitiveComparison || false;
  const maxDepth = options?.maxDepth ?? DEFAULT_MAX_RECURSION_DEPTH;

  // http://json-schema.org/latest/json-schema-core.html#rfc.section.3.6

  // Two JSON values are said to be equal if and only if:
  // both are nulls; or
  // both are booleans, and have the same value; or
  // both are strings, and have the same value; or
  // both are numbers, and have the same mathematical value; or
  if (json1 === json2) {
    return true;
  }
  if (
    caseInsensitiveComparison &&
    typeof json1 === 'string' &&
    typeof json2 === 'string' &&
    json1.toUpperCase() === json2.toUpperCase()
  ) {
    return true;
  }

  if (_depth >= maxDepth) {
    throw new Error(
      `Maximum recursion depth (${maxDepth}) exceeded in areEqual. ` +
        'If your data is deeply nested and valid, increase the maxRecursionDepth option.'
    );
  }

  let i;
  let len;

  // both are arrays, and:
  if (Array.isArray(json1) && Array.isArray(json2)) {
    // have the same number of items; and
    if (json1.length !== json2.length) {
      return false;
    }
    // items at the same index are equal according to this definition; or
    len = json1.length;
    for (i = 0; i < len; i++) {
      if (!areEqual(json1[i], json2[i], options, _depth + 1)) {
        return false;
      }
    }
    return true;
  }

  // both are objects, and:
  if (isObject(json1) && isObject(json2)) {
    // have the same set of property names; and
    const keys1 = sortedKeys(json1 as Record<string, unknown>);
    const keys2 = sortedKeys(json2 as Record<string, unknown>);
    if (!areEqual(keys1, keys2, options, _depth + 1)) {
      return false;
    }
    // values for a same property name are equal according to this definition.
    len = keys1.length;
    for (i = 0; i < len; i++) {
      if (!areEqual(json1[keys1[i]], json2[keys1[i]], options, _depth + 1)) {
        return false;
      }
    }
    return true;
  }

  return false;
};

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
