/* eslint-disable vitest/valid-title */

import { JsonSchema } from '../../src/json-schema.ts';
import { JsonSchemaVersion, ZSchema } from '../../src/z-schema.ts';

interface TestSuite {
  description: string;
  schema: JsonSchema;
  tests: Array<{
    description: string;
    data: unknown;
    valid: boolean;
  }>;
}

type JSONSchemaTestSuiteTestFolder = 'draft4' | 'draft6' | 'draft7' | 'draft2019-09' | 'draft2020-12';

const VERSION_FOLDER_MAPPING: Record<JsonSchemaVersion, JSONSchemaTestSuiteTestFolder> = {
  'draft-04': 'draft4',
};

const excludedDirs: string[] = ['draft4/optional'];
const excludedFiles: string[] = [
  'draft4/optional/format/date-time.json',
  'draft4/optional/format/ipv6.json',
  'draft4/optional/format/unknown.json',
  'draft4/optional/format/uri.json',
];
const excludedTests: string[] = [];

export async function runTests({ reader }: { reader: <T>(testFilePath: string) => Promise<T> }) {
  const manifest = await reader<string[]>('/manifest.json');
  const testsPath = '/json-schema-test-suite/tests';

  const remoteFiles = manifest.filter((f) => f.startsWith('/json-schema-test-suite/remotes'));
  await Promise.all(
    remoteFiles.map(async (file) => {
      // desired serverPath example: http://localhost:1234/draft4/locationIndependentIdentifier.json
      const serverPath = 'http://localhost:1234/' + file.slice('/json-schema-test-suite/remotes/'.length);
      const schema = await reader<JsonSchema>(file);
      ZSchema.setRemoteReference(serverPath, schema);
    })
  );

  const versionsTested = Object.keys(VERSION_FOLDER_MAPPING) as JsonSchemaVersion[];
  for (const version of versionsTested) {
    describe(`${version}`, () => {
      const draftPath = `${testsPath}/${VERSION_FOLDER_MAPPING[version]}`;
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
                const validator = ZSchema.create({ version });
                const { valid, err } = validator.validateSafe(test.data, schema);
                expect.soft(valid).toBe(test.valid);
                if (valid !== test.valid) {
                  if (!valid) {
                    expect(err!.details).toBe(null);
                  }
                }
              });
            });
          });
        });
      });
    });
  }
}
