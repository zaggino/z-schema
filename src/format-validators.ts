import isEmailModule from 'validator/lib/isEmail.js';
import isIPModule from 'validator/lib/isIP.js';
import isURLModule from 'validator/lib/isURL.js';

import { isValidRfc3339Date } from './utils/date.js';
import { isValidHostname, isValidIdnHostname } from './utils/hostname.js';
import { sortedKeys } from './utils/json.js';
import { parseRfc3339Time } from './utils/time.js';

export type FormatValidatorFn = (input: unknown) => boolean | Promise<boolean>;

const dateValidator: FormatValidatorFn = (date: unknown) => {
  if (typeof date !== 'string') {
    return true;
  }
  // full-date from http://tools.ietf.org/html/rfc3339#section-5.6
  const matches = /^(?<year>[0-9]{4})-(?<month>[0-9]{2})-(?<day>[0-9]{2})$/.exec(date);
  if (matches === null) {
    return false;
  }
  const year = Number.parseInt(matches[1], 10);
  const month = Number.parseInt(matches[2], 10);
  const day = Number.parseInt(matches[3], 10);
  return isValidRfc3339Date(year, month, day);
};

const dateTimeValidator: FormatValidatorFn = (dateTime: unknown) => {
  if (typeof dateTime !== 'string') {
    return true;
  }
  // date-time from http://tools.ietf.org/html/rfc3339#section-5.6
  let tIdx = dateTime.indexOf('T');
  if (tIdx === -1) {
    tIdx = dateTime.indexOf('t');
  }
  if (tIdx === -1) {
    return false;
  }
  const datePart = dateTime.slice(0, tIdx);
  const timePart = dateTime.slice(tIdx + 1);
  // Check date
  const dateMatches = /^(?<year>[0-9]{4})-(?<month>[0-9]{2})-(?<day>[0-9]{2})$/.exec(datePart);
  if (dateMatches === null) {
    return false;
  }
  const year = Number.parseInt(dateMatches[1], 10);
  const month = Number.parseInt(dateMatches[2], 10);
  const day = Number.parseInt(dateMatches[3], 10);
  if (!isValidRfc3339Date(year, month, day)) {
    return false;
  }

  return parseRfc3339Time(timePart) !== null;
};

const emailValidator: FormatValidatorFn = (email: unknown) => {
  if (typeof email !== 'string') {
    return true;
  }
  if (isEmailModule.default(email, { require_tld: true, allow_ip_domain: true })) {
    return true;
  }

  const ipv6Literal = /^(?<localPart>.+)@\[IPv6:(?<address>[^\]]+)\]$/i.exec(email);
  if (!ipv6Literal) {
    return false;
  }

  const localPart = ipv6Literal[1];
  const addressPart = ipv6Literal[2];
  if (!isIPModule.default(addressPart, 6)) {
    return false;
  }

  return isEmailModule.default(`${localPart}@example.com`, { require_tld: true });
};

const hostnameValidator: FormatValidatorFn = (hostname: unknown) => {
  if (typeof hostname !== 'string') {
    return true;
  }
  return isValidHostname(hostname);
};

const ipv4Validator: FormatValidatorFn = (ipv4: unknown) => {
  if (typeof ipv4 !== 'string') {
    return true;
  }
  return isIPModule.default(ipv4, 4);
};

const ipv6Validator: FormatValidatorFn = (ipv6: unknown) => {
  if (typeof ipv6 !== 'string') {
    return true;
  }
  if (ipv6.includes('%')) {
    return false;
  }
  return isIPModule.default(ipv6, 6);
};

const INVALID_REGEX_ESCAPES = new Set(['a']);

const regexValidator: FormatValidatorFn = (input: unknown) => {
  if (typeof input !== 'string') {
    return true;
  }

  for (let idx = 0; idx < input.length; idx++) {
    if (input[idx] !== '\\') {
      continue;
    }

    idx++;
    if (idx >= input.length) {
      return false;
    }

    const escaped = input[idx];
    if (INVALID_REGEX_ESCAPES.has(escaped)) {
      return false;
    }
  }

  try {
    // Constructed purely to detect an invalid pattern (throws SyntaxError). The
    // result is intentionally unused; `new` is required by new-for-builtins and
    // `void`/call-form trip no-void/new-for-builtins, so no-new is disabled here.
    // oxlint-disable-next-line no-new
    new RegExp(input);
    return true;
  } catch {
    return false;
  }
};

const durationValidator: FormatValidatorFn = (input: unknown) => {
  if (typeof input !== 'string') {
    return true;
  }

  // eslint-disable-next-line no-control-regex
  if (!/^P[\u0000-\u007F]*$/.test(input)) {
    return false;
  }

  if (!input.startsWith('P')) {
    return false;
  }

  const body = input.slice(1);
  if (body.length === 0) {
    return false;
  }

  if (body.includes('W')) {
    return /^\d+W$/.test(body);
  }

  const parts = body.split('T');
  if (parts.length > 2) {
    return false;
  }

  const datePart = parts[0];
  const timePart = parts.length === 2 ? parts[1] : undefined;

  // RFC 3339 Appendix A ABNF: dur-year = 1*DIGIT "Y" [dur-month], dur-month = 1*DIGIT "M" [dur-day]
  // Y can only be followed by M (not D directly), so P1Y2D is invalid
  if (datePart.length > 0 && !/^(?:\d+Y(?:\d+M(?:\d+D)?)?|\d+M(?:\d+D)?|\d+D)$/.test(datePart)) {
    return false;
  }

  const hasDateComponent = datePart.length > 0;
  let hasTimeComponent = false;

  if (timePart !== undefined) {
    if (timePart.length === 0) {
      return false;
    }
    // RFC 3339 Appendix A ABNF: dur-hour = 1*DIGIT "H" [dur-minute], dur-minute = 1*DIGIT "M" [dur-second]
    // H can only be followed by M (not S directly), so PT1H2S is invalid
    if (!/^(?:\d+H(?:\d+M(?:\d+S)?)?|\d+M(?:\d+S)?|\d+S)$/.test(timePart)) {
      return false;
    }
    hasTimeComponent = /\d+[HMS]/.test(timePart);
    if (!hasTimeComponent) {
      return false;
    }
  }

  return hasDateComponent || hasTimeComponent;
};

const uuidValidator: FormatValidatorFn = (input: unknown) => {
  if (typeof input !== 'string') {
    return true;
  }
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(input);
};

const strictUriValidator: FormatValidatorFn = (uri: unknown) => typeof uri !== 'string' || isURLModule.default(uri);

const isHexChar = (c: number) => (c >= 48 && c <= 57) || (c >= 65 && c <= 70) || (c >= 97 && c <= 102);

const hasValidPercentEncoding = (str: string): boolean => {
  for (let i = 0; i < str.length; i++) {
    if (
      str[i] === '%' &&
      (i + 2 >= str.length || !isHexChar(str.charCodeAt(i + 1)) || !isHexChar(str.charCodeAt(i + 2)))
    ) {
      return false;
    }
  }
  return true;
};

const uriValidator: FormatValidatorFn = (uri: unknown) => {
  if (typeof uri !== 'string') {
    return true;
  }
  // eslint-disable-next-line no-control-regex
  if (/[^\u0000-\u007F]/.test(uri)) {
    return false;
  }
  if (!hasValidPercentEncoding(uri)) {
    return false;
  }
  const match = /^(?<scheme>[a-zA-Z][a-zA-Z0-9+.-]*):\/\/(?<authority>[^/?#]*)/.exec(uri);
  if (match) {
    const authority = match[2];
    const atIndex = authority.indexOf('@');
    if (atIndex > 0) {
      // userinfo is a string; prefer-set-has misfires here — two String#includes
      // calls are faster than building a Set or a regex for this membership check.
      // oxlint-disable-next-line unicorn/prefer-set-has
      const userinfo = authority.slice(0, atIndex);
      if (userinfo.includes('[') || userinfo.includes(']')) {
        return false;
      }
    }
    // Validate port: must be numeric
    let hostPort = atIndex === -1 ? authority : authority.slice(atIndex + 1);
    if (hostPort.startsWith('[')) {
      const bracketEnd = hostPort.indexOf(']');
      if (bracketEnd !== -1) {
        hostPort = hostPort.slice(bracketEnd + 1);
      }
    }
    const colonIndex = hostPort.lastIndexOf(':');
    if (colonIndex !== -1) {
      const port = hostPort.slice(colonIndex + 1);
      if (port.length > 0 && !/^\d+$/.test(port)) {
        return false;
      }
    }
  }
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:[^"\\<>^{}^`| ]*$/.test(uri);
};

const uriReferenceValidator: FormatValidatorFn = (uri: unknown) => {
  if (typeof uri !== 'string') {
    return true;
  }
  // eslint-disable-next-line no-control-regex
  if (/[^\u0000-\u007F]/.test(uri)) {
    return false;
  }
  // URI-reference allows relative URIs
  return /^(?:[a-zA-Z][a-zA-Z0-9+.-]*:)?[^"\\<>^{}^`| ]*$/.test(uri);
};

// RFC 6570 §2.3: varchar = ALPHA / DIGIT / "_" / pct-encoded
const URI_TEMPLATE_VARCHAR_SRC = '(?:[A-Za-z0-9_]|%[0-9A-Fa-f]{2})';
// RFC 6570 §2.3: varname = varchar *( ["."] varchar )
const URI_TEMPLATE_VARNAME_SRC = `${URI_TEMPLATE_VARCHAR_SRC}(?:\\.?${URI_TEMPLATE_VARCHAR_SRC})*`;
// RFC 6570 §2.4: varspec = varname [ modifier-level4 ]; modifier-level4 = prefix / explode
// prefix = ":" max-length, max-length = %x31-39 0*3DIGIT (1-9999, no leading zero); explode = "*"
const URI_TEMPLATE_VARSPEC_SRC = `${URI_TEMPLATE_VARNAME_SRC}(?::[1-9][0-9]{0,3}|\\*)?`;
// RFC 6570 §2.2: operator = op-level2 ("+" / "#") / op-level3 ("." / "/" / ";" / "?" / "&")
//                         / op-reserve ("=" / "," / "!" / "@" / "|")
// op-reserve is accepted for ABNF fidelity only — the spec leaves its expansion semantics
// undefined. The "|" branch is unreachable in practice: the literal charset check in
// uriTemplateValidator rejects any "|" anywhere in the input before this regex runs, and a
// literal space is blocked by that same check.
// RFC 6570 §2: expression body (braces excluded) = [ operator ] variable-list
//              variable-list = varspec *( "," varspec )
const URI_TEMPLATE_EXPRESSION_REGEX = new RegExp(
  `^[+#./;?&=,!@|]?${URI_TEMPLATE_VARSPEC_SRC}(?:,${URI_TEMPLATE_VARSPEC_SRC})*$`
);

const uriTemplateValidator: FormatValidatorFn = (uri: unknown) => {
  if (typeof uri !== 'string') {
    return true;
  }
  // URI template allows braces for expressions.
  // Literal text is checked leniently here: RFC 6570 also excludes "'", bare "%" and the C1
  // controls (%x80-%x9F) from literals, but tightening those would reject inputs accepted by
  // earlier versions. C0 controls and DEL are rejected in the scan below.
  if (!/^(?:[a-zA-Z][a-zA-Z0-9+.-]*:)?[^"\\<>^`| ]*$/.test(uri)) {
    return false;
  }

  // A non-null expressionStart doubles as "inside an expression", so the slice below cannot
  // read a stale index — the null check narrows it to a number.
  let expressionStart: number | null = null;
  for (let idx = 0; idx < uri.length; idx++) {
    const code = uri.charCodeAt(idx);
    // RFC 6570 §2.1: literals start at %x21, so C0 controls and DEL are never literal text.
    // Checking every position is safe as well as cheaper: an expression body containing one
    // would already fail the varchar rule in URI_TEMPLATE_EXPRESSION_REGEX.
    if (code <= 0x1f || code === 0x7f) {
      return false;
    }
    if (code === 0x7b /* { */) {
      if (expressionStart !== null) {
        return false;
      }
      expressionStart = idx + 1;
    } else if (code === 0x7d /* } */) {
      if (expressionStart === null) {
        return false;
      }
      if (!URI_TEMPLATE_EXPRESSION_REGEX.test(uri.slice(expressionStart, idx))) {
        return false;
      }
      expressionStart = null;
    }
  }

  // An unterminated expression leaves expressionStart set.
  return expressionStart === null;
};

const hasValidTildeEscapes = (segment: string): boolean => {
  for (let i = 0; i < segment.length; i++) {
    if (segment[i] === '~') {
      const next = segment[i + 1];
      if (next !== '0' && next !== '1') {
        return false;
      }
      i++; // skip the escape character
    }
  }
  return true;
};

const jsonPointerValidator: FormatValidatorFn = (pointer: unknown) => {
  if (typeof pointer !== 'string') {
    return true;
  }
  // JSON Pointer: empty, or a sequence of '/'-prefixed reference tokens.
  // In each token, '~' must be escaped as '~0' or '~1'.
  if (pointer === '') {
    return true;
  }
  if (!/^(?:\/[^/]*)+$/.test(pointer)) {
    return false;
  }
  const tokens = pointer.split('/');
  for (let i = 1; i < tokens.length; i++) {
    if (!hasValidTildeEscapes(tokens[i])) {
      return false;
    }
  }
  return true;
};

const relativeJsonPointerValidator: FormatValidatorFn = (pointer: unknown) => {
  if (typeof pointer !== 'string') {
    return true;
  }
  // Relative JSON Pointer: non-negative integer prefix (no leading zeros unless zero),
  // followed by either '#', a JSON Pointer, or nothing.
  const match = /^(?<int>0|[1-9]\d*)(?<suffix>.*)$/.exec(pointer);
  if (!match) {
    return false;
  }
  const suffix = match[2];
  if (suffix === '' || suffix === '#') {
    return true;
  }
  if (!suffix.startsWith('/')) {
    return false;
  }
  if (!/^(?:\/[^/]*)+$/.test(suffix)) {
    return false;
  }
  const tokens = suffix.split('/');
  for (let i = 1; i < tokens.length; i++) {
    if (!hasValidTildeEscapes(tokens[i])) {
      return false;
    }
  }
  return true;
};

const timeValidator: FormatValidatorFn = (time: unknown) => {
  if (typeof time !== 'string') {
    return true;
  }
  return parseRfc3339Time(time) !== null;
};

// Matches a lone (unpaired) UTF-16 surrogate — either a high surrogate not
// followed by a low surrogate, or a low surrogate not preceded by a high one.
const LONE_SURROGATE_REGEX = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/;
// A quoted local part: any char except a bare quote/backslash; backslash escapes
// allowed. Leniently permits raw control chars (e.g. bare CR/LF), which stricter
// RFC 5321 parsing forbids — an accepted limitation, not exercised by the suite.
const QUOTED_LOCAL_PART_REGEX = /^"(?:[^"\\]|\\.)*"$/u;
const UNQUOTED_LOCAL_PART_REGEX = /^[^\s@]+$/u;

const isValidIdnEmailLocalPart = (localPart: string): boolean => {
  if (localPart.length === 0 || LONE_SURROGATE_REGEX.test(localPart)) {
    return false;
  }
  if (localPart.length >= 2 && localPart.startsWith('"') && localPart.endsWith('"')) {
    return QUOTED_LOCAL_PART_REGEX.test(localPart);
  }
  return UNQUOTED_LOCAL_PART_REGEX.test(localPart);
};

const idnEmailValidator: FormatValidatorFn = (email: unknown) => {
  if (typeof email !== 'string') {
    return true;
  }
  // Split on the last '@': everything after it is the (idn-)hostname domain,
  // everything before it is the local part (which may itself be quoted).
  // Note: unlike the ASCII `email` validator, IP-literal domains
  // (`user@[192.168.1.1]` / `@[IPv6:...]`) are not supported here.
  const atIdx = email.lastIndexOf('@');
  if (atIdx <= 0 || atIdx === email.length - 1) {
    return false;
  }
  return isValidIdnEmailLocalPart(email.slice(0, atIdx)) && isValidIdnHostname(email.slice(atIdx + 1));
};

const idnHostnameValidator: FormatValidatorFn = (hostname: unknown) => {
  if (typeof hostname !== 'string') {
    return true;
  }
  return isValidIdnHostname(hostname);
};

const iriValidator: FormatValidatorFn = (iri: unknown) => {
  if (typeof iri !== 'string') {
    return true;
  }
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:[^"\\<>^{}^`| ]*$/u.test(iri)) {
    return false;
  }
  try {
    // Constructed purely to detect an unparseable IRI (throws). Avoids URL.canParse,
    // which is unavailable in older browsers the UMD build still targets; no-new is
    // disabled here as the construction is intentional and the result is unused.
    // oxlint-disable-next-line no-new
    new URL(iri);
    return true;
  } catch {
    return false;
  }
};

const iriReferenceValidator: FormatValidatorFn = (iriReference: unknown) => {
  if (typeof iriReference !== 'string') {
    return true;
  }
  return /^(?:[a-zA-Z][a-zA-Z0-9+.-]*:)?[^"\\<>^{}^`| ]*$/u.test(iriReference);
};

export interface FormatValidatorsOptions {
  strictUris?: boolean;
  customFormats?: Record<string, FormatValidatorFn | null>;
}

const inbuiltValidators: Record<string, FormatValidatorFn> = {
  date: dateValidator,
  'date-time': dateTimeValidator,
  email: emailValidator,
  hostname: hostnameValidator,
  'host-name': hostnameValidator,
  ipv4: ipv4Validator,
  ipv6: ipv6Validator,
  regex: regexValidator,
  uri: uriValidator,
  'strict-uri': strictUriValidator,
  'uri-reference': uriReferenceValidator,
  'uri-template': uriTemplateValidator,
  'json-pointer': jsonPointerValidator,
  'relative-json-pointer': relativeJsonPointerValidator,
  time: timeValidator,
  'idn-email': idnEmailValidator,
  'idn-hostname': idnHostnameValidator,
  iri: iriValidator,
  'iri-reference': iriReferenceValidator,
  duration: durationValidator,
  uuid: uuidValidator,
} as const;

const customValidators: Record<string, FormatValidatorFn> = {};

export function getFormatValidators(options?: FormatValidatorsOptions): Record<string, FormatValidatorFn> {
  return {
    ...inbuiltValidators,
    ...(options?.strictUris ? { uri: strictUriValidator } : {}),
    ...customValidators,
    ...options?.customFormats,
  };
}

export function resolveFormatValidator(name: string, options?: FormatValidatorsOptions): FormatValidatorFn | undefined {
  const custom = options?.customFormats;
  if (custom && Object.hasOwn(custom, name)) {
    return custom[name] as FormatValidatorFn | undefined;
  }
  if (Object.hasOwn(customValidators, name)) {
    return customValidators[name];
  }
  if (options?.strictUris && name === 'uri') {
    return strictUriValidator;
  }
  return inbuiltValidators[name];
}

export function registerFormat(name: string, validatorFunction: FormatValidatorFn) {
  customValidators[name] = validatorFunction;
}

export function unregisterFormat(name: string) {
  delete customValidators[name];
}

export function getSupportedFormats(customFormats?: Record<string, FormatValidatorFn | null>) {
  const merged = {
    ...inbuiltValidators,
    ...customValidators,
    ...customFormats,
  };
  const keys = sortedKeys(merged);
  return keys.filter((key) => merged[key] != null);
}

export function isFormatSupported(name: string, customFormats?: Record<string, FormatValidatorFn | null>): boolean {
  if (customFormats) {
    const custom = customFormats[name];
    // Explicitly null means unregistered at instance level
    if (custom === null) {
      return false;
    }
    if (custom != null) {
      return true;
    }
  }
  if (name in customValidators) {
    return customValidators[name] != null;
  }
  return name in inbuiltValidators;
}

export function getRegisteredFormats() {
  return sortedKeys(customValidators);
}
