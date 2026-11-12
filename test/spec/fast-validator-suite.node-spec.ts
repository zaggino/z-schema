import { buildFastValidator } from '../../src/fast-validator.ts';
import { loadSuiteFiles, suiteRuns, TESTED_VERSIONS } from '../lib/json-schema-test-suite.ts';
import { readPublicJson } from '../lib/read-public-json.ts';

// Differential run: wherever the fast validator can be built for an official-suite schema, it must
// agree with the interpreter on every test of that schema.
const suiteFiles = await loadSuiteFiles(readPublicJson);

// Number of suite tests that ran through a built fast validator, across all dialects.
const stats = { built: 0 };
// Measured at 8056 with scalar, array, object, combinator and $ref keywords supported; the floor sits ~10% below.
const BUILT_FLOOR = 7200;

for (const version of TESTED_VERSIONS) {
  describe(`fast validator vs interpreter: ${version}`, () => {
    for (const { label, cases } of suiteRuns(suiteFiles, version)) {
      it(label, () => {
        const mismatches: string[] = [];
        for (const { schema, tests, createValidator } of cases) {
          if (typeof schema === 'boolean') {
            continue;
          }
          for (const test of tests) {
            const validator = createValidator();
            const expected = validator.validateSafe(test.data, schema).valid;
            const key = validator.compiledSchemaCache.keyOf(schema);
            const compiled = key === undefined ? undefined : validator.compiledSchemaCache.get(key, validator.options);
            const fast = compiled ? buildFastValidator(compiled, validator) : undefined;
            if (fast) {
              stats.built++;
              const actual = fast(test.data);
              if (actual !== expected) {
                mismatches.push(`${test.title}: fast=${actual} interpreter=${expected}`);
              }
            }
          }
        }
        expect(mismatches).toEqual([]);
      });
    }
  });
}

describe('fast validator coverage', () => {
  it('builds a fast validator for a meaningful share of the suite', () => {
    expect(stats.built).toBeGreaterThanOrEqual(BUILT_FLOOR);
  });
});
