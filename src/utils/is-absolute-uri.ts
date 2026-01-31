/**
 *
 * @param {string} uri
 *
 * @returns {boolean}
 */
export const isAbsoluteUri = (uri) => /^https?:\/\//.test(uri);
