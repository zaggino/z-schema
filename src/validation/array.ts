import type { JsonSchemaInternal } from '../json-schema-versions.js';
import type { Report } from '../report.js';
import type { ZSchemaBase } from '../z-schema-base.js';

import { isUniqueArray } from '../utils/array.js';
import { cacheValidationResult, deferOrRunSync, shouldSkipValidate } from './shared.js';

// ---------------------------------------------------------------------------
// additionalItems
// ---------------------------------------------------------------------------

export function additionalItemsValidator(this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
  // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.3.1.2
  if (shouldSkipValidate(this.validateOptions, ['ARRAY_ADDITIONAL_ITEMS'])) {
    return;
  }
  if (!Array.isArray(json)) {
    return;
  }
  // if the value of "additionalItems" is boolean value false and the value of "items" is an array,
  // the json is valid if its size is less than, or equal to, the size of "items".
  if (schema.additionalItems === false && Array.isArray(schema.items)) {
    if (json.length > schema.items.length) {
      report.addError('ARRAY_ADDITIONAL_ITEMS', undefined, undefined, schema, 'additionalItems');
    }
  }
}

// ---------------------------------------------------------------------------
// items  (no-op — covered in additionalItems / recurseArray)
// ---------------------------------------------------------------------------

export function itemsValidator() {
  /*report: Report, schema: JsonSchemaInternal, json: unknown*/
  // covered in additionalItems
}

// ---------------------------------------------------------------------------
// prefixItems  (no-op — handled in recurseArray)
// ---------------------------------------------------------------------------

export function prefixItemsValidator() {
  // handled in recurseArray
}

// ---------------------------------------------------------------------------
// maxItems
// ---------------------------------------------------------------------------

export function maxItemsValidator(this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
  // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.3.2.2
  if (shouldSkipValidate(this.validateOptions, ['ARRAY_LENGTH_LONG'])) {
    return;
  }
  if (!Array.isArray(json)) {
    return;
  }
  if (json.length > schema.maxItems!) {
    report.addError('ARRAY_LENGTH_LONG', [json.length, schema.maxItems!], undefined, schema, 'maxItems');
  }
}

// ---------------------------------------------------------------------------
// minItems
// ---------------------------------------------------------------------------

export function minItemsValidator(this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
  // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.3.3.2
  if (shouldSkipValidate(this.validateOptions, ['ARRAY_LENGTH_SHORT'])) {
    return;
  }
  if (!Array.isArray(json)) {
    return;
  }
  if (json.length < schema.minItems!) {
    report.addError('ARRAY_LENGTH_SHORT', [json.length, schema.minItems!], undefined, schema, 'minItems');
  }
}

// ---------------------------------------------------------------------------
// uniqueItems
// ---------------------------------------------------------------------------

export function uniqueItemsValidator(this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
  // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.3.4.2
  if (shouldSkipValidate(this.validateOptions, ['ARRAY_UNIQUE'])) {
    return;
  }
  if (!Array.isArray(json)) {
    return;
  }
  if (schema.uniqueItems === true) {
    const matches: any[] = [];
    if (isUniqueArray(json, matches, this.options.maxRecursionDepth) === false) {
      report.addError('ARRAY_UNIQUE', matches, undefined, schema, 'uniqueItems');
    }
  }
}

// ---------------------------------------------------------------------------
// contains
// ---------------------------------------------------------------------------

export function containsValidator(this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
  if (shouldSkipValidate(this.validateOptions, ['CONTAINS'])) {
    return;
  }

  if (!Array.isArray(json)) {
    return;
  }

  const containsSchema = schema.contains;
  if (containsSchema === undefined) {
    return;
  }

  const Report_ = report.constructor as typeof Report;
  const subReports: Report[] = [];
  for (let idx = 0; idx < json.length; idx++) {
    const subReport = new Report_(report);
    subReports.push(subReport);
    this._jsonValidate(subReport, containsSchema as any, json[idx]);
    cacheValidationResult(report, containsSchema, json[idx], subReport.errors.length === 0);
  }

  const addContainsErrorIfNeeded = () => {
    let matchingItems = 0;
    for (const subReport of subReports) {
      if (subReport.errors.length === 0) {
        matchingItems += 1;
      }
    }

    const supportsContainsBounds = this.options.version === 'draft2019-09' || this.options.version === 'draft2020-12';
    const minContains: number =
      supportsContainsBounds && typeof schema.minContains === 'number' ? (schema.minContains ?? 1) : 1;
    const maxContains =
      supportsContainsBounds && typeof schema.maxContains === 'number' ? schema.maxContains : undefined;

    const hasEnoughMatches = matchingItems >= minContains;
    const notTooManyMatches = maxContains === undefined || matchingItems <= maxContains;

    if (!hasEnoughMatches || !notTooManyMatches) {
      report.addError('CONTAINS', undefined, subReports, schema, undefined);
    }
  };

  deferOrRunSync(report, subReports, addContainsErrorIfNeeded);
}

// ---------------------------------------------------------------------------
// maxContains / minContains  (no-op — handled inside contains)
// ---------------------------------------------------------------------------

export function maxContainsValidator() {}
export function minContainsValidator() {}
