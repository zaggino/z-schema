import type { JsonSchema } from '../../src/json-schema-versions.ts';
import type { ZSchemaOptions } from '../../src/z-schema-options.ts';

import { ZSchema } from '../../src/z-schema.ts';

const CORE = 'https://json-schema.org/draft/2020-12/vocab/core';
const FORMAT_ANNOTATION = 'https://json-schema.org/draft/2020-12/vocab/format-annotation';
const FORMAT_ASSERTION = 'https://json-schema.org/draft/2020-12/vocab/format-assertion';

const META_URI = 'http://localhost:1234/format-vocabulary-meta.json';

const metaSchema = ($vocabulary: Record<string, boolean>): JsonSchema => ({
  $id: META_URI,
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $vocabulary,
  $dynamicAnchor: 'meta',
  allOf: [{ $ref: 'https://json-schema.org/draft/2020-12/meta/core' }],
});

// whether "not-an-ipv4" is accepted by a schema that uses the given meta-schema
const acceptsBadIpv4 = ($vocabulary: Record<string, boolean>, options: ZSchemaOptions = {}) => {
  const validator = ZSchema.create({ version: 'draft2020-12', safe: true, ...options });
  validator.setRemoteReference(META_URI, metaSchema($vocabulary));
  const schema: JsonSchema = { $schema: META_URI, format: 'ipv4' };
  expect(validator.validate('127.0.0.1', schema).valid).toBe(true);
  return validator.validate('not-an-ipv4', schema).valid;
};

describe('format-assertion vocabulary (draft 2020-12)', () => {
  describe('with formatAssertions: true', () => {
    const options: ZSchemaOptions = { formatAssertions: true };

    it('asserts when the meta-schema lists the vocabulary as true', () => {
      expect(acceptsBadIpv4({ [CORE]: true, [FORMAT_ASSERTION]: true }, options)).toBe(false);
    });

    // `false` only tells an implementation that does not know the vocabulary that
    // it may process the schema anyway
    it('asserts when the meta-schema lists the vocabulary as false', () => {
      expect(acceptsBadIpv4({ [CORE]: true, [FORMAT_ASSERTION]: false }, options)).toBe(false);
    });

    it('only annotates when the meta-schema lists format-annotation instead', () => {
      expect(acceptsBadIpv4({ [CORE]: true, [FORMAT_ANNOTATION]: true }, options)).toBe(true);
    });

    it('only annotates when the meta-schema lists no format vocabulary', () => {
      expect(acceptsBadIpv4({ [CORE]: true }, options)).toBe(true);
    });

    it('only annotates under the standard meta-schema', () => {
      const validator = ZSchema.create({ version: 'draft2020-12', safe: true, ...options });
      expect(validator.validate('not-an-ipv4', { format: 'ipv4' }).valid).toBe(true);
    });
  });

  it('always asserts with the default formatAssertions, whatever the vocabulary', () => {
    expect(acceptsBadIpv4({ [CORE]: true, [FORMAT_ANNOTATION]: true })).toBe(false);
    expect(acceptsBadIpv4({ [CORE]: true, [FORMAT_ASSERTION]: false })).toBe(false);
  });

  it('never asserts with formatAssertions: false, whatever the vocabulary', () => {
    expect(acceptsBadIpv4({ [CORE]: true, [FORMAT_ASSERTION]: true }, { formatAssertions: false })).toBe(true);
  });
});
