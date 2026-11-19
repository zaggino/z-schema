import { describe, expect, it } from 'vitest';

import { hasUnresolvedRef } from '../../src/compiled-schema-cache.ts';
import { ZSchema } from '../../src/z-schema.ts';

type Schema = Record<string, unknown>;

const NAMES = ['default', 'enum', 'const', 'examples'];

const firstCode = (result: { err?: { details?: Array<{ code: string }> } }) => result.err?.details?.[0]?.code;

describe('a property named like a data keyword', () => {
  describe.each(NAMES)('a property named %s', (name) => {
    it('resolves a $ref inside its schema', () => {
      const v = ZSchema.create({ safe: true });
      const schema: Schema = { $defs: { n: { type: 'string' } }, properties: { [name]: { $ref: '#/$defs/n' } } };
      expect(v.validate({ [name]: 'x' }, schema).valid).toBe(true);
      const bad = v.validate({ [name]: 1 }, schema);
      expect(bad.valid).toBe(false);
      expect(firstCode(bad)).toBe('INVALID_TYPE');
    });

    it('resolves the same $ref through compile()', () => {
      const v = ZSchema.create({ safe: true });
      const schema: Schema = { $defs: { n: { type: 'string' } }, properties: { [name]: { $ref: '#/$defs/n' } } };
      const check = v.compile(schema);
      for (let i = 0; i < 2; i++) {
        expect(check({ [name]: 'x' }).valid).toBe(true);
        const bad = check({ [name]: 1 });
        expect(bad.valid).toBe(false);
        expect(firstCode(bad)).toBe('INVALID_TYPE');
      }
    });

    it('resolves a $ref under patternProperties', () => {
      const v = ZSchema.create({ safe: true });
      const schema: Schema = {
        $defs: { n: { type: 'string' } },
        patternProperties: { [`^${name}$`]: { $ref: '#/$defs/n' } },
      };
      expect(v.validate({ [name]: 'x' }, schema).valid).toBe(true);
      const bad = v.validate({ [name]: 1 }, schema);
      expect(bad.valid).toBe(false);
      expect(firstCode(bad)).toBe('INVALID_TYPE');
    });

    it('resolves a $ref under a patternProperties key spelled like it', () => {
      const v = ZSchema.create({ safe: true });
      const schema: Schema = {
        $defs: { n: { type: 'string' } },
        patternProperties: { [name]: { $ref: '#/$defs/n' } },
      };
      expect(v.validate({ [name]: 'x' }, schema).valid).toBe(true);
      const bad = v.validate({ [name]: 1 }, schema);
      expect(bad.valid).toBe(false);
      expect(firstCode(bad)).toBe('INVALID_TYPE');
    });

    it('finds an $anchor declared inside its schema', () => {
      const v = ZSchema.create({ safe: true });
      const schema: Schema = {
        properties: {
          [name]: { $anchor: 'inner', type: 'string' },
          b: { $ref: '#inner' },
        },
      };
      const bad = v.validate({ b: 1 }, schema);
      expect(bad.valid).toBe(false);
      expect(firstCode(bad)).toBe('INVALID_TYPE');
      expect(v.validate({ b: 'x' }, schema).valid).toBe(true);
    });

    it('picks up a reference target that is registered after a first call', () => {
      const v = ZSchema.create({ safe: true });
      const schema: Schema = { properties: { [name]: { $ref: 'http://example.com/later.json' } } };
      expect(v.validate({ [name]: 1 }, schema).valid).toBe(false);
      v.setRemoteReference('http://example.com/later.json', { type: 'string' });
      expect(v.validate({ [name]: 'x' }, schema).valid).toBe(true);
      const bad = v.validate({ [name]: 1 }, schema);
      expect(bad.valid).toBe(false);
      expect(firstCode(bad)).toBe('INVALID_TYPE');
    });

    it('reports an unresolved reference inside its schema to the compiled-schema cache', () => {
      expect(hasUnresolvedRef({ properties: { [name]: { $ref: '#/nowhere' } } }, 100)).toBe(true);
      expect(hasUnresolvedRef({ [name]: { $ref: '#/nowhere' } }, 100)).toBe(false);
    });

    it('resolves a reference to a definition with that name', () => {
      const v = ZSchema.create({ safe: true });
      const schema: Schema = {
        $defs: { [name]: { type: 'string' } },
        properties: { a: { $ref: `#/$defs/${name}` } },
      };
      expect(v.validate({ a: 'x' }, schema).valid).toBe(true);
      expect(v.validate({ a: 1 }, schema).valid).toBe(false);
    });

    it('resolves a reference to a definitions entry with that name under draft-07', () => {
      const v = ZSchema.create({ safe: true, version: 'draft-07' });
      const schema: Schema = {
        definitions: { [name]: { type: 'string' } },
        properties: { a: { $ref: `#/definitions/${name}` } },
      };
      expect(v.validate({ a: 'x' }, schema).valid).toBe(true);
      expect(v.validate({ a: 1 }, schema).valid).toBe(false);
    });

    it('resolves a $ref inside a dependentSchemas entry with that name', () => {
      const v = ZSchema.create({ safe: true });
      const schema: Schema = {
        dependentSchemas: { [name]: { properties: { other: { $ref: '#/$defs/n' } } } },
        $defs: { n: { type: 'string' } },
      };
      expect(v.validate({ [name]: 1, other: 1 }, schema).valid).toBe(false);
      expect(v.validate({ [name]: 1, other: 'x' }, schema).valid).toBe(true);
    });

    it('finds an $id declared inside its schema', () => {
      const v = ZSchema.create({ safe: true });
      const schema: Schema = {
        properties: {
          [name]: { $id: 'http://example.com/inner.json', type: 'string' },
          b: { $ref: 'http://example.com/inner.json' },
        },
      };
      const bad = v.validate({ b: 1 }, schema);
      expect(bad.valid).toBe(false);
      expect(firstCode(bad)).toBe('INVALID_TYPE');
      expect(v.validate({ b: 'x' }, schema).valid).toBe(true);
    });

    it('resolves a $ref nested two levels deep', () => {
      const v = ZSchema.create({ safe: true });
      const schema: Schema = {
        properties: { [name]: { properties: { [name]: { $ref: '#/$defs/n' } } } },
        $defs: { n: { type: 'string' } },
      };
      expect(v.validate({ [name]: { [name]: 'x' } }, schema).valid).toBe(true);
      const bad = v.validate({ [name]: { [name]: 1 } }, schema);
      expect(bad.valid).toBe(false);
      expect(firstCode(bad)).toBe('INVALID_TYPE');
    });
  });

  describe('the names in a keyword map are not keywords', () => {
    it('resolves references inside properties named $ref and $id', () => {
      const v = ZSchema.create({ safe: true });
      const schema: Schema = {
        $defs: { n: { type: 'string' } },
        properties: { $ref: { $ref: '#/$defs/n' }, $id: { $ref: '#/$defs/n' } },
      };
      expect(v.validate({ $ref: 'x', $id: 'y' }, schema).valid).toBe(true);
      const bad = v.validate({ $ref: 1 }, schema);
      expect(bad.valid).toBe(false);
      expect(firstCode(bad)).toBe('INVALID_TYPE');
    });

    it('inspects an object once as a keyword map and once as a schema', () => {
      const shared = { $ref: '#/nowhere' };
      // under $defs the key $ref is a name with a string value; under allOf the same object is a schema
      expect(hasUnresolvedRef({ $defs: shared, allOf: [shared] }, 100)).toBe(true);
      expect(hasUnresolvedRef({ $defs: shared }, 100)).toBe(false);
    });
  });

  // These pass with and without position tracking: they guard what must not change.
  describe('keyword values stay data', () => {
    it('does not resolve a reference-like value of default', () => {
      const v = ZSchema.create({ safe: true });
      expect(v.validate({}, { default: { $ref: '#/nowhere' }, type: 'object' }).valid).toBe(true);
    });

    it('does not resolve a reference-like value of enum', () => {
      const v = ZSchema.create({ safe: true });
      const schema: Schema = { enum: [{ $ref: '#/nowhere' }] };
      expect(v.validate({ $ref: '#/nowhere' }, schema).valid).toBe(true);
      expect(v.validate({}, schema).valid).toBe(false);
    });

    it('does not resolve a reference-like value of const', () => {
      const v = ZSchema.create({ safe: true });
      const value = { $id: 'http://example.com/x', $ref: '#/nowhere' };
      expect(v.validate(value, { const: value }).valid).toBe(true);
    });

    it('does not resolve a reference-like value of examples', () => {
      const v = ZSchema.create({ safe: true });
      expect(v.validate(1, { examples: [{ $ref: '#/nowhere' }] }).valid).toBe(true);
    });

    it('treats a keyword value inside a property named like a keyword as data', () => {
      const v = ZSchema.create({ safe: true });
      const schema: Schema = { properties: { default: { default: { $ref: '#/nowhere' }, type: 'string' } } };
      expect(v.validate({ default: 'x' }, schema).valid).toBe(true);
    });

    it('does not register an $id found inside enum', () => {
      const v = ZSchema.create({ safe: true });
      v.validate(1, { enum: [{ $id: 'http://example.com/from-enum.json', type: 'string' }], properties: {} });
      const result = v.validate(1, { $ref: 'http://example.com/from-enum.json' });
      expect(result.valid).toBe(false);
      expect(firstCode(result)).toBe('UNRESOLVABLE_REFERENCE');
    });
  });

  it('resolves a $ref inside a property whose name starts with the reserved prefix', () => {
    const v = ZSchema.create({ safe: true });
    const schema: Schema = { $defs: { n: { type: 'string' } }, properties: { __$compiled: { $ref: '#/$defs/n' } } };
    const bad = v.validate({ __$compiled: 1 }, schema);
    expect(bad.valid).toBe(false);
    expect(firstCode(bad)).toBe('INVALID_TYPE');
  });
});
