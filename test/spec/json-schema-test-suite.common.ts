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
  'draft2019-09/additionalItems.json', // FAIL: 6 out of 19 tests passes
  'draft2019-09/additionalProperties.json', // FAIL: 9 out of 21 tests passes
  'draft2019-09/allOf.json', // FAIL: 20 out of 30 tests passes
  'draft2019-09/anchor.json', // FAIL: 4 out of 8 tests passes
  'draft2019-09/anyOf.json', // FAIL: 6 out of 18 tests passes
  'draft2019-09/const.json', // FAIL: 32 out of 54 tests passes
  'draft2019-09/contains.json', // FAIL: 10 out of 21 tests passes
  'draft2019-09/content.json', // FAIL: 0 out of 18 tests passes
  'draft2019-09/default.json', // FAIL: 1 out of 7 tests passes
  'draft2019-09/defs.json', // FAIL: 1 out of 2 tests passes
  'draft2019-09/dependentRequired.json', // FAIL: 6 out of 20 tests passes
  'draft2019-09/dependentSchemas.json', // FAIL: 10 out of 20 tests passes
  'draft2019-09/enum.json', // FAIL: 23 out of 45 tests passes
  'draft2019-09/exclusiveMaximum.json', // FAIL: 2 out of 4 tests passes
  'draft2019-09/exclusiveMinimum.json', // FAIL: 2 out of 4 tests passes
  'draft2019-09/format.json', // FAIL: 0 out of 114 tests passes
  'draft2019-09/if-then-else.json', // FAIL: 10 out of 30 tests passes
  'draft2019-09/infinite-loop-detection.json', // FAIL: 1 out of 2 tests passes
  'draft2019-09/items.json', // FAIL: 10 out of 28 tests passes
  'draft2019-09/maxContains.json', // FAIL: 6 out of 12 tests passes
  'draft2019-09/maximum.json', // FAIL: 2 out of 8 tests passes
  'draft2019-09/maxItems.json', // FAIL: 2 out of 6 tests passes
  'draft2019-09/maxLength.json', // FAIL: 2 out of 7 tests passes
  'draft2019-09/maxProperties.json', // FAIL: 3 out of 10 tests passes
  'draft2019-09/minContains.json', // FAIL: 14 out of 28 tests passes
  'draft2019-09/minimum.json', // FAIL: 3 out of 11 tests passes
  'draft2019-09/minItems.json', // FAIL: 2 out of 6 tests passes
  'draft2019-09/minLength.json', // FAIL: 3 out of 7 tests passes
  'draft2019-09/minProperties.json', // FAIL: 2 out of 8 tests passes
  'draft2019-09/multipleOf.json', // FAIL: 4 out of 10 tests passes
  'draft2019-09/not.json', // FAIL: 24 out of 40 tests passes
  'draft2019-09/oneOf.json', // FAIL: 15 out of 27 tests passes
  'draft2019-09/optional/anchor.json', // FAIL: 2 out of 4 tests passes
  'draft2019-09/optional/bignum.json', // FAIL: 3 out of 9 tests passes
  'draft2019-09/optional/cross-draft.json', // FAIL: 1 out of 3 tests passes
  'draft2019-09/optional/dependencies-compatibility.json', // FAIL: 14 out of 36 tests passes
  'draft2019-09/optional/ecmascript-regex.json', // FAIL: 38 out of 74 tests passes
  'draft2019-09/optional/float-overflow.json', // FAIL: 0 out of 1 tests passes
  'draft2019-09/optional/format/date-time.json', // FAIL: 16 out of 29 tests passes
  'draft2019-09/optional/format/date.json', // FAIL: 27 out of 48 tests passes
  'draft2019-09/optional/format/duration.json', // FAIL: 11 out of 26 tests passes
  'draft2019-09/optional/format/email.json', // FAIL: 6 out of 17 tests passes
  'draft2019-09/optional/format/hostname.json', // FAIL: 33 out of 61 tests passes
  'draft2019-09/optional/format/idn-email.json', // FAIL: 2 out of 10 tests passes
  'draft2019-09/optional/format/idn-hostname.json', // FAIL: 42 out of 77 tests passes
  'draft2019-09/optional/format/ipv4.json', // FAIL: 8 out of 16 tests passes
  'draft2019-09/optional/format/ipv6.json', // FAIL: 23 out of 40 tests passes
  'draft2019-09/optional/format/iri-reference.json', // FAIL: 2 out of 13 tests passes
  'draft2019-09/optional/format/iri.json', // FAIL: 4 out of 15 tests passes
  'draft2019-09/optional/format/json-pointer.json', // FAIL: 12 out of 38 tests passes
  'draft2019-09/optional/format/regex.json', // FAIL: 1 out of 8 tests passes
  'draft2019-09/optional/format/relative-json-pointer.json', // FAIL: 7 out of 18 tests passes
  'draft2019-09/optional/format/time.json', // FAIL: 28 out of 46 tests passes
  'draft2019-09/optional/format/unknown.json', // FAIL: 0 out of 7 tests passes
  'draft2019-09/optional/format/uri-reference.json', // FAIL: 4 out of 15 tests passes
  'draft2019-09/optional/format/uri-template.json', // FAIL: 1 out of 10 tests passes
  'draft2019-09/optional/format/uri.json', // FAIL: 17 out of 36 tests passes
  'draft2019-09/optional/format/uuid.json', // FAIL: 8 out of 22 tests passes
  'draft2019-09/optional/id.json', // FAIL: 1 out of 3 tests passes
  'draft2019-09/optional/no-schema.json', // FAIL: 1 out of 3 tests passes
  'draft2019-09/optional/non-bmp-regex.json', // FAIL: 6 out of 12 tests passes
  'draft2019-09/optional/refOfUnknownKeyword.json', // FAIL: 5 out of 10 tests passes
  'draft2019-09/optional/unknownKeyword.json', // FAIL: 2 out of 3 tests passes
  'draft2019-09/pattern.json', // FAIL: 1 out of 9 tests passes
  'draft2019-09/patternProperties.json', // FAIL: 10 out of 23 tests passes
  'draft2019-09/properties.json', // FAIL: 12 out of 28 tests passes
  'draft2019-09/propertyNames.json', // FAIL: 5 out of 20 tests passes
  'draft2019-09/recursiveRef.json', // FAIL: 14 out of 34 tests passes
  'draft2019-09/ref.json', // FAIL: 43 out of 81 tests passes
  'draft2019-09/refRemote.json', // FAIL: 15 out of 31 tests passes
  'draft2019-09/required.json', // FAIL: 6 out of 18 tests passes
  'draft2019-09/type.json', // FAIL: 59 out of 80 tests passes
  'draft2019-09/unevaluatedItems.json', // FAIL: 21 out of 56 tests passes
  'draft2019-09/unevaluatedProperties.json', // FAIL: 60 out of 125 tests passes
  'draft2019-09/uniqueItems.json', // FAIL: 19 out of 69 tests passes
  'draft2019-09/vocabulary.json', // FAIL: 2 out of 5 tests passes
  'draft2020-12/additionalProperties.json', // FAIL: 9 out of 21 tests passes
  'draft2020-12/allOf.json', // FAIL: 20 out of 30 tests passes
  'draft2020-12/anchor.json', // FAIL: 4 out of 8 tests passes
  'draft2020-12/anyOf.json', // FAIL: 6 out of 18 tests passes
  'draft2020-12/const.json', // FAIL: 32 out of 54 tests passes
  'draft2020-12/contains.json', // FAIL: 10 out of 21 tests passes
  'draft2020-12/content.json', // FAIL: 0 out of 18 tests passes
  'draft2020-12/default.json', // FAIL: 1 out of 7 tests passes
  'draft2020-12/defs.json', // FAIL: 1 out of 2 tests passes
  'draft2020-12/dependentRequired.json', // FAIL: 6 out of 20 tests passes
  'draft2020-12/dependentSchemas.json', // FAIL: 10 out of 20 tests passes
  'draft2020-12/dynamicRef.json', // FAIL: 22 out of 44 tests passes
  'draft2020-12/enum.json', // FAIL: 23 out of 45 tests passes
  'draft2020-12/exclusiveMaximum.json', // FAIL: 2 out of 4 tests passes
  'draft2020-12/exclusiveMinimum.json', // FAIL: 2 out of 4 tests passes
  'draft2020-12/format.json', // FAIL: 0 out of 133 tests passes
  'draft2020-12/if-then-else.json', // FAIL: 10 out of 30 tests passes
  'draft2020-12/infinite-loop-detection.json', // FAIL: 1 out of 2 tests passes
  'draft2020-12/items.json', // FAIL: 12 out of 29 tests passes
  'draft2020-12/maxContains.json', // FAIL: 6 out of 12 tests passes
  'draft2020-12/maximum.json', // FAIL: 2 out of 8 tests passes
  'draft2020-12/maxItems.json', // FAIL: 2 out of 6 tests passes
  'draft2020-12/maxLength.json', // FAIL: 2 out of 7 tests passes
  'draft2020-12/maxProperties.json', // FAIL: 3 out of 10 tests passes
  'draft2020-12/minContains.json', // FAIL: 14 out of 28 tests passes
  'draft2020-12/minimum.json', // FAIL: 3 out of 11 tests passes
  'draft2020-12/minItems.json', // FAIL: 2 out of 6 tests passes
  'draft2020-12/minLength.json', // FAIL: 3 out of 7 tests passes
  'draft2020-12/minProperties.json', // FAIL: 2 out of 8 tests passes
  'draft2020-12/multipleOf.json', // FAIL: 4 out of 10 tests passes
  'draft2020-12/not.json', // FAIL: 24 out of 40 tests passes
  'draft2020-12/oneOf.json', // FAIL: 15 out of 27 tests passes
  'draft2020-12/optional/anchor.json', // FAIL: 2 out of 4 tests passes
  'draft2020-12/optional/bignum.json', // FAIL: 3 out of 9 tests passes
  'draft2020-12/optional/cross-draft.json', // FAIL: 0 out of 1 tests passes
  'draft2020-12/optional/dependencies-compatibility.json', // FAIL: 14 out of 36 tests passes
  'draft2020-12/optional/dynamicRef.json', // FAIL: 1 out of 2 tests passes
  'draft2020-12/optional/ecmascript-regex.json', // FAIL: 38 out of 74 tests passes
  'draft2020-12/optional/float-overflow.json', // FAIL: 0 out of 1 tests passes
  'draft2020-12/optional/format-assertion.json', // FAIL: 2 out of 4 tests passes
  'draft2020-12/optional/format/date-time.json', // FAIL: 16 out of 29 tests passes
  'draft2020-12/optional/format/date.json', // FAIL: 27 out of 48 tests passes
  'draft2020-12/optional/format/duration.json', // FAIL: 11 out of 26 tests passes
  'draft2020-12/optional/format/email.json', // FAIL: 8 out of 24 tests passes
  'draft2020-12/optional/format/hostname.json', // FAIL: 33 out of 61 tests passes
  'draft2020-12/optional/format/idn-email.json', // FAIL: 2 out of 10 tests passes
  'draft2020-12/optional/format/idn-hostname.json', // FAIL: 42 out of 77 tests passes
  'draft2020-12/optional/format/ipv4.json', // FAIL: 8 out of 16 tests passes
  'draft2020-12/optional/format/ipv6.json', // FAIL: 23 out of 40 tests passes
  'draft2020-12/optional/format/iri-reference.json', // FAIL: 2 out of 13 tests passes
  'draft2020-12/optional/format/iri.json', // FAIL: 4 out of 15 tests passes
  'draft2020-12/optional/format/json-pointer.json', // FAIL: 12 out of 38 tests passes
  'draft2020-12/optional/format/regex.json', // FAIL: 1 out of 8 tests passes
  'draft2020-12/optional/format/relative-json-pointer.json', // FAIL: 7 out of 18 tests passes
  'draft2020-12/optional/format/time.json', // FAIL: 28 out of 46 tests passes
  'draft2020-12/optional/format/unknown.json', // FAIL: 0 out of 7 tests passes
  'draft2020-12/optional/format/uri-reference.json', // FAIL: 4 out of 15 tests passes
  'draft2020-12/optional/format/uri-template.json', // FAIL: 1 out of 10 tests passes
  'draft2020-12/optional/format/uri.json', // FAIL: 17 out of 36 tests passes
  'draft2020-12/optional/format/uuid.json', // FAIL: 8 out of 22 tests passes
  'draft2020-12/optional/id.json', // FAIL: 1 out of 3 tests passes
  'draft2020-12/optional/no-schema.json', // FAIL: 1 out of 3 tests passes
  'draft2020-12/optional/non-bmp-regex.json', // FAIL: 6 out of 12 tests passes
  'draft2020-12/optional/refOfUnknownKeyword.json', // FAIL: 5 out of 10 tests passes
  'draft2020-12/optional/unknownKeyword.json', // FAIL: 2 out of 3 tests passes
  'draft2020-12/pattern.json', // FAIL: 1 out of 9 tests passes
  'draft2020-12/patternProperties.json', // FAIL: 10 out of 23 tests passes
  'draft2020-12/prefixItems.json', // FAIL: 2 out of 11 tests passes
  'draft2020-12/properties.json', // FAIL: 12 out of 28 tests passes
  'draft2020-12/propertyNames.json', // FAIL: 5 out of 20 tests passes
  'draft2020-12/ref.json', // FAIL: 42 out of 79 tests passes
  'draft2020-12/refRemote.json', // FAIL: 15 out of 31 tests passes
  'draft2020-12/required.json', // FAIL: 6 out of 18 tests passes
  'draft2020-12/type.json', // FAIL: 59 out of 80 tests passes
  'draft2020-12/unevaluatedItems.json', // FAIL: 29 out of 71 tests passes
  'draft2020-12/unevaluatedProperties.json', // FAIL: 60 out of 125 tests passes
  'draft2020-12/uniqueItems.json', // FAIL: 19 out of 69 tests passes
  'draft2020-12/vocabulary.json', // FAIL: 2 out of 5 tests passes
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
