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

export const deepClone = <T>(src: T): T => {
  let vidx = 0;
  const visited = new Map();
  const cloned: any[] = [];
  const cloneDeepInner = <T>(src: T): T => {
    if (typeof src !== 'object' || src === null) {
      return src;
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
        res[idx] = cloneDeepInner(src[idx]);
      }
    } else {
      res = {};
      cloned.push(res);
      const keys = Object.keys(src).sort() as Array<keyof T>;
      for (const key of keys) {
        copyProp(src, res, key, cloneDeepInner);
      }
    }
    return res;
  };
  return cloneDeepInner(src);
};
