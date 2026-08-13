import { describe, expect, it } from 'vitest';

import { ZSchema } from '../../src/z-schema.ts';

const asyncValidator = (input: unknown): Promise<boolean> =>
  Promise.resolve(typeof input === 'string' && input.length > 3);

const slowValidator = async (): Promise<boolean> => {
  await new Promise((resolve) => {
    setTimeout(resolve, 50); // 50ms delay
  });
  return true;
};

describe('Format Validators', () => {
  describe('Async Format Validator Registration', () => {
    it('should register an async format validator', () => {
      const validator = ZSchema.create();

      validator.registerFormat('async-test', asyncValidator);

      const registered = validator.getRegisteredFormats();
      expect(registered).toContain('async-test');
    });
  });

  describe('Sync Format Validators Regression', () => {
    it('should validate with built-in sync format validators', () => {
      const validator = ZSchema.create();

      const schema = {
        type: 'string',
        format: 'email',
      };

      const result = validator.validate('test@example.com', schema);
      expect(result).toBe(true);
    });

    it('should fail validation with built-in sync format validators', () => {
      const validator = ZSchema.create();

      const schema = {
        type: 'string',
        format: 'email',
      };

      const result = validator.validateSafe('invalid-email', schema);
      expect(result.valid).toBe(false);
    });

    it('should skip format assertion when formatAssertions is false', () => {
      const validator = ZSchema.create({ formatAssertions: false });

      const schema = {
        type: 'string',
        format: 'email',
      };

      const result = validator.validateSafe('invalid-email', schema);
      expect(result.valid).toBe(true);
    });

    it('should ignore unknown format by default for draft2020-12', () => {
      const validator = ZSchema.create({ version: 'draft2020-12' });

      const schema = {
        format: 'definitely-unknown-format',
      };

      const result = validator.validateSafe('value', schema);
      expect(result.valid).toBe(true);
    });
  });

  describe('Async Timeout Handling', () => {
    it('should timeout async format validation', async () => {
      const validator = ZSchema.create({ async: true, safe: true, asyncTimeout: 10 }); // 10ms timeout

      validator.registerFormat('slow-async', slowValidator);

      const schema = {
        type: 'string',
        format: 'slow-async',
      };

      const result = await validator.validate('test', schema);
      expect(result.valid).toBe(false);
      expect(result.err!.details).toHaveLength(1);
      expect(result.err!.details![0].code).toBe('ASYNC_TIMEOUT');
    });
  });
  describe('Format Registration and Unregistration', () => {
    it('should unregister a format validator', () => {
      const validator = ZSchema.create();

      validator.registerFormat('test-format', (input) => typeof input === 'string');

      let registered = validator.getRegisteredFormats();
      expect(registered).toContain('test-format');

      validator.unregisterFormat('test-format');

      registered = validator.getRegisteredFormats();
      expect(registered).not.toContain('test-format');
    });

    it('should unregister a inbuilt format validator', () => {
      const validator = ZSchema.create();
      const before = validator.getSupportedFormats();
      expect(before).toContain('ipv4');
      expect(before).toContain('ipv6');
      validator.unregisterFormat('ipv4');
      validator.unregisterFormat('ipv6');
      const after = validator.getSupportedFormats();
      expect(after).not.toContain('ipv4');
      expect(after).not.toContain('ipv6');
    });

    it('should get supported formats', () => {
      const validator = ZSchema.create();

      const supported = validator.getSupportedFormats();
      expect(supported).toContain('email');
      expect(supported).toContain('uri');
      expect(Array.isArray(supported)).toBe(true);
    });

    it('should get default options', () => {
      const options = ZSchema.getDefaultOptions();
      expect(options).toBeDefined();
      expect(options.asyncTimeout).toBe(2000);
    });

    it('should clamp asyncTimeout to MAX_ASYNC_TIMEOUT (60 000 ms)', () => {
      const validator = ZSchema.create({ asyncTimeout: 999_999_999 });
      expect(validator.options.asyncTimeout).toBe(60_000);
    });

    it('should clamp negative asyncTimeout to 0', () => {
      const validator = ZSchema.create({ asyncTimeout: -500 });
      expect(validator.options.asyncTimeout).toBe(0);
    });

    it('should keep asyncTimeout when within allowed range', () => {
      const validator = ZSchema.create({ asyncTimeout: 5000 });
      expect(validator.options.asyncTimeout).toBe(5000);
    });
  });

  describe('URI Template Format Validator', () => {
    const uriTemplateSchema = { type: 'string', format: 'uri-template' };

    it.each([
      // literals only
      ['', 'empty string'],
      ['foo', 'plain literal'],
      ['a%41b', 'percent-encoded triplet in a literal'],
      ['a\u{1F600}b', 'supplementary plane character in a literal'],
      ['http://example.com/dictionary', 'absolute URI without expressions'],
      // Literal text is validated leniently on purpose: RFC 6570 excludes bare "%" and "'"
      // from literals, but tightening that would reject input earlier versions accepted.
      // These two pin that deliberate leniency so it cannot regress silently.
      ['foo%bar', 'bare percent in a literal (deliberately lenient)'],
      ["foo'bar", 'apostrophe in a literal (deliberately lenient)'],
      // expressions
      ['http://example.com/dictionary/{term:1}/{term}', 'absolute URI with expressions'],
      ['dictionary/{term:1}/{term}', 'relative template with expressions'],
      ['{var}', 'bare varspec'],
      ['{+var}', 'reserved expansion operator'],
      ['{#var*}', 'fragment operator with explode modifier'],
      ['{.a}', 'label operator (op-level3), not a leading varname dot'],
      ['{/a,b}', 'path-segment operator with a variable list'],
      ['{;x,y}', 'path-style parameter operator'],
      ['{?x,y}', 'form-style query operator'],
      ['{&x}', 'form-style query continuation operator'],
      ['{,var}', 'op-reserve "," accepted for ABNF fidelity'],
      ['{=var}', 'op-reserve "=" accepted for ABNF fidelity'],
      ['{!var}', 'op-reserve "!" accepted for ABNF fidelity'],
      ['{@var}', 'op-reserve "@" accepted for ABNF fidelity'],
      ['{a.b:3}', 'dotted varname with a prefix modifier'],
      ['{%41var}', 'varname starting with a percent-encoded triplet'],
      ['{v:1}', 'minimum prefix max-length'],
      ['{v:9999}', 'maximum prefix max-length'],
      ['{?x:1,y*}', 'variable list mixing a prefix and an explode modifier'],
    ])('should accept %j (%s)', (data) => {
      const validator = ZSchema.create();
      expect(validator.validateSafe(data, uriTemplateSchema).valid).toBe(true);
    });

    it.each([
      // malformed expression bodies — the RFC 6570 §2 gap this block guards
      ['{}', 'empty expression'],
      ['{a,,b}', 'empty varspec inside the variable list'],
      ['{v:0}', 'zero prefix max-length'],
      ['{v:10000}', 'five-digit prefix max-length'],
      ['{v:01}', 'leading zero in prefix max-length'],
      ['{v:99999}', 'five-digit prefix max-length above the cap'],
      ['{var:}', 'prefix modifier without a max-length'],
      ['{*}', 'explode modifier without a varname'],
      ['{:3}', 'prefix modifier without a varname'],
      ['{a..b}', 'consecutive dots in a varname'],
      ['{a.}', 'trailing dot in a varname'],
      ['{a-b}', 'hyphen is not a varchar'],
      ['{a,b,}', 'trailing comma in the variable list'],
      ['{a,.b}', 'leading dot on a varspec after a comma'],
      // brace structure
      ['{a{b}', 'nested opening brace'],
      ['{a}}', 'trailing unmatched closing brace'],
      ['}{', 'closing brace before an opening brace'],
      ['foo}bar', 'unmatched closing brace in a literal'],
      ['http://example.com/dictionary/{term:1}/{term', 'unterminated expression'],
    ])('should reject %j (%s)', (data) => {
      const validator = ZSchema.create();
      expect(validator.validateSafe(data, uriTemplateSchema).valid).toBe(false);
    });

    // Format validators apply to strings only; every other type is vacuously valid.
    it.each([12, 13.7, {}, [], false, null])('should ignore non-string input %j', (data) => {
      const validator = ZSchema.create();
      expect(validator.validateSafe(data, { format: 'uri-template' }).valid).toBe(true);
    });
  });
});
