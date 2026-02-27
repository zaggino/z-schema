import type { ValidateError } from '../../src/errors.ts';
import type { JsonSchemaVersion } from '../../src/json-schema-versions.ts';
import type { ValidateOptions } from '../../src/z-schema-base.ts';
import type { ZSchemaOptions } from '../../src/z-schema-options.ts';

import { ZSchema } from '../../src/z-schema.ts';

type ZSchemaClass = typeof ZSchema;

interface TestCommon {
  version?: JsonSchemaVersion;
  async?: boolean;
  data?: unknown;
  schema?: unknown;
  schemaIndex?: number; // when schema is an Array if schemas
  options?: ZSchemaOptions;
  validateOptions?: ValidateOptions;
  validateSchemaOnly?: boolean;
  failWithException?: boolean;
  setup?: (validator: ZSchema, Class: ZSchemaClass) => void;
  after?: (err: any, valid: boolean, data: unknown, validator: ZSchema) => void;
}

interface TestSuiteFile extends TestCommon {
  description: string;
  tests: Test[];
}

interface Test extends TestCommon {
  description: string;
  valid: boolean;
}

const testSuiteFiles = (
  await Promise.all([
    import('../ZSchemaTestSuite/CustomFormats.js'),
    import('../ZSchemaTestSuite/CustomFormatsAsync.js'),
    import('../ZSchemaTestSuite/ForceAdditional.js'),
    import('../ZSchemaTestSuite/ForceItems.js'),
    import('../ZSchemaTestSuite/ForceMinLength.js'),
    import('../ZSchemaTestSuite/ForceMaxLength.js'),
    import('../ZSchemaTestSuite/ForceMinItems.js'),
    import('../ZSchemaTestSuite/ForceMaxItems.js'),
    import('../ZSchemaTestSuite/ForceProperties.js'),
    import('../ZSchemaTestSuite/IgnoreUnresolvableReferences.js'),
    import('../ZSchemaTestSuite/AssumeAdditional.js'),
    import('../ZSchemaTestSuite/NoEmptyArrays.js'),
    import('../ZSchemaTestSuite/NoEmptyStrings.js'),
    import('../ZSchemaTestSuite/NoTypeless.js'),
    import('../ZSchemaTestSuite/NoExtraKeywords.js'),
    import('../ZSchemaTestSuite/StrictUris.js'),
    import('../ZSchemaTestSuite/MultipleSchemas.js'),
    import('../ZSchemaTestSuite/ErrorPathAsArray.js'),
    import('../ZSchemaTestSuite/ErrorPathAsJSONPointer.js'),
    import('../ZSchemaTestSuite/ErrorPathContainsIntegerIndex.js'),
    import('../ZSchemaTestSuite/PedanticCheck.js'),
    import('../ZSchemaTestSuite/getRegisteredFormats.js'),
    import('../ZSchemaTestSuite/InvalidId.js'),
    import('../ZSchemaTestSuite/IncludeErrors.js'),
    import('../ZSchemaTestSuite/CustomValidator.js'),
    // issues
    import('../ZSchemaTestSuite/Issue12.js'),
    import('../ZSchemaTestSuite/Issue13.js'),
    import('../ZSchemaTestSuite/Issue16.js'),
    import('../ZSchemaTestSuite/Issue22.js'),
    import('../ZSchemaTestSuite/Issue25.js'),
    import('../ZSchemaTestSuite/Issue26.js'),
    import('../ZSchemaTestSuite/Issue37.js'),
    import('../ZSchemaTestSuite/Issue40.js'),
    import('../ZSchemaTestSuite/Issue41.js'),
    import('../ZSchemaTestSuite/Issue43.js'),
    import('../ZSchemaTestSuite/Issue44.js'),
    import('../ZSchemaTestSuite/Issue45.js'),
    import('../ZSchemaTestSuite/Issue47.js'),
    import('../ZSchemaTestSuite/Issue48.js'),
    import('../ZSchemaTestSuite/Issue49.js'),
    import('../ZSchemaTestSuite/Issue53.js'),
    import('../ZSchemaTestSuite/Issue56.js'),
    import('../ZSchemaTestSuite/Issue57.js'),
    import('../ZSchemaTestSuite/Issue58.js'),
    import('../ZSchemaTestSuite/Issue63.js'),
    import('../ZSchemaTestSuite/Issue64.js'),
    import('../ZSchemaTestSuite/Issue67.js'),
    import('../ZSchemaTestSuite/Issue71.js'),
    import('../ZSchemaTestSuite/Issue76.js'),
    import('../ZSchemaTestSuite/Issue85.js'),
    import('../ZSchemaTestSuite/Issue94.js'),
    import('../ZSchemaTestSuite/Issue96.js'),
    import('../ZSchemaTestSuite/Issue98.js'),
    import('../ZSchemaTestSuite/Issue101.js'),
    import('../ZSchemaTestSuite/Issue102.js'),
    import('../ZSchemaTestSuite/Issue103.js'),
    import('../ZSchemaTestSuite/Issue106.js'),
    import('../ZSchemaTestSuite/Issue107.js'),
    import('../ZSchemaTestSuite/Issue121.js'),
    import('../ZSchemaTestSuite/Issue125.js'),
    import('../ZSchemaTestSuite/Issue126.js'),
    import('../ZSchemaTestSuite/Issue130.js'),
    import('../ZSchemaTestSuite/Issue131.js'),
    import('../ZSchemaTestSuite/Issue137.js'),
    import('../ZSchemaTestSuite/Issue139.js'),
    import('../ZSchemaTestSuite/Issue142.js'),
    import('../ZSchemaTestSuite/Issue146.js'),
    import('../ZSchemaTestSuite/Issue151.js'),
    import('../ZSchemaTestSuite/Issue199.js'),
    import('../ZSchemaTestSuite/Issue209.js'),
    import('../ZSchemaTestSuite/Issue222.js'),
    import('../ZSchemaTestSuite/Issue229.js'),
    import('../ZSchemaTestSuite/Issue250.js'),
  ])
).map((m) => m.default ?? m) as TestSuiteFile[];

describe('ZSchemaTestSuite', function () {
  let idx = testSuiteFiles.length;
  while (idx--) {
    if (testSuiteFiles[idx] == null) {
      testSuiteFiles.splice(idx, 1);
    }
  }

  testSuiteFiles.forEach(function (testSuite) {
    testSuite.tests.forEach(function (test) {
      let data = test.data;
      if (typeof data === 'undefined') {
        data = testSuite.data;
      }

      let validateOptions = test.validateOptions;
      if (typeof validateOptions === 'undefined') {
        validateOptions = testSuite.validateOptions;
      }

      const async = test.async || testSuite.async || false;
      const options: ZSchemaOptions = test.options || testSuite.options || {};
      const setup = test.setup || testSuite.setup;
      let schema = test.schema || testSuite.schema;
      const schemaIndex = test.schemaIndex || testSuite.schemaIndex || 0;
      const after = test.after || testSuite.after;
      const validateSchemaOnly = test.validateSchemaOnly || testSuite.validateSchemaOnly;
      const failWithException = test.failWithException || testSuite.failWithException;
      const version = test.version || testSuite.version || 'draft-04';
      if (version) {
        options.version = version;
      }

      if (!async) {
        it(
          testSuite.description + ', ' + test.description,
          function () {
            ZSchema.setSchemaReader(undefined);

            const validator = ZSchema.create(options);
            let caughtErr;

            if (setup) {
              setup(validator, ZSchema);
            }

            let valid;
            try {
              validator.validateSchema(schema as any);
              valid = true;
            } catch (err) {
              if (!failWithException) {
                valid = false;
              }
              caughtErr = err;
            }

            if (valid && !validateSchemaOnly) {
              if (Array.isArray(schema)) {
                schema = schema[schemaIndex];
              }
              try {
                valid = validator.validate(data, schema as any, validateOptions as any);
              } catch (err) {
                valid = false;
                caughtErr = err;
              }
            }

            const err = caughtErr as ValidateError | undefined;

            if (failWithException) {
              expect(caughtErr).toBeTruthy();
            } else {
              expect(typeof valid).toBe('boolean' /*, 'returned response is not a boolean'*/);
              expect.soft(valid).toBe(test.valid /*, "test result doesn't match expected test result"*/);
            }

            if (test.valid === true) {
              expect(err).toBeFalsy(/*, 'errors are not undefined when test is valid'*/);
            }

            if (after) {
              after(err?.details ?? err ?? undefined, valid as boolean, data, validator);
            }
          },
          1000
        );
      }

      if (async) {
        it(
          testSuite.description + ', ' + test.description,
          async function () {
            const validator = ZSchema.create(options);
            if (setup) {
              setup(validator, ZSchema);
            }

            if (Array.isArray(schema)) {
              schema = schema[schemaIndex];
            }

            const response = await validator.validateAsyncSafe(data, schema as any, validateOptions as any);
            const { valid, err } = response;

            expect(typeof valid).toBe('boolean' /*, 'returned response is not a boolean'*/);
            expect(valid).toBe(test.valid /*, "test result doesn't match expected test result"*/);
            if (test.valid === true) {
              expect(err).toBe(undefined /*, 'errors are not undefined when test is valid'*/);
            }
            if (after) {
              after(err?.details ?? err ?? undefined, valid, data, validator);
            }
          },
          1000
        );
      }
    });
  });
});
