/**
 *
 * @param {string} uri
 *
 * @returns {boolean}
 */
export const isRelativeUri = (uri) =>
  // relative URIs that end with a hash sign, issue #56
  /.+#/.test(uri);
