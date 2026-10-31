import type { JsonSchema } from '../../src/json-schema-versions.ts';

import { describe, expect, it } from 'vitest';

import { ZSchema } from '../../src/z-schema.ts';

type Triple = [code: string, params: unknown[], path: string | undefined];

const validator = ZSchema.create({ version: 'draft2020-12' });
const safe = ZSchema.create({ version: 'draft2020-12', safe: true });

const detailsOf = (schema: JsonSchema, json: unknown, v: typeof safe = safe): Triple[] => {
  const { err } = v.validate(json, schema);
  return (err?.details ?? []).map((d) => [d.code, d.params, d.path] as Triple);
};

/** A `$ref` chain of `n` hops ending in `leaf`; each hop adds one collectEvaluated recursion level. */
const refChain = (n: number, leaf: JsonSchema): Record<string, JsonSchema> => {
  const defs: Record<string, JsonSchema> = {};
  for (let i = 0; i < n; i++) {
    defs[`n${i}`] = { $ref: `#/$defs/n${i + 1}` };
  }
  defs[`n${n}`] = leaf;
  return defs;
};

describe('collectEvaluated depth guard', () => {
  // Nested allOf is stopped earlier by the deepClone guard, so the collection guard is reached through $ref chains.
  const limited = ZSchema.create({ version: 'draft2020-12', safe: true, maxRecursionDepth: 6 });

  it('reports COLLECT_EVALUATED_DEPTH_EXCEEDED in properties mode', () => {
    const schema: JsonSchema = {
      $defs: refChain(12, { properties: { a: true } }),
      $ref: '#/$defs/n0',
      unevaluatedProperties: false,
    };
    expect(detailsOf(schema, { a: 1, b: 2 }, limited)).toEqual([
      ['COLLECT_EVALUATED_DEPTH_EXCEEDED', [7], '#/'],
      ['OBJECT_UNEVALUATED_PROPERTIES', ['a, b'], '#/'],
    ]);
  });

  it('reports COLLECT_EVALUATED_DEPTH_EXCEEDED in items mode', () => {
    const schema: JsonSchema = {
      $defs: refChain(12, { prefixItems: [true] }),
      $ref: '#/$defs/n0',
      unevaluatedItems: false,
    };
    expect(detailsOf(schema, [1, 2], limited)).toEqual([
      ['COLLECT_EVALUATED_DEPTH_EXCEEDED', [7], '#/'],
      ['ARRAY_UNEVALUATED_ITEMS', [], '#/'],
    ]);
  });

  it('does not report the guard when the chain fits within the limit', () => {
    const schema: JsonSchema = {
      $defs: refChain(3, { properties: { a: true } }),
      $ref: '#/$defs/n0',
      unevaluatedProperties: false,
    };
    expect(detailsOf(schema, { a: 1, b: 2 }, limited)).toEqual([['OBJECT_UNEVALUATED_PROPERTIES', ['b'], '#/']]);
  });
});

describe('unevaluatedProperties with properties/patternProperties/additionalProperties', () => {
  const inner: JsonSchema = { properties: { foo: {} }, patternProperties: { '^p_': {} } };

  it('allOf: property and pattern keys are evaluated, others are not', () => {
    expect(detailsOf({ allOf: [inner], unevaluatedProperties: false }, { foo: 1, p_x: 2, bar: 3, q_z: 4 })).toEqual([
      ['OBJECT_UNEVALUATED_PROPERTIES', ['bar, q_z'], '#/'],
    ]);
    expect(detailsOf({ allOf: [inner], unevaluatedProperties: false }, { foo: 1, p_x: 2 })).toEqual([]);
  });

  it('a key matching both a property and a pattern is evaluated once', () => {
    const schema: JsonSchema = {
      allOf: [{ properties: { p_a: {} }, patternProperties: { '^p_': {} } }],
      unevaluatedProperties: false,
    };
    expect(detailsOf(schema, { p_a: 1, p_b: 2, zzz: 3 })).toEqual([['OBJECT_UNEVALUATED_PROPERTIES', ['zzz'], '#/']]);
  });

  it('additionalProperties evaluates every remaining key', () => {
    const schema: JsonSchema = { allOf: [{ ...inner, additionalProperties: true }], unevaluatedProperties: false };
    expect(detailsOf(schema, { foo: 1, p_x: 2, bar: 3 })).toEqual([]);
  });

  it('additionalProperties: false still marks keys as evaluated and reports its own errors', () => {
    const schema: JsonSchema = {
      allOf: [
        {
          properties: { foo: true },
          patternProperties: { '^p_': { type: 'string' } },
          additionalProperties: false,
        },
      ],
      unevaluatedProperties: false,
    };
    expect(detailsOf(schema, { foo: 1, p_x: 2, bar: 3 })).toEqual([
      ['OBJECT_ADDITIONAL_PROPERTIES', ['bar'], '#/'],
      ['INVALID_TYPE', ['string', 'integer'], '#/p_x'],
    ]);
  });

  describe('anyOf: only passing branches contribute', () => {
    const schema: JsonSchema = {
      anyOf: [
        { properties: { foo: true }, patternProperties: { '^p_': { type: 'number' } }, additionalProperties: false },
        { properties: { bar: true }, required: ['bar'] },
      ],
      unevaluatedProperties: false,
    };

    it('second branch only', () => {
      expect(detailsOf(schema, { foo: 1, p_x: 2, bar: 3, other: 4 })).toEqual([
        ['OBJECT_UNEVALUATED_PROPERTIES', ['foo, p_x, other'], '#/'],
      ]);
    });

    it('first branch only', () => {
      expect(detailsOf(schema, { foo: 1, p_x: 2 })).toEqual([]);
    });

    it('second branch with a pattern key failing the first branch', () => {
      expect(detailsOf(schema, { bar: 1, p_x: 'a', other: 4 })).toEqual([
        ['OBJECT_UNEVALUATED_PROPERTIES', ['p_x, other'], '#/'],
      ]);
    });
  });
});

describe('unevaluatedProperties with dependentSchemas and $ref', () => {
  const dep: JsonSchema = {
    dependentSchemas: { a: { properties: { b: true } } },
    properties: { a: true },
    unevaluatedProperties: false,
  };

  it('dependentSchemas applies when the dependency key is present', () => {
    expect(detailsOf(dep, { a: 1, b: 2, c: 3 })).toEqual([['OBJECT_UNEVALUATED_PROPERTIES', ['c'], '#/']]);
  });

  it('dependentSchemas is ignored when the dependency key is absent', () => {
    expect(detailsOf(dep, { b: 2, c: 3 })).toEqual([['OBJECT_UNEVALUATED_PROPERTIES', ['b, c'], '#/']]);
  });

  it('a dependent schema with unevaluatedProperties: true evaluates everything', () => {
    const schema: JsonSchema = {
      dependentSchemas: { a: { unevaluatedProperties: true } },
      unevaluatedProperties: false,
    };
    expect(detailsOf(schema, { a: 1, z: 2 })).toEqual([]);
  });

  it('$ref target contributes properties and patternProperties', () => {
    const schema: JsonSchema = {
      $defs: { base: { properties: { id: {} }, patternProperties: { '^x-': {} } } },
      $ref: '#/$defs/base',
      unevaluatedProperties: false,
    };
    expect(detailsOf(schema, { id: 1, 'x-a': 2 })).toEqual([]);
    expect(detailsOf(schema, { id: 1, 'x-a': 2, nope: 3, nada: 4 })).toEqual([
      ['OBJECT_UNEVALUATED_PROPERTIES', ['nope, nada'], '#/'],
    ]);
  });

  it('$ref target with dependentSchemas', () => {
    const schema: JsonSchema = {
      $defs: {
        base: { dependentSchemas: { id: { properties: { extra: true } } }, properties: { id: true } },
      },
      $ref: '#/$defs/base',
      unevaluatedProperties: false,
    };
    expect(detailsOf(schema, { id: 1, extra: 2, nope: 3 })).toEqual([
      ['OBJECT_UNEVALUATED_PROPERTIES', ['nope'], '#/'],
    ]);
  });
});

describe('unevaluatedProperties as a schema', () => {
  const schema: JsonSchema = { properties: { ok: true }, unevaluatedProperties: { type: 'string' } };

  it('reports one error per failing key in Object.keys order', () => {
    expect(detailsOf(schema, { z: 1, ok: 0, a: 2, m: 'fine', b: 3 })).toEqual([
      ['OBJECT_UNEVALUATED_PROPERTIES', ['z'], '#/'],
      ['OBJECT_UNEVALUATED_PROPERTIES', ['a'], '#/'],
      ['OBJECT_UNEVALUATED_PROPERTIES', ['b'], '#/'],
    ]);
  });

  it('passes when every unevaluated key matches', () => {
    expect(detailsOf(schema, { z: 's', ok: 0 })).toEqual([]);
  });

  it('sync variant throws on failure', () => {
    expect(() => validator.validate({ z: 1, a: 2 }, schema)).toThrow(/JSON_OBJECT_VALIDATION_FAILED/);
  });
});

describe('unevaluatedItems', () => {
  const withContains: JsonSchema = {
    prefixItems: [{ type: 'number' }],
    contains: { type: 'string' },
    unevaluatedItems: false,
  };

  it('false: prefixItems and contains matches are evaluated', () => {
    expect(detailsOf(withContains, [1, 'a', 'b'])).toEqual([]);
  });

  it('false: a single ARRAY_UNEVALUATED_ITEMS even with several unevaluated indices', () => {
    expect(detailsOf(withContains, [1, 'a', true, 'b', null])).toEqual([['ARRAY_UNEVALUATED_ITEMS', [], '#/']]);
    expect(detailsOf({ unevaluatedItems: false }, [1, 2, 3])).toEqual([['ARRAY_UNEVALUATED_ITEMS', [], '#/']]);
  });

  it('false: without any contains match, only prefixItems are evaluated', () => {
    expect(detailsOf(withContains, [1, 2, 3])).toEqual([
      ['CONTAINS', [], '#/'],
      ['ARRAY_UNEVALUATED_ITEMS', [], '#/'],
    ]);
  });

  describe('schema form', () => {
    const schema: JsonSchema = {
      prefixItems: [true],
      contains: { type: 'string' },
      unevaluatedItems: { type: 'number' },
    };

    it('passes when every unevaluated item matches', () => {
      expect(detailsOf(schema, ['x', 'a', 1, 2])).toEqual([]);
    });

    it('emits a single error on the first failing unevaluated index', () => {
      expect(detailsOf(schema, ['x', 'a', 1, true, 'q', null])).toEqual([['ARRAY_UNEVALUATED_ITEMS', [], '#/']]);
      expect(detailsOf({ prefixItems: [true], unevaluatedItems: { type: 'string' } }, [0, 1, 'a', 2, 3])).toEqual([
        ['ARRAY_UNEVALUATED_ITEMS', [], '#/'],
      ]);
    });
  });

  describe('if/then/else', () => {
    const schema: JsonSchema = {
      if: { prefixItems: [{ const: 1 }] },
      then: { prefixItems: [true, true] },
      else: { prefixItems: [true] },
      unevaluatedItems: false,
    };

    it('then branch evaluates the first two items', () => {
      expect(detailsOf(schema, [1, 2])).toEqual([]);
      expect(detailsOf(schema, [1, 2, 3])).toEqual([['ARRAY_UNEVALUATED_ITEMS', [], '#/']]);
    });

    it('else branch evaluates the first item only', () => {
      expect(detailsOf(schema, [0])).toEqual([]);
      expect(detailsOf(schema, [0, 2])).toEqual([['ARRAY_UNEVALUATED_ITEMS', [], '#/']]);
    });
  });
});

describe('evaluated-annotation propagation', () => {
  const safe2019 = ZSchema.create({ version: 'draft2019-09', safe: true });

  it('items as a schema in a subschema evaluates every item', () => {
    expect(detailsOf({ allOf: [{ items: {} }], unevaluatedItems: false }, [1, 2])).toEqual([]);
  });

  it('additionalItems after array-form items evaluates every item (2019-09)', () => {
    expect(detailsOf({ items: [{}], additionalItems: {}, unevaluatedItems: false }, [1, 2, 3], safe2019)).toEqual([]);
  });

  it('unevaluatedItems: true in a subschema evaluates every item', () => {
    expect(detailsOf({ allOf: [{ unevaluatedItems: true }], unevaluatedItems: false }, [1, 2])).toEqual([]);
  });

  it('oneOf: only the matching branch contributes', () => {
    const schema: JsonSchema = {
      oneOf: [
        { properties: { a: {} }, required: ['a'] },
        { properties: { b: {} }, required: ['b'] },
      ],
      unevaluatedProperties: false,
    };
    expect(detailsOf(schema, { a: 1, c: 2 })).toEqual([['OBJECT_UNEVALUATED_PROPERTIES', ['c'], '#/']]);
  });

  it('allOf: a later entry with unevaluatedProperties: true wins over keys collected earlier', () => {
    const schema: JsonSchema = {
      allOf: [{ properties: { a: {} } }, { unevaluatedProperties: true }],
      unevaluatedProperties: false,
    };
    expect(detailsOf(schema, { a: 1, z: 2 })).toEqual([]);
  });

  it('$dynamicRef target contributes its properties', () => {
    const schema: JsonSchema = {
      $id: 'https://example.com/dyn',
      $defs: { d: { $dynamicAnchor: 'd', properties: { a: {} } } },
      $dynamicRef: '#d',
      unevaluatedProperties: false,
    };
    expect(detailsOf(schema, { a: 1, b: 2 })).toEqual([['OBJECT_UNEVALUATED_PROPERTIES', ['b'], '#/']]);
  });

  it('if/then/else in properties mode: only the taken branch contributes', () => {
    const schema: JsonSchema = {
      if: { required: ['x'] },
      then: { properties: { t: {} } },
      else: { properties: { e: {} } },
      unevaluatedProperties: false,
    };
    expect(detailsOf(schema, { e: 1 })).toEqual([]);
    expect(detailsOf(schema, { e: 1, t: 2 })).toEqual([['OBJECT_UNEVALUATED_PROPERTIES', ['t'], '#/']]);
  });

  it('additionalProperties evaluates data keys named like Object.prototype members', () => {
    const schema: JsonSchema = {
      allOf: [{ properties: { a: {} }, additionalProperties: { type: 'number' } }],
      unevaluatedProperties: false,
    };
    expect(detailsOf(schema, JSON.parse('{"constructor":1,"__proto__":2,"a":"x"}'))).toEqual([]);
  });

  it('unevaluatedItems checks only the items present when annotations were collected', () => {
    const data: unknown[] = [{ first: true }];
    const mutating = ZSchema.create({
      version: 'draft2020-12',
      safe: true,
      customValidator: (_report, _schema, json) => {
        if (json === data[0] && data.length === 1) {
          data.push(42);
        }
      },
    });
    expect(detailsOf({ unevaluatedItems: { type: 'object' } }, data, mutating)).toEqual([]);
  });
});
