import type { JsonSchemaInternal } from '../json-schema-versions.js';
import type { Report } from '../report.js';
import type { ZSchemaBase } from '../z-schema-base.js';

import { getFormatValidators } from '../format-validators.js';
import { decodeBase64, isValidBase64 } from '../utils/base64.js';
import { compileSchemaRegex } from '../utils/schema-regex.js';
import { unicodeLength } from '../utils/unicode.js';
import { whatIs } from '../utils/what-is.js';
import { isFormatAssertionVocabEnabled, shouldSkipValidate } from './shared.js';

// ---------------------------------------------------------------------------
// minLength
// ---------------------------------------------------------------------------

export function minLengthValidator(this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
  // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.2.2.2
  if (shouldSkipValidate(this.validateOptions, ['MIN_LENGTH'])) {
    return;
  }
  if (typeof json !== 'string') {
    return;
  }
  if (unicodeLength(json) < schema.minLength!) {
    report.addError('MIN_LENGTH', [json.length, schema.minLength!], undefined, schema, 'minLength');
  }
}

// ---------------------------------------------------------------------------
// maxLength
// ---------------------------------------------------------------------------

export function maxLengthValidator(this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
  // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.2.1.2
  if (shouldSkipValidate(this.validateOptions, ['MAX_LENGTH'])) {
    return;
  }
  if (typeof json !== 'string') {
    return;
  }
  if (unicodeLength(json) > schema.maxLength!) {
    report.addError('MAX_LENGTH', [json.length, schema.maxLength!], undefined, schema, 'maxLength');
  }
}

// ---------------------------------------------------------------------------
// pattern
// ---------------------------------------------------------------------------

export function patternValidator(this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
  // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.2.3.2
  if (shouldSkipValidate(this.validateOptions, ['PATTERN'])) {
    return;
  }
  if (typeof json !== 'string') {
    return;
  }
  const result = compileSchemaRegex(schema.pattern!);
  if (!result.ok) {
    // Should not happen: schema should have been validated already
    report.addError('PATTERN', [schema.pattern!, json, result.error.message], undefined, schema, 'pattern');
    return;
  }
  if (!result.value.test(json)) {
    report.addError('PATTERN', [schema.pattern!, json], undefined, schema, 'pattern');
  }
}

// ---------------------------------------------------------------------------
// format
// ---------------------------------------------------------------------------

export function formatValidator(this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
  // http://json-schema.org/latest/json-schema-validation.html#rfc.section.7.2
  if (this.options.formatAssertions === false) {
    return;
  }

  // When formatAssertions is explicitly true, respect the meta-schema vocabulary:
  // for draft 2019-09/2020-12, format is annotation-only unless the format-assertion
  // vocabulary is enabled in the meta-schema.
  if (this.options.formatAssertions === true) {
    if (!isFormatAssertionVocabEnabled(schema, report, this.options.version)) {
      return;
    }
  }

  const isModernDraft = this.options.version === 'draft2019-09' || this.options.version === 'draft2020-12';

  const formatValidators = getFormatValidators(this.options);
  const formatValidatorFn = formatValidators[schema.format!];
  if (typeof formatValidatorFn === 'function') {
    if (shouldSkipValidate(this.validateOptions, ['INVALID_FORMAT'])) {
      return;
    }
    if (report.hasError('INVALID_TYPE', [schema.type, whatIs(json)])) {
      return;
    }
    if (formatValidatorFn.length === 2) {
      // callback-based async
      report.addAsyncTaskWithPath(formatValidatorFn, [json], function (result) {
        if (result !== true) {
          report.addError('INVALID_FORMAT', [schema.format!, JSON.stringify(json)], undefined, schema, 'format');
        }
      });
    } else {
      const result = formatValidatorFn.call(this, json);
      if (result instanceof Promise) {
        // Promise-based async
        const promiseResult = result;
        report.addAsyncTaskWithPath(
          async (callback) => {
            try {
              const resolved = await promiseResult;
              callback(resolved);
            } catch (_error) {
              callback(false);
            }
          },
          [] as any,
          function (resolvedResult) {
            if (resolvedResult !== true) {
              report.addError('INVALID_FORMAT', [schema.format!, JSON.stringify(json)], undefined, schema, 'format');
            }
          }
        );
      } else {
        // sync
        if (result !== true) {
          report.addError('INVALID_FORMAT', [schema.format!, JSON.stringify(json)], undefined, schema, 'format');
        }
      }
    }
  } else if (this.options.ignoreUnknownFormats !== true && !isModernDraft) {
    report.addError('UNKNOWN_FORMAT', [schema.format!], undefined, schema, 'format');
  }
}

// ---------------------------------------------------------------------------
// contentEncoding
// ---------------------------------------------------------------------------

export function contentEncodingValidator(this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
  if (this.options.version !== 'draft-07') {
    return;
  }
  if (typeof json !== 'string') {
    return;
  }

  const contentEncoding = schema.contentEncoding;
  if (contentEncoding !== 'base64') {
    return;
  }

  if (!isValidBase64(json)) {
    report.addError(
      'INVALID_FORMAT',
      ['contentEncoding:base64', JSON.stringify(json)],
      undefined,
      schema,
      'contentEncoding'
    );
  }
}

// ---------------------------------------------------------------------------
// contentMediaType
// ---------------------------------------------------------------------------

export function contentMediaTypeValidator(
  this: ZSchemaBase,
  report: Report,
  schema: JsonSchemaInternal,
  json: unknown
) {
  if (this.options.version !== 'draft-07') {
    return;
  }
  if (typeof json !== 'string') {
    return;
  }

  const contentMediaType = schema.contentMediaType;
  if (contentMediaType !== 'application/json') {
    return;
  }

  let payload = json;
  if (schema.contentEncoding === 'base64') {
    const decoded = decodeBase64(json);
    if (decoded === undefined) {
      report.addError(
        'INVALID_FORMAT',
        ['contentEncoding:base64', JSON.stringify(json)],
        undefined,
        schema,
        'contentEncoding'
      );
      return;
    }
    payload = decoded;
  }

  try {
    JSON.parse(payload);
  } catch {
    report.addError(
      'INVALID_FORMAT',
      ['contentMediaType:application/json', JSON.stringify(json)],
      undefined,
      schema,
      'contentMediaType'
    );
  }
}
