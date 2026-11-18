export const getQueryPath = (uri: string) => {
  const io = uri.indexOf('#');
  const res = io === -1 ? undefined : uri.slice(io + 1);
  // WARN: do not slice slash, #/ means take root and go down from it
  // if (res && res[0] === "/") { res = res.slice(1); }
  return res;
};

export const getRemotePath = (uri: string) => {
  const io = uri.indexOf('#');
  return io === -1 ? uri : uri.slice(0, io);
};

export const isAbsoluteUri = (uri: string): boolean => /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(uri);

export const isRelativeUri = (uri: string): boolean =>
  // relative URIs that end with a hash sign, issue #56
  /.+#/.test(uri);
