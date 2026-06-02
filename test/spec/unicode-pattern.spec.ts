import { unicodeLength } from '../../src/utils/unicode.ts';
import { ZSchema } from '../../src/z-schema.ts';

// Runtime check for Unicode property escape support (must actually match ASCII letters)
function supportsUnicodePropertyEscapes() {
  try {
    const re = new RegExp('^\\p{L}+$', 'u');
    return re.test('abc') === true;
  } catch {
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
    const validator = ZSchema.create();
    const schema = { type: 'string', pattern: '^\\p{L}+$' };
    // Valid: only letters
    expect(validator.validateSafe('abc', schema).valid).toBe(true);
    // Invalid: contains a digit
    expect(validator.validateSafe('abc1', schema).valid).toBe(false);
    // Invalid: contains a symbol
    expect(validator.validateSafe('abc!', schema).valid).toBe(false);
  });

  it('should fail schema validation for invalid Unicode property escape', () => {
    const validator = ZSchema.create();
    const schema = { type: 'string', pattern: '^\\p{INVALID}+$' };
    const result = validator.validateSafe('test', schema);
    expect(result.valid).toBe(false);
    expect(result.err).toBeDefined();
    expect(result.err!.details?.[0].code).toBe('KEYWORD_PATTERN');
    expect(result.err!.details?.[0].params[1]).toBe('^\\p{INVALID}+$');
  });
});

describe('unicodeLength', () => {
  it('should count lone low surrogate as one character', () => {
    expect(unicodeLength('\uDC00')).toBe(1);
  });

  it('should count lone high surrogate at end of string as one character', () => {
    expect(unicodeLength('\uD800')).toBe(1);
  });

  it('should count unmatched high surrogate followed by ASCII as two characters', () => {
    expect(unicodeLength('\uD800a')).toBe(2);
  });

  it('should count surrogate pair as one character', () => {
    // U+10000 LINEAR B SYLLABLE B008 A = surrogate pair \uD800\uDC00
    expect(unicodeLength('\uD800\uDC00')).toBe(1);
  });

  it('should count emoji as one character', () => {
    expect(unicodeLength('😀')).toBe(1);
  });

  it('should count ASCII string correctly', () => {
    expect(unicodeLength('hello')).toBe(5);
  });
});
