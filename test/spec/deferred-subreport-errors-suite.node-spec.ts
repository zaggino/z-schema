import type { JsonSchemaVersion } from '../../src/json-schema-versions.ts';

import { expectSameThrown, settle, shapeOf, withEagerSubReports } from '../lib/deferred-errors.ts';
import {
  createCaseValidator,
  loadSuiteFiles,
  selectCases,
  suiteFileLabel,
  withDialect,
} from '../lib/json-schema-test-suite.ts';
import { readPublicJson } from '../lib/read-public-json.ts';

const versions: JsonSchemaVersion[] = ['draft2019-09', 'draft2020-12', 'draft-07', 'draft-04'];

const suiteFiles = await loadSuiteFiles(readPublicJson);

describe('deferred sub-report errors: JSON-Schema-Test-Suite differential', () => {
  for (const version of versions) {
    it(`${version}: every case yields identical error details`, () => {
      let compared = 0;
      let invalidCompared = 0;
      for (const { file, suiteFile } of suiteFiles) {
        const rel = suiteFileLabel(file, version);
        for (const group of selectCases(suiteFile, file, version)) {
          for (const test of group.tests) {
            const run = () =>
              createCaseValidator(group, version).validateSafe(test.data, withDialect(group.schema, version));
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
