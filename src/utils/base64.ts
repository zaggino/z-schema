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
