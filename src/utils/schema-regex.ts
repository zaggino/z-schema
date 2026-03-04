// Shared regex compilation helper for JSON Schema patterns
// Returns { ok: true, value: RegExp } or { ok: false, error: { pattern, message } }

import { MAX_SCHEMA_REGEX_LENGTH } from './constants.js';

export function compileSchemaRegex(
  pattern: string
): { ok: true; value: RegExp } | { ok: false; error: { pattern: string; message: string } } {
  if (pattern.length > MAX_SCHEMA_REGEX_LENGTH) {
    return {
      ok: false,
      error: {
        pattern,
        message: `Pattern length ${pattern.length} exceeds maximum allowed length of ${MAX_SCHEMA_REGEX_LENGTH}`,
      },
    };
  }

  const unicodePropertyEscape = /\\[pP]{/;
  const nonBmpCharacter = /[\u{10000}-\u{10FFFF}]/u;
  const surrogatePairEscape = /\\uD[89AB][0-9A-Fa-f]{2}\\uD[CDEF][0-9A-Fa-f]{2}/;
  const needsUnicode =
    unicodePropertyEscape.test(pattern) || nonBmpCharacter.test(pattern) || surrogatePairEscape.test(pattern);
  // Try compiling without 'u' flag if not needed
  if (needsUnicode) {
    // Try compiling with 'u' flag only
    try {
      // lgtm[js/regex-injection] JSON Schema `pattern` is intentionally regex syntax and constrained by MAX_SCHEMA_REGEX_LENGTH.
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
      // lgtm[js/regex-injection] JSON Schema `pattern` is intentionally regex syntax and constrained by MAX_SCHEMA_REGEX_LENGTH.
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
