import { DEFAULT_MAX_RECURSION_DEPTH } from './constants.js';
import { copyProp } from './properties.js';

export const shallowClone = <T>(src: T): T => {
  if (src == null || typeof src !== 'object') {
    return src;
  }
  if (Array.isArray(src)) {
    const res: unknown[] = [];
    for (let i = 0; i < src.length; i++) {
      res[i] = src[i];
    }
    return res as T;
  }
  const res: Record<string, unknown> = {};
  const keys = Object.keys(src).sort() as Array<keyof T>;
  for (let i = 0; i < keys.length; i++) {
    copyProp(src, res, keys[i]);
  }
  return res as T;
};

export const deepClone = <T>(src: T, maxDepth = DEFAULT_MAX_RECURSION_DEPTH): T => {
  let vidx = 0;
  const visited = new Map<unknown, number>();
  const cloned: unknown[] = [];
  const cloneDeepInner = <U>(node: U, _depth: number): U => {
    if (typeof node !== 'object' || node === null) {
      return node;
    }

    if (_depth >= maxDepth) {
      throw new Error(
        `Maximum recursion depth (${maxDepth}) exceeded in deepClone. ` +
          'If your schema or data is deeply nested and valid, increase the maxRecursionDepth option.'
      );
    }

    const cidx = visited.get(node);

    if (cidx !== undefined) {
      return cloned[cidx] as U;
    }

    visited.set(node, vidx++);
    if (Array.isArray(node)) {
      const res: unknown[] = [];
      cloned.push(res);
      for (let i = 0; i < node.length; i++) {
        res[i] = cloneDeepInner(node[i], _depth + 1);
      }
      return res as U;
    }
    const res: Record<string, unknown> = {};
    cloned.push(res);
    const keys = Object.keys(node).sort() as Array<keyof U>;
    for (let i = 0; i < keys.length; i++) {
      copyProp(node, res, keys[i], (v: unknown) => cloneDeepInner(v, _depth + 1));
    }
    return res as U;
  };
  return cloneDeepInner(src, 0);
};
