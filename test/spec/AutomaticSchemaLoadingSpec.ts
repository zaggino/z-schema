import ZSchema from '../../src/index.ts';

const isBrowser = typeof window !== 'undefined';

function validateWithAutomaticDownloads(validator, data, schema, callback) {
  let lastResult;

  function finish() {
    callback(validator.getLastErrors(), lastResult);
  }

  function validate() {
    lastResult = validator.validate(data, schema);

    const missingReferences = validator.getMissingRemoteReferences();
    if (missingReferences.length > 0) {
      let finished = 0;
      missingReferences.forEach(function (url) {
        fetch(url).then(async (res) => {
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
        });
      });
    } else {
      finish();
    }
  }

  validate();
}

describe('Automatic schema loading', function () {
  it('should download schemas and validate successfully', function () {
    return new Promise<void>((done) => {
      if (isBrowser) {
        // skip this test in browsers
        expect(1).toBe(1);
        done();
        return;
      }

      const validator = new ZSchema();
      const schema = { $ref: 'http://json-schema.org/draft-04/schema#' };
      const data = { minLength: 1 };

      validateWithAutomaticDownloads(validator, data, schema, function (err, valid) {
        expect(valid).toBe(true);
        expect(err).toBe(null);
        done();
      });
    });
  });

  it('should download schemas and fail validating', function () {
    return new Promise<void>((done) => {
      if (typeof window !== 'undefined') {
        // skip this test in browsers
        expect(1).toBe(1);
        done();
        return;
      }

      const validator = new ZSchema();
      const schema = { $ref: 'http://json-schema.org/draft-04/schema#' };
      const data = { minLength: -1 };

      validateWithAutomaticDownloads(validator, data, schema, function (err, valid) {
        expect(valid).toBe(false);
        expect(err[0].code).toBe('MINIMUM');
        done();
      });
    });
  });
});
