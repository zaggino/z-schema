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
    import('../ZSchemaTestSuite/CustomFormats.ts'),
    import('../ZSchemaTestSuite/CustomFormatsAsync.ts'),
    import('../ZSchemaTestSuite/ForceAdditional.ts'),
    import('../ZSchemaTestSuite/ForceItems.ts'),
    import('../ZSchemaTestSuite/ForceMinLength.ts'),
    import('../ZSchemaTestSuite/ForceMaxLength.ts'),
    import('../ZSchemaTestSuite/ForceMinItems.ts'),
    import('../ZSchemaTestSuite/ForceMaxItems.ts'),
    import('../ZSchemaTestSuite/ForceProperties.ts'),
    import('../ZSchemaTestSuite/IgnoreUnresolvableReferences.ts'),
    import('../ZSchemaTestSuite/AssumeAdditional.ts'),
    import('../ZSchemaTestSuite/NoEmptyArrays.ts'),
    import('../ZSchemaTestSuite/NoEmptyStrings.ts'),
    import('../ZSchemaTestSuite/NoTypeless.ts'),
    import('../ZSchemaTestSuite/NoExtraKeywords.ts'),
    import('../ZSchemaTestSuite/StrictUris.ts'),
    import('../ZSchemaTestSuite/MultipleSchemas.ts'),
    import('../ZSchemaTestSuite/ErrorPathAsArray.ts'),
    import('../ZSchemaTestSuite/ErrorPathAsJSONPointer.ts'),
    import('../ZSchemaTestSuite/ErrorPathContainsIntegerIndex.ts'),
    import('../ZSchemaTestSuite/PedanticCheck.ts'),
    import('../ZSchemaTestSuite/getRegisteredFormats.ts'),
    import('../ZSchemaTestSuite/InvalidId.ts'),
    import('../ZSchemaTestSuite/IncludeErrors.ts'),
    import('../ZSchemaTestSuite/CustomValidator.ts'),
    // issues
    import('../ZSchemaTestSuite/Issue12.ts'),
    import('../ZSchemaTestSuite/Issue13.ts'),
    import('../ZSchemaTestSuite/Issue16.ts'),
    import('../ZSchemaTestSuite/Issue22.ts'),
    import('../ZSchemaTestSuite/Issue25.ts'),
    import('../ZSchemaTestSuite/Issue26.ts'),
    import('../ZSchemaTestSuite/Issue37.ts'),
    import('../ZSchemaTestSuite/Issue40.ts'),
    import('../ZSchemaTestSuite/Issue41.ts'),
    import('../ZSchemaTestSuite/Issue43.ts'),
    import('../ZSchemaTestSuite/Issue44.ts'),
    import('../ZSchemaTestSuite/Issue45.ts'),
    import('../ZSchemaTestSuite/Issue47.ts'),
    import('../ZSchemaTestSuite/Issue48.ts'),
    import('../ZSchemaTestSuite/Issue49.ts'),
    import('../ZSchemaTestSuite/Issue53.ts'),
    import('../ZSchemaTestSuite/Issue56.ts'),
    import('../ZSchemaTestSuite/Issue57.ts'),
    import('../ZSchemaTestSuite/Issue58.ts'),
    import('../ZSchemaTestSuite/Issue63.ts'),
    import('../ZSchemaTestSuite/Issue64.ts'),
    import('../ZSchemaTestSuite/Issue67.ts'),
    import('../ZSchemaTestSuite/Issue71.ts'),
    import('../ZSchemaTestSuite/Issue76.ts'),
    import('../ZSchemaTestSuite/Issue85.ts'),
    import('../ZSchemaTestSuite/Issue94.ts'),
    import('../ZSchemaTestSuite/Issue96.ts'),
    import('../ZSchemaTestSuite/Issue98.ts'),
    import('../ZSchemaTestSuite/Issue101.ts'),
    import('../ZSchemaTestSuite/Issue102.ts'),
    import('../ZSchemaTestSuite/Issue103.ts'),
    import('../ZSchemaTestSuite/Issue106.ts'),
    import('../ZSchemaTestSuite/Issue107.ts'),
    import('../ZSchemaTestSuite/Issue121.ts'),
    import('../ZSchemaTestSuite/Issue125.ts'),
    import('../ZSchemaTestSuite/Issue126.ts'),
    import('../ZSchemaTestSuite/Issue130.ts'),
    import('../ZSchemaTestSuite/Issue131.ts'),
    import('../ZSchemaTestSuite/Issue137.ts'),
    import('../ZSchemaTestSuite/Issue139.ts'),
    import('../ZSchemaTestSuite/Issue142.ts'),
    import('../ZSchemaTestSuite/Issue146.ts'),
    import('../ZSchemaTestSuite/Issue151.ts'),
    import('../ZSchemaTestSuite/Issue199.ts'),
    import('../ZSchemaTestSuite/Issue209.ts'),
    import('../ZSchemaTestSuite/Issue222.ts'),
    import('../ZSchemaTestSuite/Issue229.ts'),
    import('../ZSchemaTestSuite/Issue250.ts'),
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
      const version = test.version || testSuite.version;
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
