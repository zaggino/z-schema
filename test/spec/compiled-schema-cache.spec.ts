import { CompiledSchemaCache } from '../../src/compiled-schema-cache.ts';
import { ZSchema } from '../../src/z-schema.ts';

const unknownFormatSchema = () => ({ $schema: 'http://json-schema.org/draft-07/schema#', format: 'zcache-fmt' });

const fake = (n: number) => ({ title: String(n) }) as never;

describe('compiled schema cache', () => {
  it('compiles an object schema once across repeated validations', () => {
    const validator = ZSchema.create();
    const spy = vi.spyOn(validator.sc, 'compileSchema');
    const schema = { type: 'object', properties: { a: { type: 'number' } }, required: ['a'] };

    expect(validator.validateSafe({ a: 1 }, schema).valid).toBe(true);
    const afterFirst = spy.mock.calls.length;
    expect(afterFirst).toBeGreaterThan(0);
    for (let i = 0; i < 3; i++) {
      expect(validator.validateSafe({ a: 1 }, schema).valid).toBe(true);
      const invalid = validator.validateSafe({ a: 'x' }, schema);
      expect(invalid.valid).toBe(false);
      expect(invalid.err?.details?.[0].code).toBe('INVALID_TYPE');
    }
    expect(spy).toHaveBeenCalledTimes(afterFirst);
  });

  it('hits for a structurally equal but different object', () => {
    const validator = ZSchema.create();
    const spy = vi.spyOn(validator.sc, 'compileSchema');
    expect(validator.validateSafe(1, { type: 'number' }).valid).toBe(true);
    const afterFirst = spy.mock.calls.length;
    expect(validator.validateSafe(1, { type: 'number' }).valid).toBe(true);
    expect(spy).toHaveBeenCalledTimes(afterFirst);
  });

  it('respects mutation of the schema object between calls', () => {
    const validator = ZSchema.create();
    const schema: Record<string, unknown> = { type: 'object' };
    expect(validator.validateSafe({}, schema).valid).toBe(true);
    schema.required = ['a'];
    const result = validator.validateSafe({}, schema);
    expect(result.valid).toBe(false);
    expect(result.err?.details?.[0].code).toBe('OBJECT_MISSING_REQUIRED_PROPERTY');
  });

  it('never caches an invalid schema', () => {
    const validator = ZSchema.create();
    const spy = vi.spyOn(validator.sc, 'compileSchema');
    const schema = { type: 'nonsense' };
    expect(validator.validateSafe(1, schema as never).valid).toBe(false);
    const afterFirst = spy.mock.calls.length;
    for (let i = 0; i < 2; i++) {
      expect(validator.validateSafe(1, schema as never).valid).toBe(false);
    }
    expect(spy.mock.calls.length).toBeGreaterThan(afterFirst);
    expect(() => validator.validate(1, schema as never)).toThrow(/./);
  });

  describe('invalidation', () => {
    afterEach(() => {
      ZSchema.unregisterFormat('zcache-fmt');
    });

    it('respects instance registerFormat/unregisterFormat after first validation', () => {
      const validator = ZSchema.create({ version: 'draft-07' });
      expect(validator.validateSafe('a', unknownFormatSchema()).err?.details?.[0].code).toBe('UNKNOWN_FORMAT');

      validator.registerFormat('zcache-fmt', () => true);
      expect(validator.validateSafe('a', unknownFormatSchema()).valid).toBe(true);
      // now cached; unregistering must invalidate
      expect(validator.validateSafe('a', unknownFormatSchema()).valid).toBe(true);
      validator.unregisterFormat('zcache-fmt');
      expect(validator.validateSafe('a', unknownFormatSchema()).err?.details?.[0].code).toBe('UNKNOWN_FORMAT');
    });

    it('respects global registerFormat/unregisterFormat', () => {
      const validator = ZSchema.create({ version: 'draft-07' });
      ZSchema.registerFormat('zcache-fmt', () => true);
      expect(validator.validateSafe('a', unknownFormatSchema()).valid).toBe(true);
      expect(validator.validateSafe('a', unknownFormatSchema()).valid).toBe(true);
      ZSchema.unregisterFormat('zcache-fmt');
      expect(validator.validateSafe('a', unknownFormatSchema()).err?.details?.[0].code).toBe('UNKNOWN_FORMAT');
    });

    it('respects instance setRemoteReference after first validation', () => {
      const validator = ZSchema.create({ ignoreUnresolvableReferences: true });
      const schema = { $ref: 'http://localhost:1234/zcache-remote.json' };
      for (let i = 0; i < 2; i++) {
        expect(validator.validateSafe('a', schema).err?.details?.[0].code).toBe('REF_UNRESOLVED');
      }
      validator.setRemoteReference('http://localhost:1234/zcache-remote.json', { type: 'string' });
      expect(validator.validateSafe('a', schema).valid).toBe(true);
      const result = validator.validateSafe(1, schema);
      expect(result.valid).toBe(false);
      expect(result.err?.details?.[0].code).toBe('INVALID_TYPE');
    });
  });

  it('supports schemaPath on a cache hit', () => {
    const validator = ZSchema.create();
    const schema = { definitions: { num: { type: 'number' } } };
    const spy = vi.spyOn(validator.sc, 'compileSchema');
    expect(validator.validateSafe(1, schema, { schemaPath: 'definitions.num' }).valid).toBe(true);
    const afterFirst = spy.mock.calls.length;
    for (let i = 0; i < 2; i++) {
      expect(validator.validateSafe(1, schema, { schemaPath: 'definitions.num' }).valid).toBe(true);
      expect(validator.validateSafe('x', schema, { schemaPath: 'definitions.num' }).valid).toBe(false);
    }
    expect(spy).toHaveBeenCalledTimes(afterFirst);
  });

  it('falls back to the uncached path for circular schema objects', () => {
    const validator = ZSchema.create();
    const schema: Record<string, unknown> = { type: 'object' };
    schema.self = schema;
    expect(validator.compiledSchemaCache.keyOf(schema as never)).toBeUndefined();
    expect(() => validator.validateSafe({}, schema as never)).not.toThrow(/circular/i);
  });

  it('does not populate the cache from calls with excludeErrors/includeErrors', () => {
    const validator = ZSchema.create();
    const spy = vi.spyOn(validator.sc, 'compileSchema');
    const schema = { type: 'string' };
    validator.validateSafe('a', schema, { excludeErrors: ['INVALID_TYPE'] });
    const afterFiltered = spy.mock.calls.length;
    validator.validateSafe('a', schema);
    const afterUnfiltered = spy.mock.calls.length;
    expect(afterUnfiltered).toBeGreaterThan(afterFiltered);
    validator.validateSafe('a', schema);
    expect(spy).toHaveBeenCalledTimes(afterUnfiltered);

    const other = { type: 'number' };
    validator.validateSafe(1, other, { includeErrors: ['INVALID_TYPE'] });
    const afterInclude = spy.mock.calls.length;
    validator.validateSafe(1, other);
    expect(spy.mock.calls.length).toBeGreaterThan(afterInclude);
  });

  describe('CompiledSchemaCache', () => {
    const { scache } = ZSchema.create();

    it('evicts oldest entries first (FIFO)', () => {
      const cache = new CompiledSchemaCache();
      for (let i = 0; i < 101; i++) {
        cache.set(`k${i}`, fake(i));
      }
      expect(cache.get('k0', scache)).toBeUndefined();
      expect(cache.get('k1', scache)).toBeDefined();
      expect(cache.get('k100', scache)).toBeDefined();
    });

    it('does not cache a key longer than the budget and evicts to fit within it', () => {
      const cache = new CompiledSchemaCache();
      cache.set('x'.repeat(16_000_001), fake(0));
      expect(cache.get('x'.repeat(16_000_001), scache)).toBeUndefined();

      cache.set('a'.repeat(10_000_000), fake(1));
      cache.set('b'.repeat(5_000_000), fake(2));
      cache.set('c'.repeat(5_000_000), fake(3));
      expect(cache.get('a'.repeat(10_000_000), scache)).toBeUndefined();
      expect(cache.get('b'.repeat(5_000_000), scache)).toBeDefined();
      expect(cache.get('c'.repeat(5_000_000), scache)).toBeDefined();
    });

    it('clear() drops everything', () => {
      const cache = new CompiledSchemaCache();
      cache.set('k', fake(1));
      cache.clear();
      expect(cache.get('k', scache)).toBeUndefined();
    });
  });
});
