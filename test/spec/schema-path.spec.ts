import ZSchema from '../../src/index.ts';

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
