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
 * Index just past the code point escape that starts at the backslash at `start` (a backslash, `u`, `{`,
 * one or more hex digits, `}`), or -1 when none starts there.
 */
const codePointEscapeEnd = (pattern: string, start: number): number => {
  if (pattern.charCodeAt(start + 1) !== LOWERCASE_U || pattern.charCodeAt(start + 2) !== LEFT_BRACE) {
    return -1;
  }
  let end = start + 3;
  // charCodeAt past the end is NaN, which is neither a hex digit nor a brace
  while (isHexDigit(pattern.charCodeAt(end))) {
    end++;
  }
  return end > start + 3 && pattern.charCodeAt(end) === RIGHT_BRACE ? end + 1 : -1;
};

/**
 * `pattern` with every code point escape replaced by one literal character, or `pattern` itself when it
 * contains none. Escaped pairs are skipped, so an escaped backslash followed by `u{61}` is left alone.
 *
 * This is a scan and not a regex because it serves two purposes at once: a result that differs from the
 * input says the pattern needs the `u` flag, and the result is what the backtracking check reads (that
 * check parses legacy syntax, where the braces of a code point escape would count as a repetition).
 */
const replaceCodePointEscapes = (pattern: string): string => {
  const last = pattern.length - 1;
  let out = '';
  let copied = 0;
  for (let i = 0; i < last; i++) {
    if (pattern.charCodeAt(i) !== BACKSLASH) {
      continue;
    }
    const end = codePointEscapeEnd(pattern, i);
    if (end === -1) {
      // skip the escaped character
      i++;
      continue;
    }
    out += `${pattern.slice(copied, i)}a`;
    copied = end;
    i = end - 1;
  }
  return copied === 0 ? pattern : out + pattern.slice(copied);
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

  // A code point escape is one character once the pattern is compiled with the `u` flag, so the
  // backtracking check reads it as one.
  const plain = replaceCodePointEscapes(pattern);
  // Reject patterns vulnerable to catastrophic backtracking (ReDoS) before compiling
  if (!isSafeRegex(plain)) {
    return {
      ok: false,
      error: {
        pattern,
        message: 'Pattern rejected as potentially unsafe (ReDoS)',
      },
    };
  }

  // The `u` flag applies to the whole pattern, so one that needs it must be valid in unicode mode.
  const needsUnicode =
    plain !== pattern ||
    unicodePropertyEscape.test(pattern) ||
    nonBmpCharacter.test(pattern) ||
    surrogatePairEscape.test(pattern);
  try {
    return { ok: true, value: new RegExp(pattern, needsUnicode ? 'u' : '') };
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
