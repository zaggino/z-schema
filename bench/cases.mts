export interface BenchCase {
  name: string;
  options?: Record<string, unknown>;
  schema: Record<string, unknown>;
  data: unknown;
  /**
   * `compiled` (default) measures the function returned by `compile()`. `schema-object` calls
   * `validate(data, schema)`: after the first call that is the per-call schema keying plus a
   * compiled-cache hit, not a cold compile.
   */
  mode?: 'compiled' | 'schema-object';
  /** Defaults to `true`. The runner asserts it before measuring. */
  expectValid?: boolean;
  /** Number of error details the instance must produce. The runner asserts it before measuring. */
  expectErrors?: number;
}

const range = (count: number): number[] => {
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    out.push(i);
  }
  return out;
};

const flatSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer', minimum: 0 },
    name: { type: 'string', minLength: 1, maxLength: 64 },
    email: { type: 'string' },
    active: { type: 'boolean' },
    score: { type: 'number', maximum: 100 },
    tags: { type: 'array', items: { type: 'string' } },
    kind: { enum: ['a', 'b', 'c'] },
    count: { type: 'integer' },
    ratio: { type: 'number', minimum: 0, maximum: 1 },
    title: { type: 'string' },
    note: { type: 'string', pattern: '^[a-z ]+$' },
    flag: { type: 'boolean' },
  },
  required: ['id', 'name', 'active', 'score'],
};

const flatValid = {
  id: 42,
  name: 'example',
  email: 'user@example.com',
  active: true,
  score: 87.5,
  tags: ['x', 'y', 'z'],
  kind: 'b',
  count: 7,
  ratio: 0.25,
  title: 'A title',
  note: 'some note',
  flag: false,
};

const flatInvalid = {
  id: -1,
  name: '',
  email: 5,
  active: 'yes',
  score: 1000,
  tags: ['x', 'y', 'z'],
  kind: 'b',
  count: 7,
  ratio: 0.25,
  title: 'A title',
  note: 'some note',
  flag: false,
};

const extraKeys = (count: number): Record<string, unknown> => {
  const out: Record<string, unknown> = { a: 1, b: 'two', c: true };
  for (const i of range(count)) {
    out[`extra${i}`] = `value${i}`;
  }
  return out;
};

const threeProps = {
  a: { type: 'integer' },
  b: { type: 'string' },
  c: { type: 'boolean' },
};

const patternData: Record<string, unknown> = { other: 'unmatched' };
for (const i of range(13)) {
  patternData[`str_${i}`] = `s${i}`;
  patternData[`num_${i}`] = i;
  patternData[`flag_${i}`] = i % 2 === 0;
}

const orders = range(200).map((i) => ({
  id: i,
  customer: { name: `customer-${i}`, vip: i % 5 === 0 },
  lines: [
    { sku: `sku-${i}-a`, qty: 1 + (i % 3) },
    { sku: `sku-${i}-b`, qty: 2 },
  ],
}));

const refDefs = {
  id: { type: 'integer', minimum: 0 },
  label: { type: 'string', minLength: 1 },
  point: {
    type: 'object',
    properties: { x: { type: 'number' }, y: { type: 'number' } },
    required: ['x', 'y'],
  },
  tag: { type: 'array', items: { type: 'string' } },
  node: {
    type: 'object',
    properties: {
      id: { $ref: '#/$defs/id' },
      label: { $ref: '#/$defs/label' },
      position: { $ref: '#/$defs/point' },
      tags: { $ref: '#/$defs/tag' },
      children: { type: 'array', items: { $ref: '#/$defs/node' } },
    },
    required: ['id', 'label'],
  },
};

const refTree = (depth: number, id: number): Record<string, unknown> => ({
  id,
  label: `node-${id}`,
  position: { x: id, y: id * 2 },
  tags: ['a', 'b'],
  children: depth === 0 ? [] : [refTree(depth - 1, id * 3 + 1), refTree(depth - 1, id * 3 + 2)],
});

const toDraft07 = (defs: Record<string, unknown>): string =>
  JSON.stringify(defs).replaceAll('#/$defs/', '#/definitions/');

const oneOfAnyOfSchema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      shape: {
        oneOf: [
          { type: 'object', properties: { kind: { const: 'circle' }, r: { type: 'number' } }, required: ['kind', 'r'] },
          {
            type: 'object',
            properties: { kind: { const: 'square' }, side: { type: 'number' } },
            required: ['kind', 'side'],
          },
          {
            type: 'object',
            properties: { kind: { const: 'rect' }, w: { type: 'number' }, h: { type: 'number' } },
            required: ['kind', 'w', 'h'],
          },
          { type: 'object', properties: { kind: { const: 'dot' } }, required: ['kind'] },
        ],
      },
      value: {
        anyOf: [{ type: 'string' }, { type: 'integer' }, { type: 'array', items: { type: 'integer' } }],
      },
    },
    required: ['shape', 'value'],
  },
};

const shapes = [{ kind: 'circle', r: 2 }, { kind: 'square', side: 3 }, { kind: 'rect', w: 2, h: 5 }, { kind: 'dot' }];
const values = ['text', 7, [1, 2, 3]];
const oneOfAnyOfData = range(50).map((i) => ({ shape: shapes[i % 4], value: values[i % 3] }));

export const cases: BenchCase[] = [
  { name: 'flat-properties', schema: flatSchema, data: flatValid },
  {
    name: 'additional-keys',
    schema: { type: 'object', properties: threeProps },
    data: extraKeys(60),
  },
  {
    name: 'additional-properties-schema',
    schema: { type: 'object', properties: threeProps, additionalProperties: { type: 'string' } },
    data: extraKeys(60),
  },
  {
    name: 'pattern-properties',
    schema: {
      type: 'object',
      patternProperties: {
        '^str_': { type: 'string' },
        '^num_': { type: 'integer' },
        '^flag_': { type: 'boolean' },
      },
    },
    data: patternData,
  },
  {
    name: 'array-of-objects',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          customer: {
            type: 'object',
            properties: { name: { type: 'string' }, vip: { type: 'boolean' } },
            required: ['name'],
          },
          lines: {
            type: 'array',
            items: {
              type: 'object',
              properties: { sku: { type: 'string' }, qty: { type: 'integer', minimum: 1 } },
              required: ['sku', 'qty'],
            },
          },
        },
        required: ['id', 'customer', 'lines'],
      },
    },
    data: orders,
  },
  {
    name: 'ref-heavy',
    schema: { $defs: refDefs, $ref: '#/$defs/node' },
    data: refTree(4, 1),
  },
  { name: 'one-of-any-of', schema: oneOfAnyOfSchema, data: oneOfAnyOfData },
  {
    name: 'unevaluated-properties',
    schema: {
      type: 'object',
      allOf: [
        { properties: { a: { type: 'integer' }, b: { type: 'string' } } },
        { properties: { c: { type: 'boolean' } }, required: ['c'] },
      ],
      properties: { d: { type: 'number' } },
      unevaluatedProperties: false,
    },
    data: { a: 1, b: 'two', c: true, d: 4.5 },
  },
  {
    // Default options on purpose: with formatAssertions: true, draft 2020-12 treats format as annotation-only.
    name: 'formats',
    schema: {
      type: 'object',
      properties: {
        when: { type: 'string', format: 'date-time' },
        email: { type: 'string', format: 'email' },
        link: { type: 'string', format: 'uri' },
        ip: { type: 'string', format: 'ipv4' },
        uuid: { type: 'string', format: 'uuid' },
      },
    },
    data: {
      when: '2024-01-15T10:30:00Z',
      email: 'user@example.com',
      link: 'https://example.com/path?query=1',
      ip: '192.168.1.10',
      uuid: '123e4567-e89b-12d3-a456-426614174000',
    },
  },
  {
    name: 'draft-07-ref',
    options: { version: 'draft-07' },
    schema: {
      definitions: JSON.parse(toDraft07(refDefs)) as Record<string, unknown>,
      $ref: '#/definitions/node',
    },
    data: refTree(4, 1),
  },
  {
    name: 'invalid-collect-all',
    options: { breakOnFirstError: false },
    schema: flatSchema,
    data: flatInvalid,
    expectValid: false,
    expectErrors: 5,
  },
  { name: 'schema-object-validate', mode: 'schema-object', schema: flatSchema, data: flatValid },
];
