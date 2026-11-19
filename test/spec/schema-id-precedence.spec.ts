import { afterEach, describe, expect, it } from 'vitest';

import { ZSchema } from '../../src/z-schema.ts';
import { codesOf, createSafe as create, expectInvalidType, expectValid } from '../lib/validate-results.ts';

const BASE = 'http://id-precedence.test/';

let counter = 0;
const nextUri = (name: string) => `${BASE}${name}-${counter++}.json`;

const DRAFT_2020_12 = 'https://json-schema.org/draft/2020-12/schema';
const DRAFT_07 = 'http://json-schema.org/draft-07/schema';

afterEach(() => {
  ZSchema.setSchemaReader(undefined);
});

describe('ids declared by a schema passed to the validator', () => {
  it('keeps a registered schema when a validated schema declares its URI', () => {
    const uri = nextUri('a');
    const validator = create();
    validator.setRemoteReference(uri, { type: 'string' });

    expectValid(validator.validate(1, { $id: uri, type: 'number' }));
    expectInvalidType(validator.validate(1, { $ref: uri }));
    expectValid(validator.validate('x', { $ref: uri }));
  });

  it('keeps a registered schema when a compiled schema declares its URI', () => {
    const uri = nextUri('b');
    const validator = create();
    validator.setRemoteReference(uri, { type: 'string' });

    expectValid(validator.compile({ $id: uri, type: 'number' })(1));
    expectInvalidType(validator.validate(1, { $ref: uri }));
  });

  it('keeps a registered schema when a nested id declares its URI', () => {
    const uri = nextUri('c');
    const validator = create();
    validator.setRemoteReference(uri, { type: 'string' });

    expectValid(validator.validateSchema({ $defs: { x: { $id: uri, type: 'number' } } }));
    expectInvalidType(validator.validate(1, { $ref: uri }));
  });

  it('keeps the bundled meta-schema when a schema declares its URI', () => {
    const fresh = create().validateSchema({ type: 'strnig' });
    expect(codesOf(fresh)).toEqual(['PARENT_SCHEMA_VALIDATION_FAILED', 'KEYWORD_TYPE_EXPECTED']);

    const validator = create();
    expectValid(validator.validate(1, { $id: DRAFT_2020_12 }));
    expect(codesOf(validator.validateSchema({ type: 'strnig' }))).toEqual(codesOf(fresh));
  });

  it('keeps validating other schemas after a schema declared the meta-schema URI', () => {
    const validator = create();
    const declared = validator.validate(1, { $id: DRAFT_2020_12, not: {} });
    expect(declared.valid).toBe(false);
    expect(codesOf(declared)).toEqual(['NOT_PASSED']);

    expectValid(validator.validate('x', { type: 'string' }));
  });

  it('keeps a bundled meta-schema that the validator has not used yet', () => {
    const schema = { $schema: `${DRAFT_07}#`, type: 'strnig' };
    const fresh = create().validateSchema(schema);
    expect(fresh.valid).toBe(false);

    const validator = create();
    expectValid(validator.validate(1, { $id: DRAFT_07 }));
    expect(codesOf(validator.validateSchema(schema))).toEqual(codesOf(fresh));
  });

  it("resolves a registered schema's reference to the registered target while a schema with that id is compiled", () => {
    const target = nextUri('target');
    const referrer = nextUri('referrer');
    const validator = create();
    validator.setRemoteReference(target, { type: 'string' });
    validator.setRemoteReference(referrer, { $ref: target });

    expectInvalidType(validator.validate(1, { id: target, type: 'number', allOf: [{ $ref: referrer }] }));
    expectInvalidType(validator.validate(1, { $ref: referrer }));
    expectValid(validator.validate('x', { $ref: referrer }));
  });

  it('prefers a later global registration over an id declared earlier', () => {
    const uri = nextUri('h');
    const validator = create();
    expectValid(validator.validate(1, { $id: uri, type: 'number' }));

    ZSchema.setRemoteReference(uri, { type: 'string' });
    expectInvalidType(validator.validate(1, { $ref: uri }));
  });

  it('lets the last declaration win among declared ids', () => {
    const uri = nextUri('i');
    const validator = create();
    expectValid(validator.validate(1, { $id: uri, type: 'number' }));
    expectValid(validator.validate('x', { $id: uri, type: 'string' }));

    expectInvalidType(validator.validate(1, { $ref: uri }));
  });

  it('still validates the declaring schema itself', () => {
    const uri = nextUri('self');
    const validator = create();
    validator.setRemoteReference(uri, { type: 'string' });

    expectValid(validator.validate(1, { $id: uri, type: 'number' }));
    expectInvalidType(validator.validate('x', { $id: uri, type: 'number' }));
  });

  it("resolves a declaring schema's references to its own root", () => {
    const uri = nextUri('root');
    const validator = create();
    validator.setRemoteReference(uri, { type: 'string' });

    const local = {
      $id: uri,
      type: 'object',
      properties: { a: { $ref: '#/$defs/n' } },
      $defs: { n: { type: 'number' } },
    };
    expectValid(validator.validate({ a: 1 }, local));
    expectInvalidType(validator.validate({ a: 'x' }, local));

    const absolute = {
      $id: uri,
      type: 'object',
      properties: { a: { $ref: `${uri}#/$defs/n` } },
      $defs: { n: { type: 'number' } },
    };
    expectValid(validator.validate({ a: 1 }, absolute));
    expectInvalidType(validator.validate({ a: 'x' }, absolute));
  });
});

describe('ids declared inside registered or loaded schemas', () => {
  it('protects ids declared inside a registered schema once it is compiled', () => {
    const lib = nextUri('lib');
    const inner = nextUri('inner');
    const validator = create();
    validator.setRemoteReference(lib, { $defs: { n: { $id: inner, type: 'number' } } });

    expectValid(validator.validate(1, { $ref: lib }));
    expectInvalidType(validator.validate(1, { $id: inner, type: 'string' }));
    expectInvalidType(validator.validate('x', { $ref: inner }));
    expectValid(validator.validate(1, { $ref: inner }));
  });

  it('protects a URI loaded by a schema reader', () => {
    const uri = nextUri('reader');
    ZSchema.setSchemaReader((requested) => {
      if (requested === uri) {
        return { type: 'string' };
      }
      throw new Error(`unexpected read of ${requested}`);
    });
    const validator = create();

    expectValid(validator.validate('x', { $ref: uri }));
    expectValid(validator.validate(1, { $id: uri, type: 'number' }));
    expectInvalidType(validator.validate(1, { $ref: uri }));
  });
});

describe('explicit registration', () => {
  it('lets setRemoteReference replace a registered schema', () => {
    const uri = nextUri('replace');
    const validator = create();
    validator.setRemoteReference(uri, { type: 'string' });
    expectValid(validator.validate('x', { $ref: uri }));

    validator.setRemoteReference(uri, { type: 'number' });
    expectInvalidType(validator.validate('x', { $ref: uri }));
    expectValid(validator.validate(1, { $ref: uri }));
  });

  it('keeps an instance registration when the same URI is registered globally later', () => {
    const uri = nextUri('instance');
    const validator = create();
    validator.setRemoteReference(uri, { type: 'string' });
    ZSchema.setRemoteReference(uri, { type: 'number' });

    expectInvalidType(validator.validate(1, { $ref: uri }));
  });
});

describe('ids nested in registered or loaded schemas', () => {
  it('keeps a registered schema when another registered schema nests its URI', () => {
    const a = nextUri('a');
    const b = nextUri('b');
    const validator = create();
    validator.setRemoteReference(a, { type: 'string' });
    validator.setRemoteReference(b, { $defs: { x: { $id: a, type: 'number' } } });

    expectValid(validator.validate(1, { $ref: b }));
    expectInvalidType(validator.validate(1, { $ref: a }));
    expectValid(validator.validate('x', { $ref: a }));
  });

  it('keeps the bundled meta-schema when a loaded schema nests its URI', () => {
    const uri = nextUri('loaded');
    ZSchema.setSchemaReader((requested) => {
      if (requested === uri) {
        return { type: 'string', $defs: { m: { $id: DRAFT_2020_12 } } };
      }
      throw new Error(`unexpected read of ${requested}`);
    });
    const fresh = create().validateSchema({ type: 'strnig' });
    const validator = create();

    expectValid(validator.validate('x', { $ref: uri }));
    expect(codesOf(validator.validateSchema({ type: 'strnig' }))).toEqual(codesOf(fresh));
  });

  it('protects ids nested in a schema registered under a plain name', () => {
    const inner = nextUri('inner');
    const validator = create();
    validator.setRemoteReference('lib', { $defs: { n: { $id: inner, type: 'number' } } });

    expectValid(validator.validate(1, 'lib'));
    expectValid(validator.validate('x', { $id: inner, type: 'string' }));
    expectInvalidType(validator.validate('x', { $ref: inner }));
    expectValid(validator.validate(1, { $ref: inner }));
  });

  it('replaces nested ids when their schema is registered again', () => {
    const lib = nextUri('lib');
    const nested = nextUri('nested');
    const validator = create();
    validator.setRemoteReference(lib, { $defs: { n: { $id: nested, type: 'number' } } });
    expectValid(validator.validate(1, { $ref: lib }));
    expectValid(validator.validate(1, { $ref: nested }));

    validator.setRemoteReference(lib, { $defs: { n: { $id: nested, type: 'string' } } });
    expectValid(validator.validate(1, { $ref: lib }));

    expectValid(validator.validate('x', { $ref: nested }));
    expectInvalidType(validator.validate(1, { $ref: nested }));
  });

  it('keeps a registered schema when validateSchema gets an array that declares its URI', () => {
    const uri = nextUri('array');
    const other = nextUri('other');
    const validator = create();
    validator.setRemoteReference(uri, { type: 'string' });

    expectValid(
      validator.validateSchema([
        { $id: uri, type: 'number' },
        { $id: other, $ref: uri },
      ])
    );
    expectInvalidType(validator.validate(1, { $ref: uri }));
  });

  it('keeps the first of two registered schemas that nest the same id', () => {
    const a = nextUri('first');
    const b = nextUri('second');
    const nested = nextUri('shared');
    const validator = create();
    validator.setRemoteReference(a, { $defs: { n: { $id: nested, type: 'number' } } });
    validator.setRemoteReference(b, { $defs: { n: { $id: nested, type: 'string' } } });
    expectValid(validator.validate(1, { $ref: a }));
    expectValid(validator.validate('x', { $ref: b }));

    expectValid(validator.validate(1, { $ref: nested }));
    expectInvalidType(validator.validate('x', { $ref: nested }));
  });

  it('keeps an explicit registration at a URI that a registered schema nests', () => {
    const lib = nextUri('lib');
    const uri = nextUri('nested');
    const validator = create();
    validator.setRemoteReference(lib, { $defs: { n: { $id: uri, type: 'number' } } });
    expectValid(validator.validate(1, { $ref: lib }));

    validator.setRemoteReference(uri, { type: 'string' });
    expectValid(validator.validate(1, { $ref: lib }));

    expectValid(validator.validate('x', { $ref: uri }));
    expectInvalidType(validator.validate(1, { $ref: uri }));
  });
});
