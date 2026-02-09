import { Report } from '../../src/report.ts';

describe('Report schema path tracking', () => {
  it('should initialize with empty schema path', () => {
    const report = new Report({});
    expect(report.schemaPath).toEqual([]);
  });

  it('should track schema path segments', () => {
    const report = new Report({});
    report.schemaPath.push('properties');
    report.schemaPath.push('name');
    report.schemaPath.push('type');
    expect(report.schemaPath).toEqual(['properties', 'name', 'type']);
  });

  it('should return schema path via getSchemaPath', () => {
    const report = new Report({});
    report.schemaPath.push('properties');
    report.schemaPath.push('age');
    expect(report.getSchemaPath()).toEqual(['properties', 'age']);
  });

  it('should inherit schema path from parent report', () => {
    const parentReport = new Report({});
    parentReport.schemaPath.push('properties');
    parentReport.schemaPath.push('user');

    const childReport = new Report(parentReport);
    childReport.schemaPath.push('name');

    expect(childReport.getSchemaPath()).toEqual(['properties', 'user', 'name']);
  });

  it('should include schema path in error details', () => {
    const report = new Report({});
    report.schemaPath.push('properties');
    report.schemaPath.push('email');
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
    parentReport.schemaPath.push('allOf');
    parentReport.schemaPath.push(0);

    const childReport = new Report(parentReport);
    childReport.schemaPath.push('properties');
    childReport.schemaPath.push('name');

    childReport.addError('INVALID_TYPE', ['string', 'number']);

    expect(childReport.errors[0].schemaPath).toEqual(['allOf', 0, 'properties', 'name']);
  });
});
