import type { ZSchemaOptions } from '../../src/z-schema-options.ts';

import { afterEach, describe, expect, it } from 'vitest';

import { ZSchema } from '../../src/z-schema.ts';

type Schema = Record<string, unknown>;
interface Outcome {
  valid: boolean;
  codes: string[];
}
type Entry = (schema: Schema, instance: unknown, uri: string) => Outcome;

const BASE = 'http://reserved-keys.test/';

let uriCounter = 0;
const nextUri = (label: string) => `${BASE}${label}-${uriCounter++}.json`;

const outcomeOf = (res: { valid: boolean; err?: { details?: Array<{ code: string }> } }): Outcome => ({
  valid: res.valid,
  codes: (res.err?.details ?? []).map((d) => d.code),
});

const create = (options: ZSchemaOptions = {}) => ZSchema.create({ ...options, safe: true });

const RESERVED: Array<[string, unknown]> = [
  ['__$compiled', true],
  ['__$validated', true],
  ['__$missingReferences', []],
  ['__$refResolved', { type: 'number' }],
  ['__$dynamicRefResolved', { type: 'number' }],
  ['__$recursiveRefResolved', { type: 'number' }],
  ['__$resourceRoot', { $defs: { s: { type: 'number' } } }],
  ['__$schemaResolved', {}],
  ['__$validationOptions', { strictMode: false }],
];

const makeSchema = (extra?: [string, unknown]): Schema => {
  const schema: Schema = {
    type: 'object',
    properties: { a: { $ref: '#/$defs/s' } },
    required: ['a'],
    $defs: { s: { type: 'string' } },
  };
  if (extra) {
    const [key, value] = extra;
    schema[key] = value;
    (schema.properties as Schema).a = { $ref: '#/$defs/s', [key]: value };
  }
  return schema;
};

const INSTANCES: unknown[] = [{ a: 'x' }, { a: 1 }, {}];

const ENTRY_POINTS: Array<[string, Entry]> = [
  ['validate', (schema, instance) => outcomeOf(create().validate(instance, schema))],
  [
    'validateSchema then validate',
    (schema, instance) => {
      const validator = create();
      const schemaOutcome = outcomeOf(validator.validateSchema(schema));
      const res = outcomeOf(validator.validate(instance, schema));
      return { valid: res.valid && schemaOutcome.valid, codes: schemaOutcome.codes.concat(res.codes) };
    },
  ],
  ['compile', (schema, instance) => outcomeOf(create().compile(schema)(instance))],
  [
    'instance setRemoteReference with an object',
    (schema, instance, uri) => {
      const validator = create();
      validator.setRemoteReference(uri, schema);
      return outcomeOf(validator.validate(instance, { $ref: uri }));
    },
  ],
  [
    'instance setRemoteReference with a JSON string',
    (schema, instance, uri) => {
      const validator = create();
      validator.setRemoteReference(uri, JSON.stringify(schema));
      return outcomeOf(validator.validate(instance, { $ref: uri }));
    },
  ],
  [
    'static setRemoteReference',
    (schema, instance, uri) => {
      ZSchema.setRemoteReference(uri, schema);
      return outcomeOf(create().validate(instance, { $ref: uri }));
    },
  ],
  [
    'schema reader',
    (schema, instance, uri) => {
      ZSchema.setSchemaReader((requested) => (requested === uri ? schema : {}));
      return outcomeOf(create().validate(instance, { $ref: uri }));
    },
  ],
];

const runStrictRemote = (schema: Schema) => {
  const uri = nextUri('options');
  const validator = create({ strictMode: true });
  validator.setRemoteReference(uri, schema);
  return outcomeOf(validator.validate({ a: 1 }, { $ref: uri }));
};

afterEach(() => {
  ZSchema.setSchemaReader(undefined);
});

describe('a schema with reserved keys behaves like the same schema without them', () => {
  describe.each(ENTRY_POINTS)('%s', (_entryName, entry) => {
    it.each(RESERVED)('ignores %s', (key, value) => {
      const clean = makeSchema();
      const withReservedKeys = makeSchema([key, value]);
      for (let i = 0; i < INSTANCES.length; i++) {
        const expected = entry(clean, INSTANCES[i], nextUri('clean'));
        const actual = entry(withReservedKeys, INSTANCES[i], nextUri('reserved'));
        expect(actual).toEqual(expected);
      }
    });
  });

  it('the clean schema distinguishes the three instances', () => {
    const outcomes = INSTANCES.map((instance) => ENTRY_POINTS[0][1](makeSchema(), instance, nextUri('shape')));
    expect(outcomes.map((o) => o.valid)).toEqual([true, false, false]);
  });
});

describe('schema checks apply to schemas with reserved keys', () => {
  it('reports a loose schema under strictMode next to __$validated', () => {
    const validator = create({ strictMode: true });
    const schema: Schema = { properties: { a: {} }, __$validated: true };
    const res = outcomeOf(validator.validateSchema(schema));
    expect(res.valid).toBe(false);
    expect(res.codes).toContain('KEYWORD_UNDEFINED_STRICT');
  });

  it('reports a bogus keyword value next to __$validated', () => {
    const schema: Schema = { type: 'strnig', __$validated: true };
    const res = outcomeOf(create().validateSchema(schema));
    expect(res.valid).toBe(false);
  });

  it('applies assumeAdditional next to __$validated', () => {
    const validator = create({ assumeAdditional: true });
    const schema: Schema = { type: 'object', properties: { a: { type: 'string' } }, __$validated: true };
    const res = outcomeOf(validator.validate({ a: 'x', extra: 1 }, schema));
    expect(res.valid).toBe(false);
    expect(res.codes).toContain('OBJECT_ADDITIONAL_PROPERTIES');
  });

  it('reports an unresolvable reference next to __$compiled', () => {
    const withReservedKey: Schema = { $ref: '#/$defs/missing', __$compiled: true };
    const clean = outcomeOf(create().validate('x', { $ref: '#/$defs/missing' }));
    const res = outcomeOf(create().validate('x', withReservedKey));
    expect(clean.valid).toBe(false);
    expect(res).toEqual(clean);
  });

  it('resolves a $ref node to its real target whatever __$refResolved holds', () => {
    const schema: Schema = {
      $ref: '#/$defs/s',
      $defs: { s: { type: 'string' } },
      __$refResolved: { type: 'number' },
    };
    expect(create().validate(1, schema).valid).toBe(false);
    expect(create().validate('x', schema).valid).toBe(true);
  });

  it('validates a registered remote with the validator options whatever __$validationOptions holds', () => {
    const loose = { properties: { a: {} } };
    const clean = runStrictRemote(loose);
    expect(clean.valid).toBe(false);
    expect(runStrictRemote({ ...loose, __$validationOptions: { strictMode: false } })).toEqual(clean);
  });

  it('honours the options passed to setRemoteReference', () => {
    const uri = nextUri('explicit-options');
    const validator = create({ strictMode: true });
    validator.setRemoteReference(uri, { properties: { a: {} } }, { strictMode: false });
    expect(validator.validate({ a: 1 }, { $ref: uri }).valid).toBe(true);
  });
});

describe('inputs are not modified', () => {
  it('leaves the schema passed to validate, validateSchema, compile and setRemoteReference as it was', () => {
    const schema = makeSchema(['__$compiled', true]);
    const before = structuredClone(schema);
    const validator = create();
    validator.validate({ a: 'x' }, schema);
    expect(schema).toEqual(before);
    validator.validateSchema(schema);
    expect(schema).toEqual(before);
    validator.compile(schema)({ a: 'x' });
    expect(schema).toEqual(before);
    validator.setRemoteReference(nextUri('unchanged'), schema);
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

  it('keeps a default value', () => {
    const schema: Schema = { default: { __$validated: true }, type: 'object' };
    expect(create().validate({}, schema).valid).toBe(true);
  });
});
