// RFC 3986 — Uniform Resource Identifier (URI): Generic Syntax
// https://www.rfc-editor.org/rfc/rfc3986#appendix-A
//
// A transcription of the Appendix A ABNF into two anchored regular expressions (URI and
// relative-ref). Fragments are composed as uncompiled `_SRC` strings and only the two
// top-level productions are compiled, once, at module scope — format validation runs on
// hot paths. RFC 3987 (IRI) is defined as this grammar with widened character classes,
// so `buildTopLevelRegexes` is exported for src/utils/rfc-3987.ts to instantiate; that
// module contributes character classes only, never production shapes.
//
// Deliberately NOT gated behind safe-regex2 (used in src/utils/schema-regex.ts for
// untrusted `pattern` values): that heuristic rejects any star height > 1 outright and
// caps repetition nodes at 25, so it reports this grammar as unsafe. The nesting here is
// unambiguous — `/` is not a member of pchar, so a path admits exactly one segmentation —
// and the grammar is reviewed and fixed rather than user-supplied.

import isIPModule from 'validator/lib/isIP.js';

// RFC 3986 §2.1: pct-encoded = "%" HEXDIG HEXDIG
const PCT_ENCODED_SRC = '%[0-9A-Fa-f]{2}';

// RFC 3986 §2.2: sub-delims = "!" / "$" / "&" / "'" / "(" / ")" / "*" / "+" / "," / ";" / "="
// Character-class body: none of these are special inside `[...]`, with or without the `u` flag.
const SUB_DELIMS_CHARS_SRC = "!$&'()*+,;=";

// RFC 3986 §2.3: unreserved = ALPHA / DIGIT / "-" / "." / "_" / "~"
// The "-" MUST stay escaped: `[A-Za-z0-9-._~]` reads "9-." as a range, which is a tolerated
// quirk without the `u` flag but a construction-time SyntaxError with it (the IRI grammar
// compiles with `u`).
export const UNRESERVED_CHARS_SRC = 'A-Za-z0-9\\-._~';

// RFC 3986 §3.1: scheme = ALPHA *( ALPHA / DIGIT / "+" / "-" / "." )
// Stays ASCII in an IRI too — RFC 3987 §2.2 reuses `scheme` verbatim.
const SCHEME_SRC = '[A-Za-z][A-Za-z0-9+.\\-]*';

// RFC 3986 §3.2.3: port = *DIGIT
const PORT_SRC = '[0-9]*';

// RFC 3986 §3.2.2: IP-literal = "[" ( IPv6address / IPvFuture ) "]"
// Bracket contents are matched permissively here and checked semantically by
// isValidAuthorityIpLiteral — inlining the nine-alternative IPv6address production would be
// the hardest part of the grammar to prove correct, and `validator` already implements it.
const IP_LITERAL_SRC = '\\[[^\\]]*\\]';

// RFC 3986 Appendix A: IPvFuture = "v" 1*HEXDIG "." 1*( unreserved / sub-delims / ":" )
// RFC 5234 §2.3 makes ABNF string literals case-insensitive, so "v" also matches "V". Spelled
// as [vV] rather than the `i` flag, which would additionally loosen the HEXDIG class.
const IPV_FUTURE_REGEX = /^[vV][0-9A-Fa-f]+\.[A-Za-z0-9\-._~!$&'()*+,;=:]+$/;

// Captures the contents of the first bracket pair. Safe to run against the whole input: `[`
// and `]` are gen-delims admitted by no production except IP-literal, so once a string has
// matched a top-level regex, any bracket pair it contains is provably the authority's host.
const IP_LITERAL_CONTENT_REGEX = /\[(?<inner>[^\]]*)\]/;

// "v" and "V" — IPvFuture's version-letter prefix, compared by code unit to keep the check
// off String#startsWith (see the Performance section of AGENTS.md).
const LOWERCASE_V_CHAR_CODE = 118;
const UPPERCASE_V_CHAR_CODE = 86;

/**
 * Validates the host of a string that has already matched a top-level URI/IRI production.
 *
 * Returns `true` unchanged when the host is not an IP-literal, so the common case costs a
 * single `String#includes` and allocates nothing.
 */
export const isValidAuthorityIpLiteral = (value: string): boolean => {
  if (!value.includes('[')) {
    return true;
  }
  const inner = IP_LITERAL_CONTENT_REGEX.exec(value)?.groups?.inner;
  if (inner === undefined || inner.length === 0) {
    return false;
  }
  const firstCharCode = inner.charCodeAt(0);
  if (firstCharCode === LOWERCASE_V_CHAR_CODE || firstCharCode === UPPERCASE_V_CHAR_CODE) {
    return IPV_FUTURE_REGEX.test(inner);
  }
  // RFC 4007 zone IDs ("fe80::1%eth0") are accepted by validator's isIP but are not part of
  // RFC 3986's IPv6address. Rejected up front, matching ipv6Validator in format-validators.ts.
  if (inner.includes('%')) {
    return false;
  }
  return isIPModule.default(inner, 6);
};

/** Inputs that distinguish RFC 3987's grammar from RFC 3986's — character classes only. */
export interface UriGrammarOptions {
  /** Body of the `unreserved` character class: RFC 3986's `unreserved`, or RFC 3987's `iunreserved`. */
  unreservedChars: string;
  /** Extra class body permitted in the query alone — RFC 3987's `iprivate`. Empty for a URI. */
  privateQueryChars?: string;
  /** Compile with the `u` flag. Required when any class body uses `\u{...}` escapes. */
  unicode?: boolean;
}

/**
 * Composes the RFC 3986 §3 / §4.2 grammar and compiles its two top-level productions.
 *
 * `URI-reference = URI / relative-ref` cannot collapse into one pattern with an optional
 * scheme: the two differ in `path-rootless` vs `path-noscheme`, and only the latter forbids
 * a colon in the first segment. JS has no conditional groups, so they stay separate and the
 * `uri-reference` / `iri-reference` validators test both.
 */
export const buildTopLevelRegexes = ({
  unreservedChars,
  privateQueryChars = '',
  unicode = false,
}: UriGrammarOptions): { absolute: RegExp; relative: RegExp } => {
  const uc = unreservedChars;
  const sd = SUB_DELIMS_CHARS_SRC;

  // §3.2.1: userinfo = *( unreserved / pct-encoded / sub-delims / ":" )
  const userinfo = `(?:[${uc}${sd}:]|${PCT_ENCODED_SRC})*`;
  // §3.2.2: reg-name = *( unreserved / pct-encoded / sub-delims )
  const regName = `(?:[${uc}${sd}]|${PCT_ENCODED_SRC})*`;
  // §3.2.2: host = IP-literal / IPv4address / reg-name
  // IPv4address is omitted deliberately: it is built only from DIGIT and ".", both members of
  // unreserved, so every IPv4address is already a reg-name and the two-way alternation
  // recognizes the identical language. This is exactly why "http://087.10.0.1/" and
  // "http://999.999.999.999/" are valid URIs — they fail dec-octet but are well-formed
  // reg-names — while "[::ffff:01.2.3.4]" is not, an IP-literal having no reg-name fallback.
  const host = `(?:${IP_LITERAL_SRC}|${regName})`;
  // §3.2: authority = [ userinfo "@" ] host [ ":" port ]
  const authority = `(?:${userinfo}@)?${host}(?::${PORT_SRC})?`;

  // §3.3: pchar = unreserved / pct-encoded / sub-delims / ":" / "@"
  const pchar = `(?:[${uc}${sd}:@]|${PCT_ENCODED_SRC})`;
  // §3.3: segment-nz-nc = 1*( unreserved / pct-encoded / sub-delims / "@" )
  //       ; non-zero-length segment without any colon ":"
  const segmentNzNc = `(?:[${uc}${sd}@]|${PCT_ENCODED_SRC})+`;

  // §3.3: path-abempty = *( "/" segment ) ; segment = *pchar
  const pathAbempty = `(?:/${pchar}*)*`;
  // §3.3: path-absolute = "/" [ segment-nz *( "/" segment ) ]
  const pathAbsolute = `/(?:${pchar}+(?:/${pchar}*)*)?`;
  // §3.3: path-rootless = segment-nz *( "/" segment )
  const pathRootless = `${pchar}+(?:/${pchar}*)*`;
  // §3.3: path-noscheme = segment-nz-nc *( "/" segment )
  const pathNoscheme = `${segmentNzNc}(?:/${pchar}*)*`;

  // §3.4: query = *( pchar / "/" / "?" ) ; §3.5: fragment = *( pchar / "/" / "?" )
  // RFC 3987 §2.2 widens iquery with iprivate but leaves ifragment alone — hence the asymmetry.
  const query = `(?:${pchar}|[${privateQueryChars}/?])*`;
  const fragment = `(?:${pchar}|[/?])*`;
  const tail = `(?:\\?${query})?(?:#${fragment})?$`;

  // Making the whole hier-part / relative-part alternation optional expresses path-empty.
  const flags = unicode ? 'u' : '';
  return {
    // §3: URI = scheme ":" hier-part [ "?" query ] [ "#" fragment ]
    // hier-part = "//" authority path-abempty / path-absolute / path-rootless / path-empty
    absolute: new RegExp(
      `^${SCHEME_SRC}:(?://${authority}${pathAbempty}|${pathAbsolute}|${pathRootless})?${tail}`,
      flags
    ),
    // §4.2: relative-ref = relative-part [ "?" query ] [ "#" fragment ]
    // relative-part = "//" authority path-abempty / path-absolute / path-noscheme / path-empty
    relative: new RegExp(`^(?://${authority}${pathAbempty}|${pathAbsolute}|${pathNoscheme})?${tail}`, flags),
  };
};

// Every class in the URI grammar is pure ASCII, so non-ASCII input is rejected by the grammar
// itself — no separate /[^\u0000-\u007F]/ pre-check is needed, and none is compiled with `u`.
const { absolute: URI_REGEX, relative: URI_RELATIVE_REF_REGEX } = buildTopLevelRegexes({
  unreservedChars: UNRESERVED_CHARS_SRC,
});

/** Tests a string against RFC 3986 §3 `URI` — an absolute URI with an optional fragment. */
export const isValidUri = (uri: string): boolean => URI_REGEX.test(uri) && isValidAuthorityIpLiteral(uri);

/** Tests a string against RFC 3986 §4.1 `URI-reference` — a `URI` or a `relative-ref`. */
export const isValidUriReference = (uri: string): boolean =>
  (URI_REGEX.test(uri) || URI_RELATIVE_REF_REGEX.test(uri)) && isValidAuthorityIpLiteral(uri);
