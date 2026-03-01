import { DEFAULT_MAX_RECURSION_DEPTH } from './constants.js';
import { copyProp } from './properties.js';

export const shallowClone = <T>(src: T): T => {
  if (src == null || typeof src !== 'object') {
    return src;
  }
  let res: any;
  if (Array.isArray(src)) {
    res = [];
    for (let i = 0; i < src.length; i++) {
      res[i] = src[i];
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
    const cidx = visited.get(src);

    if (cidx !== undefined) {
      return cloned[cidx];
    }

    visited.set(src, vidx++);
    if (Array.isArray(src)) {
      res = [];
      cloned.push(res);
      for (let i = 0; i < src.length; i++) {
        res[i] = cloneDeepInner(src[i], _depth + 1);
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
