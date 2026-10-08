import { getKeywordPlan, invalidateKeywordPlan } from '../../src/json-validation.ts';
import { deepClone } from '../../src/utils/clone.ts';
import { ZSchema } from '../../src/z-schema.ts';

const plan = (schema: object) => getKeywordPlan(schema);

describe('keyword plan', () => {
  it('excludes internal, no-op and unknown keys and preserves order', () => {
    const schema = {
      $id: 'x',
      title: 'T',
      __$validated: true,
      minimum: 1,
      definitions: {},
      items: {},
      then: {},
      $ref: '#',
      madeUp: 1,
      maximum: 5,
      required: [],
    };
    expect(plan(schema).keys).toEqual(['minimum', 'maximum', 'required']);
    expect(plan(schema).empty).toBe(false);
  });

  it('reports empty from the raw key count', () => {
    expect(plan({}).empty).toBe(true);
    expect(plan({ __$validated: true }).empty).toBe(false);
    expect(plan({ __$validated: true }).keys).toEqual([]);
  });

  it('excludes type only when it is truthy', () => {
    expect(plan({ type: 'string', minLength: 1 }).keys).toEqual(['minLength']);
    expect(plan({ type: '', minLength: 1 }).keys).toEqual(['type', 'minLength']);
  });

  it('does not treat inherited Object.prototype names as keywords', () => {
    expect(plan({ toString: 1, constructor: 1, minimum: 1 }).keys).toEqual(['minimum']);
  });

  it('is cached and invisible to Object.keys, JSON.stringify and deepClone', () => {
    const schema = { type: 'number', minimum: 1 };
    const first = plan(schema);
    expect(plan(schema)).toBe(first);
    expect(Object.keys(schema)).toEqual(['type', 'minimum']);
    expect(JSON.stringify(schema)).toBe('{"type":"number","minimum":1}');
    expect(Object.getOwnPropertySymbols(deepClone(schema))).toEqual([]);
    expect(Object.getOwnPropertySymbols(schema)).toHaveLength(1);
  });

  it('does not store the plan on frozen schemas and still validates', () => {
    const schema = Object.freeze({ type: 'number', minimum: 5 });
    expect(plan(schema)).not.toBe(plan(schema));
    expect(Object.getOwnPropertySymbols(schema)).toEqual([]);
    const validator = ZSchema.create({ version: 'draft2020-12' });
    expect(validator.validateSafe(3, schema as never).valid).toBe(false);
    expect(validator.validateSafe(7, schema as never).valid).toBe(true);
  });

  it('keeps validating correctly across repeated calls (cached plan reused)', () => {
    const validator = ZSchema.create();
    const schema = { type: 'object', properties: { a: { type: 'number', minimum: 1 } }, required: ['a'] };
    for (let i = 0; i < 3; i++) {
      expect(validator.validateSafe({ a: 2 }, schema).valid).toBe(true);
      expect(validator.validateSafe({ a: 0 }, schema).valid).toBe(false);
      expect(validator.validateSafe({}, schema).valid).toBe(false);
    }
  });

  it('draft-04 $ref still ignores sibling keywords', () => {
    const validator = ZSchema.create({ version: 'draft-04' });
    const schema = {
      definitions: { num: { type: 'number' } },
      $ref: '#/definitions/num',
      minimum: 100,
    };
    expect(validator.validateSafe(5, schema).valid).toBe(true);
    expect(validator.validateSafe('x', schema).valid).toBe(false);
  });

  it('draft-04 $ref chain follows resolved schema keywords', () => {
    const validator = ZSchema.create({ version: 'draft-04' });
    const schema = {
      definitions: {
        a: { $ref: '#/definitions/b' },
        b: { type: 'integer', maximum: 10 },
      },
      $ref: '#/definitions/a',
    };
    expect(validator.validateSafe(5, schema).valid).toBe(true);
    expect(validator.validateSafe(11, schema).valid).toBe(false);
    expect(validator.validateSafe(1.5, schema).valid).toBe(false);
  });

  it('draft2020-12 $ref applies sibling keywords', () => {
    const validator = ZSchema.create({ version: 'draft2020-12' });
    const schema = { $defs: { num: { type: 'number' } }, $ref: '#/$defs/num', minimum: 100 };
    expect(validator.validateSafe(5, schema).valid).toBe(false);
    expect(validator.validateSafe(150, schema).valid).toBe(true);
  });

  it('skips validation keywords when the meta-schema disables the validation vocabulary', () => {
    const validator = ZSchema.create({ version: 'draft2020-12' });
    const metaId = 'https://example.com/no-validation-vocab';
    validator.setRemoteReference(metaId, {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: metaId,
      $vocabulary: {
        'https://json-schema.org/draft/2020-12/vocab/core': true,
        'https://json-schema.org/draft/2020-12/vocab/applicator': true,
      },
      allOf: [{ $ref: 'https://json-schema.org/draft/2020-12/meta/core' }],
    });
    const schema = { $schema: metaId, type: 'string', minLength: 3 };
    for (let i = 0; i < 2; i++) {
      expect(validator.validateSafe(5, schema as never).valid).toBe(true);
      expect(validator.validateSafe('a', schema as never).valid).toBe(true);
    }
  });

  describe('breakOnFirstError', () => {
    const schema = {
      title: 'x',
      type: 'object',
      items: { type: 'string' },
      minProperties: 2,
      then: {},
      definitions: {},
      maxProperties: 0,
      required: ['zzz'],
    };

    it('stops at the first failing keyword, skipping no-op keys between failures', () => {
      const validator = ZSchema.create({ breakOnFirstError: true, version: 'draft2020-12' });
      const result = validator.validateSafe({ a: 1 }, schema);
      expect(result.valid).toBe(false);
      expect(result.err!.details!.map((d) => d.code)).toEqual(['OBJECT_PROPERTIES_MAXIMUM']);
    });

    it('reports every failing keyword when disabled', () => {
      const validator = ZSchema.create({ breakOnFirstError: false, version: 'draft2020-12' });
      const result = validator.validateSafe({ a: 1 }, schema);
      expect(result.err!.details!.map((d) => d.code)).toEqual([
        'OBJECT_PROPERTIES_MAXIMUM',
        'OBJECT_PROPERTIES_MINIMUM',
        'OBJECT_MISSING_REQUIRED_PROPERTY',
      ]);
    });

    it('reports the type error first and stops', () => {
      const validator = ZSchema.create({ breakOnFirstError: true });
      const result = validator.validateSafe(5, schema);
      expect(result.err!.details!.map((d) => d.code)).toEqual(['INVALID_TYPE']);
    });
  });

  describe('invalidation', () => {
    it('rebuilds the plan after invalidateKeywordPlan', () => {
      const schema: Record<string, unknown> = { type: 'string', maxLength: 5 };
      expect(plan(schema).keys).toEqual(['maxLength']);
      schema.minLength = 1;
      expect(plan(schema).keys).toEqual(['maxLength']);
      invalidateKeywordPlan(schema);
      expect(plan(schema).keys).toEqual(['maxLength', 'minLength']);
    });

    it('applies noEmptyStrings rewrites even when the node was planned before schema validation', () => {
      const validator = ZSchema.create({ safe: true, noEmptyStrings: true });
      const schema = { type: 'object', properties: { s: { type: 'string' } } };
      expect(validator.validate({ s: '' }, schema).valid).toBe(false);
      expect(validator.validate({ s: 'x' }, schema).valid).toBe(true);
    });
  });
});
