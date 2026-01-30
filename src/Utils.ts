export const jsonSymbol = Symbol.for('z-schema/json');

export const schemaSymbol = Symbol.for('z-schema/schema');

/**
 * @param {object} obj
 *
 * @returns {string[]}
 */
export function sortedKeys(obj) {
  return Object.keys(obj).sort();
}

/**
 *
 * @param {string} uri
 *
 * @returns {boolean}
 */
export function isAbsoluteUri(uri) {
  return /^https?:\/\//.test(uri);
}

/**
 *
 * @param {string} uri
 *
 * @returns {boolean}
 */
export function isRelativeUri(uri) {
  // relative URIs that end with a hash sign, issue #56
  return /.+#/.test(uri);
}

export function whatIs(what) {
  const to = typeof what;

  if (to === 'object') {
    if (what === null) {
      return 'null';
    }
    if (Array.isArray(what)) {
      return 'array';
    }
    return 'object'; // typeof what === 'object' && what === Object(what) && !Array.isArray(what);
  }

  if (to === 'number') {
    if (Number.isFinite(what)) {
      if (what % 1 === 0) {
        return 'integer';
      } else {
        return 'number';
      }
    }
    if (Number.isNaN(what)) {
      return 'not-a-number';
    }
    return 'unknown-number';
  }

  return to; // undefined, boolean, string, function
}

/**
 *
 * @param {*} json1
 * @param {*} json2
 * @param {*} [options]
 *
 * @returns {boolean}
 */
export function areEqual(json1, json2, options?) {
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
    const keys1 = sortedKeys(json1);
    const keys2 = sortedKeys(json2);
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
}

/**
 *
 * @param {*[]} arr
 * @param {number[]} [indexes]
 *
 * @returns {boolean}
 */
export function isUniqueArray(arr, indexes?) {
  let i;
  let j;
  const l = arr.length;
  for (i = 0; i < l; i++) {
    for (j = i + 1; j < l; j++) {
      if (areEqual(arr[i], arr[j])) {
        if (indexes) {
          indexes.push(i, j);
        }
        return false;
      }
    }
  }
  return true;
}

/**
 *
 * @param {*} bigSet
 * @param {*} subSet
 *
 * @returns {*[]}
 */
export function difference(bigSet, subSet) {
  const arr = [];
  let idx = bigSet.length;
  while (idx--) {
    if (subSet.indexOf(bigSet[idx]) === -1) {
      arr.push(bigSet[idx]);
    }
  }
  return arr;
}

// NOT a deep version of clone
export function clone(src) {
  if (typeof src === 'undefined') {
    return void 0;
  }
  if (typeof src !== 'object' || src === null) {
    return src;
  }
  let res, idx;
  if (Array.isArray(src)) {
    res = [];
    idx = src.length;
    while (idx--) {
      res[idx] = src[idx];
    }
  } else {
    res = {};
    const keys = Object.keys(src);
    idx = keys.length;
    while (idx--) {
      const key = keys[idx];
      res[key] = src[key];
    }
  }
  return res;
}

export function cloneDeep(src) {
  let vidx = 0;
  const visited = new Map();
  const cloned = [];
  function cloneDeepInner(src) {
    if (typeof src !== 'object' || src === null) {
      return src;
    }

    let res;
    let idx;
    const cidx = visited.get(src);

    if (cidx !== undefined) {
      return cloned[cidx];
    }

    visited.set(src, vidx++);
    if (Array.isArray(src)) {
      res = [];
      cloned.push(res);
      idx = src.length;
      while (idx--) {
        res[idx] = cloneDeepInner(src[idx]);
      }
    } else {
      res = {};
      cloned.push(res);
      const keys = Object.keys(src);
      idx = keys.length;
      while (idx--) {
        const key = keys[idx];
        res[key] = cloneDeepInner(src[key]);
      }
    }
    return res;
  }
  return cloneDeepInner(src);
}

/*
  following function comes from punycode.js library
  see: https://github.com/bestiejs/punycode.js
*/
/**
 * Creates an array containing the numeric code points of each Unicode
 * character in the string. While JavaScript uses UCS-2 internally,
 * this function will convert a pair of surrogate halves (each of which
 * UCS-2 exposes as separate characters) into a single code point,
 * matching UTF-16.
 * @see `punycode.ucs2.encode`
 * @see <https://mathiasbynens.be/notes/javascript-encoding>
 * @memberOf punycode.ucs2
 * @name decode
 * @param {String} string The Unicode input string (UCS-2).
 * @returns {Array} The new array of code points.
 */
export function ucs2decode(string) {
  const output = [];
  let counter = 0;
  const length = string.length;
  let value;
  let extra;
  while (counter < length) {
    value = string.charCodeAt(counter++);
    if (value >= 0xd800 && value <= 0xdbff && counter < length) {
      // high surrogate, and there is a next character
      extra = string.charCodeAt(counter++);
      if ((extra & 0xfc00) == 0xdc00) {
        // low surrogate
        output.push(((value & 0x3ff) << 10) + (extra & 0x3ff) + 0x10000);
      } else {
        // unmatched surrogate; only append this code unit, in case the next
        // code unit is the high surrogate of a surrogate pair
        output.push(value);
        counter--;
      }
    } else {
      output.push(value);
    }
  }
  return output;
}
