export const deepClone = (src) => {
  let vidx = 0;
  const visited = new Map();
  const cloned = [];
  const cloneDeepInner = (src) => {
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
  };
  return cloneDeepInner(src);
};
