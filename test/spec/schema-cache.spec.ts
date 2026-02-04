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
    const validator = new ZSchema();
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
    const validator = new ZSchema();
    const valid = validator.validate(1, schema);
    expect(valid).toBe(true);
    expect(validator.getLastErrors()).toBeNull();
  });

  it('validates data using remote $ref (invalid case)', () => {
    const schema = { $ref: remoteSchemaUrl };
    const validator = new ZSchema();
    const valid = validator.validate('a', schema);
    expect(valid).toBe(false);
    const errors = validator.getLastErrors();
    expect(errors).not.toBeNull();
    expect(errors && errors[0].code).toBe('INVALID_TYPE');
  });
});
