import { DEFAULT_MAX_RECURSION_DEPTH } from '../z-schema-options.js';
import { copyProp } from './properties.js';

export const shallowClone = <T>(src: T): T => {
  if (src == null || typeof src !== 'object') {
    return src;
  }
  let res: any;
  let idx;
  if (Array.isArray(src)) {
    res = [];
    idx = src.length;
    while (idx--) {
      res[idx] = src[idx];
    }
  } else {
    res = {};
    const keys = Object.keys(src).sort() as Array<keyof T>;
    for (const key of keys) {
      copyProp(src, res, key);
    }
  }
  return res;
};

export const deepClone = <T>(src: T, maxDepth = DEFAULT_MAX_RECURSION_DEPTH): T => {
  let vidx = 0;
  const visited = new Map();
  const cloned: any[] = [];
  const cloneDeepInner = <T>(src: T, _depth: number): T => {
    if (typeof src !== 'object' || src === null) {
      return src;
    }

    if (_depth >= maxDepth) {
      throw new Error(
        `Maximum recursion depth (${maxDepth}) exceeded in deepClone. ` +
          'If your schema or data is deeply nested and valid, increase the maxRecursionDepth option.'
      );
    }

    let res: any;
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
        res[idx] = cloneDeepInner(src[idx], _depth + 1);
      }
    } else {
      res = {};
      cloned.push(res);
      const keys = Object.keys(src).sort() as Array<keyof T>;
      for (const key of keys) {
        copyProp(src, res, key, (v: any) => cloneDeepInner(v, _depth + 1));
      }
    }
    return res;
  };
  return cloneDeepInner(src, 0);
};
