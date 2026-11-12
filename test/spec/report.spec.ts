import { Report } from '../../src/report.ts';
import { jsonSymbol } from '../../src/utils/symbols.ts';
import { ZSchema } from '../../src/z-schema.ts';

describe('Report schemaId and root json', () => {
  it('reports schemaId from $id', () => {
    const validator = ZSchema.create();
    const result = validator.validateSafe(1, { $id: 'https://example.com/root', type: 'string' });
    expect(result.valid).toBe(false);
    expect(result.err?.details?.[0].schemaId).toBe('https://example.com/root');
  });

  it('reports schemaId from id on draft-04', () => {
    const validator = ZSchema.create({ version: 'draft-04' });
    const result = validator.validateSafe(1, { id: 'http://example.com/root', type: 'string' });
    expect(result.valid).toBe(false);
    expect(result.err?.details?.[0].schemaId).toBe('http://example.com/root');
  });

  it.each([0, '', false, null])('returns a falsy root json (%j) from getJson', (value) => {
    const parent = new Report({});
    parent.json = value;
    expect(parent.getJson()).toBe(value);
    expect(new Report(parent).getJson()).toBe(value);

    parent.addError('INVALID_TYPE', ['string', 'number']);
    const detail = parent.errors[0] as unknown as Record<symbol, unknown>;
    expect(detail[jsonSymbol]).toBe(value);
  });
});

describe('Report schema path tracking', () => {
  it('should initialize with empty schema path', () => {
    const report = new Report({});
    expect(report.schemaPath).toEqual([]);
  });

  it('should track schema path segments', () => {
    const report = new Report({});
    report.schemaPath.push('properties', 'name');
    report.schemaPath.push('type');
    expect(report.schemaPath).toEqual(['properties', 'name', 'type']);
  });

  it('should return schema path via getSchemaPath', () => {
    const report = new Report({});
    report.schemaPath.push('properties', 'age');
    expect(report.getSchemaPath()).toEqual(['properties', 'age']);
  });

  it('should inherit schema path from parent report', () => {
    const parentReport = new Report({});
    parentReport.schemaPath.push('properties', 'user');

    const childReport = new Report(parentReport);
    childReport.schemaPath.push('name');

    expect(childReport.getSchemaPath()).toEqual(['properties', 'user', 'name']);
  });

  it('should include schema path in error details', () => {
    const report = new Report({});
    report.schemaPath.push('properties', 'email');
    report.schemaPath.push('type');

    report.addError('INVALID_TYPE', ['string', 'number']);

    expect(report.errors).toHaveLength(1);
    expect(report.errors[0].schemaPath).toEqual(['properties', 'email', 'type']);
  });

  it('should handle empty schema path in errors', () => {
    const report = new Report({});
    report.addError('INVALID_TYPE', ['string', 'number']);

    expect(report.errors).toHaveLength(1);
    expect(report.errors[0].schemaPath).toEqual([]);
  });

  it('should maintain schema path across nested reports', () => {
    const parentReport = new Report({});
    parentReport.schemaPath.push('allOf', 0);

    const childReport = new Report(parentReport);
    childReport.schemaPath.push('properties', 'name');

    childReport.addError('INVALID_TYPE', ['string', 'number']);

    expect(childReport.errors[0].schemaPath).toEqual(['allOf', 0, 'properties', 'name']);
  });
});
