import { expectSameThrown, settle, shapeOf, withEagerSubReports } from '../lib/deferred-errors.ts';
import { loadSuiteFiles, suiteRuns, TESTED_VERSIONS } from '../lib/json-schema-test-suite.ts';
import { readPublicJson } from '../lib/read-public-json.ts';

const suiteFiles = await loadSuiteFiles(readPublicJson);

describe('deferred sub-report errors: JSON-Schema-Test-Suite differential', () => {
  for (const version of TESTED_VERSIONS) {
    it(`${version}: every case yields identical error details`, () => {
      let compared = 0;
      let invalidCompared = 0;
      for (const { label: rel, cases } of suiteRuns(suiteFiles, version)) {
        for (const group of cases) {
          for (const test of group.tests) {
            const run = () => group.createValidator().validateSafe(test.data, group.schema);
            const deferredOutcome = settle(run);
            const eagerOutcome = settle(() => withEagerSubReports(run));
            const label = `${rel} :: ${group.description} :: ${test.description}`;
            if (expectSameThrown(deferredOutcome, eagerOutcome) && !eagerOutcome.threw) {
              const deferred = deferredOutcome.value;
              const eager = eagerOutcome.value;
              expect({ label, valid: deferred.valid }).toStrictEqual({ label, valid: eager.valid });
              expect(deferred.err?.constructor).toBe(eager.err?.constructor);
              expect(deferred.err?.message).toBe(eager.err?.message);
              if (!eager.valid) {
                invalidCompared++;
                expect({ label, shape: shapeOf(deferred.err?.details) }).toStrictEqual({
                  label,
                  shape: shapeOf(eager.err?.details),
                });
              }
            }
            compared++;
          }
        }
      }
      console.info(`${version}: compared ${compared} cases (${invalidCompared} invalid)`);
      expect(invalidCompared).toBeGreaterThan(100);
      expect(compared).toBeGreaterThan(invalidCompared);
    }, 120_000);
  }
});
