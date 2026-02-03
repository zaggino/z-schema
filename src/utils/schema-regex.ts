// Shared regex compilation helper for JSON Schema patterns
// Returns { ok: true, value: RegExp } or { ok: false, error: { pattern, message } }

export function compileSchemaRegex(
  pattern: string
): { ok: true; value: RegExp } | { ok: false; error: { pattern: string; message: string } } {
  // Detect Unicode property escapes
  const unicodeEscape = /\\[pP]{/;
  const needsUnicode = unicodeEscape.test(pattern);
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
