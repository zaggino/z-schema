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
    const keys = Object.keys(src) as Array<keyof T>;
    idx = keys.length;
    while (idx--) {
      const key = keys[idx];
      res[key] = src[key];
    }
  }
  return res;
};
