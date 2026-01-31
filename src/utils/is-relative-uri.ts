export const isRelativeUri = (uri: string): boolean =>
  // relative URIs that end with a hash sign, issue #56
  /.+#/.test(uri);
