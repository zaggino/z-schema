import type { ZSchemaOptions } from '../../src/z-schema-options.ts';

import { afterEach, describe, expect, it } from 'vitest';

import { ZSchema } from '../../src/z-schema.ts';

const BASE = 'http://id-registration.test/';

const create = (options: ZSchemaOptions = {}) => ZSchema.create({ ...options, safe: true });

type Result = ReturnType<ReturnType<typeof create>['validate']>;

// The error codes of a result, for assertions on why something is invalid.
const codesOf = (res: Result) => (res.err?.details ?? []).map((d) => d.code);

const expectValid = (res: Result) => {
  expect(res.valid).toBe(true);
};

const expectInvalidType = (res: Result) => {
  expect(res.valid).toBe(false);
  expect(codesOf(res)).toEqual(['INVALID_TYPE']);
};

const personSchema = (folder: string) => ({
  $id: `${BASE}${folder}/person.json`,
  type: 'object',
  properties: { address: { $ref: 'address.json' } },
  required: ['address'],
});

const addressSchema = (folder: string) => ({
  $id: `${BASE}${folder}/address.json`,
  type: 'object',
  properties: { zip: { type: 'string' } },
  required: ['zip'],
});

const pairA = (idKey: string, folder: string) => ({
  [idKey]: `${BASE}${folder}/a.json`,
  type: 'object',
  properties: { b: { $ref: 'b.json' }, n: { type: 'number' } },
});

const pairB = (idKey: string, folder: string) => ({
  [idKey]: `${BASE}${folder}/b.json`,
  type: 'object',
  properties: { a: { $ref: 'a.json' }, s: { type: 'string' } },
});

const treeSchema = () => ({
  $id: `${BASE}tree/tree.json`,
  type: 'object',
  properties: { value: { type: 'number' }, child: { $ref: '#' } },
  additionalProperties: false,
});

const nestedSchema = () => ({
  $id: `${BASE}nested/root.json`,
  type: 'object',
  properties: { abs: { $ref: `${BASE}nested/abs.json` }, rel: { $ref: 'rel.json' }, anchor: { $ref: '#named' } },
  $defs: {
    a: { $id: `${BASE}nested/abs.json`, type: 'string' },
    r: { $id: 'rel.json', type: 'number' },
    n: { $anchor: 'named', type: 'boolean' },
  },
});

const nestedDraft4Schema = () => ({
  id: `${BASE}nested-d4/root.json`,
  type: 'object',
  properties: { anchor: { $ref: '#named' }, rel: { $ref: 'rel.json' } },
  definitions: { n: { id: '#named', type: 'boolean' }, r: { id: 'rel.json', type: 'number' } },
});

afterEach(() => {
  ZSchema.setSchemaReader(undefined);
});

describe('validateSchema with an array of schemas', () => {
  it('registers every element so ids and elements validate alike', () => {
    const validator = create();
    const person = personSchema('array');
    const address = addressSchema('array');
    expectValid(validator.validateSchema([person, address]));

    expectValid(validator.validate({ address: { zip: 'x' } }, `${BASE}array/person.json`));
    expectInvalidType(validator.validate({ address: { zip: 1 } }, `${BASE}array/person.json`));
    expectValid(validator.validate({ address: { zip: 'x' } }, person));
    expectInvalidType(validator.validate({ address: { zip: 1 } }, person));
  });

  it('resolves a reference to an element listed after the referrer or before it', () => {
    const validator = create();
    const person = personSchema('array-reversed');
    const address = addressSchema('array-reversed');
    expectValid(validator.validateSchema([address, person]));

    expectInvalidType(validator.validate({ address: { zip: 1 } }, `${BASE}array-reversed/person.json`));
  });
});

describe('schemas that reference each other', () => {
  it('validates through either schema', () => {
    const validator = create();
    const a = pairA('$id', 'pair');
    const b = pairB('$id', 'pair');
    expectValid(validator.validateSchema([a, b]));

    expectValid(validator.validate({ n: 1, b: { s: 'x', a: { n: 2 } } }, a));
    expectInvalidType(validator.validate({ n: 1, b: { s: 'x', a: { n: 'no' } } }, a));
    expectInvalidType(validator.validate({ s: 1 }, b));
  });

  it('validates through either schema with draft-04 ids', () => {
    const validator = create({ version: 'draft-04' });
    const a = pairA('id', 'pair-d4');
    const b = pairB('id', 'pair-d4');
    expectValid(validator.validateSchema([b, a]));

    expectValid(validator.validate({ n: 1, b: { s: 'x', a: { n: 2 } } }, a));
    expectInvalidType(validator.validate({ n: 1, b: { s: 'x', a: { n: 'no' } } }, a));
  });
});

describe('a registered schema passed to validate again', () => {
  it('validates the same schema by object and by reference', () => {
    const validator = create();
    validator.setRemoteReference(`${BASE}tree/tree.json`, treeSchema());

    expectValid(validator.validate({ value: 1, child: { value: 2, child: { value: 3 } } }, treeSchema()));
    expectInvalidType(validator.validate({ value: 1, child: { value: 2, child: { value: 'x' } } }, treeSchema()));
    expectInvalidType(
      validator.validate({ value: 1, child: { value: 2, child: { value: 'x' } } }, { $ref: `${BASE}tree/tree.json` })
    );
    expectValid(validator.validate({ value: 1, child: { value: 2 } }, treeSchema()));
  });
});

describe('ids declared inside one schema', () => {
  it('resolves absolute ids, relative ids and anchors', () => {
    const allValid = { abs: 'x', rel: 1, anchor: true };
    expectValid(create().validate(allValid, nestedSchema()));
    expectInvalidType(create().validate({ abs: 1 }, nestedSchema()));
    expectInvalidType(create().validate({ rel: 'x' }, nestedSchema()));
    expectInvalidType(create().validate({ anchor: 1 }, nestedSchema()));
  });

  it('resolves them through a compiled schema', () => {
    const validate = create().compile(nestedSchema());
    expectValid(validate({ abs: 'x', rel: 1, anchor: true }));
    expectInvalidType(validate({ rel: 'x' }));
  });

  it('resolves draft-04 ids and anchors', () => {
    const schema = nestedDraft4Schema;
    const options = { version: 'draft-04' } as const;
    expectValid(create(options).validate({ anchor: true, rel: 1 }, schema()));
    expectInvalidType(create(options).validate({ anchor: 1 }, schema()));
    expectInvalidType(create(options).validate({ rel: 'x' }, schema()));
  });
});

describe('a registered schema reached with a fragment', () => {
  it('resolves an anchor and a pointer', () => {
    const validator = create();
    validator.setRemoteReference(`${BASE}frag/defs.json`, {
      $defs: { n: { $anchor: 'named', type: 'boolean' }, s: { type: 'string' } },
    });

    expectValid(validator.validate(true, { $ref: `${BASE}frag/defs.json#named` }));
    expectInvalidType(validator.validate(1, { $ref: `${BASE}frag/defs.json#named` }));
    expectInvalidType(validator.validate(1, { $ref: `${BASE}frag/defs.json#/$defs/s` }));
  });

  it('resolves a draft-04 id fragment', () => {
    const validator = create({ version: 'draft-04' });
    validator.setRemoteReference(`${BASE}frag-d4/defs.json`, {
      definitions: { n: { id: '#named', type: 'boolean' } },
    });

    expectValid(validator.validate(true, { $ref: `${BASE}frag-d4/defs.json#named` }));
    expectInvalidType(validator.validate(1, { $ref: `${BASE}frag-d4/defs.json#named` }));
  });
});

describe('a schema reader whose result declares another id', () => {
  it('serves the requested uri, the declared id and ids nested under it', () => {
    ZSchema.setSchemaReader((uri) => {
      if (uri === `${BASE}reader/requested.json`) {
        return {
          $id: `${BASE}reader/declared.json`,
          type: 'string',
          $defs: { n: { $id: 'nested.json', type: 'number' } },
        };
      }
      throw new Error(`unexpected read of ${uri}`);
    });
    const validator = create();

    expectInvalidType(validator.validate(1, { $ref: `${BASE}reader/requested.json` }));
    expectValid(validator.validate('x', { $ref: `${BASE}reader/requested.json` }));
    expectInvalidType(validator.validate(1, { $ref: `${BASE}reader/declared.json` }));
    expectInvalidType(validator.validate('x', { $ref: `${BASE}reader/nested.json` }));
  });
});

describe('ids declared inside a registered schema', () => {
  it('makes nested ids resolvable once the registered schema has been used', () => {
    const validator = create();
    validator.setRemoteReference(`${BASE}lib/lib.json`, {
      $defs: { n: { $id: `${BASE}lib/inner.json`, type: 'number' } },
    });

    const before = validator.validate('x', { $ref: `${BASE}lib/inner.json` });
    expect(before.valid).toBe(false);
    expect(codesOf(before)).toEqual(['UNRESOLVABLE_REFERENCE']);

    expectValid(validator.validate(1, { $ref: `${BASE}lib/lib.json` }));

    expectInvalidType(validator.validate('x', { $ref: `${BASE}lib/inner.json` }));
    expectValid(validator.validate(1, { $ref: `${BASE}lib/inner.json` }));
  });
});
