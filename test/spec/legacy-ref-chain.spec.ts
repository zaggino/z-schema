import type { JsonSchema } from '../../src/json-schema-versions.ts';
import type { ZSchemaBase } from '../../src/z-schema-base.ts';

import { describe, expect, it } from 'vitest';

import { ZSchema } from '../../src/z-schema.ts';
import { buildFastFor, interpreterRun } from '../lib/fast-validator.ts';

const VERSIONS = ['draft-07', 'draft-04'] as const;

/** A root whose `$ref` chain takes exactly `hops` hops through `definitions`, ending on `last`. */
const chain = (hops: number, last: unknown): JsonSchema => {
  const definitions: Record<string, unknown> = {};
  for (let i = 0; i < hops; i++) {
    definitions[`d${i}`] = i === hops - 1 ? last : { $ref: `#/definitions/d${i + 1}` };
  }
  return { $ref: '#/definitions/d0', definitions } as unknown as JsonSchema;
};

const PINNED: Record<string, { valid: boolean; codes: string[] }> = {
  true: { valid: true, codes: [] },
  false: { valid: false, codes: ['REF_UNRESOLVED'] },
};

/** True when `validator` holds a compiled-cache entry for `schema`. */
const isCached = (validator: ZSchemaBase, schema: JsonSchema): boolean => {
  const key = validator.compiledSchemaCache.keyOf(schema);
  return key !== undefined && validator.compiledSchemaCache.getEntry(key, validator.options) !== undefined;
};

const codes = (r: { err?: { details?: Array<{ code: string }> } }) => r.err?.details?.map((d) => d.code) ?? [];

describe.each(VERSIONS)('legacy $ref chain (%s)', (version) => {
  const options = { version, ignoreUnresolvableReferences: true } as const;

  it('follows 98 hops and agrees with the fast validator', () => {
    const schema = chain(98, { type: 'string' });
    const v = ZSchema.create({ ...options, safe: true });
    for (let i = 0; i < 2; i++) {
      expect(v.validate('a', schema).valid).toBe(true);
      const bad = v.validate(1, schema);
      expect(bad.valid).toBe(false);
      expect(codes(bad)).toEqual(['INVALID_TYPE']);
    }
    expect(buildFastFor(v, schema)).toBeDefined();
    expect(interpreterRun(options, schema, 1).valid).toBe(false);
  });

  it('throws at 99 hops and builds no fast validator', () => {
    const schema = chain(99, { type: 'string' });
    expect(() => ZSchema.create(options).validate('a', schema)).toThrow('Circular dependency by $ref references!');
    const safe = ZSchema.create({ ...options, safe: true });
    const result = safe.validate('a', schema);
    expect(result.valid).toBe(false);
    expect(String(result.err)).toContain('Circular dependency by $ref references!');
    expect(buildFastFor(safe, schema)).toBeUndefined();
  });

  it('ignores siblings of a $ref', () => {
    const schema = { $ref: '#/definitions/s', type: 'number', minimum: 100, definitions: { s: { type: 'string' } } };
    const v = ZSchema.create({ ...options, safe: true });
    for (let i = 0; i < 2; i++) {
      expect(v.validate('a', schema as JsonSchema).valid).toBe(true);
      expect(codes(v.validate(5, schema as JsonSchema))).toEqual(['INVALID_TYPE']);
    }
    expect(buildFastFor(v, schema as JsonSchema)).toBeDefined();
  });

  it('reports REF_UNRESOLVED for an unresolved $ref and is never cached', () => {
    const schema = { $ref: 'http://localhost:1234/legacy-chain-missing.json' } as JsonSchema;
    const v = ZSchema.create({ ...options, safe: true });
    for (let i = 0; i < 2; i++) {
      expect(codes(v.validate('a', schema))).toEqual(['REF_UNRESOLVED']);
    }
    // a schema with an unresolved reference is not compiled into the cache, so no fast validator can exist
    expect(isCached(v, schema)).toBe(false);
    expect(codes(interpreterRun(options, schema, 'a'))).toEqual(['REF_UNRESOLVED']);
  });

  it('reports REF_UNRESOLVED at the end of a resolved chain', () => {
    const schema = chain(3, { $ref: 'http://localhost:1234/legacy-chain-missing.json', type: 'number' });
    const v = ZSchema.create({ ...options, safe: true });
    for (let i = 0; i < 2; i++) {
      expect(codes(v.validate('a', schema))).toEqual(['REF_UNRESOLVED', 'INVALID_TYPE']);
    }
    // not compiled into the cache either (see above)
    expect(isCached(v, schema)).toBe(false);
  });

  it('treats a self-referencing $ref as its own keywords and builds no fast validator', () => {
    const schema = { definitions: { a: { $ref: '#/definitions/a', type: 'string' } }, $ref: '#/definitions/a' };
    const v = ZSchema.create({ ...options, safe: true });
    const first = v.validate(1, schema);
    const second = v.validate(1, schema);
    expect(first.valid).toBe(false);
    expect(codes(first)).toEqual(['INVALID_TYPE']);
    expect(second.valid).toBe(first.valid);
    expect(codes(second)).toEqual(codes(first));
    expect(isCached(v, schema as JsonSchema)).toBe(true);
    expect(buildFastFor(v, schema as JsonSchema)).toBeUndefined();
  });
});

describe('legacy $ref to a boolean schema (draft-07)', () => {
  const options = { version: 'draft-07' } as const;
  const cases = [
    { name: 'true', def: true },
    { name: 'false', def: false },
  ];

  it.each(cases)('pins the interpreter answer for a $name target', ({ def }) => {
    const schema = { $ref: '#/definitions/t', definitions: { t: def } } as unknown as JsonSchema;
    const v = ZSchema.create({ ...options, safe: true });
    const fresh = interpreterRun(options, schema, 'a');
    for (let i = 0; i < 2; i++) {
      const r = v.validate('a', schema);
      expect(r.valid).toBe(fresh.valid);
      expect(codes(r)).toEqual(codes(fresh));
    }
    expect(buildFastFor(v, schema)).toBeUndefined();
    // the pinned answers are in PINNED above
    expect({ valid: fresh.valid, codes: codes(fresh) }).toEqual(PINNED[String(def)]);
  });
});
