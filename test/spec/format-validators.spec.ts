import { describe, expect, it } from 'vitest';

import { buildUriPredicates, UNRESERVED_CHARS_SRC } from '../../src/utils/rfc-3986.ts';
import { ZSchema } from '../../src/z-schema.ts';

const asyncValidator = (input: unknown): Promise<boolean> =>
  Promise.resolve(typeof input === 'string' && input.length > 3);

// Times repeated validation of an adversarial `[ userinfo "@" ] host` string. Firefox coarsens
// performance.now() to 1ms, so a single sub-millisecond run reads as 0 and makes any ratio
// meaningless — the repeat count lifts each measurement well clear of timer granularity in every
// browser project. Returns total elapsed ms, which is what the caller compares across sizes.
const ADVERSARIAL_SPLIT_RUNS = 25;

const timeAdversarialSplit = (size: number): number => {
  const validator = ZSchema.create();
  const schema = { type: 'string', format: 'uri-reference' };
  const adversarial = `//${'a'.repeat(size)}@${'b'.repeat(size)}:!`;
  const started = performance.now();
  for (let run = 0; run < ADVERSARIAL_SPLIT_RUNS; run++) {
    if (validator.validateSafe(adversarial, schema).valid) {
      throw new Error('adversarial input must not validate');
    }
  }
  return performance.now() - started;
};

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
      // Literal text is validated leniently on purpose: RFC 6570 excludes bare "%", "'" and
      // the C1 controls from literals, but tightening that would reject input earlier versions
      // accepted. These three pin that deliberate leniency so it cannot regress silently.
      ['foo%bar', 'bare percent in a literal (deliberately lenient)'],
      ["foo'bar", 'apostrophe in a literal (deliberately lenient)'],
      ['foo\u0080bar', 'C1 control in a literal (deliberately lenient)'],
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
      // literal charset — RFC 6570 §2.1 starts literals at %x21, so no C0 control or DEL
      ['foo\u007Fbar', 'a delete character in a literal'],
      ['foo\u0000bar', 'a NUL character in a literal'],
      ['foo\u001Fbar', 'a unit-separator control character in a literal'],
      ['{foo\u007Fbar}', 'a delete character inside an expression body'],
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

  describe('URI Format Validator', () => {
    const uriSchema = { type: 'string', format: 'uri' };

    it.each([
      ['http://foo.bar/?baz=qux#quux', 'a valid URL with anchor'],
      ['http://foo.com/blah_(wikipedia)_blah#cite-1', 'parentheses in a path'],
      ['http://foo.bar/?q=Test%20URL-encoded%20stuff', 'percent-encoded query'],
      ['http://xn--nw2a.xn--j6w193g/', 'punycode host'],
      ["http://-.~_!$&'()*+,;=:%40:80%2f::::::@example.com", 'userinfo of sub-delims, colons and pct-encoded'],
      ['http://223.255.255.254', 'IPv4 host'],
      ['ftp://ftp.is.co.za/rfc/rfc1808.txt', 'ftp scheme'],
      ['ldap://[2001:db8::7]/c=GB?objectClass?one', 'IPv6 IP-literal host'],
      ['mailto:John.Doe@example.com', 'path-rootless with an at-sign'],
      ['news:comp.infosystems.www.servers.unix', 'path-rootless'],
      ['tel:+1-816-555-1212', 'plus is a sub-delim'],
      ['urn:oasis:names:specification:docbook:dtd:xml:4.1.2', 'colons are pchar in a rootless path'],
      // RFC 3986 §3.2.2 orders `host` as `IP-literal / IPv4address / reg-name`, and every
      // IPv4address is also a well-formed reg-name, so a quad that fails `dec-octet` falls
      // through to reg-name and is still a valid host.
      ['http://087.10.0.1/', 'leading-zero quad is a valid reg-name'],
      ['http://999.999.999.999/', 'out-of-bounds quad is a valid reg-name'],
      ['http://x.com/?arr%5B%5D=1', 'percent-encoded brackets in a query'],
      // Structural productions the grammar supports but the upstream suite never exercises.
      ['mailto:', 'path-empty — the hier-part alternation is optional'],
      ['urn:/a/b', 'path-absolute under a scheme'],
      ['http://', 'reg-name accepts zero repetitions, so the authority may be empty'],
      ['http://example.com:/path', 'port = *DIGIT, so an empty port is well-formed'],
      // IPvFuture accepts either case of the version letter; only "V" was covered before.
      ['http://[v1.fe]', 'lowercase IPvFuture version letter'],
    ])('should accept %j (%s)', (data) => {
      const validator = ZSchema.create();
      expect(validator.validateSafe(data, uriSchema).valid).toBe(true);
    });

    it.each([
      ['//foo.bar/?baz=qux#quux', 'protocol-relative reference is not a URI'],
      ['/abc', 'relative reference is not a URI'],
      ['abc', 'bare word is not a URI'],
      ['\\\\WINDOWS\\fileshare', 'backslashes are in no production'],
      ['http:// shouldfail.com', 'space in the authority'],
      [':// should fail', 'missing scheme'],
      ['bar,baz:foo', 'comma is not a scheme character'],
      ['1http://example.com', 'scheme must start with a letter'],
      ['ht_tp://example.com', 'underscore is not a scheme character'],
      ['https://[@example.org/test.txt', 'unterminated IP-literal'],
      ['https://example.org/foobar®.txt', 'non-ASCII is rejected by the URI grammar itself'],
      ['https://example.org/foobar\\.txt', 'backslash in a path'],
      ['https://example.org/foobar".txt', 'double quote in a path'],
      ['https://example.org/foobar<>.txt', 'angle brackets in a path'],
      ['https://example.org/foobar{}.txt', 'braces in a path'],
      ['https://example.org/foobar^.txt', 'caret in a path'],
      ['https://example.org/foobar`.txt', 'backtick in a path'],
      ['https://example.org/foo bar.txt', 'space in a path'],
      ['https://example.org/foobar|.txt', 'pipe in a path'],
      ['http://example.com/%6G', 'percent-encoding with a non-hex digit'],
      ['http://example.com/%A', 'incomplete percent-encoding triplet'],
      ['http://example.com/%', 'lone percent sign'],
      ['http://example.com:abc/path', 'non-numeric port'],
      ['http://[::ffff:01.2.3.4]', 'leading zero in an IPv6-embedded IPv4 quad'],
      // A single slash makes this `path-absolute`, so there is no authority for an
      // IP-literal to sit in — the brackets are just characters in a path segment.
      ['http:/[::1]', 'brackets in a path segment, not an authority'],
      // `[` and `]` are gen-delims admitted only by `IP-literal`, so raw brackets in a
      // query are not RFC 3986 conformant even though they are common in the wild —
      // callers percent-encode them.
      ['http://x.com/?arr[]=1', 'raw brackets in a query'],
      // IP-literal bracket contents are checked semantically after the grammar matches.
      ['http://[]', 'empty IP-literal'],
      ['http://[fe80::1%eth0]', 'RFC 4007 zone id is not part of RFC 3986 IPv6address'],
      // IPvFuture = "v" 1*HEXDIG "." 1*( unreserved / sub-delims / ":" ). Every part of that is
      // load-bearing; without these the regex is only ever exercised in the accept direction.
      ['http://[v1]', 'IPvFuture without the separating dot'],
      ['http://[v.1]', 'IPvFuture with no hex digit before the dot'],
      ['http://[vZZ.1]', 'IPvFuture with a non-hex version'],
      ['http://[v1.]', 'IPvFuture with an empty trailer'],
      // Brackets are gen-delims: no production but IP-literal admits them. This is the invariant
      // the whole-string bracket scan in isValidAuthorityIpLiteral depends on.
      ['http://us[er@example.com/', 'bracket in userinfo'],
      ['http://example.com/#fr[ag]', 'bracket in a fragment'],
    ])('should reject %j (%s)', (data) => {
      const validator = ZSchema.create();
      expect(validator.validateSafe(data, uriSchema).valid).toBe(false);
    });

    // Format validators apply to strings only; every other type is vacuously valid.
    it.each([12, 13.7, {}, [], false, null])('should ignore non-string input %j', (data) => {
      const validator = ZSchema.create();
      expect(validator.validateSafe(data, { format: 'uri' }).valid).toBe(true);
    });
  });

  describe('URI Reference Format Validator', () => {
    const uriReferenceSchema = { type: 'string', format: 'uri-reference' };

    it.each([
      ['http://foo.bar/?baz=qux#quux', 'a full URI is also a URI-reference'],
      ['//foo.bar/?baz=qux#quux', 'network-path reference'],
      ['/abc', 'absolute-path reference'],
      ['abc', 'relative-path reference'],
      ['#fragment', 'fragment-only reference'],
      ['', 'empty reference is path-empty'],
      ['?query=1', 'query-only reference'],
      ['//', 'network-path reference with an empty authority'],
      // RFC 3986 §3.3 `path-noscheme` begins with `segment-nz-nc`, which exists solely to
      // forbid a colon in the first segment; later segments are plain `segment = *pchar`,
      // which does admit one. Contrast with the rejected `1:b` below.
      ['./this:that', 'a colon is legal after a first segment that has none'],
      ['http://087.10.0.1/', 'leading-zero quad is a valid reg-name'],
      ['http://999.999.999.999/', 'out-of-bounds quad is a valid reg-name'],
    ])('should accept %j (%s)', (data) => {
      const validator = ZSchema.create();
      expect(validator.validateSafe(data, uriReferenceSchema).valid).toBe(true);
    });

    it.each([
      ['\\\\WINDOWS\\fileshare', 'backslashes are in no production'],
      ['#frag\\ment', 'backslash in a fragment'],
      ['/foobar®.txt', 'non-ASCII'],
      ['https://example.org/foobar\\.txt', 'backslash in a path'],
      ['/%zz', 'incomplete percent-encoding'],
      ['/a"b', 'double quote in a path'],
      ['/[::1]', 'brackets outside an authority'],
      ['//example.com:abc/p', 'non-numeric port'],
      ['//a@b@example.com/', 'more than one at-sign in the authority'],
      ['//[::ffff:192.168.0.01]/p', 'leading zero in the IPv4 part of an IPv6 literal'],
      // Mirror image of the accepted `./this:that` above: `path-noscheme`'s first segment
      // is `segment-nz-nc`, which forbids a colon. `1:b` cannot be read as a scheme either,
      // since a scheme must start with ALPHA.
      ['1:b', 'colon in the first segment of a relative-path reference'],
    ])('should reject %j (%s)', (data) => {
      const validator = ZSchema.create();
      expect(validator.validateSafe(data, uriReferenceSchema).valid).toBe(false);
    });

    // Format validators apply to strings only; every other type is vacuously valid.
    it.each([12, 13.7, {}, [], false, null])('should ignore non-string input %j', (data) => {
      const validator = ZSchema.create();
      expect(validator.validateSafe(data, { format: 'uri-reference' }).valid).toBe(true);
    });

    // The [ userinfo "@" ] host split is the one place the grammar's character classes overlap:
    // userinfo's class is a superset of reg-name's, and only the "@" disambiguates where the
    // split falls. This is the construct most likely to degrade if the authority production is
    // ever edited, so assert the scaling rather than a single wall-clock ceiling — a
    // linear-to-quadratic regression at one input size can still land under a fixed bound.
    it('rejects an adversarial userinfo/host split without super-linear blowup', () => {
      const small = timeAdversarialSplit(25_000);
      const large = timeAdversarialSplit(100_000);
      // 4x the input. Linear predicts ~4x, quadratic ~16x. The bound sits between the two so it
      // catches a genuine complexity change while tolerating timer noise on a loaded machine.
      expect(large / small).toBeLessThan(10);
      expect(large).toBeLessThan(2000);
    });
  });

  describe('IRI Format Validator', () => {
    const iriSchema = { type: 'string', format: 'iri' };

    it.each([
      ['http://ƒøø.ßår/?∂éœ=πîx#πîüx', 'non-ASCII in host, query and fragment'],
      ['http://ƒøø.com/blah_(wîkïpédiå)_blah#ßité-1', 'parentheses and non-ASCII'],
      ['http://ƒøø.ßår/?q=Test%20URL-encoded%20stuff', 'percent-encoding in an IRI'],
      ['http://[2001:0db8:85a3:0000:0000:8a2e:0370:7334]', 'full IPv6 literal'],
      ['http://[2001:db8::1]', 'compressed IPv6 literal'],
      // RFC 5234 §2.3 makes ABNF string literals case-insensitive, so the "v" of
      // IPvFuture matches "V" too.
      ['http://[V1.fe]', 'uppercase IPvFuture version letter'],
      ['http://192.168.0.1/p', 'IPv4 host'],
      ['urn:example:resource', 'path-rootless'],
      ['file:/etc/hosts', 'path-absolute'],
      ['http://ƒøø.ßår/\u{10300}', 'supplementary-plane ucschar in a path'],
      ['http://ƒøø.ßår/?q=\u{F0000}', 'supplementary-plane iprivate in a query'],
    ])('should accept %j (%s)', (data) => {
      const validator = ZSchema.create();
      expect(validator.validateSafe(data, iriSchema).valid).toBe(true);
    });

    it.each([
      ['/abc', 'relative reference is not an IRI'],
      ['\\\\WINDOWS\\filëßåré', 'backslashes'],
      ['âππ', 'bare word is not an IRI'],
      ['http://2001:0db8:85a3:0000:0000:8a2e:0370:7334', 'IPv6 without enclosing brackets'],
      ['http://[::ffff:192.168.0.01]', 'leading zero in an IPv6-embedded IPv4 quad'],
      ['http://ƒøø.ßår/\n', 'trailing newline'],
      // The important asymmetry: RFC 3987 §2.2 widens `iquery` with `iprivate` but leaves
      // `ipath` and `ifragment` alone, so the same code point is valid after `?` and invalid
      // after `#` (see the accepted supplementary-plane iprivate query case above).
      ['http://ƒøø.ßår/#\u{F0000}', 'iprivate is not permitted in a fragment'],
      ['http://ƒøø.ßår/\u{F0000}', 'iprivate is not permitted in a path'],
      // ucschar starts at U+00A0; the code point just below it must still be rejected.
      ['http://\u009F.example.com/', 'U+009F sits just below the ucschar range'],
      // The widened classes do not relax percent-encoding, which stays shared with RFC 3986.
      ['http://example.com/%ZZ', 'percent-encoding with non-hex digits in an IRI'],
    ])('should reject %j (%s)', (data) => {
      const validator = ZSchema.create();
      expect(validator.validateSafe(data, iriSchema).valid).toBe(false);
    });

    // Format validators apply to strings only; every other type is vacuously valid.
    it.each([12, 13.7, {}, [], false, null])('should ignore non-string input %j', (data) => {
      const validator = ZSchema.create();
      expect(validator.validateSafe(data, { format: 'iri' }).valid).toBe(true);
    });
  });

  describe('IRI Reference Format Validator', () => {
    const iriReferenceSchema = { type: 'string', format: 'iri-reference' };

    it.each([
      ['http://ƒøø.ßår/?∂éœ=πîx#πîüx', 'a full IRI is also an IRI-reference'],
      ['//ƒøø.ßår/?∂éœ=πîx#πîüx', 'network-path reference'],
      ['/âππ', 'absolute-path reference'],
      ['âππ', 'relative-path reference'],
      ['#ƒrägmênt', 'fragment-only reference'],
      // The segment-colon rule must survive the widened iunreserved class — same discriminator
      // as the uri-reference block, with a non-ASCII segment.
      ['./this:β', 'colon after a first segment that has none'],
    ])('should accept %j (%s)', (data) => {
      const validator = ZSchema.create();
      expect(validator.validateSafe(data, iriReferenceSchema).valid).toBe(true);
    });

    it.each([
      ['\\\\WINDOWS\\filëßåré', 'backslashes'],
      ['#ƒräg\\mênt', 'backslash in a fragment'],
      ['1:β', 'colon in the first segment of a relative-path reference'],
      ['/à[1]', 'bracket outside an authority'],
    ])('should reject %j (%s)', (data) => {
      const validator = ZSchema.create();
      expect(validator.validateSafe(data, iriReferenceSchema).valid).toBe(false);
    });

    // Format validators apply to strings only; every other type is vacuously valid.
    it.each([12, 13.7, {}, [], false, null])('should ignore non-string input %j', (data) => {
      const validator = ZSchema.create();
      expect(validator.validateSafe(data, { format: 'iri-reference' }).valid).toBe(true);
    });
  });

  // Reaches into src/utils/rfc-3986.ts on purpose, unlike every block above: this pins a property
  // of the grammar sources themselves, not the behaviour of a registered format.
  describe('URI Grammar Source Invariants', () => {
    // The `u` flag is derived from the class bodies rather than passed in. Getting that wrong is
    // silent rather than loud: outside `u` mode a `\u{...}` escape is an identity escape, so the
    // range would compile as the literal characters "u{...}" and simply match less. Assert the
    // derivation behaviourally, since there is no exception to catch.
    it('derives the u flag from the class bodies', () => {
      const astral = buildUriPredicates({
        unreservedChars: `${UNRESERVED_CHARS_SRC}\\u{10000}-\\u{1FFFD}`,
      });
      expect(astral.isAbsolute('http://example.com/\u{10300}')).toBe(true);
      // The unextended ASCII grammar must not accept the same input.
      const ascii = buildUriPredicates({ unreservedChars: UNRESERVED_CHARS_SRC });
      expect(ascii.isAbsolute('http://example.com/\u{10300}')).toBe(false);
    });

    it('keeps the shared ASCII class bodies safe to compile under the u flag', () => {
      expect(() => new RegExp(`[${UNRESERVED_CHARS_SRC}]`, 'u')).not.toThrow();
    });

    it('pairs the IP-literal check with the grammar in both predicates', () => {
      const { isAbsolute, isReference } = buildUriPredicates({ unreservedChars: UNRESERVED_CHARS_SRC });
      // Matches the grammar (bracketed host) but is not a valid IPv6address, so only the paired
      // semantic check can reject it.
      expect(isAbsolute('http://[::ffff:01.2.3.4]')).toBe(false);
      expect(isReference('//[::ffff:01.2.3.4]/p')).toBe(false);
    });
  });
});
