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

const addPlain = (report: Report, count: number) => {
  for (let i = 0; i < count; i++) {
    report.path = [i];
    report.addError('INVALID_TYPE', ['string', 'number']);
  }
};

const makeSub = (parent: Report, count: number, deferred = false) => {
  const sub = new Report(parent);
  sub.errorLimit = Infinity;
  sub.deferErrors = deferred;
  addPlain(sub, count);
  return sub;
};

describe('Report error limit', () => {
  it('counts every detail, nested ones included', () => {
    const root = new Report({});
    root.addError('INVALID_TYPE', ['string', 'number']);
    root.addError('ANY_OF_MISSING', undefined, makeSub(root, 3));
    expect(root.errors).toHaveLength(2);
    expect(root.errorCount).toBe(5);
  });

  it.each([0, 1])('records the first error at limit %i', (limit) => {
    const report = new Report({});
    report.errorLimit = limit;
    addPlain(report, 3);
    expect(report.errors).toHaveLength(1);
    expect(report.errorsTruncated).toBe(true);
  });

  it.each([false, true])('stops at the limit (deferred: %j)', (deferred) => {
    const limited = new Report({});
    limited.deferErrors = deferred;
    limited.errorLimit = 3;
    addPlain(limited, 5);
    expect(limited.errors).toHaveLength(3);
    expect(limited.errorsTruncated).toBe(true);

    const roomy = new Report({});
    roomy.deferErrors = deferred;
    roomy.errorLimit = 5;
    addPlain(roomy, 5);
    expect(roomy.errors).toHaveLength(5);
    expect(roomy.errorsTruncated).toBe(false);
  });

  it('gives a sub-report the room its parent has left', () => {
    const parent = new Report({});
    parent.errorLimit = 10;
    addPlain(parent, 4);
    expect(new Report(parent).errorLimit).toBe(5);

    const full = new Report({});
    full.errorLimit = 3;
    addPlain(full, 3);
    expect(new Report(full).errorLimit).toBe(1);

    expect(new Report(new Report({})).errorLimit).toBe(Infinity);
  });

  it.each([false, true])(
    'adopts sub-report errors whole, in order, until one does not fit (deferred: %j)',
    (deferred) => {
      const fits = new Report({});
      fits.errorLimit = 4;
      fits.addError('ANY_OF_MISSING', undefined, makeSub(fits, 3, deferred));
      expect(fits.errors[0].inner).toHaveLength(3);
      expect(fits.errorCount).toBe(4);
      expect(fits.errorsTruncated).toBe(false);

      const tight = new Report({});
      tight.errorLimit = 3;
      tight.addError('ANY_OF_MISSING', undefined, makeSub(tight, 3, deferred));
      expect(tight.errors[0].inner).toHaveLength(2);
      expect(tight.errorCount).toBe(3);
      expect(tight.errorsTruncated).toBe(true);

      const misfit = new Report({});
      misfit.errorLimit = 3;
      const sub = makeSub(misfit, 0, deferred);
      sub.addError('ANY_OF_MISSING', undefined, makeSub(sub, 2, deferred));
      sub.addError('INVALID_TYPE', ['string', 'number']);
      misfit.addError('ANY_OF_MISSING', undefined, sub);
      expect(misfit.errors[0].inner).toBeUndefined();
      expect(misfit.errorCount).toBe(1);
      expect(misfit.errorsTruncated).toBe(true);
    }
  );

  it('passes the flag up only when errors are adopted', () => {
    const parent = new Report({});
    const discarded = makeSub(parent, 1);
    discarded.errorsTruncated = true;
    expect(parent.errorsTruncated).toBe(false);

    const adopted = makeSub(parent, 1);
    adopted.errorsTruncated = true;
    parent.addError('ANY_OF_MISSING', undefined, adopted);
    expect(parent.errorsTruncated).toBe(true);
  });

  it('does not count or flag an excluded error', () => {
    const report = new Report({}, { excludeErrors: ['INVALID_TYPE'] });
    report.errorLimit = 1;
    report.addError('INVALID_TYPE', ['string', 'number']);
    report.addError('INVALID_TYPE', ['string', 'number']);
    report.addError('ENUM_MISMATCH', ['x']);
    expect(report.errors.map((e) => e.code)).toStrictEqual(['ENUM_MISMATCH']);
    expect(report.errorsTruncated).toBe(false);
  });
});
