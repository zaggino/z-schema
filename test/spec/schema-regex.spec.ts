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

    it('evicts the oldest entry once the cache is full', () => {
      const oldest = compileSchemaRegex('^evict-0$');
      for (let i = 1; i <= MAX_SCHEMA_REGEX_CACHE_SIZE; i++) {
        compileSchemaRegex(`^evict-${i}$`);
      }
      const newest = compileSchemaRegex(`^evict-${MAX_SCHEMA_REGEX_CACHE_SIZE}$`);
      expect(compileSchemaRegex(`^evict-${MAX_SCHEMA_REGEX_CACHE_SIZE}$`)).toBe(newest);
      const recompiled = compileSchemaRegex('^evict-0$');
      expect(recompiled).not.toBe(oldest);
      expect(recompiled.ok).toBe(true);
    });
  });
});
