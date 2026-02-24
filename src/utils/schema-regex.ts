// Shared regex compilation helper for JSON Schema patterns
// Returns { ok: true, value: RegExp } or { ok: false, error: { pattern, message } }

export function compileSchemaRegex(
  pattern: string
): { ok: true; value: RegExp } | { ok: false; error: { pattern: string; message: string } } {
  const unicodePropertyEscape = /\\[pP]{/;
  const nonBmpCharacter = /[\u{10000}-\u{10FFFF}]/u;
  const surrogatePairEscape = /\\uD[89AB][0-9A-Fa-f]{2}\\uD[CDEF][0-9A-Fa-f]{2}/;
  const needsUnicode =
    unicodePropertyEscape.test(pattern) || nonBmpCharacter.test(pattern) || surrogatePairEscape.test(pattern);
  // Try compiling without 'u' flag if not needed
  if (needsUnicode) {
    // Try compiling with 'u' flag only
    try {
      const re = new RegExp(pattern, 'u');
      return { ok: true, value: re };
    } catch (e: any) {
      return {
        ok: false,
        error: {
          pattern,
          message: e && e.message ? e.message : 'Invalid regular expression',
        },
      };
    }
  } else {
    try {
      const re = new RegExp(pattern);
      return { ok: true, value: re };
    } catch (e: any) {
      return {
        ok: false,
        error: {
          pattern,
          message: e && e.message ? e.message : 'Invalid regular expression',
        },
      };
    }
  }
}
