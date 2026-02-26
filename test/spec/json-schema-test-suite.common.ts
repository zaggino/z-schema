/* eslint-disable vitest/valid-title */

import type { JsonSchema, JsonSchemaVersion } from '../../src/json-schema-versions.ts';

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

type JSONSchemaTestSuiteTestFolder = 'draft4' | 'draft6' | 'draft7' | 'draft2019-09' | 'draft2020-12';

const VERSION_FOLDER_MAPPING: Partial<Record<JsonSchemaVersion, JSONSchemaTestSuiteTestFolder>> = {
  'draft-04': 'draft4',
  'draft-06': 'draft6',
  'draft-07': 'draft7',
  'draft2019-09': 'draft2019-09',
  'draft2020-12': 'draft2020-12',
};

const excludedDirs: string[] = [];
const excludedFiles: string[] = [
  // unknown formats are reported as an error by default
  // there's ignoreUnknownFormats option that can change this
  'draft4/optional/format/unknown.json',
  'draft6/optional/format/unknown.json',
  'draft7/optional/format/unknown.json',
  // as far as I'm aware, this can't be fixed without custom json parser
  'draft4/optional/float-overflow.json',
  'draft6/optional/float-overflow.json',
  'draft7/optional/float-overflow.json',
  'draft4/optional/zeroTerminatedFloats.json',
  // decided to not support this for now, using unsupported drafts should fail
  'draft7/optional/cross-draft.json',
  // FAILING
  'draft2019-09/format.json', // FAIL: 102 out of 114 tests passes
  'draft2019-09/optional/anchor.json', // FAIL: 3 out of 4 tests passes
  'draft2019-09/optional/float-overflow.json', // FAIL: 0 out of 1 tests passes
  'draft2019-09/optional/format/duration.json', // FAIL: 11 out of 26 tests passes
  'draft2019-09/optional/format/unknown.json', // FAIL: 0 out of 7 tests passes
  'draft2019-09/optional/format/uuid.json', // FAIL: 8 out of 22 tests passes
  'draft2019-09/unevaluatedItems.json', // FAIL: 38 out of 56 tests passes
  'draft2019-09/unevaluatedProperties.json', // FAIL: 106 out of 125 tests passes
  'draft2019-09/vocabulary.json', // FAIL: 4 out of 5 tests passes
  'draft2020-12/format.json', // FAIL: 102 out of 133 tests passes
  'draft2020-12/optional/anchor.json', // FAIL: 3 out of 4 tests passes
  'draft2020-12/optional/dynamicRef.json', // FAIL: 1 out of 2 tests passes
  'draft2020-12/optional/format/ecmascript-regex.json', // FAIL: 0 out of 1 tests passes
  'draft2020-12/optional/float-overflow.json', // FAIL: 0 out of 1 tests passes
  'draft2020-12/optional/format/duration.json', // FAIL: 11 out of 26 tests passes
  'draft2020-12/optional/format/email.json', // FAIL: 22 out of 24 tests passes
  'draft2020-12/optional/format/unknown.json', // FAIL: 0 out of 7 tests passes
  'draft2020-12/optional/format/uuid.json', // FAIL: 8 out of 22 tests passes
  'draft2020-12/unevaluatedItems.json', // FAIL: 44 out of 71 tests passes
  'draft2020-12/unevaluatedProperties.json', // FAIL: 106 out of 125 tests passes
  'draft2020-12/vocabulary.json', // FAIL: 4 out of 5 tests passes
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
            if (typeof schema !== 'boolean' && !schema.$schema) {
              if (draftPath.endsWith('/draft4')) {
                schema.$schema = 'http://json-schema.org/draft-04/schema#';
              } else if (draftPath.endsWith('/draft6')) {
                schema.$schema = 'http://json-schema.org/draft-06/schema#';
              } else if (draftPath.endsWith('/draft7')) {
                schema.$schema = 'http://json-schema.org/draft-07/schema#';
              } else if (draftPath.endsWith('/draft2019-09')) {
                schema.$schema = 'https://json-schema.org/draft/2019-09/schema';
              } else if (draftPath.endsWith('/draft2020-12')) {
                schema.$schema = 'https://json-schema.org/draft/2020-12/schema';
              } else {
                throw new Error(`no $schema for draft: ${draftPath}`);
              }
            }
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
