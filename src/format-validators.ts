import validator from 'validator';
import type { ZSchema } from './z-schema.js';

const { isEmail, isIP, isURL } = validator;

export type FormatValidatorFn = (input: unknown) => boolean;

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
  if (!dateValidator(s[0])) {
    return false;
  }
  const matches = /^([0-9]{2}):([0-9]{2}):([0-9]{2})(.[0-9]+)?(z|([+-][0-9]{2}:[0-9]{2}))$/.exec(s[1]);
  if (matches === null) {
    return false;
  }
  // var hour = matches[1];
  // var minute = matches[2];
  // var second = matches[3];
  // var fraction = matches[4];
  // var timezone = matches[5];
  if (matches[1] > '23' || matches[2] > '59' || matches[3] > '59') {
    return false;
  }
  return true;
};

const emailValidator: FormatValidatorFn = (email: unknown) => {
  if (typeof email !== 'string') {
    return true;
  }
  return isEmail(email, { require_tld: true });
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
  return isIP(ipv4, 4);
};

const ipv6Validator: FormatValidatorFn = (ipv6: unknown) => {
  if (typeof ipv6 !== 'string') {
    return true;
  }
  return isIP(ipv6, 6);
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

const strictUriValidator: FormatValidatorFn = (uri: unknown) => typeof uri !== 'string' || isURL(uri);

const uriValidator: FormatValidatorFn = function (this: ZSchema, uri: unknown) {
  if (this.options && this.options.strictUris) {
    return strictUriValidator(uri);
  }
  // https://github.com/zaggino/z-schema/issues/18
  // RegExp from http://tools.ietf.org/html/rfc3986#appendix-B
  return typeof uri !== 'string' || RegExp('^(([^:/?#]+):)?(//([^/?#]*))?([^?#]*)(\\?([^#]*))?(#(.*))?').test(uri);
};

export const FormatValidators: Record<string, FormatValidatorFn> = {
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
};
