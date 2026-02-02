import ZSchema from '../../src/index.ts';

const [draft_04_schema_json, remotes_integer_json, remotes_subSchemas_json, remotes_folderInteger_json] = (
  await Promise.all([
    import('../../src/schemas/draft-04-schema.json'),
    import('../jsonSchemaTestSuite/remotes/integer.json'),
    import('../jsonSchemaTestSuite/remotes/subSchemas.json'),
    import('../jsonSchemaTestSuite/remotes/folder/folderInteger.json'),
  ])
).map((m) => m.default ?? m);

function setRemoteReferences(validator) {
  validator.setRemoteReference('http://json-schema.org/draft-04/schema', draft_04_schema_json);
  validator.setRemoteReference('http://localhost:1234/integer.json', remotes_integer_json);
  validator.setRemoteReference('http://localhost:1234/subSchemas.json', remotes_subSchemas_json);
  validator.setRemoteReference('http://localhost:1234/folder/folderInteger.json', remotes_folderInteger_json);
}

type JsonSchemaTestSuiteFile = Array<{
  description: string;
  schema: unknown;
  tests: Array<{
    description: string;
    data: unknown;
    valid: boolean;
  }>;
}>;

const jsonSchemaTestSuiteFiles = (
  await Promise.all([
    import('../jsonSchemaTestSuite/tests/draft4/additionalItems.json'),
    import('../jsonSchemaTestSuite/tests/draft4/additionalProperties.json'),
    import('../jsonSchemaTestSuite/tests/draft4/allOf.json'),
    import('../jsonSchemaTestSuite/tests/draft4/anyOf.json'),
    import('../jsonSchemaTestSuite/tests/draft4/default.json'),
    import('../jsonSchemaTestSuite/tests/draft4/definitions.json'),
    import('../jsonSchemaTestSuite/tests/draft4/dependencies.json'),
    import('../jsonSchemaTestSuite/tests/draft4/enum.json'),
    import('../jsonSchemaTestSuite/tests/draft4/items.json'),
    import('../jsonSchemaTestSuite/tests/draft4/maximum.json'),
    import('../jsonSchemaTestSuite/tests/draft4/maxItems.json'),
    import('../jsonSchemaTestSuite/tests/draft4/maxLength.json'),
    import('../jsonSchemaTestSuite/tests/draft4/maxProperties.json'),
    import('../jsonSchemaTestSuite/tests/draft4/minimum.json'),
    import('../jsonSchemaTestSuite/tests/draft4/minItems.json'),
    import('../jsonSchemaTestSuite/tests/draft4/minLength.json'),
    import('../jsonSchemaTestSuite/tests/draft4/minProperties.json'),
    import('../jsonSchemaTestSuite/tests/draft4/multipleOf.json'),
    import('../jsonSchemaTestSuite/tests/draft4/not.json'),
    import('../jsonSchemaTestSuite/tests/draft4/oneOf.json'),
    import('../jsonSchemaTestSuite/tests/draft4/pattern.json'),
    import('../jsonSchemaTestSuite/tests/draft4/patternProperties.json'),
    import('../jsonSchemaTestSuite/tests/draft4/properties.json'),
    import('../jsonSchemaTestSuite/tests/draft4/ref.json'),
    import('../jsonSchemaTestSuite/tests/draft4/refRemote.json'),
    import('../jsonSchemaTestSuite/tests/draft4/required.json'),
    import('../jsonSchemaTestSuite/tests/draft4/type.json'),
    import('../jsonSchemaTestSuite/tests/draft4/uniqueItems.json'),
    // optional
    import('../jsonSchemaTestSuite/tests/draft4/optional/bignum.json'),
    import('../jsonSchemaTestSuite/tests/draft4/optional/format.json'),
    // zeroTerminatedFloats.json is excluded because JavaScript doesn't distinguish between different types of numeric values
    // import("../jsonSchemaTestSuite/tests/draft4/optional/zeroTerminatedFloats.json")
  ])
).map((m) => m.default ?? m) as JsonSchemaTestSuiteFile[];

const testExcludes = ['an invalid URI', 'an invalid URI though valid URI reference'];

describe('JsonSchemaTestSuite', function () {
  it('should contain 30 files', function () {
    expect(jsonSchemaTestSuiteFiles.length).toBe(30);
  });

  jsonSchemaTestSuiteFiles.forEach(function (testDefinitions, fileIndex) {
    testDefinitions.forEach(function (testDefinition) {
      testDefinition.tests.forEach(function (test) {
        if (testExcludes.indexOf(test.description) !== -1) {
          return;
        }

        it(
          '[' +
            fileIndex +
            ']' +
            testDefinition.description +
            ' - ' +
            test.description +
            ': ' +
            JSON.stringify(test.data),
          function () {
            const validator = new ZSchema();
            setRemoteReferences(validator);

            const valid = validator.validate(test.data, testDefinition.schema);
            expect(valid).toBe(test.valid);

            if (valid !== test.valid) {
              if (!valid) {
                const errors = validator.getLastErrors();
                expect(errors).toBe(null);
              }
            }
          }
        );
      });
    });
  });
});
