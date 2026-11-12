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

const pathsOf = (version: any, testSchema: any, data: unknown) => {
  const validator = ZSchema.create({ reportPathAsArray: true, breakOnFirstError: false, version });
  const result = validator.validateSafe(data, testSchema);
  return (result.err?.details ?? []).map((d: any) => ({ code: d.code, path: d.path, schemaPath: d.schemaPath }));
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
