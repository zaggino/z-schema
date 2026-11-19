import type { SchemaErrorDetail } from '../../src/report.ts';

import { describe, expect, it } from 'vitest';

import { ZSchema } from '../../src/z-schema.ts';

function findDetail(details: SchemaErrorDetail[] | undefined, code: string): SchemaErrorDetail | undefined {
  if (!details) {
    return undefined;
  }
  for (let idx = 0; idx < details.length; idx++) {
    const detail = details[idx];
    if (detail.code === code) {
      return detail;
    }
    const nested = findDetail(detail.inner, code);
    if (nested) {
      return nested;
    }
  }
  return undefined;
}

function validateRef(node: unknown) {
  const validator = ZSchema.create({ safe: true });
  const schema = { $ref: '#/extra/node', extra: { node } };
  return validator.validate(1, schema);
}

describe('a reference that ends on a value that is not a schema', () => {
  it('reports the type of a string node without copying the text', () => {
    const result = validateRef('some text');
    expect(result.valid).toBe(false);
    const details = result.err?.details;
    const detail = findDetail(details, 'SCHEMA_NOT_AN_OBJECT');
    expect(detail).toBeDefined();
    expect(detail?.params).toEqual(['string']);
    expect(detail?.description).toBeUndefined();
    expect(JSON.stringify(details)).not.toContain('some text');
  });

  it('reports the type of a number node without a description', () => {
    const result = validateRef(5.5);
    expect(result.valid).toBe(false);
    const detail = findDetail(result.err?.details, 'SCHEMA_NOT_AN_OBJECT');
    expect(detail).toBeDefined();
    expect(detail?.params).toEqual(['number']);
    expect(detail?.description).toBeUndefined();
  });

  it('an object schema still reports its title and description', () => {
    const validator = ZSchema.create({ safe: true });
    const result = validator.validate(1, { type: 'string', title: 'T', description: 'D' });
    expect(result.valid).toBe(false);
    const detail = findDetail(result.err?.details, 'INVALID_TYPE');
    expect(detail).toBeDefined();
    expect(detail?.title).toBe('T');
    expect(detail?.description).toBe('D');
  });
});
