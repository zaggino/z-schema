import punycode from 'punycode/punycode.js';
import isIPModule from 'validator/lib/isIP.js';

const IDN_SEPARATOR_REGEX = /[\u3002\uFF0E\uFF61]/g;
const IDN_SEPARATOR_TEST_REGEX = /[\u3002\uFF0E\uFF61]/;

// IDNA2008 (RFC 5890-5893) support below is a hand-rolled approximation built on
// General_Category / Script Unicode-property regexes (JS regex has no
// \p{Bidi_Class} or \p{Joining_Type}). It covers the JSON-Schema-Test-Suite
// corpus, not the full IDNA table. Known limitations: joining-context (CONTEXTJ)
// only models Arabic script; the ZWJ/ZWNJ Virama context recognizes only the
// Devanagari virama U+094D (not other scripts' viramas); Bidi class detection
// covers L/R/AL/AN/EN/NSM and treats everything else as ON; and U-labels are not
// required to be in Unicode NFC form. All regexes/Sets are hoisted to module scope
// so they are compiled once (format validation runs on hot paths).

// Matches an A-label (ACE) prefix; hoisted so it is compiled once, not per label.
const XN_LABEL_REGEX = /^xn--/i;

// RFC 5892 section 2.6 lists a handful of code points that are PVALID (or governed
// by a contextual rule) despite being Punctuation/Symbol. A blanket "reject
// P/S/Z/C" DISALLOWED heuristic must whitelist exactly these so valid labels are
// not rejected. Letters (e.g. U+00DF sharp s, U+03C2 final sigma) and Numbers
// (e.g. U+3007) are unaffected by the heuristic and need no entry here.
const DISALLOWED_CATEGORY_REGEX = /[\p{P}\p{S}\p{Z}\p{C}]/u;
const DISALLOWED_CATEGORY_WHITELIST: ReadonlySet<string> = new Set([
  '-', // HYPHEN-MINUS (medial; leading/trailing rejected separately)
  '\u00B7', // MIDDLE DOT (CONTEXTO)
  '\u0375', // GREEK LOWER NUMERAL SIGN / KERAIA (CONTEXTO)
  '\u05F3', // HEBREW PUNCTUATION GERESH (CONTEXTO)
  '\u05F4', // HEBREW PUNCTUATION GERSHAYIM (CONTEXTO)
  '\u30FB', // KATAKANA MIDDLE DOT (CONTEXTO)
  '\u06FD', // ARABIC SIGN SINDHI AMPERSAND (RFC 5892 section 2.6 PVALID)
  '\u06FE', // ARABIC SIGN SINDHI POSTPOSITION MEN (RFC 5892 section 2.6 PVALID)
  '\u0F0B', // TIBETAN MARK INTERSYLLABIC TSHEG (RFC 5892 section 2.6 PVALID)
  '\u200C', // ZERO WIDTH NON-JOINER (CONTEXTJ, checked separately)
  '\u200D', // ZERO WIDTH JOINER (CONTEXTJ, checked separately)
]);

const isDisallowedCodePoint = (char: string): boolean =>
  DISALLOWED_CATEGORY_REGEX.test(char) && !DISALLOWED_CATEGORY_WHITELIST.has(char);

// CONTEXTJ (RFC 5892 Appendix A.1) support for ZERO WIDTH NON-JOINER.
const TRANSPARENT_MARK_REGEX = /\p{Mn}/u;
const ARABIC_SCRIPT_REGEX = /\p{Script=Arabic}/u;
const ARABIC_INDIC_DIGITS_REGEX = /[\u0660-\u0669\u06F0-\u06F9]/;

// Approximates Joining_Type {L, D, R} as "an Arabic-script letter" (excluding the
// Arabic-Indic digit ranges, which are not letters).
const isArabicJoiningLetter = (char: string | undefined): boolean =>
  char !== undefined && ARABIC_SCRIPT_REGEX.test(char) && !ARABIC_INDIC_DIGITS_REGEX.test(char);

// ZWNJ at `idx` is valid if it sits between two joining letters, skipping over any
// Transparent (combining-mark) code points on either side.
const hasZwnjJoiningContext = (label: string, idx: number): boolean => {
  let before = idx - 1;
  while (before >= 0 && TRANSPARENT_MARK_REGEX.test(label[before])) {
    before--;
  }
  let after = idx + 1;
  while (after < label.length && TRANSPARENT_MARK_REGEX.test(label[after])) {
    after++;
  }
  return isArabicJoiningLetter(label[before]) && isArabicJoiningLetter(label[after]);
};

// RFC 5893 Bidi rule. Bidi_Class is approximated from Script / General_Category.
type BidiClass = 'AL' | 'AN' | 'EN' | 'L' | 'NSM' | 'ON' | 'R';

const BIDI_NSM_REGEX = /[\p{Mn}\p{Me}]/u;
const BIDI_ARABIC_INDIC_DIGIT_REGEX = /[\u0660-\u0669]/; // Bidi_Class AN
const BIDI_EXTENDED_ARABIC_INDIC_DIGIT_REGEX = /[\u06F0-\u06F9]/; // Bidi_Class EN (NOT AN)
const BIDI_HEBREW_SCRIPT_REGEX = /\p{Script=Hebrew}/u; // Bidi_Class R
const BIDI_AL_SCRIPT_REGEX = /[\p{Script=Arabic}\p{Script=Syriac}\p{Script=Thaana}]/u; // Bidi_Class AL
const BIDI_ASCII_DIGIT_REGEX = /[0-9]/; // Bidi_Class EN
const BIDI_LETTER_REGEX = /\p{L}/u;

const classifyBidi = (char: string): BidiClass => {
  if (BIDI_NSM_REGEX.test(char)) {
    return 'NSM';
  }
  if (BIDI_ARABIC_INDIC_DIGIT_REGEX.test(char)) {
    return 'AN';
  }
  if (BIDI_EXTENDED_ARABIC_INDIC_DIGIT_REGEX.test(char)) {
    return 'EN';
  }
  if (BIDI_HEBREW_SCRIPT_REGEX.test(char)) {
    return 'R';
  }
  if (BIDI_AL_SCRIPT_REGEX.test(char)) {
    return 'AL';
  }
  if (BIDI_ASCII_DIGIT_REGEX.test(char)) {
    return 'EN';
  }
  if (BIDI_LETTER_REGEX.test(char)) {
    return 'L';
  }
  return 'ON';
};

// A domain is "Bidi" (and thus subject to the Bidi rule) if any label contains an
// R, AL, or AN character. Iterated by code point so surrogate pairs stay intact.
const isLabelBidiTriggering = (label: string): boolean => {
  for (const char of label) {
    const bidiClass = classifyBidi(char);
    if (bidiClass === 'R' || bidiClass === 'AL' || bidiClass === 'AN') {
      return true;
    }
  }
  return false;
};

const isLabelBidiRuleValid = (label: string): boolean => {
  const classes: BidiClass[] = [];
  for (const char of label) {
    classes.push(classifyBidi(char));
  }
  if (classes.length === 0) {
    return false;
  }

  const first = classes[0];
  // Rule 1: the first character must be L, R, or AL.
  if (first !== 'L' && first !== 'R' && first !== 'AL') {
    return false;
  }

  // The "last" character check ignores trailing NSM marks.
  let lastIdx = classes.length - 1;
  while (lastIdx > 0 && classes[lastIdx] === 'NSM') {
    lastIdx--;
  }
  const last = classes[lastIdx];

  if (first === 'R' || first === 'AL') {
    // Rule 2: RTL label.
    let hasEN = false;
    let hasAN = false;
    for (let i = 0; i < classes.length; i++) {
      const c = classes[i];
      if (c !== 'R' && c !== 'AL' && c !== 'AN' && c !== 'EN' && c !== 'NSM' && c !== 'ON') {
        return false;
      }
      if (c === 'EN') {
        hasEN = true;
      } else if (c === 'AN') {
        hasAN = true;
      }
    }
    if (hasEN && hasAN) {
      return false;
    }
    return last === 'R' || last === 'AL' || last === 'EN' || last === 'AN';
  }

  // Rule 3: LTR label.
  for (let i = 0; i < classes.length; i++) {
    const c = classes[i];
    if (c !== 'L' && c !== 'EN' && c !== 'NSM' && c !== 'ON') {
      return false;
    }
  }
  return last === 'L' || last === 'EN';
};

const isDomainBidiValid = (unicodeLabels: string[]): boolean => {
  let isBidiDomain = false;
  for (let i = 0; i < unicodeLabels.length; i++) {
    if (isLabelBidiTriggering(unicodeLabels[i])) {
      isBidiDomain = true;
      break;
    }
  }
  if (!isBidiDomain) {
    return true;
  }
  for (let i = 0; i < unicodeLabels.length; i++) {
    if (!isLabelBidiRuleValid(unicodeLabels[i])) {
      return false;
    }
  }
  return true;
};

const splitHostnameLabels = (hostname: string): string[] | null => {
  if (hostname.length === 0 || hostname.length > 255) {
    return null;
  }
  if (hostname.startsWith('.') || hostname.endsWith('.')) {
    return null;
  }
  const labels = hostname.split('.');
  for (let i = 0; i < labels.length; i++) {
    const len = labels[i].length;
    if (len === 0 || len > 63) {
      return null;
    }
  }
  return labels;
};

const isAsciiHostnameLabel = (label: string): boolean => /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label);

const isGreek = (char: string): boolean => /\p{Script=Greek}/u.test(char);

const isHebrew = (char: string): boolean => /\p{Script=Hebrew}/u.test(char);

const hasCjkKanaOrHan = (input: string): boolean =>
  /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(input);

const toUnicodeLabel = (label: string): string | null => {
  if (!XN_LABEL_REGEX.test(label)) {
    return label;
  }
  try {
    return punycode.toUnicode(label.toLowerCase());
  } catch {
    return null;
  }
};

const isValidIdnUnicodeLabel = (label: string): boolean => {
  if (label.startsWith('-') || label.endsWith('-')) {
    return false;
  }

  if (label.length >= 4 && label[2] === '-' && label[3] === '-' && !XN_LABEL_REGEX.test(label)) {
    return false;
  }

  if (/^\p{M}/u.test(label)) {
    return false;
  }

  if (/[\u302E\u302F\u0640\u07FA]/u.test(label)) {
    return false;
  }

  for (let idx = 0; idx < label.length; idx++) {
    const char = label[idx];

    if (
      char === '\u00B7' &&
      (idx === 0 || idx === label.length - 1 || label[idx - 1] !== 'l' || label[idx + 1] !== 'l')
    ) {
      return false;
    }

    if (char === '\u0375' && (idx === label.length - 1 || !isGreek(label[idx + 1]))) {
      return false;
    }

    if ((char === '\u05F3' || char === '\u05F4') && (idx === 0 || !isHebrew(label[idx - 1]))) {
      return false;
    }

    if (char === '\u200D' && (idx === 0 || label[idx - 1] !== '\u094D')) {
      return false;
    }

    // ZERO WIDTH NON-JOINER (CONTEXTJ, RFC 5892 Appendix A.1): valid only when
    // preceded by a Virama, or when it sits in a joining context.
    if (char === '\u200C' && (idx === 0 || (label[idx - 1] !== '\u094D' && !hasZwnjJoiningContext(label, idx)))) {
      return false;
    }
  }

  // Reject IDNA2008-DISALLOWED code points (Punctuation/Symbol/Separator/Other,
  // minus the RFC 5892 section 2.6 / contextual exceptions). Iterated by code point so a
  // surrogate pair is not mistaken for a lone \p{Cs} half.
  for (const char of label) {
    if (isDisallowedCodePoint(char)) {
      return false;
    }
  }

  if (label.includes('\u30FB') && !hasCjkKanaOrHan(label.replaceAll('・', ''))) {
    return false;
  }

  const hasArabicIndic = /[\u0660-\u0669]/.test(label);
  const hasExtendedArabicIndic = /[\u06F0-\u06F9]/.test(label);
  if (hasArabicIndic && hasExtendedArabicIndic) {
    return false;
  }

  return true;
};

/*
  http://json-schema.org/latest/json-schema-validation.html#anchor114
  A string instance is valid against this attribute if it is a valid
  representation for an Internet host name, as defined by RFC 1034, section 3.1 [RFC1034].

  http://tools.ietf.org/html/rfc1034#section-3.5

  <digit> ::= any one of the ten digits 0 through 9
  var digit = /[0-9]/;

  <letter> ::= any one of the 52 alphabetic characters A through Z in upper case and a through z in lower case
  var letter = /[a-zA-Z]/;

  <let-dig> ::= <letter> | <digit>
  var letDig = /[0-9a-zA-Z]/;

  <let-dig-hyp> ::= <let-dig> | "-"
  var letDigHyp = /[-0-9a-zA-Z]/;

  <ldh-str> ::= <let-dig-hyp> | <let-dig-hyp> <ldh-str>
  var ldhStr = /[-0-9a-zA-Z]+/;

  <label> ::= <letter> [ [ <ldh-str> ] <let-dig> ]
  var label = /[a-zA-Z](([-0-9a-zA-Z]+)?[0-9a-zA-Z])?/;

  <subdomain> ::= <label> | <subdomain> "." <label>
  var subdomain = /^[a-zA-Z](([-0-9a-zA-Z]+)?[0-9a-zA-Z])?(\.[a-zA-Z](([-0-9a-zA-Z]+)?[0-9a-zA-Z])?)*$/;

  <domain> ::= <subdomain> | " "
  var domain = null;
*/
export const isValidHostname = (hostname: string): boolean => {
  // eslint-disable-next-line no-control-regex
  if (IDN_SEPARATOR_TEST_REGEX.test(hostname) || /[^\u0000-\u007F]/.test(hostname)) {
    return false;
  }

  if (isIPModule.default(hostname, 4)) {
    return false;
  }

  const labels = splitHostnameLabels(hostname);
  if (labels === null) {
    return false;
  }

  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    if (!isAsciiHostnameLabel(label)) {
      return false;
    }

    // Punycode (A-label) hostnames encode IDN labels, so validate the decoded Unicode form
    if (XN_LABEL_REGEX.test(label)) {
      const unicodeLabel = toUnicodeLabel(label);
      if (unicodeLabel === null || !isValidIdnUnicodeLabel(unicodeLabel)) {
        return false;
      }
    }
  }

  return true;
};

export const isValidIdnHostname = (hostname: string): boolean => {
  const normalizedHostname = hostname.replace(IDN_SEPARATOR_REGEX, '.');
  const labels = splitHostnameLabels(normalizedHostname);
  if (labels === null) {
    return false;
  }

  const unicodeLabels: string[] = [];
  let totalLength = labels.length - 1; // separator dots between labels

  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    const unicodeLabel = toUnicodeLabel(label);
    if (unicodeLabel === null || !isValidIdnUnicodeLabel(unicodeLabel)) {
      return false;
    }

    let aLabel: string;
    try {
      aLabel = punycode.toASCII(unicodeLabel);
    } catch {
      return false;
    }

    // An A-label (xn-- input) must be canonical Punycode: re-encoding its decoded
    // U-label must reproduce the original A-label. This also rejects an A-label
    // that decodes to pure ASCII, since such a label never re-encodes to an "xn--"
    // form (RFC 5890 §2.3.2.1, RFC 5891 §5.4).
    if (XN_LABEL_REGEX.test(label) && aLabel.toLowerCase() !== label.toLowerCase()) {
      return false;
    }

    // RFC 5890 §2.3.2.1 — the A-label form of any label must not exceed 63 octets.
    if (aLabel.length > 63) {
      return false;
    }

    totalLength += aLabel.length;
    unicodeLabels.push(unicodeLabel);
  }

  // RFC 1035 §3.1 — the domain name (in A-label form) must not exceed 253 octets.
  if (totalLength > 253) {
    return false;
  }

  return isDomainBidiValid(unicodeLabels);
};
