import { SchemaCache } from '../../src/schema-cache.ts';
import { ZSchema } from '../../src/z-schema.ts';
import { guardBuiltinPrototypes } from '../lib/prototype-guard.ts';

describe('SchemaCache remote $ref', () => {
  const remoteSchemaUrl = 'http://localhost:1234/integer.json';
  const remoteSchema = { type: 'integer' };

  beforeAll(() => {
    // Register the remote schema in the cache
    ZSchema.setRemoteReference(remoteSchemaUrl, remoteSchema);
  });

  it('verifies schema is present in both static and local cache', () => {
    const validator = ZSchema.create();
    // Static/global cache
    const staticCache = SchemaCache.global_cache;
    expect(staticCache[remoteSchemaUrl]).toBeDefined();
    // Local cache
    const localCache = validator.scache.cache;
    // Should not be present in local cache until used
    expect(localCache[remoteSchemaUrl]).toBeUndefined();
    // Use the schema to trigger local cache population
    validator.validate(1, { $ref: remoteSchemaUrl });
    expect(localCache[remoteSchemaUrl]).toBeDefined();
  });

  it('validates data using remote $ref (valid case)', () => {
    const schema = { $ref: remoteSchemaUrl };
    const validator = ZSchema.create();
    const result = validator.validateSafe(1, schema);
    expect(result.valid).toBe(true);
    expect(result.err).toBeUndefined();
  });

  it('validates data using remote $ref (invalid case)', () => {
    const schema = { $ref: remoteSchemaUrl };
    const validator = ZSchema.create();
    const result = validator.validateSafe('a', schema);
    expect(result.valid).toBe(false);
    expect(result.err).toBeDefined();
    expect(result.err!.details?.[0].code).toBe('INVALID_TYPE');
  });
});

const isValid = (data: unknown, schema: object) => ZSchema.create().validateSafe(data, schema).valid;

const codesOf = (schema: object) =>
  (ZSchema.create().validateSafe({ a: 1 }, schema).err?.details ?? []).map((detail) => detail.code);

/** Result of `run`, or the message of the error it threw. */
const outcomeOf = (run: () => unknown) => {
  try {
    return run();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
};

const validateOutcome = (schema: object) => outcomeOf(() => ZSchema.create().validate({ a: 1 }, schema));

const schemaOutcome = (schema: object) => outcomeOf(() => ZSchema.create().validateSchema(schema));

const expectKeywordsEnforced = () => {
  expect(isValid({ a: 1, z: 2 }, { type: 'object', properties: { a: {} }, additionalProperties: false })).toBe(false);
  expect(isValid({}, { type: 'object', required: ['a'] })).toBe(false);
  expect(isValid(1, { type: 'number', minimum: 5 })).toBe(false);
  expect(isValid('q', { enum: ['a', 'b'] })).toBe(false);
  expect(isValid('abc', { type: 'string', pattern: '^z' })).toBe(false);
};

describe('SchemaCache $ref fragment resolution', () => {
  const remoteUrl = 'http://localhost:1234/fragment-own-properties.json';
  const expectCleanPrototypes = guardBuiltinPrototypes();

  beforeAll(() => {
    ZSchema.setRemoteReference(remoteUrl, { type: 'object' });
  });

  // Each schema is reported exactly like its twin, whose fragment names a missing own property.
  const unresolvableFragments: Array<[string, object, object]> = [
    ['#/__proto__', { $ref: '#/__proto__' }, { $ref: '#/nope' }],
    ['#/constructor/prototype', { $ref: '#/constructor/prototype' }, { $ref: '#/nope/nope' }],
    ['#/$defs/__proto__', { $defs: { a: {} }, $ref: '#/$defs/__proto__' }, { $defs: { a: {} }, $ref: '#/$defs/nope' }],
    ['#/toString', { $ref: '#/toString' }, { $ref: '#/nope' }],
    ['percent-encoded #/__proto__', { $ref: '#/%5F%5Fproto%5F%5F' }, { $ref: '#/nope' }],
    [
      '#/prefixItems/__proto__ (an array)',
      { prefixItems: [{}], $ref: '#/prefixItems/__proto__' },
      { prefixItems: [{}], $ref: '#/prefixItems/nope' },
    ],
    // only reachable with a live object as the schema: JSON cannot hold a function
    ["a function's own prototype", { x: Object, $ref: '#/x/prototype' }, { x: Object, $ref: '#/x/nope' }],
    ['#/title/length (a string)', { title: 'abc', $ref: '#/title/length' }, { title: 'abc', $ref: '#/title/nope' }],
    ['a remote document with #/__proto__', { $ref: `${remoteUrl}#/__proto__` }, { $ref: `${remoteUrl}#/nope` }],
  ];

  describe.each(unresolvableFragments)('with a fragment that leaves the schema data: %s', (_name, schema, missing) => {
    it('does not resolve it in validateSafe', () => {
      const codes = codesOf(schema);
      expect(codes.length).toBeGreaterThan(0);
      expect(codes).toEqual(codesOf(missing));
      expectCleanPrototypes();
      expectKeywordsEnforced();
    });

    it('does not resolve it in validate', () => {
      const outcome = validateOutcome(schema);
      expect(outcome).not.toBe(true);
      expect(outcome).toEqual(validateOutcome(missing));
      expectCleanPrototypes();
      expectKeywordsEnforced();
    });

    it('does not resolve it in validateSchema', () => {
      expect(schemaOutcome(schema)).toEqual(schemaOutcome(missing));
      expectCleanPrototypes();
      expectKeywordsEnforced();
    });
  });

  it('still resolves fragments through own properties', () => {
    expect(isValid(1, { $defs: { a: { type: 'integer' } }, $ref: '#/$defs/a' })).toBe(true);
    expect(isValid('x', { $defs: { a: { type: 'integer' } }, $ref: '#/$defs/a' })).toBe(false);
    expect(isValid('x', { prefixItems: [{ type: 'integer' }], $ref: '#/prefixItems/0' })).toBe(false);
    expectCleanPrototypes();
  });

  it('still resolves an own property named like an inherited one', () => {
    const schema = JSON.parse(
      '{"$defs":{"constructor":{"type":"integer"},"__proto__":{"type":"string"}},"properties":{"a":{"$ref":"#/$defs/constructor"},"b":{"$ref":"#/$defs/__proto__"}}}'
    ) as object;
    expect(isValid({ a: 1, b: 'x' }, schema)).toBe(true);
    expect(isValid({ a: 'x' }, schema)).toBe(false);
    expect(isValid({ b: 1 }, schema)).toBe(false);
    expectCleanPrototypes();
  });
});

describe.each(['constructor', 'prototype', '__proto__', 'toString'])('SchemaCache with a schema named %s', (name) => {
  const expectCleanPrototypes = guardBuiltinPrototypes();

  afterAll(() => {
    delete SchemaCache.global_cache[name];
  });

  it('stores it as an ordinary key of the instance cache', () => {
    const validator = ZSchema.create();
    const cached = { type: 'integer' };
    expect(validator.scache.checkCacheForUri(name)).toBe(false);
    validator.scache.cacheSchemaByUri(name, cached);
    expect(Object.hasOwn(validator.scache.cache, name)).toBe(true);
    expect(validator.scache.checkCacheForUri(name)).toBe(true);
    expect(validator.scache.fromCache(name)).toBe(cached);
    validator.scache.removeFromCacheByUri(name);
    expect(validator.scache.checkCacheForUri(name)).toBe(false);
    expectCleanPrototypes();
  });

  it('resolves a $ref to it once registered as a remote reference', () => {
    ZSchema.setRemoteReference(name, { type: 'integer' });
    expect(Object.hasOwn(SchemaCache.global_cache, name)).toBe(true);
    expect(isValid(1, { $ref: name })).toBe(true);
    expect(isValid('x', { $ref: name })).toBe(false);
    expectCleanPrototypes();
  });
});
