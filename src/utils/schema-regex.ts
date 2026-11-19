// Shared regex compilation helper for JSON Schema patterns
// Returns { ok: true, value: RegExp } or { ok: false, error: { pattern, message } }

import isSafeRegex from 'safe-regex2';

import { MAX_SCHEMA_REGEX_CACHE_SIZE, MAX_SCHEMA_REGEX_LENGTH } from './constants.js';

type CompileSchemaRegexResult =
  | { ok: true; value: RegExp }
  | { ok: false; error: { pattern: string; message: string } };

const unicodePropertyEscape = /\\[pP]{/;
const nonBmpCharacter = /[\u{10000}-\u{10FFFF}]/u;
const surrogatePairEscape = /\\uD[89AB][0-9A-Fa-f]{2}\\uD[CDEF][0-9A-Fa-f]{2}/;

const BACKSLASH = 0x5c;
const LOWERCASE_U = 0x75;
const LEFT_BRACE = 0x7b;
const RIGHT_BRACE = 0x7d;

const isHexDigit = (code: number): boolean =>
  (code >= 0x30 && code <= 0x39) || (code >= 0x41 && code <= 0x46) || (code >= 0x61 && code <= 0x66);

/**
 * Whether `pattern` holds a code point escape: an unescaped backslash, `u`, `{`, one or more hex digits, `}`.
 * Escaped pairs are skipped, so an escaped backslash followed by `u{61}` is not one.
 */
const hasCodePointEscape = (pattern: string): boolean => {
  const last = pattern.length - 1;
  for (let i = 0; i < last; i++) {
    if (pattern.charCodeAt(i) !== BACKSLASH) {
      continue;
    }
    if (pattern.charCodeAt(i + 1) === LOWERCASE_U && pattern.charCodeAt(i + 2) === LEFT_BRACE) {
      let j = i + 3;
      while (isHexDigit(pattern.charCodeAt(j))) {
        j++;
      }
      if (j > i + 3 && pattern.charCodeAt(j) === RIGHT_BRACE) {
        return true;
      }
    }
    // skip the escaped character
    i++;
  }
  return false;
};

// Patterns are compiled on every validation of `pattern` / `patternProperties` /
// `additionalProperties`, and the ReDoS check (safe-regex2) is expensive, so results
// are memoized per pattern string. Sharing a RegExp across callers is safe because
// the compiled expressions never carry the `g` or `y` flag, so `test()` is stateless.
const regexCache = new Map<string, CompileSchemaRegexResult>();

/**
 * Compiles a JSON Schema `pattern` into a `RegExp`, rejecting oversized and ReDoS-prone patterns.
 *
 * Results are memoized and shared between callers, so the returned object (and its `RegExp`)
 * must be treated as read-only.
 *
 * @param pattern - The ECMA-262 regular expression source from the schema.
 * @returns `{ ok: true, value }` with the compiled expression, or `{ ok: false, error }` describing why it was rejected.
 */
export function compileSchemaRegex(pattern: string): CompileSchemaRegexResult {
  let result = regexCache.get(pattern);
  if (result === undefined) {
    result = compileSchemaRegexUncached(pattern);
    // Oversized patterns are rejected in O(1) anyway; caching them would let the entry cap
    // retain unbounded bytes.
    if (pattern.length > MAX_SCHEMA_REGEX_LENGTH) {
      return result;
    }
    if (regexCache.size >= MAX_SCHEMA_REGEX_CACHE_SIZE) {
      // Map iterates in insertion order, so the first key is the oldest entry (FIFO
      // eviction keeps the hit path to a single lookup).
      regexCache.delete(regexCache.keys().next().value!);
    }
    regexCache.set(pattern, result);
  }
  return result;
}

/**
 * Clears the pattern cache used by {@link compileSchemaRegex}. Intended for tests.
 *
 * @internal
 */
export function clearSchemaRegexCache(): void {
  regexCache.clear();
}

function compileSchemaRegexUncached(pattern: string): CompileSchemaRegexResult {
  if (pattern.length > MAX_SCHEMA_REGEX_LENGTH) {
    return {
      ok: false,
      error: {
        pattern,
        message: `Pattern length ${pattern.length} exceeds maximum allowed length of ${MAX_SCHEMA_REGEX_LENGTH}`,
      },
    };
  }

  // Reject patterns vulnerable to catastrophic backtracking (ReDoS) before compiling
  if (!isSafeRegex(pattern)) {
    return {
      ok: false,
      error: {
        pattern,
        message: 'Pattern rejected as potentially unsafe (ReDoS)',
      },
    };
  }

  const needsUnicode =
    unicodePropertyEscape.test(pattern) ||
    nonBmpCharacter.test(pattern) ||
    surrogatePairEscape.test(pattern) ||
    hasCodePointEscape(pattern);
  // Try compiling without 'u' flag if not needed
  if (needsUnicode) {
    // Try compiling with 'u' flag only
    try {
      const re = new RegExp(pattern, 'u');
      return { ok: true, value: re };
    } catch (error: unknown) {
      return {
        ok: false,
        error: {
          pattern,
          message: error instanceof Error ? error.message : 'Invalid regular expression',
        },
      };
    }
  } else {
    try {
      const re = new RegExp(pattern);
      return { ok: true, value: re };
    } catch (error: unknown) {
      return {
        ok: false,
        error: {
          pattern,
          message: error instanceof Error ? error.message : 'Invalid regular expression',
        },
      };
    }
  }
}
