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

describe('Using path to schema as a third argument', function () {
  it('Should pass the test', function () {
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

describe('Schema path tracking in validation errors', function () {
  it('should include schema path for property type validation', function () {
    const validator = ZSchema.create({ reportPathAsArray: true });
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
    };
    const data = { name: 'John', age: 'thirty' };

    try {
      validator.validate(data, schema);
      expect.fail('Validation should have failed');
    } catch (err) {
      const error = err as any;
      expect(error.details).toHaveLength(1);
      expect(error.details[0].path).toEqual(['age']);
      expect(error.details[0].schemaPath).toEqual(['properties', 'age', 'type']);
    }
  });

  it('should include schema path for array item validation', function () {
    const validator = ZSchema.create({ reportPathAsArray: true });
    const schema = {
      type: 'array',
      items: { type: 'string' },
    };
    const data = ['valid', 123, 'also-valid'];

    try {
      validator.validate(data, schema);
      expect.fail('Validation should have failed');
    } catch (err) {
      const error = err as any;
      expect(error.details).toHaveLength(1);
      expect(error.details[0].path).toEqual([1]);
      expect(error.details[0].schemaPath).toEqual(['items', 'type']);
    }
  });

  it('should include schema path for nested object validation', function () {
    const validator = ZSchema.create({ reportPathAsArray: true });
    const schema = {
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
      validator.validate(data, schema);
      expect.fail('Validation should have failed');
    } catch (err) {
      const error = err as any;
      expect(error.details).toHaveLength(1);
      expect(error.details[0].path).toEqual(['user', 'age']);
      expect(error.details[0].schemaPath).toEqual(['properties', 'user', 'properties', 'age', 'type']);
    }
  });

  it('should handle root level type validation', function () {
    const validator = ZSchema.create({ reportPathAsArray: true });
    const schema = { type: 'string' };
    const data = 123;

    try {
      validator.validate(data, schema);
      expect.fail('Validation should have failed');
    } catch (err) {
      const error = err as any;
      expect(error.details).toHaveLength(1);
      expect(error.details[0].path).toEqual([]);
      expect(error.details[0].schemaPath).toEqual(['type']);
    }
  });

  it('should include schema path for $ref validation', function () {
    const validator = ZSchema.create({ reportPathAsArray: true });
    const schema = {
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
      validator.validate(data, schema);
      expect.fail('Validation should have failed');
    } catch (err) {
      const error = err as any;
      expect(error.details).toHaveLength(1);
      expect(error.details[0].path).toEqual(['user', 'age']);
      expect(error.details[0].schemaPath).toEqual(['properties', 'user', 'properties', 'age', 'type']);
    }
  });
});
