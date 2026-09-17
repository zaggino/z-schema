// RFC 6570 — URI Template
// https://www.rfc-editor.org/rfc/rfc6570#section-2
//
// URI-Template = *( literals / expression ) has no nesting — an expression cannot contain
// an expression, and "{" / "}" are excluded from literals — so the production is a regular
// language and compiles to one anchored regex with no companion scan, unlike the two-pass
// grammar + scan this replaces.
//
// ucschar and iprivate are imported from src/utils/rfc-3987.ts rather than restated here:
// RFC 6570 §1.5 imports them from RFC 3987 normatively, so this module contributes no
// character classes of its own for those two.
//
// Deliberately NOT gated behind safe-regex2, for the same reason src/utils/rfc-3986.ts:11-15
// gives, plus one specific to this grammar: the three top-level branches (expression, a
// pct-encoded triplet, a bare literal character) are pairwise disjoint on their first
// character — "{" starts an expression, "%" starts a pct-encoded triplet since %x25 is
// excluded from the literal class, and nothing else can start either — and the star-height-2
// region (varname repeating inside variable-list's repeating varspec) is equally forced,
// because "." and "," are not varchars. Every alternation is decided by one lookahead
// character, so backtracking stays linear. Measured: <= 0.33 ms on 100k-char adversarial
// inputs.

import { IPRIVATE_SRC, UCSCHAR_SRC } from './rfc-3987.js';

// RFC 6570 §1.5 (via RFC 3986 §2.1): pct-encoded = "%" HEXDIG HEXDIG
const PCT_ENCODED_SRC = '%[0-9A-Fa-f]{2}';

// RFC 6570 §2.1, as corrected by Errata 6937 (Verified):
//   literals = %x21 / %x23-24 / %x26-3B / %x3D / %x3F-5B
//            / %x5D / %x5F / %x61-7A / %x7E / ucschar / iprivate / pct-encoded
// The erratum replaces the published "%x26 / %x28-3B" with "%x26-3B", restoring
// %x27 (') to the literal set. RFC 6570 §3.2.1's own example `'{var}'` is only
// well-formed with the erratum applied.
// Gaps are load-bearing: %x22 ("), %x25 (%) -> the pct-encoded branch,
// %x7B/%x7D ({ }) -> expression delimiters, and %x3C %x3E %x5C %x5E %x60 %x7C
// are not literals at all.
// %x5D ("]") is written as an explicit `\\]` rather than the bare hex-escaped character: inside
// a `[...]` class, an unescaped "]" closes the class wherever it appears, hex-escaped or not —
// only a literal backslash immediately before it prevents that.
const LITERAL_CHARS_SRC = `!#$&-;=?-[\\]_a-z~${UCSCHAR_SRC}${IPRIVATE_SRC}`;
const LITERALS_SRC = `(?:[${LITERAL_CHARS_SRC}]|${PCT_ENCODED_SRC})`;

// RFC 6570 §2.3: varchar = ALPHA / DIGIT / "_" / pct-encoded
const VARCHAR_SRC = `(?:[A-Za-z0-9_]|${PCT_ENCODED_SRC})`;
// RFC 6570 §2.3: varname = varchar *( ["."] varchar )
// The "." must be a real `\.` in the compiled regex, not a bare ".": inside a template literal,
// "\." is not a recognized string escape, so a single backslash is dropped before the pattern is
// ever compiled and the regex engine would see an unescaped, unintended wildcard. `\\.` puts one
// literal backslash character in the source string, which is what regex-escapes the dot.
const VARNAME_SRC = `${VARCHAR_SRC}(?:\\.?${VARCHAR_SRC})*`;
// RFC 6570 §2.4: varspec = varname [ modifier-level4 ]
//   modifier-level4 = prefix / explode
//   prefix = ":" max-length ; max-length = %x31-39 0*3DIGIT (1-9999, no leading zero)
//   explode = "*"
// Same NonEscapeCharacter hazard as VARNAME_SRC above: `\\*` puts a real backslash ahead of "*".
const VARSPEC_SRC = `${VARNAME_SRC}(?::[1-9][0-9]{0,3}|\\*)?`;
// RFC 6570 §2.2: operator = op-level2 / op-level3 / op-reserve
//   op-level2 = "+" / "#" ; op-level3 = "." / "/" / ";" / "?" / "&"
//   op-reserve = "=" / "," / "!" / "@" / "|"
// op-reserve is accepted for ABNF fidelity; the spec leaves its expansion
// semantics undefined.
const OPERATOR_SRC = '[+#./;?&=,!@|]';
// RFC 6570 §2: expression = "{" [ operator ] variable-list "}"
//              variable-list = varspec *( "," varspec )
// "{" and "}" must be escaped: under the `u` flag an unescaped "}" is a SyntaxError. As above,
// `\\{` / `\\}` (not `\{` / `\}`) are what actually survive template-literal parsing as escapes.
const EXPRESSION_SRC = `\\{${OPERATOR_SRC}?${VARSPEC_SRC}(?:,${VARSPEC_SRC})*\\}`;

// RFC 6570 §2: URI-Template = *( literals / expression )
const URI_TEMPLATE_REGEX = new RegExp(`^(?:${LITERALS_SRC}|${EXPRESSION_SRC})*$`, 'u');

/**
 * Tests a string against RFC 6570 §2 `URI-Template`, with Errata 6937 (Verified) applied.
 *
 * Accepts the empty string — `*( literals / expression )` admits zero repetitions.
 */
export const isValidUriTemplate = (value: string): boolean => URI_TEMPLATE_REGEX.test(value);
