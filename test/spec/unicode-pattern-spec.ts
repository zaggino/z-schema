import { describe, it, expect } from 'vitest';
import ZSchema from '../../src/index';

// Runtime check for Unicode property escape support (must actually match ASCII letters)
function supportsUnicodePropertyEscapes() {
  try {
    const re = new RegExp('^\\p{L}+$', 'u');
    return re.test('abc') === true;
  } catch (_e) {
    return false;
  }
}

const unicodeSupport = supportsUnicodePropertyEscapes();
console.log('[unicode-pattern-spec] Unicode property escape supported and matches ASCII letters:', unicodeSupport);

describe('Unicode property escapes in pattern keyword', () => {
  it('should validate and reject non-letter strings with Unicode property escapes (\\p{L})', () => {
    if (!unicodeSupport) {
      console.warn(
        '[unicode-pattern-spec] Skipping test: Unicode property escapes not supported or not matching ASCII letters as expected.'
      );
      expect(true).toBe(true); // Mark as passed
      return;
    }
    const validator = new ZSchema();
    const schema = { type: 'string', pattern: '^\\p{L}+$' };
    // Valid: only letters
    expect(validator.validate('abc', schema)).toBe(true);
    // Invalid: contains a digit
    expect(validator.validate('abc1', schema)).toBe(false);
    // Invalid: contains a symbol
    expect(validator.validate('abc!', schema)).toBe(false);
  });

  it('should fail schema validation for invalid Unicode property escape', () => {
    const validator = new ZSchema();
    const schema = { type: 'string', pattern: '^\\p{INVALID}+$' };
    expect(validator.validateSchema(schema)).toBe(false);
    const errors = validator.getLastErrors();
    expect(errors && errors[0].code).toBe('KEYWORD_PATTERN');
    expect(errors && errors[0].params[1]).toBe('^\\p{INVALID}+$');
  });
});
