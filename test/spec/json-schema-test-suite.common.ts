/* eslint-disable vitest/valid-title */

import { loadSuiteFiles, suiteRuns, TESTED_VERSIONS } from '../lib/json-schema-test-suite.ts';

export async function runTests({ reader }: { reader: <T>(testFilePath: string) => Promise<T> }) {
  // every dialect reads the same files, so they are loaded once, up front
  const suiteFiles = await loadSuiteFiles(reader);

  for (const version of TESTED_VERSIONS) {
    describe(version, () => {
      for (const { label, cases } of suiteRuns(suiteFiles, version)) {
        describe(label, () => {
          for (const { schema, tests, createValidator } of cases) {
            for (const test of tests) {
              it(test.title, () => {
                const { valid, err } = createValidator().validateSafe(test.data, schema);
                expect.soft(valid).toBe(test.valid);
                if (valid !== test.valid && !valid) {
                  expect(err!.details).toBe(null);
                }
              });
            }
          }
        });
      }
    });
  }
}
