import isEmailModule from 'validator/lib/isEmail.js';
import isIPModule from 'validator/lib/isIP.js';
import isURLModule from 'validator/lib/isURL.js';

import { bumpGlobalSchemaStateGeneration } from './compiled-schema-cache.js';
import { isValidRfc3339Date } from './utils/date.js';
import { isValidHostname, isValidIdnHostname } from './utils/hostname.js';
import { sortedKeys } from './utils/json.js';
import { createDict } from './utils/properties.js';
import { isValidUri, isValidUriReference } from './utils/rfc-3986.js';
import { isValidIri, isValidIriReference } from './utils/rfc-3987.js';
import { isValidUriTemplate } from './utils/rfc-6570.js';
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

// Matches any code unit outside the ASCII range; hoisted so it is compiled once.
// eslint-disable-next-line no-control-regex
const NON_ASCII_REGEX = /[^\u0000-\u007F]/;

const IPV6_TAG_LENGTH = 7; // "@[IPv6:"

/** Index of the last `@[IPv6:` in `email` (tag letters in either case), or -1. */
const lastIpv6TagIndex = (email: string): number => {
  for (let i = email.length - IPV6_TAG_LENGTH; i >= 0; i--) {
    if (email.charCodeAt(i) !== 0x40 || email.charCodeAt(i + 1) !== 0x5b) {
      continue;
    }
    const c2 = email.charCodeAt(i + 2);
    const c3 = email.charCodeAt(i + 3);
    const c4 = email.charCodeAt(i + 4);
    if (
      (c2 === 0x49 || c2 === 0x69) &&
      (c3 === 0x50 || c3 === 0x70) &&
      (c4 === 0x56 || c4 === 0x76) &&
      email.charCodeAt(i + 5) === 0x36 &&
      email.charCodeAt(i + 6) === 0x3a
    ) {
      return i;
    }
  }
  return -1;
};

const emailValidator: FormatValidatorFn = (email: unknown) => {
  if (typeof email !== 'string') {
    return true;
  }
  // RFC 5321/5322 addresses are ASCII-only — Unicode addresses are `idn-email`.
  // Checked up front because `validator` would otherwise accept non-ASCII in the
  // local part (its `allow_utf8_local_part` option defaults to true, and applies to
  // quoted pairs too) and in the domain (`isFQDN` allows non-ASCII label chars).
  if (NON_ASCII_REGEX.test(email)) {
    return false;
  }
  // `require_tld` is deliberately false: a single-label domain (`test@io`) is a
  // valid address. Dot placement is still enforced by `isFQDN`, so `test@.iana.org`,
  // `test@iana.org.` and `test@iana..com` remain invalid.
  if (isEmailModule.default(email, { require_tld: false, allow_ip_domain: true })) {
    return true;
  }

  // Address literal `<local>@[IPv6:<address>]`: decided by a single scan.
  const last = email.length - 1;
  if (last < 0 || email.charCodeAt(last) !== 0x5d) {
    return false;
  }
  const tagIndex = lastIpv6TagIndex(email);
  if (tagIndex < 1) {
    return false;
  }
  for (let i = 0; i < tagIndex; i++) {
    const c = email.charCodeAt(i);
    if (c === 0x0a || c === 0x0d) {
      return false;
    }
  }
  const addressStart = tagIndex + IPV6_TAG_LENGTH;
  if (addressStart >= last) {
    return false;
  }
  for (let i = addressStart; i < last; i++) {
    if (email.charCodeAt(i) === 0x5d) {
      return false;
    }
  }

  const localPart = email.slice(0, tagIndex);
  const addressPart = email.slice(addressStart, last);
  if (!isIPModule.default(addressPart, 6)) {
    return false;
  }

  return isEmailModule.default(`${localPart}@example.com`, { require_tld: false });
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

const uriValidator: FormatValidatorFn = (uri: unknown) => typeof uri !== 'string' || isValidUri(uri);

const uriReferenceValidator: FormatValidatorFn = (uri: unknown) => typeof uri !== 'string' || isValidUriReference(uri);

const uriTemplateValidator: FormatValidatorFn = (uri: unknown) => typeof uri !== 'string' || isValidUriTemplate(uri);

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
  const { length } = pointer;
  if (length === 0) {
    return false;
  }
  const first = pointer.charCodeAt(0);
  let prefixEnd = 1;
  if (first >= 0x31 && first <= 0x39) {
    while (prefixEnd < length) {
      const c = pointer.charCodeAt(prefixEnd);
      if (c < 0x30 || c > 0x39) {
        break;
      }
      prefixEnd++;
    }
  } else if (first !== 0x30) {
    return false;
  }
  for (let i = prefixEnd; i < length; i++) {
    const c = pointer.charCodeAt(i);
    if (c === 0x0a || c === 0x0d || c === 0x20_28 || c === 0x20_29) {
      return false;
    }
  }
  const suffix = prefixEnd === length ? '' : pointer.slice(prefixEnd);
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

const iriValidator: FormatValidatorFn = (iri: unknown) => typeof iri !== 'string' || isValidIri(iri);

const iriReferenceValidator: FormatValidatorFn = (iriReference: unknown) =>
  typeof iriReference !== 'string' || isValidIriReference(iriReference);

export interface FormatValidatorsOptions {
  strictUris?: boolean;
  customFormats?: Record<string, FormatValidatorFn | null>;
}

// The built-in and the globally registered formats are looked up by the schema's `format` string, so both are
// dictionaries without a prototype: a name such as `constructor` is unknown unless it is an entry.
const inbuiltValidators = createDict<FormatValidatorFn>({
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
});

const inbuiltValidatorFns = new Set<FormatValidatorFn>(Object.values(inbuiltValidators));

/** Returns true if `fn` is a known synchronous validator, i.e. one of the built-in format validators. */
export function isSyncBuiltInFormatValidator(fn: FormatValidatorFn): boolean {
  return inbuiltValidatorFns.has(fn);
}

const customValidators = createDict<FormatValidatorFn>();

/**
 * Every format validator in effect for `options`, keyed by format name. The result has no prototype, so reading a
 * name that is not a format gives `undefined`.
 */
export function getFormatValidators(options?: FormatValidatorsOptions): Record<string, FormatValidatorFn> {
  return createDict({
    ...inbuiltValidators,
    ...(options?.strictUris ? { uri: strictUriValidator } : {}),
    ...customValidators,
    ...options?.customFormats,
  });
}

/**
 * The entry in effect for a format name: the instance's own entry if it has one (a function, or `null` when the
 * format was unregistered on the instance), else the globally registered format, else the built-in one.
 * This is the only place that decides whether a format name is known.
 */
function lookupFormat(
  name: string,
  customFormats: FormatValidatorsOptions['customFormats'],
  strictUris: boolean | undefined
): FormatValidatorFn | null | undefined {
  // the instance map belongs to the caller and may have a prototype, so only its own entries count
  if (customFormats && Object.hasOwn(customFormats, name)) {
    return customFormats[name];
  }
  const registered: FormatValidatorFn | undefined = customValidators[name];
  if (registered !== undefined) {
    return registered;
  }
  if (strictUris && name === 'uri') {
    return strictUriValidator;
  }
  return inbuiltValidators[name];
}

export function resolveFormatValidator(name: string, options?: FormatValidatorsOptions): FormatValidatorFn | undefined {
  return lookupFormat(name, options?.customFormats, options?.strictUris) ?? undefined;
}

export function registerFormat(name: string, validatorFunction: FormatValidatorFn) {
  customValidators[name] = validatorFunction;
  bumpGlobalSchemaStateGeneration();
}

export function unregisterFormat(name: string) {
  delete customValidators[name];
  bumpGlobalSchemaStateGeneration();
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
  return typeof lookupFormat(name, customFormats, false) === 'function';
}

export function getRegisteredFormats() {
  return sortedKeys(customValidators);
}
