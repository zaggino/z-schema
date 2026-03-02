import type { JsonSchemaInternal } from '../json-schema-versions.js';
import type { ZSchemaBase } from '../z-schema-base.js';

import { Report } from '../report.js';
import { cacheValidationResult, deferOrRunSync } from './shared.js';

// ---------------------------------------------------------------------------
// allOf
// ---------------------------------------------------------------------------

export function allOfValidator(this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
  // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.5.3.2
  for (let i = 0; i < schema.allOf!.length; i++) {
    const validateResult = this._jsonValidate(report, schema.allOf![i], json);
    if (this.options.breakOnFirstError && validateResult === false) {
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// anyOf
// ---------------------------------------------------------------------------

export function anyOfValidator(this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
  // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.5.4.2
  const subReports: Report[] = [];

  for (let i = 0; i < schema.anyOf!.length; i++) {
    const subReport = new Report(report);
    subReports.push(subReport);
    this._jsonValidate(subReport, schema.anyOf![i], json);
    cacheValidationResult(report, schema.anyOf![i], json, subReport.errors.length === 0);
  }

  // Aggregate async tasks and decide when ready
  deferOrRunSync(report, subReports, () => {
    let passed = false;
    for (const subReport of subReports) {
      if (subReport.errors.length === 0) {
        passed = true;
        break;
      }
    }

    if (passed === false) {
      report.addError('ANY_OF_MISSING', undefined, subReports, schema, 'anyOf');
    }
  });
}

// ---------------------------------------------------------------------------
// oneOf
// ---------------------------------------------------------------------------

export function oneOfValidator(this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
  // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.5.5.2
  const subReports: Report[] = [];

  for (let i = 0; i < schema.oneOf!.length; i++) {
    const subReport = new Report(report);
    subReports.push(subReport);
    this._jsonValidate(subReport, schema.oneOf![i], json);
    cacheValidationResult(report, schema.oneOf![i], json, subReport.errors.length === 0);
  }

  // Aggregate async tasks and decide when ready
  deferOrRunSync(report, subReports, () => {
    let passes = 0;
    for (const subReport of subReports) {
      if (subReport.errors.length === 0) {
        passes++;
      }
    }

    if (passes === 0) {
      report.addError('ONE_OF_MISSING', undefined, subReports, schema, 'oneOf');
    } else if (passes > 1) {
      report.addError('ONE_OF_MULTIPLE', undefined, undefined, schema, 'oneOf');
    }
  });
}

// ---------------------------------------------------------------------------
// not
// ---------------------------------------------------------------------------

export function notValidator(this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
  // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.5.6.2
  const subReport = new Report(report);
  if (this._jsonValidate(subReport, schema.not!, json) === true) {
    report.addError('NOT_PASSED', undefined, undefined, schema, 'not');
  }
}

// ---------------------------------------------------------------------------
// if / then / else
// ---------------------------------------------------------------------------

export function ifValidator(this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
  if (this.options.version === 'draft-04' || this.options.version === 'draft-06') {
    return;
  }

  const conditionSchema = schema.if;
  const thenSchema = schema.then;
  const elseSchema = schema.else;

  if (conditionSchema === undefined || (thenSchema === undefined && elseSchema === undefined)) {
    return;
  }

  const conditionReport = new Report(report);
  this._jsonValidate(conditionReport, conditionSchema as any, json);
  cacheValidationResult(report, conditionSchema, json, conditionReport.errors.length === 0);

  const branchSchema = conditionReport.errors.length === 0 ? thenSchema : elseSchema;
  if (branchSchema === undefined) {
    return;
  }

  this._jsonValidate(report, branchSchema as any, json);
}

export function thenValidator() {
  // handled by if
}

export function elseValidator() {
  // handled by if
}
