const base64Pattern = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export const isValidBase64 = (value: string) => {
  if (value.length % 4 !== 0) {
    return false;
  }
  return base64Pattern.test(value);
};

export const decodeBase64 = (value: string): string | undefined => {
  if (!isValidBase64(value)) {
    return undefined;
  }

  if (typeof atob === 'function') {
    try {
      return atob(value);
    } catch {
      return undefined;
    }
  }

  // Node fallback (reached only when `atob` is unavailable, i.e. not a browser).
  // Read `Buffer` off `globalThis` rather than the bare global so it is typed
  // without an untyped global reference; on Node >=22 `Buffer` is always present
  // on `globalThis`. (A bundler polyfill injected as a module-scoped variable but
  // not onto `globalThis` would be missed, but that path is unreachable in browsers
  // where `atob` above is used instead.)
  const bufferCtor = (
    globalThis as {
      Buffer?: { from(data: string, encoding: string): { toString(encoding: string): string } };
    }
  ).Buffer;
  if (bufferCtor !== undefined) {
    try {
      return bufferCtor.from(value, 'base64').toString('utf-8');
    } catch {
      return undefined;
    }
  }

  return undefined;
};
