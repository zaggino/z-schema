/* eslint-disable vitest/valid-title */

import type { JsonSchema, JsonSchemaVersion } from '../../src/json-schema.ts';

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
};

const excludedDirs: string[] = [];
const excludedFiles: string[] = [
  'draft4/optional/ecmascript-regex.json',
  'draft4/optional/float-overflow.json',
  'draft4/optional/format/unknown.json',
  'draft4/optional/id.json',
  'draft4/optional/non-bmp-regex.json',
  'draft4/optional/zeroTerminatedFloats.json',
  'draft6/additionalItems.json',
  'draft6/additionalProperties.json',
  'draft6/allOf.json',
  'draft6/anyOf.json',
  'draft6/boolean_schema.json',
  'draft6/const.json',
  'draft6/contains.json',
  'draft6/default.json',
  'draft6/definitions.json',
  'draft6/dependencies.json',
  'draft6/detached-ref.json',
  'draft6/enum.json',
  'draft6/exclusiveMaximum.json',
  'draft6/format.json',
  'draft6/infinite-loop-detection.json',
  'draft6/items.json',
  'draft6/locationIndependentIdentifier.json',
  'draft6/maximum.json',
  'draft6/maxItems.json',
  'draft6/maxLength.json',
  'draft6/maxProperties.json',
  'draft6/minimum.json',
  'draft6/minItems.json',
  'draft6/minLength.json',
  'draft6/minProperties.json',
  'draft6/multipleOf.json',
  'draft6/name.json',
  'draft6/not.json',
  'draft6/oneOf.json',
  'draft6/optional/bignum.json',
  'draft6/optional/ecmascript-regex.json',
  'draft6/optional/float-overflow.json',
  'draft6/optional/format/date-time.json',
  'draft6/optional/format/email.json',
  'draft6/optional/format/hostname.json',
  'draft6/optional/format/ipv4.json',
  'draft6/optional/format/ipv6.json',
  'draft6/optional/format/json-pointer.json',
  'draft6/optional/format/unknown.json',
  'draft6/optional/format/uri-reference.json',
  'draft6/optional/format/uri-template.json',
  'draft6/optional/format/uri.json',
  'draft6/optional/id.json',
  'draft6/optional/non-bmp-regex.json',
  'draft6/optional/unknownKeyword.json',
  'draft6/pattern.json',
  'draft6/patternProperties.json',
  'draft6/properties.json',
  'draft6/propertyNames.json',
  'draft6/ref-and-definitions.json',
  'draft6/ref.json',
  'draft6/refRemote.json',
  'draft6/required.json',
  'draft6/subSchemas.json',
  'draft6/type.json',
  'draft6/uniqueItems.json',
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
            if (!schema.$schema) {
              if (draftPath.endsWith('/draft4')) {
                schema.$schema = 'http://json-schema.org/draft-04/schema#';
              } else if (draftPath.endsWith('/draft6')) {
                schema.$schema = 'http://json-schema.org/draft-06/schema#';
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
