import type { JsonSchema, JsonSchemaVersion } from '../../src/json-schema-versions.ts';
import type { ZSchemaOptions } from '../../src/z-schema-options.ts';

import { ZSchema } from '../../src/z-schema.ts';

const CORE_2020 = 'https://json-schema.org/draft/2020-12/vocab/core';
const FORMAT_ANNOTATION_2020 = 'https://json-schema.org/draft/2020-12/vocab/format-annotation';
const FORMAT_ASSERTION_2020 = 'https://json-schema.org/draft/2020-12/vocab/format-assertion';

const CORE_2019 = 'https://json-schema.org/draft/2019-09/vocab/core';
const FORMAT_2019 = 'https://json-schema.org/draft/2019-09/vocab/format';

const META_URI = 'http://localhost:1234/format-vocabulary-meta.json';

const DRAFTS = {
  'draft2020-12': {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    core: 'https://json-schema.org/draft/2020-12/meta/core',
    anchor: { $dynamicAnchor: 'meta' },
  },
  'draft2019-09': {
    $schema: 'https://json-schema.org/draft/2019-09/schema',
    core: 'https://json-schema.org/draft/2019-09/meta/core',
    anchor: { $recursiveAnchor: true },
  },
} satisfies Partial<Record<JsonSchemaVersion, object>>;

type Draft = keyof typeof DRAFTS;

// a validator that knows a meta-schema with the given `$vocabulary` at META_URI
const createValidator = (version: Draft, $vocabulary: Record<string, boolean>, options: ZSchemaOptions = {}) => {
  const draft = DRAFTS[version];
  const validator = ZSchema.create({ ...options, version, safe: true });
  validator.setRemoteReference(META_URI, {
    $id: META_URI,
    $schema: draft.$schema,
    $vocabulary,
    ...draft.anchor,
    allOf: [{ $ref: draft.core }],
  });
  return validator;
};

// Whether a schema using that meta-schema asserts `format`. A valid address must
// pass either way, so a schema that fails to compile can't look like an assertion.
const assertsFormat = (version: Draft, $vocabulary: Record<string, boolean>, options?: ZSchemaOptions) => {
  const validator = createValidator(version, $vocabulary, options);
  const schema: JsonSchema = { $schema: META_URI, format: 'ipv4' };
  expect(validator.validate('127.0.0.1', schema).valid).toBe(true);
  return !validator.validate('not-an-ipv4', schema).valid;
};

describe('format vocabulary with formatAssertions: true', () => {
  const options: ZSchemaOptions = { formatAssertions: true };

  describe('draft 2020-12', () => {
    const version = 'draft2020-12';

    it('asserts when the meta-schema lists format-assertion as true', () => {
      expect(assertsFormat(version, { [CORE_2020]: true, [FORMAT_ASSERTION_2020]: true }, options)).toBe(true);
    });

    // `false` only tells an implementation that does not know the vocabulary that
    // it may process the schema anyway
    it('asserts when the meta-schema lists format-assertion as false', () => {
      expect(assertsFormat(version, { [CORE_2020]: true, [FORMAT_ASSERTION_2020]: false }, options)).toBe(true);
    });

    it('asserts when the meta-schema lists both format vocabularies', () => {
      const $vocabulary = { [CORE_2020]: true, [FORMAT_ANNOTATION_2020]: true, [FORMAT_ASSERTION_2020]: false };
      expect(assertsFormat(version, $vocabulary, options)).toBe(true);
    });

    it('only annotates when the meta-schema lists format-annotation alone', () => {
      expect(assertsFormat(version, { [CORE_2020]: true, [FORMAT_ANNOTATION_2020]: true }, options)).toBe(false);
    });

    it('only annotates when the meta-schema lists no format vocabulary', () => {
      expect(assertsFormat(version, { [CORE_2020]: true }, options)).toBe(false);
    });

    it('only annotates under the standard meta-schema', () => {
      const validator = ZSchema.create({ ...options, version, safe: true });
      expect(validator.validate('not-an-ipv4', { format: 'ipv4' }).valid).toBe(true);
    });

    it('applies the root meta-schema to a subschema without its own $schema', () => {
      const validator = createValidator(version, { [CORE_2020]: true, [FORMAT_ASSERTION_2020]: false }, options);
      const schema: JsonSchema = { $schema: META_URI, properties: { ip: { format: 'ipv4' } } };
      expect(validator.validate({ ip: '127.0.0.1' }, schema).valid).toBe(true);
      expect(validator.validate({ ip: 'not-an-ipv4' }, schema).valid).toBe(false);
    });
  });

  // 2019-09 has one format vocabulary for both behaviors, and its standard
  // meta-schema lists it as false, so here the value does decide
  describe('draft 2019-09', () => {
    const version = 'draft2019-09';

    it('asserts when the meta-schema lists format as true', () => {
      expect(assertsFormat(version, { [CORE_2019]: true, [FORMAT_2019]: true }, options)).toBe(true);
    });

    it('only annotates when the meta-schema lists format as false', () => {
      expect(assertsFormat(version, { [CORE_2019]: true, [FORMAT_2019]: false }, options)).toBe(false);
    });

    it('only annotates under the standard meta-schema', () => {
      const validator = ZSchema.create({ ...options, version, safe: true });
      expect(validator.validate('not-an-ipv4', { format: 'ipv4' }).valid).toBe(true);
    });
  });
});

describe('format vocabulary with other formatAssertions settings', () => {
  it('always asserts with the default, whatever the vocabulary', () => {
    expect(assertsFormat('draft2020-12', { [CORE_2020]: true, [FORMAT_ANNOTATION_2020]: true })).toBe(true);
    expect(assertsFormat('draft2020-12', { [CORE_2020]: true, [FORMAT_ASSERTION_2020]: false })).toBe(true);
    expect(assertsFormat('draft2019-09', { [CORE_2019]: true, [FORMAT_2019]: false })).toBe(true);
  });

  it('never asserts with false, whatever the vocabulary', () => {
    const options: ZSchemaOptions = { formatAssertions: false };
    expect(assertsFormat('draft2020-12', { [CORE_2020]: true, [FORMAT_ASSERTION_2020]: true }, options)).toBe(false);
    expect(assertsFormat('draft2019-09', { [CORE_2019]: true, [FORMAT_2019]: true }, options)).toBe(false);
  });
});
