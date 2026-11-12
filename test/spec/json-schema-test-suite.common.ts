/* eslint-disable vitest/valid-title */

import {
  createCaseValidator,
  loadSuiteFiles,
  selectCases,
  suiteFileLabel,
  suiteTestTitle,
  TESTED_VERSIONS,
  withDialect,
} from '../lib/json-schema-test-suite.ts';

export async function runTests({ reader }: { reader: <T>(testFilePath: string) => Promise<T> }) {
  // every dialect reads the same files, so they are loaded once, up front
  const suiteFiles = await loadSuiteFiles(reader);

  for (const version of TESTED_VERSIONS) {
    describe(version, () => {
      for (const { file, suiteFile } of suiteFiles) {
        const suiteCases = selectCases(suiteFile, file, version);
        // a file may hold nothing for this dialect, and vitest rejects an empty suite
        if (suiteCases.length === 0) {
          continue;
        }

        describe(suiteFileLabel(file, version), () => {
          for (const suiteCase of suiteCases) {
            const schema = withDialect(suiteCase.schema, version);
            for (const test of suiteCase.tests) {
              it(suiteTestTitle(suiteCase, test), () => {
                const validator = createCaseValidator(suiteCase, version);
                const { valid, err } = validator.validateSafe(test.data, schema);
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
