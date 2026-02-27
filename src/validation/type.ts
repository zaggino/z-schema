import type { JsonSchemaInternal } from '../json-schema-versions.js';
import type { Report } from '../report.js';
import type { ZSchemaBase } from '../z-schema-base.js';

import { areEqual } from '../utils/json.js';
import { whatIs } from '../utils/what-is.js';
import { shouldSkipValidate } from './shared.js';

// ---------------------------------------------------------------------------
// type
// ---------------------------------------------------------------------------

export function typeValidator(this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
  // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.5.2.2
  if (shouldSkipValidate(this.validateOptions, ['INVALID_TYPE'])) {
    return;
  }
  const jsonType = whatIs(json);
  if (typeof schema.type === 'string') {
    if (jsonType !== schema.type && (jsonType !== 'integer' || schema.type !== 'number')) {
      report.addError('INVALID_TYPE', [schema.type, jsonType], undefined, schema, 'type');
    }
  } else {
    if (!schema.type!.includes(jsonType) && (jsonType !== 'integer' || !schema.type!.includes('number'))) {
      report.addError('INVALID_TYPE', [JSON.stringify(schema.type), jsonType], undefined, schema, 'type');
    }
  }
}

// ---------------------------------------------------------------------------
// enum
// ---------------------------------------------------------------------------

export function enumValidator(this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
  // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.5.1.2
  if (shouldSkipValidate(this.validateOptions, ['ENUM_CASE_MISMATCH', 'ENUM_MISMATCH'])) {
    return;
  }
  let match = false,
    caseInsensitiveMatch = false;
  for (const enumVal of schema.enum!) {
    if (areEqual(json, enumVal, { maxDepth: this.options.maxRecursionDepth })) {
      match = true;
      break;
    } else if (areEqual(json, enumVal, { caseInsensitiveComparison: true, maxDepth: this.options.maxRecursionDepth })) {
      caseInsensitiveMatch = true;
    }
  }

  if (match === false) {
    const error =
      caseInsensitiveMatch && this.options.enumCaseInsensitiveComparison ? 'ENUM_CASE_MISMATCH' : 'ENUM_MISMATCH';
    report.addError(error, [JSON.stringify(json)], undefined, schema, 'enum');
  }
}

// ---------------------------------------------------------------------------
// const
// ---------------------------------------------------------------------------

export function constValidator(this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
  const constValue = schema.const;
  if (areEqual(json, constValue, { maxDepth: this.options.maxRecursionDepth }) === false) {
    report.addError('CONST', [JSON.stringify(constValue)], undefined, schema, undefined);
  }
}
