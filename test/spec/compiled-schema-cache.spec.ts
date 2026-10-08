import { CompiledSchemaCache } from '../../src/compiled-schema-cache.ts';
import { SchemaCache } from '../../src/schema-cache.ts';
import { setSchemaReader } from '../../src/z-schema-reader.ts';
import { ZSchema } from '../../src/z-schema.ts';

const unknownFormatSchema = () => ({ $schema: 'http://json-schema.org/draft-07/schema#', format: 'zcache-fmt' });

const fake = (n: number) => ({ title: String(n) }) as never;

const code = (result: { err?: { details?: Array<{ code: string }> } }) => result.err?.details?.[0].code;

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
      expect(code(invalid)).toBe('INVALID_TYPE');
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
    expect(code(result)).toBe('OBJECT_MISSING_REQUIRED_PROPERTY');
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
      setSchemaReader(undefined);
      delete (SchemaCache.global_cache as Record<string, unknown>)['http://localhost:1234/zcache-global.json'];
    });

    it('respects instance registerFormat/unregisterFormat after first validation', () => {
      const validator = ZSchema.create({ version: 'draft-07' });
      expect(code(validator.validateSafe('a', unknownFormatSchema()))).toBe('UNKNOWN_FORMAT');

      validator.registerFormat('zcache-fmt', () => true);
      expect(validator.validateSafe('a', unknownFormatSchema()).valid).toBe(true);
      // now cached; unregistering must invalidate
      const spy = vi.spyOn(validator.sc, 'compileSchema');
      expect(validator.validateSafe('a', unknownFormatSchema()).valid).toBe(true);
      expect(spy).not.toHaveBeenCalled();
      validator.unregisterFormat('zcache-fmt');
      expect(code(validator.validateSafe('a', unknownFormatSchema()))).toBe('UNKNOWN_FORMAT');
    });

    it('respects global registerFormat/unregisterFormat', () => {
      const validator = ZSchema.create({ version: 'draft-07' });
      ZSchema.registerFormat('zcache-fmt', () => true);
      expect(validator.validateSafe('a', unknownFormatSchema()).valid).toBe(true);
      const spy = vi.spyOn(validator.sc, 'compileSchema');
      expect(validator.validateSafe('a', unknownFormatSchema()).valid).toBe(true);
      expect(spy).not.toHaveBeenCalled();
      ZSchema.unregisterFormat('zcache-fmt');
      expect(code(validator.validateSafe('a', unknownFormatSchema()))).toBe('UNKNOWN_FORMAT');
    });

    it('respects instance setRemoteReference after first validation', () => {
      const validator = ZSchema.create({ ignoreUnresolvableReferences: true });
      const schema = { $ref: 'http://localhost:1234/zcache-remote.json' };
      for (let i = 0; i < 2; i++) {
        expect(code(validator.validateSafe('a', schema))).toBe('REF_UNRESOLVED');
      }
      validator.setRemoteReference('http://localhost:1234/zcache-remote.json', { type: 'string' });
      expect(validator.validateSafe('a', schema).valid).toBe(true);
      const result = validator.validateSafe(1, schema);
      expect(result.valid).toBe(false);
      expect(code(result)).toBe('INVALID_TYPE');
    });

    it('picks up an instance setRemoteReference replacing an already resolved target', () => {
      const validator = ZSchema.create();
      const uri = 'http://localhost:1234/zcache-resolved.json';
      validator.setRemoteReference(uri, { type: 'string' });
      const schema = { $ref: uri };
      const spy = vi.spyOn(validator.sc, 'compileSchema');
      expect(validator.validateSafe('a', schema).valid).toBe(true);
      const afterFirst = spy.mock.calls.length;
      expect(validator.validateSafe('a', schema).valid).toBe(true);
      expect(spy).toHaveBeenCalledTimes(afterFirst);

      validator.setRemoteReference(uri, { type: 'number' });
      expect(code(validator.validateSafe('a', schema))).toBe('INVALID_TYPE');
      expect(validator.validateSafe(1, schema).valid).toBe(true);
    });

    it('recompiles after static ZSchema.setRemoteReference (global generation bump)', () => {
      const uri = 'http://localhost:1234/zcache-global.json';
      const validator = ZSchema.create();
      const schema = { $ref: uri };
      ZSchema.setRemoteReference(uri, { type: 'string' });
      const spy = vi.spyOn(validator.sc, 'compileSchema');
      expect(validator.validateSafe('a', schema).valid).toBe(true);
      const afterFirst = spy.mock.calls.length;
      expect(validator.validateSafe('a', schema).valid).toBe(true);
      expect(spy).toHaveBeenCalledTimes(afterFirst);

      ZSchema.setRemoteReference(uri, { type: 'number' });
      validator.validateSafe('a', schema);
      expect(spy.mock.calls.length).toBeGreaterThan(afterFirst);
    });

    it('recompiles after ZSchema.setSchemaReader (global generation bump)', () => {
      const validator = ZSchema.create();
      const schema = { type: 'string' };
      const spy = vi.spyOn(validator.sc, 'compileSchema');
      expect(validator.validateSafe('a', schema).valid).toBe(true);
      const afterFirst = spy.mock.calls.length;
      expect(validator.validateSafe('a', schema).valid).toBe(true);
      expect(spy).toHaveBeenCalledTimes(afterFirst);

      setSchemaReader(() => ({}));
      expect(validator.validateSafe('a', schema).valid).toBe(true);
      expect(spy.mock.calls.length).toBeGreaterThan(afterFirst);
    });
  });

  describe('instance schema cache coherence', () => {
    const uri = 'http://zcache.test/coherence.json';

    it('validateSchema replacing a mapped id invalidates cached $ref users', () => {
      const validator = ZSchema.create();
      validator.validateSchema({ $id: uri, type: 'string' });
      const user = { $ref: uri };
      const spy = vi.spyOn(validator.sc, 'compileSchema');
      expect(validator.validateSafe('x', user).valid).toBe(true);
      const afterFirst = spy.mock.calls.length;
      expect(validator.validateSafe('x', user).valid).toBe(true);
      expect(spy).toHaveBeenCalledTimes(afterFirst);

      validator.validateSchema({ $id: uri, type: 'number' });
      expect(code(validator.validateSafe('x', user))).toBe('INVALID_TYPE');
      expect(validator.validateSafe(1, user).valid).toBe(true);
    });

    it('handles nested $id replacement', () => {
      const validator = ZSchema.create();
      validator.validateSchema({
        $id: 'http://zcache.test/outer.json',
        properties: { a: { $id: uri, type: 'string' } },
      });
      const user = { $ref: uri };
      expect(validator.validateSafe('x', user).valid).toBe(true);
      const spy = vi.spyOn(validator.sc, 'compileSchema');
      expect(validator.validateSafe('x', user).valid).toBe(true);
      expect(spy).not.toHaveBeenCalled();
      validator.validateSchema({
        $id: 'http://zcache.test/outer2.json',
        properties: { a: { $id: uri, type: 'number' } },
      });
      expect(code(validator.validateSafe('x', user))).toBe('INVALID_TYPE');
    });

    it('validate(json, otherObjectWithSameId) followed by the original', () => {
      const validator = ZSchema.create();
      const a = { $id: uri, type: 'string' };
      const b = { $id: uri, type: 'number' };
      const user = { $ref: uri };
      expect(validator.validateSafe('x', a).valid).toBe(true);
      expect(validator.validateSafe('x', user).valid).toBe(true);
      const spy = vi.spyOn(validator.sc, 'compileSchema');
      expect(validator.validateSafe('x', user).valid).toBe(true);
      expect(spy).not.toHaveBeenCalled();

      expect(validator.validateSafe(1, b).valid).toBe(true);
      expect(code(validator.validateSafe('x', user))).toBe('INVALID_TYPE');
      expect(validator.validateSafe('x', a).valid).toBe(true);
      expect(validator.validateSafe('x', user).valid).toBe(true);
    });

    it('does not thrash for two distinct schemas each with its own $id', () => {
      const validator = ZSchema.create();
      const a = { $id: 'http://zcache.test/own-a.json', type: 'string' };
      const b = { $id: 'http://zcache.test/own-b.json', type: 'number' };
      validator.validateSafe('x', a);
      validator.validateSafe(1, b);
      validator.validateSafe('x', a);
      validator.validateSafe(1, b);
      const spy = vi.spyOn(validator.sc, 'compileSchema');
      for (let i = 0; i < 3; i++) {
        expect(validator.validateSafe('x', a).valid).toBe(true);
        expect(validator.validateSafe(1, b).valid).toBe(true);
      }
      expect(spy).not.toHaveBeenCalled();
    });

    it('removeFromCacheByUri clears cached entries', () => {
      const validator = ZSchema.create();
      validator.validateSchema({ $id: uri, type: 'string' });
      const user = { $ref: uri };
      expect(validator.validateSafe('x', user).valid).toBe(true);
      const spy = vi.spyOn(validator.sc, 'compileSchema');
      expect(validator.validateSafe('x', user).valid).toBe(true);
      expect(spy).not.toHaveBeenCalled();
      validator.scache.removeFromCacheByUri(uri);
      validator.validateSafe('x', user);
      expect(spy).toHaveBeenCalled();
    });

    it('does not cache a schema with an unresolved $ref', () => {
      const validator = ZSchema.create({ ignoreUnresolvableReferences: true });
      const schema = { $ref: 'http://zcache.test/late.json' };
      const spy = vi.spyOn(validator.sc, 'compileSchema');
      validator.validateSafe('x', schema);
      const afterFirst = spy.mock.calls.length;
      validator.validateSafe('x', schema);
      expect(spy.mock.calls.length).toBeGreaterThan(afterFirst);
      validator.setRemoteReference('http://zcache.test/late.json', { type: 'number' });
      expect(code(validator.validateSafe('x', schema))).toBe('INVALID_TYPE');
    });
  });

  describe('faithful keys', () => {
    it('does not confuse NaN with null', () => {
      const validator = ZSchema.create();
      expect(validator.validateSafe(null, { enum: [null] }).valid).toBe(true);
      expect(validator.validateSafe(null, { enum: [null] }).valid).toBe(true);
      const uncached = ZSchema.create().validateSafe(null, { enum: [Number.NaN] }).valid;
      expect(validator.validateSafe(null, { enum: [Number.NaN] }).valid).toBe(uncached);
    });

    it('returns no key for values that do not round-trip through JSON', () => {
      const { compiledSchemaCache: c } = ZSchema.create();
      expect(c.keyOf({ enum: [Number.NaN] })).toBeUndefined();
      expect(c.keyOf({ enum: [Number.POSITIVE_INFINITY] })).toBeUndefined();
      expect(c.keyOf({ const: undefined })).toBeUndefined();
      expect(c.keyOf({ enum: [undefined] })).toBeUndefined();
      expect(c.keyOf({ default: new Date(0) })).toBeUndefined();
      expect(c.keyOf({ pattern: /a/ } as never)).toBeUndefined();
      expect(c.keyOf({ enum: [() => 1] })).toBeUndefined();
      expect(c.keyOf({ type: 'string', enum: ['a', 1, null, { b: [true] }] })).toBeDefined();
    });

    it('does not cache schemas holding undefined or Date values', () => {
      const validator = ZSchema.create();
      const spy = vi.spyOn(validator.sc, 'compileSchema');
      for (const schema of [
        { type: 'string', default: undefined },
        { type: 'string', default: new Date(0) },
      ]) {
        validator.validateSafe('a', schema);
        const afterFirst = spy.mock.calls.length;
        validator.validateSafe('a', schema);
        expect(spy.mock.calls.length).toBeGreaterThan(afterFirst);
      }
    });
  });

  describe('instance options', () => {
    it('picks up mutated validator.options after caching', () => {
      const validator = ZSchema.create();
      const schema = { title: 'only a title' };
      const spy = vi.spyOn(validator.sc, 'compileSchema');
      expect(validator.validateSafe(1, schema).valid).toBe(true);
      const afterFirst = spy.mock.calls.length;
      expect(validator.validateSafe(1, schema).valid).toBe(true);
      expect(spy).toHaveBeenCalledTimes(afterFirst);

      validator.options.noTypeless = true;
      expect(code(validator.validateSafe(1, schema))).toBe('KEYWORD_UNDEFINED_STRICT');
    });

    it('picks up direct customFormats mutation', () => {
      const validator = ZSchema.create({ version: 'draft-07' });
      validator.registerFormat('zcache-fmt', () => true);
      expect(validator.validateSafe('a', unknownFormatSchema()).valid).toBe(true);
      const spy = vi.spyOn(validator.sc, 'compileSchema');
      expect(validator.validateSafe('a', unknownFormatSchema()).valid).toBe(true);
      expect(spy).not.toHaveBeenCalled();
      validator.options.customFormats!['zcache-fmt'] = null;
      expect(code(validator.validateSafe('a', unknownFormatSchema()))).toBe('UNKNOWN_FORMAT');
    });
  });

  describe('customValidator', () => {
    it('bypasses the cache and isolates schema mutations per call', () => {
      const seen: unknown[] = [];
      const validator = ZSchema.create({
        customValidator: (_report, schema) => {
          const s = schema as Record<string, unknown>;
          // meta-schemas are shared and legitimately marked; the user schema must be a fresh clone per call
          if (s.title === 'zcache-probe') {
            seen.push(s.zmark);
            s.zmark = true;
          }
        },
      });
      const spy = vi.spyOn(validator.sc, 'compileSchema');
      const schema = { type: 'string', title: 'zcache-probe' };
      validator.validateSafe('a', schema);
      const afterFirst = spy.mock.calls.length;
      validator.validateSafe('a', schema);
      expect(spy.mock.calls.length).toBeGreaterThan(afterFirst);
      expect(seen).toEqual([undefined, undefined]);
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
    const first = validator.validateSafe({}, schema);
    const second = validator.validateSafe({}, schema);
    expect(second.valid).toBe(first.valid);
    expect(code(second)).toBe(code(first));
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
    const { options } = ZSchema.create();

    it('evicts oldest entries first (FIFO)', () => {
      const cache = new CompiledSchemaCache();
      for (let i = 0; i < 101; i++) {
        cache.set(`k${i}`, fake(i), options);
      }
      expect(cache.get('k0', options)).toBeUndefined();
      expect(cache.get('k1', options)).toBeDefined();
      expect(cache.get('k100', options)).toBeDefined();
    });

    it('does not cache a key longer than the budget and evicts to fit within it', () => {
      const cache = new CompiledSchemaCache();
      cache.set('x'.repeat(16_000_001), fake(0), options);
      expect(cache.get('x'.repeat(16_000_001), options)).toBeUndefined();

      cache.set('a'.repeat(10_000_000), fake(1), options);
      cache.set('b'.repeat(5_000_000), fake(2), options);
      cache.set('c'.repeat(5_000_000), fake(3), options);
      expect(cache.get('a'.repeat(10_000_000), options)).toBeUndefined();
      expect(cache.get('b'.repeat(5_000_000), options)).toBeDefined();
      expect(cache.get('c'.repeat(5_000_000), options)).toBeDefined();
    });

    it('clear() drops everything', () => {
      const cache = new CompiledSchemaCache();
      cache.set('k', fake(1), options);
      cache.clear();
      expect(cache.get('k', options)).toBeUndefined();
    });
  });
});
