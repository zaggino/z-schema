// RFC 3987 — Internationalized Resource Identifiers (IRIs)
// https://www.rfc-editor.org/rfc/rfc3987#section-2.2
//
// RFC 3987 is RFC 3986 with two widened character classes and no structural change: every
// production shape is imported from src/utils/rfc-3986.ts. This module therefore contains
// character classes only — if a production ever needs restating here, the change belongs in
// rfc-3986.ts instead.

import { buildTopLevelRegexes, isValidAuthorityIpLiteral, UNRESERVED_CHARS_SRC } from './rfc-3986.js';

// RFC 3987 §2.2: ucschar = %xA0-D7FF / %xF900-FDCF / %xFDF0-FFEF / %x10000-1FFFD
//   / %x20000-2FFFD / %x30000-3FFFD / %x40000-4FFFD / %x50000-5FFFD / %x60000-6FFFD
//   / %x70000-7FFFD / %x80000-8FFFD / %x90000-9FFFD / %xA0000-AFFFD / %xB0000-BFFFD
//   / %xC0000-CFFFD / %xD0000-DFFFD / %xE1000-EFFFD
// The `\u{...}` escapes require the `u` flag, hence `unicode: true` below.
const UCSCHAR_SRC =
  '\\u00A0-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFEF' +
  '\\u{10000}-\\u{1FFFD}\\u{20000}-\\u{2FFFD}\\u{30000}-\\u{3FFFD}\\u{40000}-\\u{4FFFD}' +
  '\\u{50000}-\\u{5FFFD}\\u{60000}-\\u{6FFFD}\\u{70000}-\\u{7FFFD}\\u{80000}-\\u{8FFFD}' +
  '\\u{90000}-\\u{9FFFD}\\u{A0000}-\\u{AFFFD}\\u{B0000}-\\u{BFFFD}\\u{C0000}-\\u{CFFFD}' +
  '\\u{D0000}-\\u{DFFFD}\\u{E1000}-\\u{EFFFD}';

// RFC 3987 §2.2: iprivate = %xE000-F8FF / %xF0000-FFFFD / %x100000-10FFFD
// Admitted by `iquery` alone — `ipath` and `ifragment` do not widen, so a private-use code
// point is valid after "?" and invalid after "#".
const IPRIVATE_SRC = '\\uE000-\\uF8FF\\u{F0000}-\\u{FFFFD}\\u{100000}-\\u{10FFFD}';

// RFC 3987 §2.2: iunreserved = ALPHA / DIGIT / "-" / "." / "_" / "~" / ucschar
const IUNRESERVED_CHARS_SRC = `${UNRESERVED_CHARS_SRC}${UCSCHAR_SRC}`;

const { absolute: IRI_REGEX, relative: IRI_RELATIVE_REF_REGEX } = buildTopLevelRegexes({
  unreservedChars: IUNRESERVED_CHARS_SRC,
  privateQueryChars: IPRIVATE_SRC,
  unicode: true,
});

/** Tests a string against RFC 3987 §2.2 `IRI` — an absolute IRI with an optional fragment. */
export const isValidIri = (iri: string): boolean => IRI_REGEX.test(iri) && isValidAuthorityIpLiteral(iri);

/** Tests a string against RFC 3987 §2.2 `IRI-reference` — an `IRI` or an `irelative-ref`. */
export const isValidIriReference = (iri: string): boolean =>
  (IRI_REGEX.test(iri) || IRI_RELATIVE_REF_REGEX.test(iri)) && isValidAuthorityIpLiteral(iri);
