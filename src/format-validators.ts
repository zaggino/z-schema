import isEmailModule from 'validator/lib/isEmail.js';
import isIPModule from 'validator/lib/isIP.js';
import isURLModule from 'validator/lib/isURL.js';

import { sortedKeys } from './utils/json.js';

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
  // var year = matches[1];
  // var month = matches[2];
  // var day = matches[3];
  if (matches[2] < '01' || matches[2] > '12' || matches[3] < '01' || matches[3] > '31') {
    return false;
  }
  return true;
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
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  // Check if date is valid
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return false;
  }
  // Check time
  const timeMatches = /^([0-9]{2}):([0-9]{2}):([0-9]{2})(.[0-9]+)?(z|([+-][0-9]{2}:[0-9]{2}))$/.exec(timePart);
  if (timeMatches === null) {
    return false;
  }
  const hour = parseInt(timeMatches[1], 10);
  const minute = parseInt(timeMatches[2], 10);
  const second = parseInt(timeMatches[3], 10);
  if (hour > 23 || minute > 59 || second > 60) {
    return false;
  }
  // Check offset
  let utcHour = hour;
  if (timeMatches[5] !== 'z') {
    const offset = timeMatches[5];
    const offsetMatches = /^([+-])([0-9]{2}):([0-9]{2})$/.exec(offset);
    if (offsetMatches === null) {
      return false;
    }
    const offsetSign = offsetMatches[1];
    const offsetHour = parseInt(offsetMatches[2], 10);
    const offsetMinute = parseInt(offsetMatches[3], 10);
    if (offsetHour > 23 || offsetMinute > 59) {
      return false;
    }
    if (offsetSign === '+') {
      utcHour = hour - offsetHour;
    } else {
      utcHour = hour + offsetHour;
    }
    utcHour = ((utcHour % 24) + 24) % 24;
  }
  // Leap second only at 23:59:60 UTC
  if (second === 60) {
    if (utcHour !== 23 || minute !== 59) {
      return false;
    }
  }
  return true;
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
  const valid = /^[a-zA-Z](([-0-9a-zA-Z]+)?[0-9a-zA-Z])?(\.[a-zA-Z](([-0-9a-zA-Z]+)?[0-9a-zA-Z])?)*$/.test(hostname);
  if (valid) {
    // the sum of all label octets and label lengths is limited to 255.
    if (hostname.length > 255) {
      return false;
    }
    // Each node has a label, which is zero to 63 octets in length
    const labels = hostname.split('.');
    for (let i = 0; i < labels.length; i++) {
      if (labels[i].length > 63) {
        return false;
      }
    }
  }
  return valid;
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
    return false;
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
