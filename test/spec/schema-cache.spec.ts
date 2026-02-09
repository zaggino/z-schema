import { SchemaCache } from '../../src/schema-cache.ts';
import { ZSchema } from '../../src/z-schema.ts';

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
