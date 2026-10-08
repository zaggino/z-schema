import type { SchemaErrorDetail } from '../../src/report.ts';
import type { ValidateOptions } from '../../src/z-schema-base.ts';
import type { ZSchemaOptions } from '../../src/z-schema-options.ts';

import { Report } from '../../src/report.ts';
import { ZSchema } from '../../src/z-schema.ts';
import { expectSameThrown, runBothModes, settle, shapeOf, withEagerSubReports } from '../lib/deferred-errors.ts';

interface Case {
  name: string;
  schema: Record<string, unknown> | boolean;
  data: unknown;
  options?: ZSchemaOptions;
  validateOptions?: ValidateOptions;
}

const draft2019 = 'https://json-schema.org/draft/2019-09/schema';
const draft7 = 'http://json-schema.org/draft-07/schema#';
const draft4 = 'http://json-schema.org/draft-04/schema#';

const corpus: Case[] = [
  {
    name: 'oneOf all fail',
    schema: { oneOf: [{ type: 'string' }, { type: 'number', minimum: 10 }, { type: 'array', minItems: 2 }] },
    data: 5,
  },
  { name: 'oneOf multi pass', schema: { oneOf: [{ type: 'number' }, { minimum: 1 }] }, data: 5 },
  {
    name: 'anyOf all fail',
    schema: { anyOf: [{ type: 'string', title: 'str', description: 'a string' }, { required: ['a'] }] },
    data: { b: 1 },
  },
  {
    name: 'nested oneOf in anyOf in items',
    schema: {
      type: 'array',
      items: { anyOf: [{ oneOf: [{ type: 'string' }, { type: 'boolean' }] }, { type: 'object', required: ['x'] }] },
    },
    data: [1, 'a', { y: 1 }, [2]],
  },
  { name: 'not', schema: { properties: { a: { not: { type: 'string' } } } }, data: { a: 'x' } },
  {
    name: 'if/then/else',
    schema: {
      if: { properties: { a: { const: 1 } }, required: ['a'] },
      then: { required: ['b'] },
      else: { required: ['c'] },
    },
    data: { a: 2 },
  },
  { name: 'contains none', schema: { contains: { type: 'string', minLength: 3 } }, data: [1, 'a', {}] },
  {
    name: 'contains min/maxContains',
    schema: { contains: { type: 'number' }, minContains: 2, maxContains: 3 },
    data: [1, 'a'],
  },
  { name: 'contains maxContains exceeded', schema: { contains: { type: 'number' }, maxContains: 1 }, data: [1, 2, 3] },
  {
    name: 'propertyNames',
    schema: { propertyNames: { pattern: '^[a-z]+$', maxLength: 3 } },
    data: { abc: 1, ABCD: 2, 'x/y': 3 },
  },
  {
    name: 'unevaluatedProperties with combinators',
    schema: {
      allOf: [{ properties: { a: { type: 'string' } } }],
      anyOf: [{ properties: { b: { type: 'number' } } }, { properties: { c: { type: 'number' } } }],
      unevaluatedProperties: false,
    },
    data: { a: 'x', b: 1, d: 1 },
  },
  {
    name: 'unevaluatedProperties as schema',
    schema: { properties: { a: {} }, unevaluatedProperties: { type: 'string', title: 'T' } },
    data: { a: 1, b: 2, c: 'x' },
  },
  {
    name: 'unevaluatedItems with combinators',
    schema: {
      prefixItems: [{ type: 'number' }],
      oneOf: [{ items: { type: 'number' } }, { items: { type: 'string' } }],
      unevaluatedItems: false,
    },
    data: [1, 'a', 2],
  },
  {
    name: 'unevaluatedItems as schema',
    schema: { prefixItems: [{}], unevaluatedItems: { type: 'string' } },
    data: [1, 2, 'x'],
  },
  {
    name: '$ref with $id differing schemaId',
    schema: {
      $id: 'http://example.com/root.json',
      $defs: {
        a: { $id: 'http://example.com/a.json', oneOf: [{ type: 'string' }, { $ref: 'b.json' }] },
        b: { $id: 'http://example.com/b.json', type: 'object', required: ['q'] },
      },
      properties: { x: { $ref: 'a.json' }, y: { anyOf: [{ $ref: 'a.json' }, { type: 'null' }] } },
    },
    data: { x: 5, y: 6 },
  },
  {
    name: 'draft-07 id based',
    schema: {
      $schema: draft7,
      $id: 'http://example.com/r7.json',
      definitions: { d: { $id: 'http://example.com/d7.json', anyOf: [{ type: 'string' }, { minimum: 100 }] } },
      properties: { x: { $ref: '#/definitions/d' } },
    },
    data: { x: 1 },
  },
  {
    name: 'draft-04 id based',
    schema: {
      $schema: draft4,
      id: 'http://example.com/r4.json',
      properties: { x: { id: 'http://example.com/n4.json', oneOf: [{ type: 'string' }, { type: 'array' }] } },
    },
    data: { x: 1 },
  },
  {
    name: 'reportPathAsArray',
    schema: { properties: { a: { items: { anyOf: [{ type: 'string' }, { type: 'boolean' }] } } } },
    data: { a: [1, 'x', 2] },
    options: { reportPathAsArray: true },
  },
  {
    name: 'breakOnFirstError',
    schema: { oneOf: [{ type: 'string' }, { type: 'number', minimum: 10 }], required: ['q'] },
    data: { a: 1 },
    options: { breakOnFirstError: true },
  },
  {
    name: 'breakOnFirstError false',
    schema: { anyOf: [{ type: 'string' }, { type: 'object', required: ['q', 'r'] }] },
    data: { a: 1 },
    options: { breakOnFirstError: false },
  },
  {
    name: 'excludeErrors inner code',
    schema: { oneOf: [{ type: 'string' }, { type: 'object', required: ['q'], minProperties: 3 }] },
    data: { a: 1 },
    validateOptions: { excludeErrors: ['INVALID_TYPE'] },
  },
  {
    name: 'excludeErrors top code',
    schema: { anyOf: [{ type: 'string' }, { required: ['q'] }] },
    data: { a: 1 },
    validateOptions: { excludeErrors: ['ANY_OF_MISSING'] },
  },
  {
    name: 'includeErrors',
    schema: { anyOf: [{ type: 'string' }, { required: ['q'] }], minProperties: 2 },
    data: { a: 1 },
    validateOptions: { includeErrors: ['ANY_OF_MISSING'] },
  },
  {
    name: 'title/description on failing sub-schemas',
    schema: {
      oneOf: [
        { title: 'A', description: 'alpha', type: 'string' },
        { title: 'B', type: 'number', minimum: 5 },
        { description: 'gamma', required: ['z'] },
      ],
    },
    data: 1,
  },
  {
    name: 'uri property names in path',
    schema: {
      properties: {
        'http://example.com/a': { oneOf: [{ type: 'string' }, { type: 'array' }] },
        'a~b/c': { anyOf: [{ type: 'string' }, { type: 'array' }] },
      },
    },
    data: { 'http://example.com/a': 1, 'a~b/c': 2 },
  },
  {
    name: 'many failures in array',
    schema: { items: { oneOf: [{ type: 'string' }, { type: 'boolean' }] } },
    data: [1, 2, 3, 4, 5, 6],
  },
  {
    name: 'dependentSchemas / allOf nested errors',
    schema: {
      dependentSchemas: { a: { anyOf: [{ required: ['b'] }, { required: ['c'] }] } },
      allOf: [{ anyOf: [{ type: 'string' }, { type: 'object', not: { required: ['a'] } }] }],
    },
    data: { a: 1 },
  },
  {
    name: 'draft2019-09 recursive anchors',
    schema: {
      $schema: draft2019,
      $id: 'http://example.com/tree',
      $recursiveAnchor: true,
      type: 'object',
      properties: { child: { anyOf: [{ $recursiveRef: '#' }, { type: 'null' }] }, v: { type: 'number' } },
    },
    data: { child: { child: { v: 'x' } } },
  },
];

function validateOnce(testCase: Case) {
  const validator = ZSchema.create(testCase.options);
  const schema = structuredClone(testCase.schema) as never;
  return validator.validateSafe(testCase.data, schema, testCase.validateOptions);
}

describe('deferred sub-report errors: differential against eager materialization', () => {
  it.each(corpus.map((c) => [c.name, c] as const))('%s', (_name, testCase) => {
    const { deferred, eager } = runBothModes(() => validateOnce(testCase));
    expect(deferred.valid).toBe(eager.valid);
    expect(shapeOf(deferred.err?.details)).toStrictEqual(shapeOf(eager.err?.details));
    expect(deferred.err?.details).toStrictEqual(eager.err?.details);
    expect(deferred.err?.message).toBe(eager.err?.message);
  });

  it('exercises materialized inner details for oneOf', () => {
    const { deferred } = runBothModes(() => validateOnce(corpus[0]));
    const detail = deferred.err!.details![0];
    expect(detail.code).toBe('ONE_OF_MISSING');
    expect(detail.inner!.length).toBeGreaterThan(0);
    expect(typeof detail.inner![0].message).toBe('string');
    expect(typeof detail.inner![0].path).toBe('string');
  });

  it('matches for an async format validator inside anyOf', async () => {
    const schema = {
      type: 'object',
      properties: {
        v: {
          anyOf: [
            { type: 'string', format: 'async-a' },
            { type: 'number', format: 'async-a' },
          ],
        },
      },
    };
    const run = async () => {
      const validator = ZSchema.create({ async: true, safe: true });
      validator.registerFormat('async-a', (input: unknown) => Promise.resolve(input === 'ok'));
      return await validator.validate({ v: 'nope' }, structuredClone(schema));
    };
    const deferred = await run();
    const eager = await withEagerSubReports(run);
    expect(eager.valid).toBe(false);
    expect(deferred.valid).toBe(false);
    expect(shapeOf(deferred.err?.details)).toStrictEqual(shapeOf(eager.err?.details));
    expect(deferred.err?.details).toStrictEqual(eager.err?.details);
    expect(deferred.err!.details![0].inner!.length).toBeGreaterThan(0);
  });

  it('matches for an async format validator inside oneOf that passes', async () => {
    const schema = {
      oneOf: [
        { type: 'string', format: 'async-a' },
        { type: 'string', maxLength: 1 },
      ],
    };
    const run = async () => {
      const validator = ZSchema.create({ async: true, safe: true });
      validator.registerFormat('async-a', (input: unknown) => Promise.resolve(input === 'ok'));
      return await validator.validate('ok', structuredClone(schema));
    };
    const deferred = await run();
    const eager = await withEagerSubReports(run);
    expect(deferred.valid).toBe(eager.valid);
    expect(shapeOf(deferred.err?.details)).toStrictEqual(shapeOf(eager.err?.details));
  });
});

describe('deferred sub-report errors: customValidator exemption', () => {
  it('shows fully materialized errors to a customValidator reading sub-report errors', () => {
    const seen: SchemaErrorDetail[] = [];
    let subReportCount = 0;
    const validator = ZSchema.create({
      customValidator(report: Report) {
        if (report.parentReport) {
          subReportCount++;
          for (const err of report.errors) {
            seen.push(err);
          }
        }
      },
    });
    const { valid } = validator.validateSafe(5, { oneOf: [{ type: 'string' }, { type: 'array' }] });
    expect(valid).toBe(false);
    expect(subReportCount).toBeGreaterThan(0);
    expect(seen.length).toBeGreaterThan(0);
    for (const err of seen) {
      expect(typeof err.message).toBe('string');
      expect(typeof err.path).toBe('string');
      expect(Array.isArray(err.schemaPath)).toBe(true);
    }
  });

  it('does not defer when a customValidator is set', () => {
    const parent = new Report({ customValidator: () => {} });
    expect(Report.createSubReport(parent).deferErrors).toBe(false);
    expect(Report.createSubReport(new Report({})).deferErrors).toBe(true);
  });
});

const runInstallHook = () => {
  const seen: SchemaErrorDetail[] = [];
  const validator = ZSchema.create({});
  validator.registerFormat('install-hook', () => {
    validator.options.customValidator = (report: Report) => {
      for (const err of report.errors) {
        seen.push(err);
      }
    };
    return false;
  });
  const result = validator.validateSafe(
    { a: 'x', b: 1 },
    {
      properties: {
        a: { anyOf: [{ type: 'number' }, { type: 'string', format: 'install-hook' }] },
        b: { anyOf: [{ type: 'string' }, { type: 'string', minLength: 1 }] },
      },
    }
  );
  return { result, seen };
};

describe('deferred sub-report errors: mid-validation customValidator (C1)', () => {
  it('shows materialized errors to a customValidator installed by a format validator inside anyOf', () => {
    const { deferred, eager } = runBothModes(runInstallHook);
    expect(deferred.seen.length).toBeGreaterThan(0);
    for (const err of deferred.seen) {
      expect(typeof err.message).toBe('string');
    }
    expect(shapeOf(deferred.seen)).toStrictEqual(shapeOf(eager.seen));
    expect(shapeOf(deferred.result.err?.details)).toStrictEqual(shapeOf(eager.result.err?.details));
  });
});

const runFlipPathAsArray = () => {
  const validator = ZSchema.create({});
  validator.registerFormat('flip', () => {
    validator.options.reportPathAsArray = true;
    return false;
  });
  return validator.validateSafe(
    { a: 1, b: 'x' },
    {
      properties: {
        a: { anyOf: [{ type: 'string' }, { type: 'boolean' }] },
        b: { anyOf: [{ type: 'number' }, { type: 'string', format: 'flip' }] },
      },
    }
  );
};

describe('deferred sub-report errors: reportPathAsArray flipped mid-run (C2)', () => {
  it('snapshots reportPathAsArray at add time', () => {
    const { deferred, eager } = runBothModes(runFlipPathAsArray);
    expect(shapeOf(deferred.err?.details)).toStrictEqual(shapeOf(eager.err?.details));
  });
});

const undefinedParamRepro = () => ZSchema.create().validateSafe(undefined, { anyOf: [{ enum: ['x'] }, true] } as never);
const excludedUndefinedParam = () =>
  ZSchema.create().validateSafe(undefined, { enum: ['x'] }, { excludeErrors: ['ENUM_MISMATCH'] });
const objectParam = () =>
  ZSchema.create().validateSafe({ k: 1 }, { anyOf: [{ enum: [{ k: 2 }] }, { type: 'string' }] });

// validateSafe converts a thrown error into `err`, so compare the surfaced error itself.
const expectSameResult = (d: ReturnType<typeof undefinedParamRepro>, e: ReturnType<typeof undefinedParamRepro>) => {
  expect(d.valid).toBe(e.valid);
  expect(d.err?.constructor).toBe(e.err?.constructor);
  expect(d.err?.message).toBe(e.err?.message);
  expect(shapeOf(d.err?.details)).toStrictEqual(shapeOf(e.err?.details));
};

describe('deferred sub-report errors: message construction exceptions (C3)', () => {
  it('surfaces the same TypeError for an undefined param inside anyOf', () => {
    const deferred = settle(undefinedParamRepro);
    const eager = settle(() => withEagerSubReports(undefinedParamRepro));
    expect(!eager.threw && eager.value.err instanceof TypeError).toBe(true);
    if (expectSameThrown(deferred, eager) && !eager.threw) {
      expectSameResult(deferred.value, eager.value);
    }
  });

  it('matches for an excluded code with an undefined param', () => {
    // main builds the message (failing on the undefined param) before the excludeErrors check
    const deferred = settle(excludedUndefinedParam);
    const eager = settle(() => withEagerSubReports(excludedUndefinedParam));
    expect(!eager.threw && eager.value.err instanceof TypeError).toBe(true);
    if (expectSameThrown(deferred, eager) && !eager.threw) {
      expectSameResult(deferred.value, eager.value);
    }
  });

  it('matches for an object param (enum of objects)', () => {
    const { deferred, eager } = runBothModes(objectParam);
    expect(shapeOf(deferred.err?.details)).toStrictEqual(shapeOf(eager.err?.details));
    expect(deferred.err?.details?.[0].inner?.[0].message).toContain('{"k":1}');
  });

  it('throws on a circular object param in both modes', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const report = new Report({});
    report.deferErrors = true;
    expect(() => {
      report.addCustomError('ENUM_MISMATCH', 'x {0}', [circular as never]);
    }).toThrow(TypeError);
    expect(report.errors).toHaveLength(0);
  });
});

const maxErrorsRun = (defer: boolean) => {
  const parent = new Report({});
  const sub = new Report(parent, { maxErrors: 2 });
  sub.deferErrors = defer;
  for (let i = 0; i < 5; i++) {
    sub.path = [i];
    sub.addError('INVALID_TYPE', ['string', 'number']);
  }
  parent.addError('ANY_OF_MISSING', undefined, sub);
  return shapeOf(parent.errors);
};

describe('deferred sub-report errors: maxErrors (S5)', () => {
  it('honors reportOptions.maxErrors on a deferred sub-report (no public path sets it; direct Report)', () => {
    const deferred = maxErrorsRun(true);
    expect(deferred).toStrictEqual(maxErrorsRun(false));
    expect((deferred as Array<{ values: { inner: unknown[] } }>)[0].values.inner).toHaveLength(2);
  });
});
