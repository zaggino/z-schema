import ZSchema from '../../src/ZSchema.ts';

const isBrowser = typeof window !== 'undefined';

let request;
if (!isBrowser) {
  request = require('https').request;
}

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
        request(url, function (response) {
          const body = '';
          response.on('data', function (chunk) {
            data += chunk;
          });
          response.on('end', function () {
            validator.setRemoteReference(url, JSON.parse(body));
            finished++;
            if (finished === missingReferences.length) {
              validate();
            }
          });
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
