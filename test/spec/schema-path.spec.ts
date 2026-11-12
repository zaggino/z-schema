import type { JsonSchema } from '../../src/json-schema-versions.ts';
import type { ZSchemaOptions } from '../../src/z-schema-options.ts';

import { ZSchema } from '../../src/z-schema.ts';

const schema = {
  type: ['object'],
  definitions: {
    car: {
      title: 'Car',
      description: "It's a car",
      stability: 'prototype',
      strictProperties: true,
      type: ['object'],
      definitions: {
        id: {
          description: 'unique identifier of car',
          readOnly: true,
          type: ['string'],
        },
        car: {
          description: 'Car object',
          type: ['object'],
          properties: {
            brand: {
              description: 'Car brand',
              type: ['string'],
            },
            engine: {
              description: 'Car engine',
              type: ['string'],
            },
          },
        },
        cars: {
          description: 'Collection of cars',
          type: ['array'],
          items: {
            $ref: '#/definitions/car/definitions/car',
          },
        },
        identity: {
          $ref: '#/definitions/car/definitions/id',
        },
      },
      links: [],
      properties: {
        id: {
          $ref: '#/definitions/car/definitions/id',
        },
      },
    },
  },
  properties: {
    car: {
      $ref: '#/definitions/car',
    },
  },
  description: 'Car API',
  id: 'cars',
  links: [
    {
      href: 'https://example.com/schema',
      rel: 'self',
    },
  ],
  title: 'Car API',
};

describe('Using path to schema as a third argument', () => {
  it('Should pass the test', () => {
    const validator = ZSchema.create();
    const cars = [
      {
        brand: 'Lexus',
        engine: 'big',
      },
    ];
    const result = validator.validateSafe(cars, schema, { schemaPath: 'definitions.car.definitions.cars' });
    expect(result.valid).toBe(true);
    expect(result.err).toBeUndefined();
  });
});

const pathsOf = (version: ZSchemaOptions['version'], testSchema: JsonSchema, data: unknown) => {
  const validator = ZSchema.create({ reportPathAsArray: true, breakOnFirstError: false, version });
  const result = validator.validateSafe(data, testSchema);
  return (result.err?.details ?? []).map((d) => ({ code: d.code, path: d.path, schemaPath: d.schemaPath }));
};

describe('Schema path accuracy across applicators', () => {
  it('keeps the prefix for siblings after a legacy $ref', () => {
    const details = pathsOf(
      'draft-07',
      {
        definitions: { s: { type: 'string' } },
        properties: { outer: { properties: { a: { $ref: '#/definitions/s' }, b: { type: 'string' } } } },
      },
      { outer: { a: 'ok', b: 1 } }
    );
    expect(details).toHaveLength(1);
    expect(details[0].path).toEqual(['outer', 'b']);
    expect(details[0].schemaPath).toEqual(['properties', 'outer', 'properties', 'b', 'type']);
  });

  it('keeps the path relative to the referenced schema for errors inside a legacy $ref', () => {
    const details = pathsOf(
      'draft-07',
      {
        definitions: { s: { type: 'string' } },
        properties: { a: { $ref: '#/definitions/s' } },
      },
      { a: 1 }
    );
    expect(details).toHaveLength(1);
    expect(details[0].schemaPath).toEqual(['type']);
  });

  it('uses patternProperties for pattern-only matches', () => {
    const details = pathsOf('draft2020-12', { patternProperties: { '^x': { type: 'string' } } }, { xa: 1 });
    expect(details).toHaveLength(1);
    expect(details[0].schemaPath).toEqual(['patternProperties', '^x', 'type']);
  });

  it('distinguishes properties from patternProperties on the same key', () => {
    const details = pathsOf(
      'draft2020-12',
      { properties: { xa: { type: 'number' } }, patternProperties: { '^x': { minimum: 5 } } },
      { xa: 1 }
    );
    expect(details).toHaveLength(1);
    expect(details[0].code).toBe('MINIMUM');
    expect(details[0].schemaPath).toEqual(['patternProperties', '^x']);
  });

  it('keeps additionalProperties paths', () => {
    const details = pathsOf('draft2020-12', { additionalProperties: { type: 'string' } }, { a: 1 });
    expect(details).toHaveLength(1);
    expect(details[0].schemaPath).toEqual(['additionalProperties', 'type']);
  });

  it('includes prefixItems index', () => {
    const details = pathsOf('draft2020-12', { prefixItems: [{ type: 'string' }, { type: 'string' }] }, ['a', 1]);
    expect(details).toHaveLength(1);
    expect(details[0].path).toEqual([1]);
    expect(details[0].schemaPath).toEqual(['prefixItems', 1, 'type']);
  });

  it('includes array-form items index and additionalItems', () => {
    const arraySchema = { items: [{ type: 'string' }], additionalItems: { type: 'string' } };
    const extra = pathsOf('draft-07', arraySchema, ['a', 1]);
    expect(extra).toHaveLength(1);
    expect(extra[0].schemaPath).toEqual(['additionalItems', 'type']);

    const first = pathsOf('draft-07', arraySchema, [1]);
    expect(first).toHaveLength(1);
    expect(first[0].schemaPath).toEqual(['items', 0, 'type']);
  });

  it('keeps single-schema items paths', () => {
    const details = pathsOf('draft-07', { items: { type: 'string' } }, ['a', 1]);
    expect(details).toHaveLength(1);
    expect(details[0].schemaPath).toEqual(['items', 'type']);
  });
});

describe('Schema path tracking in validation errors', () => {
  it('should include schema path for property type validation', () => {
    const validator = ZSchema.create({ reportPathAsArray: true });
    const testSchema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
    };
    const data = { name: 'John', age: 'thirty' };

    try {
      validator.validate(data, testSchema);
      expect.fail('Validation should have failed');
    } catch (error: any) {
      expect(error.details).toHaveLength(1);
      expect(error.details[0].path).toEqual(['age']);
      expect(error.details[0].schemaPath).toEqual(['properties', 'age', 'type']);
    }
  });

  it('should include schema path for array item validation', () => {
    const validator = ZSchema.create({ reportPathAsArray: true });
    const testSchema = {
      type: 'array',
      items: { type: 'string' },
    };
    const data = ['valid', 123, 'also-valid'];

    try {
      validator.validate(data, testSchema);
      expect.fail('Validation should have failed');
    } catch (error: any) {
      expect(error.details).toHaveLength(1);
      expect(error.details[0].path).toEqual([1]);
      expect(error.details[0].schemaPath).toEqual(['items', 'type']);
    }
  });

  it('should include schema path for nested object validation', () => {
    const validator = ZSchema.create({ reportPathAsArray: true });
    const testSchema = {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            age: { type: 'number' },
          },
        },
      },
    };
    const data = { user: { name: 'John', age: 'thirty' } };

    try {
      validator.validate(data, testSchema);
      expect.fail('Validation should have failed');
    } catch (error: any) {
      expect(error.details).toHaveLength(1);
      expect(error.details[0].path).toEqual(['user', 'age']);
      expect(error.details[0].schemaPath).toEqual(['properties', 'user', 'properties', 'age', 'type']);
    }
  });

  it('should handle root level type validation', () => {
    const validator = ZSchema.create({ reportPathAsArray: true });
    const testSchema = { type: 'string' };
    const data = 123;

    try {
      validator.validate(data, testSchema);
      expect.fail('Validation should have failed');
    } catch (error: any) {
      expect(error.details).toHaveLength(1);
      expect(error.details[0].path).toEqual([]);
      expect(error.details[0].schemaPath).toEqual(['type']);
    }
  });

  it('should include schema path for $ref validation', () => {
    const validator = ZSchema.create({ reportPathAsArray: true });
    const testSchema = {
      type: 'object',
      properties: {
        user: { $ref: '#/definitions/User' },
      },
      definitions: {
        User: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            age: { type: 'number' },
          },
        },
      },
    };
    const data = { user: { name: 'John', age: 'thirty' } };

    try {
      validator.validate(data, testSchema);
      expect.fail('Validation should have failed');
    } catch (error: any) {
      expect(error.details).toHaveLength(1);
      expect(error.details[0].path).toEqual(['user', 'age']);
      expect(error.details[0].schemaPath).toEqual(['properties', 'user', 'properties', 'age', 'type']);
    }
  });
});

describe('Schema path with breakOnFirstError and several applicable schemas', () => {
  it('restores the prefix after a legacy $ref that stops at its type check', () => {
    const validator = ZSchema.create({ reportPathAsArray: true, breakOnFirstError: true, version: 'draft-07' });
    const result = validator.validateSafe(
      { outer: { a: 1, b: 1 } },
      {
        definitions: { s: { type: 'string' } },
        properties: { outer: { properties: { a: { $ref: '#/definitions/s' }, b: { type: 'string' } } } },
      }
    );
    const details = result.err?.details ?? [];
    expect(details.map((d) => d.path)).toEqual([
      ['outer', 'a'],
      ['outer', 'b'],
    ]);
    expect(details[0].schemaPath).toEqual(['type']);
    expect(details[1].schemaPath).toEqual(['properties', 'outer', 'properties', 'b', 'type']);
  });

  it('reports properties first, then every matching pattern in declaration order', () => {
    const details = pathsOf(
      undefined,
      {
        properties: { xa: { type: 'string' } },
        patternProperties: { '^x': { minimum: 5 }, a$: { multipleOf: 2 }, '^y': { type: 'null' } },
      },
      { xa: 1 }
    );
    expect(details.map((d) => [d.code, d.schemaPath])).toEqual([
      ['INVALID_TYPE', ['properties', 'xa', 'type']],
      ['MINIMUM', ['patternProperties', '^x']],
      ['MULTIPLE_OF', ['patternProperties', 'a$']],
    ]);
  });

  it('validates against the schemas present when the key was reached, even if a customValidator replaces one', () => {
    const validator = ZSchema.create({
      customValidator(report, node) {
        const root = report.rootSchema as { patternProperties?: Record<string, unknown> } | undefined;
        if ((node as { title?: string }).title === 'declared' && root?.patternProperties) {
          root.patternProperties['^x'] = { type: 'number' };
        }
      },
    });
    const result = validator.validateSafe(
      { x: 'ok' },
      { properties: { x: { title: 'declared' } }, patternProperties: { '^x': { type: 'string' } } }
    );
    expect(result.valid).toBe(true);
  });
});

const hookCalls = (testSchema: JsonSchema, data: Record<string, unknown>) => {
  // Validating the schema against its meta-schema also runs the hook; only calls on values of `data` are kept.
  const instanceValues = new Set<unknown>([data, ...Object.values(data)]);
  const calls: Array<[string | undefined, unknown]> = [];
  const validator = ZSchema.create({
    reportPathAsArray: true,
    customValidator(_report, node, json) {
      if (instanceValues.has(json)) {
        calls.push([(node as { title?: string }).title, json]);
      }
    },
  });
  const result = validator.validateSafe(data, testSchema);
  return { calls, result };
};

describe('recurseObject equivalence', () => {
  it('does not visit unknown keys when additionalProperties is absent', () => {
    const { calls, result } = hookCalls(
      { title: 'root', properties: { a: { title: 'a', type: 'string' } } },
      { a: 'x-val', b: 7001, c: 7002 }
    );
    expect(result.valid).toBe(true);
    expect(calls.map(([title]) => title)).toEqual(['a', 'root']);
  });

  it('treats additionalProperties: true like an absent keyword', () => {
    const { calls, result } = hookCalls(
      { title: 'root', properties: { a: { title: 'a', type: 'string' } }, additionalProperties: true },
      { a: 'x-val', b: 7001, c: 7002 }
    );
    expect(result.valid).toBe(true);
    expect(calls.map(([title]) => title)).toEqual(['a', 'root']);
  });

  it('still validates an explicit empty additionalProperties schema', () => {
    const { calls, result } = hookCalls(
      { title: 'root', properties: { a: { title: 'a' } }, additionalProperties: {} },
      { a: 'x-val', b: 7001 }
    );
    expect(result.valid).toBe(true);
    // unlike an absent keyword, the explicit schema is a real node: the hook runs for "b" against it
    expect(calls).toEqual([
      ['a', 'x-val'],
      [undefined, 7001],
      ['root', { a: 'x-val', b: 7001 }],
    ]);
  });

  it('still validates additionalProperties schemas', () => {
    const details = pathsOf(
      undefined,
      { properties: { a: {} }, additionalProperties: { type: 'string' } },
      { a: 1, b: 2, c: 'ok' }
    );
    expect(details.map((d) => [d.code, d.path, d.schemaPath])).toEqual([
      ['INVALID_TYPE', ['b'], ['additionalProperties', 'type']],
    ]);
  });

  it('matches only own enumerable keys of properties', () => {
    const data = JSON.parse('{"__proto__": 1, "constructor": 2, "toString": 3}') as unknown;
    const details = pathsOf(undefined, { properties: { known: {} }, additionalProperties: { type: 'string' } }, data);
    expect(details.map((d) => [d.code, d.schemaPath])).toEqual([
      ['INVALID_TYPE', ['additionalProperties', 'type']],
      ['INVALID_TYPE', ['additionalProperties', 'type']],
      ['INVALID_TYPE', ['additionalProperties', 'type']],
    ]);
  });

  it('keeps the set of properties fixed when a customValidator adds one mid-object', () => {
    const validator = ZSchema.create({
      customValidator(report, node) {
        const root = report.rootSchema as { properties?: Record<string, unknown> } | undefined;
        if ((node as { title?: string }).title === 'a' && root?.properties) {
          root.properties.b = { type: 'string' };
        }
      },
    });
    const result = validator.validateSafe({ a: 1, b: 2 }, { properties: { a: { title: 'a' } } });
    expect(result.valid).toBe(true);
  });

  it('reads the schema of a declared property live when a customValidator replaces properties mid-object', () => {
    const validator = ZSchema.create({
      customValidator(report, node) {
        const root = report.rootSchema as { properties?: Record<string, unknown> } | undefined;
        if ((node as { title?: string }).title === 'a' && root) {
          root.properties = { a: {}, b: { type: 'number' } };
        }
      },
    });
    const result = validator.validateSafe({ a: 1, b: 2 }, { properties: { a: { title: 'a' }, b: { type: 'string' } } });
    expect(result.valid).toBe(true);
  });

  it('resets the summary message for an unknown key after a customValidator replaced it', () => {
    const validator = ZSchema.create({
      breakOnFirstError: false,
      customValidator(report, node) {
        if ((node as { title?: string }).title === 'a') {
          report.commonErrorMessage = 'REPLACED_BY_HOOK';
        }
      },
    });
    const result = validator.validateSafe({ a: 1, b: 2 }, { properties: { a: { title: 'a', type: 'string' } } });
    expect(result.valid).toBe(false);
    expect(result.err?.message).toBe('JSON_OBJECT_VALIDATION_FAILED');
  });

  it('keeps the summary message a customValidator set when additionalProperties is false', () => {
    const validator = ZSchema.create({
      breakOnFirstError: false,
      customValidator(report, node) {
        if ((node as { title?: string }).title === 'a') {
          report.commonErrorMessage = 'REPLACED_BY_HOOK';
        }
      },
    });
    const result = validator.validateSafe(
      { a: 1 },
      { properties: { a: { title: 'a', type: 'string' } }, additionalProperties: false }
    );
    expect(result.valid).toBe(false);
    expect(result.err?.message).toBe('REPLACED_BY_HOOK');
  });
});
