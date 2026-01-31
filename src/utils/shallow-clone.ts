// NOT a deep version of clone
export const shallowClone = (src) => {
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
};
