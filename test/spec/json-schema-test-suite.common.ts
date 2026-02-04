/* eslint-disable vitest/valid-title */

import { JsonSchema } from '../../src/json-schema.ts';
import { ZSchema } from '../../src/z-schema.ts';

interface TestSuite {
  description: string;
  schema: JsonSchema;
  tests: Array<{
    description: string;
    data: unknown;
    valid: boolean;
  }>;
}

const excludedDirs: string[] = ['draft4/optional', 'draft4/optional/format'];
const excludedFiles: string[] = [];
const excludedTests: string[] = ['an invalid URI', 'an invalid URI though valid URI reference']; // TODO: fix these

export async function runTests({ reader }: { reader: <T>(testFilePath: string) => Promise<T> }) {
  const manifest = await reader<string[]>('/manifest.json');
  const draftPath = '/json-schema-test-suite/tests/draft4';

  const remoteFiles = manifest.filter((f) => f.startsWith('/json-schema-test-suite/remotes'));
  await Promise.all(
    remoteFiles.map(async (file) => {
      // desired serverPath example: http://localhost:1234/draft4/locationIndependentIdentifier.json
      const serverPath = 'http://localhost:1234/' + file.slice('/json-schema-test-suite/remotes/'.length);
      const schema = await reader<JsonSchema>(file);
      ZSchema.setRemoteReference(serverPath, schema);
    })
  );

  const testFiles = manifest.filter((f) => f.startsWith(draftPath));
  testFiles.forEach((testFilePath) => {
    // excludedDirs
    const file = testFilePath.slice('/json-schema-test-suite/tests/'.length);
    const fileDir = file.replace(/\/[^/]+$/, '');
    if (excludedDirs.some((d) => d === fileDir)) {
      console.warn(`excluded by dir: ${testFilePath}`);
      return;
    }

    // excludedFiles
    if (excludedFiles.some((f) => f === file)) {
      console.warn(`excluded by file: ${testFilePath}`);
      return;
    }

    describe(file, async () => {
      const testSuites = await reader<TestSuite[]>(testFilePath);
      testSuites.forEach((testSuite) => {
        const schema = testSuite.schema;
        testSuite.tests.forEach((test) => {
          if (excludedTests.some((t) => t === test.description)) {
            console.warn(`excluded by test description: ${test.description}`);
            return;
          }
          it([testSuite.description, test.description].join(' '), function () {
            const validator = new ZSchema();
            const valid = validator.validate(test.data, schema);
            expect.soft(valid).toBe(test.valid);
            if (valid !== test.valid) {
              if (!valid) {
                const errors = validator.getLastErrors();
                expect(errors).toBe(null);
              }
            }
          });
        });
      });
    });
  });
}
