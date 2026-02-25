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
  return isEmailModule.default(email, { require_tld: true });
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
  try {
    RegExp(input);
    return true;
  } catch (_e) {
    return false;
  }
};

const strictUriValidator: FormatValidatorFn = (uri: unknown) => typeof uri !== 'string' || isURLModule.default(uri);

const uriValidator: FormatValidatorFn = function (uri: unknown) {
  if (typeof uri !== 'string') return true;
  // eslint-disable-next-line no-control-regex
  if (/[^\x00-\x7F]/.test(uri)) return false;
  const match = uri.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/([^/]*)/);
  if (match) {
    const authority = match[2];
    const atIndex = authority.indexOf('@');
    if (atIndex > 0) {
      const userinfo = authority.substring(0, atIndex);
      if (userinfo.includes('[') || userinfo.includes(']')) {
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

const jsonPointerValidator: FormatValidatorFn = (pointer: unknown) => {
  if (typeof pointer !== 'string') return true;
  // JSON Pointer: empty, or a sequence of '/'-prefixed reference tokens.
  // In each token, '~' must be escaped as '~0' or '~1'.
  return pointer === '' || /^(?:\/(?:[^~]|~0|~1)*)+$/.test(pointer);
};

const relativeJsonPointerValidator: FormatValidatorFn = (pointer: unknown) => {
  if (typeof pointer !== 'string') return true;
  // Relative JSON Pointer: non-negative integer prefix (no leading zeros unless zero),
  // followed by either '#', a JSON Pointer, or nothing.
  return /^(?:0|[1-9]\d*)(?:#|(?:\/(?:[^~]|~0|~1)*)+)?$/.test(pointer);
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
  const supported = getSupportedFormats(customFormats);
  return supported.includes(name);
}

export function getRegisteredFormats() {
  return sortedKeys(customValidators);
}
