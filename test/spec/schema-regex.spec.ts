import { MAX_SCHEMA_REGEX_CACHE_SIZE, MAX_SCHEMA_REGEX_LENGTH } from '../../src/utils/constants.ts';
import { clearSchemaRegexCache, compileSchemaRegex } from '../../src/utils/schema-regex.ts';

describe('compileSchemaRegex', () => {
  it('fails for invalid regex pattern (no Unicode)', () => {
    const result = compileSchemaRegex('[');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.pattern).toBe('[');
      expect(typeof result.error.message).toBe('string');
      expect(result.error.message.length).toBeGreaterThan(0);
    }
  });

  it('compiles valid pattern with Unicode property escape', () => {
    const result = compileSchemaRegex('^\\p{L}+$');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBeInstanceOf(RegExp);
      expect(result.value.flags).toContain('u');
    }
  });

  it('compiles valid pattern without Unicode property escape', () => {
    const result = compileSchemaRegex('^abc$');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBeInstanceOf(RegExp);
      expect(result.value.flags).not.toContain('u');
    }
  });

  it('fails for invalid Unicode property escape (even with u flag)', () => {
    const result = compileSchemaRegex('^\\p{INVALID}+$');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.pattern).toBe('^\\p{INVALID}+$');
      expect(typeof result.error.message).toBe('string');
      expect(result.error.message.length).toBeGreaterThan(0);
    }
  });

  it('rejects patterns exceeding MAX_SCHEMA_REGEX_LENGTH', () => {
    const longPattern = 'a'.repeat(MAX_SCHEMA_REGEX_LENGTH + 1);
    const result = compileSchemaRegex(longPattern);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('exceeds maximum allowed length');
    }
  });

  it('accepts patterns at exactly MAX_SCHEMA_REGEX_LENGTH', () => {
    const exactPattern = 'a'.repeat(MAX_SCHEMA_REGEX_LENGTH);
    const result = compileSchemaRegex(exactPattern);
    expect(result.ok).toBe(true);
  });

  it('rejects patterns vulnerable to catastrophic backtracking (ReDoS)', () => {
    const redosPatterns = ['(a+)+', '(a+){2,}'];
    for (const pattern of redosPatterns) {
      const result = compileSchemaRegex(pattern);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('ReDoS');
      }
    }
  });

  it('accepts safe patterns that are not ReDoS-vulnerable', () => {
    const safePatterns = ['^[a-z]+$', '\\d{1,3}\\.\\d{1,3}', '^foo|bar$', '[A-Za-z0-9_-]+'];
    for (const pattern of safePatterns) {
      const result = compileSchemaRegex(pattern);
      expect(result.ok).toBe(true);
    }
  });

  describe('memoization', () => {
    beforeEach(() => {
      clearSchemaRegexCache();
    });

    it('returns the same result object for a repeated pattern', () => {
      const first = compileSchemaRegex('^memo-[a-z]+$');
      const second = compileSchemaRegex('^memo-[a-z]+$');
      expect(second).toBe(first);
      expect(second.ok).toBe(true);
    });

    it('memoizes failing patterns', () => {
      const first = compileSchemaRegex('(a+)+');
      const second = compileSchemaRegex('(a+)+');
      expect(second).toBe(first);
      expect(second.ok).toBe(false);
    });

    it('shared RegExp is stateless across repeated test() calls', () => {
      const result = compileSchemaRegex('^x+$');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.global).toBe(false);
        expect(result.value.sticky).toBe(false);
        expect(result.value.test('xxx')).toBe(true);
        expect(compileSchemaRegex('^x+$')).toBe(result);
        expect(result.value.test('xxx')).toBe(true);
      }
    });

    it('evicts only the oldest entry once the cache is full', () => {
      const compiled = [];
      for (let i = 0; i <= MAX_SCHEMA_REGEX_CACHE_SIZE; i++) {
        compiled.push(compileSchemaRegex(`^evict-${i}$`));
      }
      // One insert past the cap evicted exactly entry 0; entries 1..cap are still cached.
      expect(compileSchemaRegex('^evict-1$')).toBe(compiled[1]);
      expect(compileSchemaRegex(`^evict-${MAX_SCHEMA_REGEX_CACHE_SIZE}$`)).toBe(compiled[MAX_SCHEMA_REGEX_CACHE_SIZE]);
      const recompiled = compileSchemaRegex('^evict-0$');
      expect(recompiled).not.toBe(compiled[0]);
      expect(recompiled.ok).toBe(true);
    });

    it('does not cache patterns exceeding the maximum length', () => {
      const oversized = 'a'.repeat(MAX_SCHEMA_REGEX_LENGTH + 1);
      const first = compileSchemaRegex(oversized);
      const second = compileSchemaRegex(oversized);
      expect(first.ok).toBe(false);
      expect(second.ok).toBe(false);
      expect(second).not.toBe(first);
    });
  });
});

// One backslash. The patterns below are assembled from it so that this file holds no literal escape.
const BS = String.fromCharCode(92);

describe('code point escapes', () => {
  it('compiles a code point escape with the u flag', () => {
    const result = compileSchemaRegex(`^${BS}u{61}$`);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.flags).toContain('u');
      expect(result.value.test('a')).toBe(true);
      expect(result.value.test('u'.repeat(61))).toBe(false);
    }
  });

  it('leaves an escaped backslash followed by u{61} in legacy mode', () => {
    const result = compileSchemaRegex(`^${BS}${BS}u{61}$`);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.flags).not.toContain('u');
      expect(result.value.test(BS + 'u'.repeat(61))).toBe(true);
    }
  });

  it('does not treat u{61,} as a code point escape', () => {
    const result = compileSchemaRegex(`^${BS}u{61,}$`);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.flags).not.toContain('u');
      expect(result.value.test('u'.repeat(61))).toBe(true);
      expect(result.value.test('u'.repeat(70))).toBe(true);
    }
  });

  it('does not treat an empty u{} as a code point escape', () => {
    const result = compileSchemaRegex(`^${BS}u{}$`);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.flags).not.toContain('u');
    }
  });

  it('finds a code point escape inside a character class and after other escapes', () => {
    const inClass = compileSchemaRegex(`^[${BS}u{1F600}]$`);
    expect(inClass.ok).toBe(true);
    if (inClass.ok) {
      expect(inClass.value.flags).toContain('u');
      expect(inClass.value.test(String.fromCodePoint(0x1_f6_00))).toBe(true);
      expect(inClass.value.test('x')).toBe(false);
    }
    const afterEscape = compileSchemaRegex(`^${BS}d${BS}u{41}$`);
    expect(afterEscape.ok).toBe(true);
    if (afterEscape.ok) {
      expect(afterEscape.value.flags).toContain('u');
      expect(afterEscape.value.test('5A')).toBe(true);
    }
  });

  // [name, pattern, whether it is compiled with the u flag]
  const boundaries: Array<[string, string, boolean]> = [
    ['three backslashes before u{61}', `^${BS}${BS}${BS}u{61}$`, true],
    ['uppercase hex digits', `^${BS}u{1F}$`, true],
    ['decimal digits only', `^${BS}u{2}$`, true],
    ['a range of repetitions', `^${BS}u{2,3}$`, false],
    ['a character that is not a hex digit', `^${BS}u{6g}$`, false],
    ['an uppercase U', `^${BS}U{61}$`, false],
  ];
  it.each(boundaries)('decides the u flag for %s', (_name, pattern, unicode) => {
    const result = compileSchemaRegex(pattern);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.flags.includes('u')).toBe(unicode);
    }
  });

  it('reads decimal digits in braces as a code point, not as a repetition', () => {
    const result = compileSchemaRegex(`^${BS}u{2}$`);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.test(String.fromCodePoint(2))).toBe(true);
      expect(result.value.test('uu')).toBe(false);
    }
  });

  it('reports a code point above 10FFFF as an invalid pattern', () => {
    expect(compileSchemaRegex(`^${BS}u{110000}$`).ok).toBe(false);
  });

  it('accepts a repeated group around a code point escape', () => {
    const result = compileSchemaRegex(`^(${BS}u{61})+$`);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.test('aa')).toBe(true);
      expect(result.value.test('ab')).toBe(false);
    }
  });

  it('still rejects nested repetition next to a code point escape', () => {
    const result = compileSchemaRegex(`^(${BS}u{61}+)+$`);
    expect(result.ok).toBe(false);
  });

  it('reports a pattern that mixes a code point escape with legacy-only syntax', () => {
    const result = compileSchemaRegex(`^${BS}u{61}${BS}-$`);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message.length).toBeGreaterThan(0);
    }
  });
});
