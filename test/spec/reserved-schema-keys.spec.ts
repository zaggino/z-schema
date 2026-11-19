import type { ZSchemaOptions } from '../../src/z-schema-options.ts';

import { afterEach, describe, expect, it } from 'vitest';

import { ValidateError } from '../../src/errors.ts';
import { ZSchema } from '../../src/z-schema.ts';
import { deepFreeze, nest } from '../lib/object-helpers.ts';

type Schema = Record<string, unknown>;
interface Outcome {
  valid: boolean;
  codes: string[];
}
type Entry = (options: ZSchemaOptions, schema: Schema, instance: unknown, uri: string) => Outcome;

const BASE = 'http://reserved-keys.test/';

let uriCounter = 0;
const nextUri = (label: string) => `${BASE}${label}-${uriCounter++}.json`;

const create = (options: ZSchemaOptions = {}) => ZSchema.create({ ...options, safe: true });

type SafeResult = ReturnType<ReturnType<typeof create>['validate']>;

const outcomeOf = (res: SafeResult): Outcome => ({
  valid: res.valid,
  codes: (res.err?.details ?? []).map((d) => d.code),
});

const messageOf = (register: () => void): string => {
  try {
    register();
  } catch (error) {
    return (error as Error).message;
  }
  return '';
};

const validateDirectly: Entry = (options, schema, instance) => outcomeOf(create(options).validate(instance, schema));

const ENTRY_POINTS: Array<[string, Entry]> = [
  ['validate', validateDirectly],
  [
    'validate twice on one validator',
    (options, schema, instance) => {
      const validator = create(options);
      validator.validate(instance, schema);
      return outcomeOf(validator.validate(instance, schema));
    },
  ],
  [
    'validateSchema then validate',
    (options, schema, instance) => {
      const validator = create(options);
      const schemaOutcome = outcomeOf(validator.validateSchema(schema));
      const res = outcomeOf(validator.validate(instance, schema));
      return { valid: res.valid && schemaOutcome.valid, codes: schemaOutcome.codes.concat(res.codes) };
    },
  ],
  [
    'compile',
    (options, schema, instance) => {
      try {
        return outcomeOf(create(options).compile(schema)(instance));
      } catch (error) {
        if (error instanceof ValidateError) {
          return { valid: false, codes: (error.details ?? []).map((d) => d.code) };
        }
        throw error;
      }
    },
  ],
  [
    'instance setRemoteReference with an object',
    (options, schema, instance, uri) => {
      const validator = create(options);
      validator.setRemoteReference(uri, schema);
      return outcomeOf(validator.validate(instance, { $ref: uri }));
    },
  ],
  [
    'instance setRemoteReference with a JSON string',
    (options, schema, instance, uri) => {
      const validator = create(options);
      validator.setRemoteReference(uri, JSON.stringify(schema));
      return outcomeOf(validator.validate(instance, { $ref: uri }));
    },
  ],
  [
    'static setRemoteReference',
    (options, schema, instance, uri) => {
      ZSchema.setRemoteReference(uri, schema);
      return outcomeOf(create(options).validate(instance, { $ref: uri }));
    },
  ],
  [
    'schema reader',
    (options, schema, instance, uri) => {
      ZSchema.setSchemaReader((requested) => (requested === uri ? schema : {}));
      return outcomeOf(create(options).validate(instance, { $ref: uri }));
    },
  ],
];

interface Fixture {
  title: string;
  key: string;
  value: unknown;
  options: ZSchemaOptions;
  // Builds the schema. `reserved` is spread in at the place where the library keeps the key on its own copy.
  schema: (reserved: Schema) => Schema;
  cases: Array<[instance: unknown, valid: boolean]>;
}

const TREE = {
  $dynamicAnchor: 'node',
  type: 'object',
  properties: { v: { type: 'string' }, child: { $dynamicRef: '#node' } },
  additionalProperties: false,
};

const REF_RESOLVED: Fixture = {
  title: '__$refResolved',
  key: '__$refResolved',
  value: { type: 'number' },
  options: {},
  schema: (reserved) => ({
    type: 'object',
    properties: { a: { $ref: '#/$defs/s', ...reserved } },
    $defs: { s: { type: 'string' } },
  }),
  cases: [
    [{ a: 'x' }, true],
    [{ a: 1 }, false],
  ],
};

const FIXTURES: Fixture[] = [
  {
    title: '__$compiled',
    key: '__$compiled',
    value: true,
    options: {},
    schema: (reserved) => ({ $ref: '#/$defs/s', $defs: { s: { type: 'string' } }, ...reserved }),
    cases: [
      ['x', true],
      [1, false],
    ],
  },
  {
    title: '__$compiled holding a deeply nested value',
    key: '__$compiled',
    value: nest(150),
    options: {},
    schema: (reserved) => ({ type: 'string', ...reserved }),
    cases: [
      ['x', true],
      [1, false],
    ],
  },
  {
    title: '__$validated with strictMode',
    key: '__$validated',
    value: true,
    options: { strictMode: true },
    schema: (reserved) => ({ type: 'object', properties: { a: {} }, ...reserved }),
    cases: [[{ a: 1 }, false]],
  },
  {
    title: '__$validated with assumeAdditional',
    key: '__$validated',
    value: true,
    options: { assumeAdditional: true },
    schema: (reserved) => ({ type: 'object', properties: { a: { type: 'string' } }, ...reserved }),
    cases: [
      [{ a: 'x' }, true],
      [{ a: 'x', extra: 1 }, false],
    ],
  },
  {
    // Not read from any position of an input schema: this row shows that nothing changes.
    title: '__$missingReferences',
    key: '__$missingReferences',
    value: [{ ref: 'x', key: '$ref', obj: {}, path: [] }],
    options: {},
    schema: (reserved) => ({ $ref: '#/$defs/s', $defs: { s: { type: 'string' } }, ...reserved }),
    cases: [
      ['x', true],
      [1, false],
    ],
  },
  REF_RESOLVED,
  {
    title: '__$dynamicRefResolved',
    key: '__$dynamicRefResolved',
    value: { type: 'number' },
    options: {},
    schema: (reserved) => ({
      type: 'object',
      properties: { a: { $dynamicRef: '#/$defs/s', ...reserved } },
      $defs: { s: { type: 'string' } },
    }),
    cases: [
      [{ a: 'x' }, true],
      [{ a: 1 }, false],
    ],
  },
  {
    title: '__$recursiveRefResolved',
    key: '__$recursiveRefResolved',
    value: { type: 'number' },
    options: { version: 'draft2019-09' },
    schema: (reserved) => ({
      $recursiveAnchor: true,
      type: 'object',
      properties: { v: { type: 'string' }, child: { $recursiveRef: '#', ...reserved } },
      additionalProperties: false,
    }),
    cases: [
      [{ child: { v: 'x' } }, true],
      [{ child: { v: 1 } }, false],
    ],
  },
  {
    title: '__$resourceRoot',
    key: '__$resourceRoot',
    value: { $dynamicAnchor: 'node', type: 'number' },
    options: {},
    schema: (reserved) => ({
      type: 'object',
      properties: { tree: { $ref: '#/$defs/tree' } },
      $defs: { tree: TREE },
      ...reserved,
    }),
    cases: [
      [{ tree: { child: { v: 'x' } } }, true],
      [{ tree: { child: { v: 1 } } }, false],
    ],
  },
  {
    title: '__$schemaResolved',
    key: '__$schemaResolved',
    value: { $vocabulary: { 'https://json-schema.org/draft/2020-12/vocab/core': true } },
    options: {},
    schema: (reserved) => ({ type: 'object', properties: { a: { type: 'string', ...reserved } } }),
    cases: [
      [{ a: 'x' }, true],
      [{ a: 1 }, false],
    ],
  },
  {
    title: '__$validationOptions',
    key: '__$validationOptions',
    value: { strictMode: false },
    options: { strictMode: true },
    schema: (reserved) => ({ type: 'object', properties: { a: {} }, ...reserved }),
    cases: [[{ a: 1 }, false]],
  },
];

afterEach(() => {
  ZSchema.setSchemaReader(undefined);
});

describe('a reserved key where a keyword can appear is ignored', () => {
  describe.each(FIXTURES)('$title', ({ key, value, options, schema, cases }) => {
    it.each(ENTRY_POINTS)('%s', (_name, entry) => {
      for (let i = 0; i < cases.length; i++) {
        const [instance, valid] = cases[i];
        const clean = entry(options, schema({}), instance, nextUri('clean'));
        const reserved = entry(options, schema({ [key]: value }), instance, nextUri('reserved'));
        expect(clean.valid).toBe(valid);
        expect(reserved).toEqual(clean);
      }
    });
  });
});

describe('options and limits of registered schemas', () => {
  it('honours the options passed to setRemoteReference', () => {
    const uri = nextUri('explicit-options');
    const validator = create({ strictMode: true });
    validator.setRemoteReference(uri, { properties: { a: {} } }, { strictMode: false });
    expect(validator.validate({ a: 1 }, { $ref: uri }).valid).toBe(true);
  });

  it('registers a JSON string nested deeper than the limit like the same object', () => {
    let schema: Schema = {};
    for (let i = 0; i < 150; i++) {
      schema = { properties: { a: schema } };
    }
    const fromObject = messageOf(() => {
      create().setRemoteReference(nextUri('deep'), schema);
    });
    const fromString = messageOf(() => {
      create().setRemoteReference(nextUri('deep'), JSON.stringify(schema));
    });
    expect(fromObject).toContain('Maximum recursion depth (100)');
    expect(fromString).toBe(fromObject);
  });
});

describe('inputs are not modified', () => {
  it.each(ENTRY_POINTS)('%s leaves a frozen schema as it was', (_name, entry) => {
    const schema = REF_RESOLVED.schema({});
    const before = structuredClone(schema);
    deepFreeze(schema);
    const outcome = entry({}, schema, { a: 'x' }, nextUri('frozen'));
    expect(outcome.valid).toBe(true);
    expect(schema).toEqual(before);
  });

  it('leaves the object returned by a schema reader as it was', () => {
    const uri = nextUri('reader-constant');
    const constant = { properties: { a: {} } };
    const before = structuredClone(constant);
    ZSchema.setSchemaReader((requested) => (requested === uri ? constant : {}));

    expect(create().validate({ a: 1 }, { $ref: uri }).valid).toBe(true);
    expect(constant).toEqual(before);

    const strict = create({ strictMode: true }).validate({ a: 1 }, { $ref: uri });
    expect(strict.valid).toBe(false);
    expect(constant).toEqual(before);
  });
});

describe('names and data that start with the reserved prefix are kept', () => {
  it('keeps a property name', () => {
    const validator = create();
    const schema: Schema = {
      type: 'object',
      properties: { __$compiled: { type: 'string' } },
      additionalProperties: false,
    };
    expect(validator.validate({ __$compiled: 'x' }, schema).valid).toBe(true);
    expect(validator.validate({ __$compiled: 1 }, schema).valid).toBe(false);
  });

  it('keeps an enum member', () => {
    const validator = create();
    const schema: Schema = { enum: [{ __$validated: true }] };
    expect(validator.validate({ __$validated: true }, schema).valid).toBe(true);
    expect(validator.validate({}, schema).valid).toBe(false);
  });

  it('keeps a const value', () => {
    const validator = create();
    const schema: Schema = { const: { __$compiled: 1 } };
    expect(validator.validate({ __$compiled: 1 }, schema).valid).toBe(true);
    expect(validator.validate({}, schema).valid).toBe(false);
  });
});
