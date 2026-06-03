import { ZSchema } from '../../src/z-schema.ts';

const isBrowser = typeof window !== 'undefined';

function validateWithAutomaticDownloads(
  validator: ZSchema,
  data: unknown,
  schema: unknown,
  callback: (err: unknown, valid: boolean) => void
) {
  let lastResult: boolean;
  let lastError: unknown;

  function finish() {
    callback(lastError, lastResult);
  }

  function validate() {
    const result = validator.validateSafe(data, schema as any);
    lastResult = result.valid;
    lastError = result.valid ? null : result.err?.details;

    const missingReferences = result.valid ? [] : validator.getMissingRemoteReferences(result.err!);
    if (missingReferences.length > 0) {
      let finished = 0;
      const loadReference = async (url: string) => {
        const res = await fetch(url);
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`HTTP ${res.status} ${res.statusText}: ${text}`);
        }
        const json = await res.json();
        validator.setRemoteReference(url, json);
        finished++;
        if (finished === missingReferences.length) {
          validate();
        }
      };
      missingReferences.forEach((url: string) => {
        void loadReference(url);
      });
    } else {
      finish();
    }
  }

  validate();
}

describe('Automatic schema loading', function () {
  it('should download schemas and validate successfully', function () {
    return new Promise<void>((resolve) => {
      if (isBrowser) {
        // skip this test in browsers
        expect(1).toBe(1);
        resolve();
        return;
      }

      const validator = ZSchema.create();
      const schema = { $ref: 'http://json-schema.org/draft-04/schema#' };
      const data = { minLength: 1 };

      validateWithAutomaticDownloads(validator, data, schema, function (err: unknown, valid: boolean) {
        expect(valid).toBe(true);
        expect(err).toBe(null);
        resolve();
      });
    });
  });

  it('should download schemas and fail validating', function () {
    return new Promise<void>((resolve) => {
      if (typeof window !== 'undefined') {
        // skip this test in browsers
        expect(1).toBe(1);
        resolve();
        return;
      }

      const validator = ZSchema.create();
      const schema = { $ref: 'http://json-schema.org/draft-04/schema#' };
      const data = { minLength: -1 };

      validateWithAutomaticDownloads(validator, data, schema, function (err: unknown, valid: boolean) {
        expect(valid).toBe(false);
        expect((err as any)[0].code).toBe('MINIMUM');
        resolve();
      });
    });
  });
});
