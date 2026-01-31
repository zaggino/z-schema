import { whatIs } from './what-is.js';
import { sortedKeys } from './sorted-keys.js';

interface AreEqualOptions {
  caseInsensitiveComparison?: boolean;
}

export const areEqual = (json1: unknown, json2: unknown, options?: AreEqualOptions): boolean => {
  options = options || {};
  const caseInsensitiveComparison = options.caseInsensitiveComparison || false;

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
    caseInsensitiveComparison === true &&
    typeof json1 === 'string' &&
    typeof json2 === 'string' &&
    json1.toUpperCase() === json2.toUpperCase()
  ) {
    return true;
  }

  let i, len;

  // both are arrays, and:
  if (Array.isArray(json1) && Array.isArray(json2)) {
    // have the same number of items; and
    if (json1.length !== json2.length) {
      return false;
    }
    // items at the same index are equal according to this definition; or
    len = json1.length;
    for (i = 0; i < len; i++) {
      if (!areEqual(json1[i], json2[i], { caseInsensitiveComparison: caseInsensitiveComparison })) {
        return false;
      }
    }
    return true;
  }

  // both are objects, and:
  if (whatIs(json1) === 'object' && whatIs(json2) === 'object') {
    // have the same set of property names; and
    const keys1 = sortedKeys(json1 as Record<string, unknown>);
    const keys2 = sortedKeys(json2 as Record<string, unknown>);
    if (!areEqual(keys1, keys2, { caseInsensitiveComparison: caseInsensitiveComparison })) {
      return false;
    }
    // values for a same property name are equal according to this definition.
    len = keys1.length;
    for (i = 0; i < len; i++) {
      if (!areEqual(json1[keys1[i]], json2[keys1[i]], { caseInsensitiveComparison: caseInsensitiveComparison })) {
        return false;
      }
    }
    return true;
  }

  return false;
};
