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
  const matches = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(date);
  if (matches === null) {
    return false;
  }
  const year = parseInt(matches[1], 10);
  const month = parseInt(matches[2], 10);
  const day = parseInt(matches[3], 10);
  return isValidRfc3339Date(year, month, day);
};

const dateTimeValidator: FormatValidatorFn = (dateTime: unknown) => {
  if (typeof dateTime !== 'string') {
    return true;
  }
  // date-time from http://tools.ietf.org/html/rfc3339#section-5.6
  const s = dateTime.toLowerCase().split('t');
  if (s.length !== 2) {
    return false;
  }
  const datePart = s[0];
  const timePart = s[1];
  // Check date
  const dateMatches = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(datePart);
  if (dateMatches === null) {
    return false;
  }
  const year = parseInt(dateMatches[1], 10);
  const month = parseInt(dateMatches[2], 10);
  const day = parseInt(dateMatches[3], 10);
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

  const ipv6Literal = /^(.+)@\[IPv6:([^\]]+)\]$/i.exec(email);
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

const regexValidator: FormatValidatorFn = (input: unknown) => {
  if (typeof input !== 'string') {
    return true;
  }

  const invalidEscapes = new Set(['a']);
  for (let idx = 0; idx < input.length; idx++) {
    if (input[idx] !== '\\') {
      continue;
    }

    idx++;
    if (idx >= input.length) {
      return false;
    }

    const escaped = input[idx];
    if (invalidEscapes.has(escaped)) {
      return false;
    }
  }

  try {
    RegExp(input);
    return true;
  } catch (_e) {
    return false;
  }
};

const durationValidator: FormatValidatorFn = (input: unknown) => {
  if (typeof input !== 'string') {
    return true;
  }

  // eslint-disable-next-line no-control-regex
  if (!/^P[\x00-\x7F]*$/.test(input)) {
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

  const hasDateComponent = /\d+[YMD]/.test(datePart);
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

const hasValidPercentEncoding = (str: string): boolean => {
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '%') {
      if (i + 2 >= str.length || !/[0-9a-fA-F]/.test(str[i + 1]) || !/[0-9a-fA-F]/.test(str[i + 2])) {
        return false;
      }
    }
  }
  return true;
};

const uriValidator: FormatValidatorFn = function (uri: unknown) {
  if (typeof uri !== 'string') return true;
  // eslint-disable-next-line no-control-regex
  if (/[^\x00-\x7F]/.test(uri)) return false;
  if (!hasValidPercentEncoding(uri)) return false;
  const match = uri.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/([^/?#]*)/);
  if (match) {
    const authority = match[2];
    const atIndex = authority.indexOf('@');
    if (atIndex > 0) {
      const userinfo = authority.substring(0, atIndex);
      if (userinfo.includes('[') || userinfo.includes(']')) {
        return false;
      }
    }
    // Validate port: must be numeric
    let hostPort = atIndex >= 0 ? authority.substring(atIndex + 1) : authority;
    if (hostPort.startsWith('[')) {
      const bracketEnd = hostPort.indexOf(']');
      if (bracketEnd >= 0) {
        hostPort = hostPort.substring(bracketEnd + 1);
      }
    }
    const colonIndex = hostPort.lastIndexOf(':');
    if (colonIndex >= 0) {
      const port = hostPort.substring(colonIndex + 1);
      if (port.length > 0 && !/^\d+$/.test(port)) {
        return false;
      }
    }
  }
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:[^"\\<>^{}^`| ]*$/.test(uri);
};

const uriReferenceValidator: FormatValidatorFn = (uri: unknown) => {
  if (typeof uri !== 'string') return true;
  // eslint-disable-next-line no-control-regex
  if (/[^\x00-\x7F]/.test(uri)) return false;
  // URI-reference allows relative URIs
  return /^([a-zA-Z][a-zA-Z0-9+.-]*:)?[^"\\<>^{}^`| ]*$/.test(uri);
};

const uriTemplateValidator: FormatValidatorFn = (uri: unknown) => {
  if (typeof uri !== 'string') return true;
  // URI template allows braces for expressions.
  if (!/^([a-zA-Z][a-zA-Z0-9+.-]*:)?[^"\\<>^`| ]*$/.test(uri)) {
    return false;
  }

  let inExpression = false;
  for (let idx = 0; idx < uri.length; idx++) {
    const ch = uri[idx];
    if (ch === '{') {
      if (inExpression) {
        return false;
      }
      inExpression = true;
    } else if (ch === '}') {
      if (!inExpression) {
        return false;
      }
      inExpression = false;
    }
  }

  return !inExpression;
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
  if (typeof pointer !== 'string') return true;
  // JSON Pointer: empty, or a sequence of '/'-prefixed reference tokens.
  // In each token, '~' must be escaped as '~0' or '~1'.
  if (pointer === '') return true;
  if (!/^(?:\/[^/]*)+$/.test(pointer)) return false;
  const tokens = pointer.split('/').slice(1); // first element is empty before leading '/'
  for (const token of tokens) {
    if (!hasValidTildeEscapes(token)) return false;
  }
  return true;
};

const relativeJsonPointerValidator: FormatValidatorFn = (pointer: unknown) => {
  if (typeof pointer !== 'string') return true;
  // Relative JSON Pointer: non-negative integer prefix (no leading zeros unless zero),
  // followed by either '#', a JSON Pointer, or nothing.
  const match = pointer.match(/^(0|[1-9]\d*)(.*)$/);
  if (!match) return false;
  const suffix = match[2];
  if (suffix === '' || suffix === '#') return true;
  if (!suffix.startsWith('/')) return false;
  if (!/^(?:\/[^/]*)+$/.test(suffix)) return false;
  const tokens = suffix.split('/').slice(1);
  for (const token of tokens) {
    if (!hasValidTildeEscapes(token)) return false;
  }
  return true;
};

const timeValidator: FormatValidatorFn = (time: unknown) => {
  if (typeof time !== 'string') return true;
  return parseRfc3339Time(time) !== null;
};

const idnEmailValidator: FormatValidatorFn = (email: unknown) => {
  if (typeof email !== 'string') return true;
  // Simple email check, allowing international chars
  return /^[^\s@]+@[^\s@]+$/.test(email);
};

const idnHostnameValidator: FormatValidatorFn = (hostname: unknown) => {
  if (typeof hostname !== 'string') return true;
  return isValidIdnHostname(hostname);
};

const iriValidator: FormatValidatorFn = (iri: unknown) => {
  if (typeof iri !== 'string') return true;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:[^"\\<>^{}^`| ]*$/u.test(iri)) {
    return false;
  }
  try {
    new URL(iri);
    return true;
  } catch (_e) {
    return false;
  }
};

const iriReferenceValidator: FormatValidatorFn = (iriReference: unknown) => {
  if (typeof iriReference !== 'string') return true;
  return /^([a-zA-Z][a-zA-Z0-9+.-]*:)?[^"\\<>^{}^`| ]*$/u.test(iriReference);
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
    ...(options?.customFormats || {}),
  };
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
    if (custom === null) return false;
    if (custom != null) return true;
  }
  if (name in customValidators) return customValidators[name] != null;
  return name in inbuiltValidators;
}

export function getRegisteredFormats() {
  return sortedKeys(customValidators);
}
