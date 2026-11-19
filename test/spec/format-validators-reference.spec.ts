import isEmailModule from 'validator/lib/isEmail.js';
import isIPModule from 'validator/lib/isIP.js';
import { describe, expect, it } from 'vitest';

import { ZSchema } from '../../src/z-schema.ts';

// The two regular expressions below are the reference definition of the `email` address-literal
// decision and of the `relative-json-pointer` integer-prefix split. The validators implement them by
// index scan and must agree with them on every string in the corpora.

const MAX_ASCII_CHAR_CODE = 0x7f;

const referenceEmail = (email: string): boolean => {
  for (let i = 0; i < email.length; i++) {
    if (email.charCodeAt(i) > MAX_ASCII_CHAR_CODE) {
      return false;
    }
  }
  if (isEmailModule.default(email, { require_tld: false, allow_ip_domain: true })) {
    return true;
  }
  const match = /^(?<localPart>.+)@\[IPv6:(?<address>[^\]]+)\]$/i.exec(email);
  if (!match) {
    return false;
  }
  if (!isIPModule.default(match[2], 6)) {
    return false;
  }
  return isEmailModule.default(`${match[1]}@example.com`, { require_tld: false });
};

const LF = '\n';
const CR = '\r';
const LS = String.fromCharCode(0x20_28);
const PS = String.fromCharCode(0x20_29);
const E_ACUTE = String.fromCharCode(0xe9);

const combine = (...lists: string[][]): string[] => {
  let out: string[] = [''];
  for (let l = 0; l < lists.length; l++) {
    const next: string[] = [];
    for (let i = 0; i < out.length; i++) {
      for (let j = 0; j < lists[l].length; j++) {
        next.push(out[i] + lists[l][j]);
      }
    }
    out = next;
  }
  return out;
};

describe('Format decisions match their reference definition', () => {
  const validator = ZSchema.create();

  const referenceRelativeJsonPointer = (pointer: string): boolean => {
    const match = /^(?<int>0|[1-9]\d*)(?<suffix>.*)$/.exec(pointer);
    if (!match) {
      return false;
    }
    const suffix = match[2];
    if (suffix === '' || suffix === '#') {
      return true;
    }
    return validator.validateSafe(suffix, { type: 'string', format: 'json-pointer' }).valid;
  };

  const emailLocals = [
    '',
    'a',
    'a.b',
    '"a b"',
    `"a${LF}b"`,
    `"a${CR}b"`,
    `a${LF}b`,
    'a@b',
    'a@[IPv6:::1]',
    '"',
    `a${E_ACUTE}`,
    `"a${LS}b"`,
  ];
  const emailTags = ['@[IPv6:', '@[ipv6:', '@[IPV6:', '@[iPv6:', '@[IPv4:', '@[', '@', '[IPv6:', '@[IPv6', '@ [IPv6:'];
  const emailAddresses = [
    '::1',
    '2001:db8::1',
    'fe80::1%eth0',
    '',
    '::1]',
    '1.2.3.4',
    'x',
    `::1${LF}`,
    '::1@[IPv6:',
    '::g',
  ];
  const emailTails = [']', '', ']]', '] ', `]${LF}`, ']@[IPv6:]', ']@[IPv6:::1]'];

  const pointerPrefixes = ['', '0', '1', '9', '12', '120', '01', '00', '-1', '+1', 'a', String.fromCharCode(0x06_61)];
  const pointerSuffixes = [
    '',
    '#',
    '##',
    '/',
    '/a',
    '/a/b',
    '//',
    '/~0',
    '/~1',
    '/~',
    '/~2',
    'a',
    '#/a',
    `/a${LF}`,
    LF,
    `/a${CR}b`,
    `/a${LS}`,
    `/a${PS}`,
    '1',
    '/0',
  ];

  it('agrees on the email decision', () => {
    const corpus = combine(emailLocals, emailTags, emailAddresses, emailTails);
    const mismatches: string[] = [];
    let literalAccepted = 0;
    for (let i = 0; i < corpus.length; i++) {
      const data = corpus[i];
      const actual = validator.validateSafe(data, { type: 'string', format: 'email' }).valid;
      const expected = referenceEmail(data);
      if (actual !== expected) {
        mismatches.push(JSON.stringify(data));
      }
      if (expected && !isEmailModule.default(data, { require_tld: false, allow_ip_domain: true })) {
        literalAccepted++;
      }
    }
    expect(mismatches).toEqual([]);
    expect(literalAccepted).toBeGreaterThanOrEqual(30);
  });

  it('agrees on the relative-json-pointer decision', () => {
    const corpus = combine(pointerPrefixes, pointerSuffixes);
    const mismatches: string[] = [];
    let accepted = 0;
    for (let i = 0; i < corpus.length; i++) {
      const data = corpus[i];
      const actual = validator.validateSafe(data, { type: 'string', format: 'relative-json-pointer' }).valid;
      const expected = referenceRelativeJsonPointer(data);
      if (actual !== expected) {
        mismatches.push(JSON.stringify(data));
      }
      if (expected) {
        accepted++;
      }
    }
    expect(mismatches).toEqual([]);
    expect(accepted).toBeGreaterThanOrEqual(20);
  });
});
