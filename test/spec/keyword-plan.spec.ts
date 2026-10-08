import type { JsonSchemaInternal } from '../../src/json-schema-versions.ts';
import type { ZSchemaOptions } from '../../src/z-schema-options.ts';

import { getKeywordPlan, invalidateKeywordPlan } from '../../src/json-validation.ts';
import { Report } from '../../src/report.ts';
import { deepClone } from '../../src/utils/clone.ts';
import { ZSchema } from '../../src/z-schema.ts';

const plan = (schema: object) => getKeywordPlan(schema);

const compileInternal = (options: Record<string, unknown>, schema: object) => {
  const v = ZSchema.create(options as never) as never as {
    options: never;
    scache: { getSchema: (r: Report, s: object) => JsonSchemaInternal };
    sc: { compileSchema: (r: Report, s: JsonSchemaInternal) => unknown };
    sv: { validateSchema: (r: Report, s: JsonSchemaInternal) => unknown };
  };
  const report = new Report(v.options);
  const compiled = v.scache.getSchema(report, schema);
  v.sc.compileSchema(report, compiled);
  return { v, report, compiled };
};

const codes = (opts: ZSchemaOptions, schema: object, data: unknown) => {
  const r = ZSchema.create({ version: 'draft2020-12', ...opts }).validateSafe(data, schema);
  return r.valid ? [] : r.err!.details!.map((d) => d.code);
};

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

  describe('customValidator', () => {
    it('re-reads keywords of nodes mutated by the hook (shared child visited twice)', () => {
      // compile deep-clones the schema, so share the child through $ref (both refs resolve to one node)
      const schema = { $defs: { c: { type: 'number' } }, allOf: [{ $ref: '#/$defs/c' }, { $ref: '#/$defs/c' }] };
      let mutated = false;
      const validator = ZSchema.create({
        version: 'draft2020-12',
        customValidator: (_report: unknown, sch: Record<string, unknown>) => {
          if (!mutated && sch.type === 'number' && sch.$ref === undefined) {
            mutated = true;
            sch.minimum = 10;
          }
        },
      } as ZSchemaOptions);
      const result = validator.validateSafe(5, schema);
      // main: first visit has no minimum, second visit re-reads Object.keys and rejects 5
      expect(result.valid).toBe(false);
      expect(result.err!.details!.map((d) => d.code)).toEqual(['MINIMUM']);
    });

    it('does not reuse a plan cached before a customValidator call', () => {
      const node: Record<string, unknown> = { minimum: 1 };
      const before = getKeywordPlan(node);
      expect(getKeywordPlan(node as never)).toBe(before);
      const validator = ZSchema.create({ version: 'draft2020-12', customValidator: () => {} } as ZSchemaOptions);
      expect(validator.validateSafe(5, { type: 'number' }).valid).toBe(true);
      const after = getKeywordPlan(node);
      expect(after).not.toBe(before);
      expect(after.keys).toEqual(before.keys);
      expect(getKeywordPlan(node as never)).toBe(after);
    });
  });

  describe('breakOnFirstError with errors already present at loop entry', () => {
    it('stops after the $ref error without running a later validator-bearing key', () => {
      const schema = { $ref: '#/$defs/a', maximum: 1, $defs: { a: { minimum: 10 } } };
      expect(codes({ breakOnFirstError: true }, schema, 5)).toEqual(['MINIMUM']);
      expect(codes({ breakOnFirstError: false }, schema, 5)).toEqual(['MINIMUM', 'MAXIMUM']);
    });

    it('runs the first validator-bearing key (a real validator) and then stops', () => {
      // Compiled key order is $ref, maximum, minimum, ... ($ref is spliced out). The remote $ref fails multipleOf
      // first; main then runs only the first validator-bearing key (maximum, fails) and breaks before minimum.
      const validator = ZSchema.create({ version: 'draft2020-12', breakOnFirstError: true });
      validator.setRemoteReference('http://example.com/mult7.json', { multipleOf: 7 });
      const schema = { maximum: 1, minimum: 100, $ref: 'http://example.com/mult7.json' };
      const result = validator.validateSafe(5, schema);
      expect(result.err!.details!.map((d) => d.code)).toEqual(['MULTIPLE_OF', 'MAXIMUM']);
    });

    it('runs nothing when the first validator-bearing key is a no-op', () => {
      // main: keys = [$defs, title, maximum] after $ref splice; $defs is a no-op validator key, so the loop
      // checks errors after it and breaks before maximum.
      const schema = { $defs: { a: { minimum: 10 } }, $ref: '#/$defs/a', title: 't', maximum: 1 };
      expect(codes({ breakOnFirstError: true }, schema, 5)).toEqual(['MINIMUM']);
    });

    it('keeps $ref as a no-op key on legacy drafts (draft-07 sibling after chase)', () => {
      // draft-07: $ref siblings are ignored; chase replaces schema with the target, so no pre-existing errors
      // can come from the $ref itself and the exact-stop path is only reachable via earlier report errors.
      const schema = { definitions: { a: { maximum: 1, minimum: 10 } }, $ref: '#/definitions/a' };
      expect(codes({ version: 'draft-07', breakOnFirstError: true }, schema, 5)).toEqual(['MAXIMUM']);
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

    // Each test pre-plans the target node, runs schema validation (which rewrites it), and asserts the plan was
    // rebuilt. Without the matching invalidateKeywordPlan call in schema-validator.ts the stale plan survives.
    it('rebuilds the additionalItems plan (assumeAdditional)', () => {
      const { v, report, compiled } = compileInternal({ assumeAdditional: true }, { items: [{ type: 'string' }] });
      expect(getKeywordPlan(compiled).keys).not.toContain('additionalItems');
      v.sv.validateSchema(report, compiled);
      expect(getKeywordPlan(compiled).keys).toContain('additionalItems');
    });

    it('rebuilds the additionalProperties plan (assumeAdditional)', () => {
      const { v, report, compiled } = compileInternal(
        { assumeAdditional: true },
        { properties: { a: { type: 'string' } } }
      );
      expect(getKeywordPlan(compiled).keys).not.toContain('additionalProperties');
      v.sv.validateSchema(report, compiled);
      expect(getKeywordPlan(compiled).keys).toContain('additionalProperties');
    });

    it('rebuilds the minLength plan (noEmptyStrings)', () => {
      const { v, report, compiled } = compileInternal({ noEmptyStrings: true }, { type: 'string' });
      expect(getKeywordPlan(compiled).keys).not.toContain('minLength');
      v.sv.validateSchema(report, compiled);
      expect(getKeywordPlan(compiled).keys).toContain('minLength');
    });

    it('rebuilds the minItems plan (noEmptyArrays)', () => {
      const { v, report, compiled } = compileInternal({ noEmptyArrays: true }, { type: 'array' });
      expect(getKeywordPlan(compiled).keys).not.toContain('minItems');
      v.sv.validateSchema(report, compiled);
      expect(getKeywordPlan(compiled).keys).toContain('minItems');
    });

    it('rebuilds the plan of sub-schemas that inherit type (noTypeless)', () => {
      const { v, report, compiled } = compileInternal(
        { noTypeless: true },
        { type: 'string', anyOf: [{ minLength: 1 }] }
      );
      const sub = compiled.anyOf![0];
      const before = getKeywordPlan(sub);
      expect(getKeywordPlan(sub)).toBe(before);
      v.sv.validateSchema(report, compiled);
      expect(sub.type).toBe('string');
      expect(getKeywordPlan(sub)).not.toBe(before);
    });
  });
});
