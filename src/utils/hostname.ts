import punycode from 'punycode/punycode.js';
import isIPModule from 'validator/lib/isIP.js';

const IDN_SEPARATOR_REGEX = /[\u3002\uff0e\uff61]/g;
const IDN_SEPARATOR_TEST_REGEX = /[\u3002\uff0e\uff61]/;

const splitHostnameLabels = (hostname: string): string[] | null => {
  if (hostname.length === 0 || hostname.length > 255) {
    return null;
  }
  if (hostname.startsWith('.') || hostname.endsWith('.')) {
    return null;
  }
  const labels = hostname.split('.');
  if (labels.some((label) => label.length === 0 || label.length > 63)) {
    return null;
  }
  return labels;
};

const isAsciiHostnameLabel = (label: string): boolean => /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label);

const isGreek = (char: string): boolean => /\p{Script=Greek}/u.test(char);

const isHebrew = (char: string): boolean => /\p{Script=Hebrew}/u.test(char);

const hasCjkKanaOrHan = (input: string): boolean =>
  /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(input);

const toUnicodeLabel = (label: string): string | null => {
  if (!/^xn--/i.test(label)) {
    return label;
  }
  try {
    return punycode.toUnicode(label.toLowerCase());
  } catch (_e) {
    return null;
  }
};

const isValidIdnUnicodeLabel = (label: string): boolean => {
  if (label.startsWith('-') || label.endsWith('-')) {
    return false;
  }

  if (label.length >= 4 && label[2] === '-' && label[3] === '-' && !/^xn--/i.test(label)) {
    return false;
  }

  if (/^\p{M}/u.test(label)) {
    return false;
  }

  if (/[\u302e\u302f\u0640\u07fa]/u.test(label)) {
    return false;
  }

  for (let idx = 0; idx < label.length; idx++) {
    const char = label[idx];

    if (char === '\u00b7') {
      if (idx === 0 || idx === label.length - 1 || label[idx - 1] !== 'l' || label[idx + 1] !== 'l') {
        return false;
      }
    }

    if (char === '\u0375') {
      if (idx === label.length - 1 || !isGreek(label[idx + 1])) {
        return false;
      }
    }

    if (char === '\u05f3' || char === '\u05f4') {
      if (idx === 0 || !isHebrew(label[idx - 1])) {
        return false;
      }
    }

    if (char === '\u200d') {
      if (idx === 0 || label[idx - 1] !== '\u094d') {
        return false;
      }
    }
  }

  if (label.includes('\u30fb') && !hasCjkKanaOrHan(label.replace(/\u30fb/g, ''))) {
    return false;
  }

  const hasArabicIndic = /[\u0660-\u0669]/.test(label);
  const hasExtendedArabicIndic = /[\u06f0-\u06f9]/.test(label);
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
  if (IDN_SEPARATOR_TEST_REGEX.test(hostname) || /[^\x00-\x7F]/.test(hostname)) {
    return false;
  }

  if (isIPModule.default(hostname, 4)) {
    return false;
  }

  const labels = splitHostnameLabels(hostname);
  if (labels === null) {
    return false;
  }

  for (const label of labels) {
    if (!isAsciiHostnameLabel(label)) {
      return false;
    }

    const unicodeLabel = toUnicodeLabel(label);
    if (unicodeLabel === null || !isValidIdnUnicodeLabel(unicodeLabel)) {
      return false;
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

  for (const label of labels) {
    const unicodeLabel = toUnicodeLabel(label);
    if (unicodeLabel === null || !isValidIdnUnicodeLabel(unicodeLabel)) {
      return false;
    }
  }

  return true;
};
