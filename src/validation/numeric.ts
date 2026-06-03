import type { JsonSchemaInternal } from '../json-schema-versions.js';
import type { Report } from '../report.js';
import type { ZSchemaBase } from '../z-schema-base.js';

import { shouldSkipValidate } from './shared.js';

// ---------------------------------------------------------------------------
// multipleOf
// ---------------------------------------------------------------------------

export function multipleOfValidator(ctx: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
  // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.1.1.2
  if (shouldSkipValidate(ctx.validateOptions, ['MULTIPLE_OF'])) {
    return;
  }
  if (typeof json !== 'number') {
    return;
  }

  const result = json / schema.multipleOf!;
  if (!Number.isFinite(result) || Math.abs(result - Math.round(result)) >= 1e-10) {
    report.addError('MULTIPLE_OF', [json, schema.multipleOf!], undefined, schema, 'multipleOf');
  }
}

// ---------------------------------------------------------------------------
// maximum
// ---------------------------------------------------------------------------

export function maximumValidator(ctx: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
  // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.1.2.2
  if (shouldSkipValidate(ctx.validateOptions, ['MAXIMUM', 'MAXIMUM_EXCLUSIVE'])) {
    return;
  }
  if (typeof json !== 'number') {
    return;
  }
  if (schema.exclusiveMaximum !== true) {
    if (json > schema.maximum!) {
      report.addError('MAXIMUM', [json, schema.maximum!], undefined, schema, 'maximum');
    }
  } else if (json >= schema.maximum!) {
    report.addError('MAXIMUM_EXCLUSIVE', [json, schema.maximum!], undefined, schema, 'maximum');
  }
}

// ---------------------------------------------------------------------------
// exclusiveMaximum
// ---------------------------------------------------------------------------

export function exclusiveMaximumValidator(ctx: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
  // In draft-06+, exclusiveMaximum is a standalone number
  if (typeof schema.exclusiveMaximum === 'number') {
    if (shouldSkipValidate(ctx.validateOptions, ['MAXIMUM_EXCLUSIVE'])) {
      return;
    }
    if (typeof json !== 'number') {
      return;
    }
    if (json >= schema.exclusiveMaximum) {
      report.addError('MAXIMUM_EXCLUSIVE', [json, schema.exclusiveMaximum], undefined, schema, 'exclusiveMaximum');
    }
  }
  // In draft-04, exclusiveMaximum is a boolean handled inside the `maximum` validator
}

// ---------------------------------------------------------------------------
// minimum
// ---------------------------------------------------------------------------

export function minimumValidator(ctx: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
  // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.1.3.2
  if (shouldSkipValidate(ctx.validateOptions, ['MINIMUM', 'MINIMUM_EXCLUSIVE'])) {
    return;
  }
  if (typeof json !== 'number') {
    return;
  }
  if (schema.exclusiveMinimum !== true) {
    if (json < schema.minimum!) {
      report.addError('MINIMUM', [json, schema.minimum!], undefined, schema, 'minimum');
    }
  } else if (json <= schema.minimum!) {
    report.addError('MINIMUM_EXCLUSIVE', [json, schema.minimum!], undefined, schema, 'minimum');
  }
}

// ---------------------------------------------------------------------------
// exclusiveMinimum
// ---------------------------------------------------------------------------

export function exclusiveMinimumValidator(ctx: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
  // In draft-06+, exclusiveMinimum is a standalone number
  if (typeof schema.exclusiveMinimum === 'number') {
    if (shouldSkipValidate(ctx.validateOptions, ['MINIMUM_EXCLUSIVE'])) {
      return;
    }
    if (typeof json !== 'number') {
      return;
    }
    if (json <= schema.exclusiveMinimum) {
      report.addError('MINIMUM_EXCLUSIVE', [json, schema.exclusiveMinimum], undefined, schema, 'exclusiveMinimum');
    }
  }
  // In draft-04, exclusiveMinimum is a boolean handled inside the `minimum` validator
}
