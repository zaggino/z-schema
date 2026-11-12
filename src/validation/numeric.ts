import type { JsonSchemaInternal } from '../json-schema-versions.js';
import type { Report } from '../report.js';
import type { ZSchemaBase } from '../z-schema-base.js';
import type { BuildState, Check } from './fast-shared.js';

import { expectNumber } from './fast-shared.js';
import { shouldSkipValidate } from './shared.js';

// ---------------------------------------------------------------------------
// multipleOf
// ---------------------------------------------------------------------------

// A divisor with at most 20 binary digits after the point is an integer once scaled by this.
const BINARY_FRACTION_SCALE = 2 ** 20;

/** Pure decision behind `multipleOf`: whether the number `json` is a multiple of `multipleOf`. */
export function isMultipleOf(json: number, multipleOf: number): boolean {
  // Beyond the safe integers the quotient can't be trusted: it has no bits left for
  // a fraction (1e20 / 3 is an integer), and it can overflow. The remainder of two
  // doubles is exact at any magnitude, but costs more than the division, so only
  // these values take it.
  if (json > Number.MAX_SAFE_INTEGER || json < -Number.MAX_SAFE_INTEGER) {
    if (json % multipleOf === 0) {
      return true;
    }
    // A non-zero remainder settles it when the double is the divisor that was
    // written: an integer, or a short binary fraction such as 1.5 or 0.25.
    if (Number.isInteger(multipleOf) || Number.isInteger(multipleOf * BINARY_FRACTION_SCALE)) {
      return false;
    }
    // Any other decimal (0.1, 0.01) is only approximated by its double, and at this
    // magnitude that error exceeds the divisor, so neither the remainder nor the
    // quotient can tell. It keeps the outcome of the quotient check below, as before:
    // accepted, unless the quotient overflows.
  }

  const result = json / multipleOf;
  return Number.isFinite(result) && Math.abs(result - Math.round(result)) < 1e-10;
}

export function multipleOfValidator(ctx: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
  // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.1.1.2
  if (shouldSkipValidate(ctx.validateOptions, ['MULTIPLE_OF'])) {
    return;
  }
  if (typeof json !== 'number') {
    return;
  }

  const multipleOf = schema.multipleOf!;
  if (!isMultipleOf(json, multipleOf)) {
    report.addError('MULTIPLE_OF', [json, multipleOf], undefined, schema, 'multipleOf');
  }
}

export function compileMultipleOf(_state: BuildState, node: JsonSchemaInternal, checks: Check[]): void {
  const multipleOf = expectNumber(node.multipleOf);
  checks.push((json) => typeof json !== 'number' || isMultipleOf(json, multipleOf));
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

export function compileMaximum(_state: BuildState, node: JsonSchemaInternal, checks: Check[]): void {
  const maximum = expectNumber(node.maximum);
  if (node.exclusiveMaximum === true) {
    checks.push((json) => typeof json !== 'number' || !(json >= maximum));
  } else {
    checks.push((json) => typeof json !== 'number' || !(json > maximum));
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

export function compileExclusiveMaximum(_state: BuildState, node: JsonSchemaInternal, checks: Check[]): void {
  const bound = node.exclusiveMaximum;
  if (typeof bound === 'number') {
    checks.push((json) => typeof json !== 'number' || !(json >= bound));
  }
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

export function compileMinimum(_state: BuildState, node: JsonSchemaInternal, checks: Check[]): void {
  const minimum = expectNumber(node.minimum);
  // Negated comparisons, exactly as the interpreter's error conditions, so NaN passes in both.
  if (node.exclusiveMinimum === true) {
    checks.push((json) => typeof json !== 'number' || !(json <= minimum));
  } else {
    checks.push((json) => typeof json !== 'number' || !(json < minimum));
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

// draft-06+ standalone numeric form; the draft-04 boolean form is handled by minimum/maximum
export function compileExclusiveMinimum(_state: BuildState, node: JsonSchemaInternal, checks: Check[]): void {
  const bound = node.exclusiveMinimum;
  if (typeof bound === 'number') {
    checks.push((json) => typeof json !== 'number' || !(json <= bound));
  }
}
