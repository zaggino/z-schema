export type WHAT_IS =
  | 'undefined'
  | 'null'
  | 'object'
  | 'array'
  | 'integer'
  | 'number'
  | 'string'
  | 'not-a-number'
  | 'unknown-number'
  | 'bigint'
  | 'boolean'
  | 'symbol'
  | 'function';

export const whatIs = (what: unknown): WHAT_IS => {
  if (typeof what === 'object') {
    if (what === null) {
      return 'null';
    }
    if (Array.isArray(what)) {
      return 'array';
    }
    return 'object'; // typeof what === 'object' && what === Object(what) && !Array.isArray(what);
  }

  if (typeof what === 'number') {
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

  return typeof what; // undefined, boolean, string, function
};

export function isObject(value: unknown): value is Record<any, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value % 1 === 0;
}
