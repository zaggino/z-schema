// Shared regex compilation helper for JSON Schema patterns
// Returns { ok: true, value: RegExp } or { ok: false, error: { pattern, message } }

import isSafeRegex from 'safe-regex2';

import { MAX_SCHEMA_REGEX_CACHE_SIZE, MAX_SCHEMA_REGEX_LENGTH } from './constants.js';

type CompileSchemaRegexResult =
  | { ok: true; value: RegExp }
  | { ok: false; error: { pattern: string; message: string } };

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
