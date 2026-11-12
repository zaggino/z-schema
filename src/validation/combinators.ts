import type { JsonSchemaInternal } from '../json-schema-versions.js';
import type { ZSchemaBase } from '../z-schema-base.js';
import type { BuildState, Check } from './fast-shared.js';

import { Report } from '../report.js';
import { ALWAYS_FALSE, ALWAYS_TRUE, expectArray } from './fast-shared.js';
import { cacheValidationResult, deferOrRunSync, isModernDraft, supportsIfThenElse } from './shared.js';

// ---------------------------------------------------------------------------
// allOf
// ---------------------------------------------------------------------------

export function allOfValidator(ctx: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
  // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.5.3.2
  for (let i = 0; i < schema.allOf!.length; i++) {
    const validateResult = ctx._jsonValidate(report, schema.allOf![i], json);
    if (ctx.options.breakOnFirstError && !validateResult) {
      break;
    }
  }
}

/** Compiles every member of a combinator array; the build is unsupported when the value is not an array. */
function compileMembers(state: BuildState, value: unknown): Check[] {
  const schemas = expectArray(value);
  const members: Check[] = [];
  for (let i = 0; i < schemas.length; i++) {
    members.push(state.compileChild(schemas[i]));
  }
  return members;
}

export function compileAllOf(state: BuildState, node: JsonSchemaInternal, checks: Check[]): void {
  const members = compileMembers(state, node.allOf);
  for (let i = 0; i < members.length; i++) {
    if (members[i] !== ALWAYS_TRUE) {
      checks.push(members[i]);
    }
  }
}

// ---------------------------------------------------------------------------
// anyOf
// ---------------------------------------------------------------------------

export function anyOfValidator(ctx: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
  // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.5.4.2
  const subReports: Report[] = [];

  for (let i = 0; i < schema.anyOf!.length; i++) {
    const subReport = Report.createSubReport(report);
    subReports.push(subReport);
    ctx._jsonValidate(subReport, schema.anyOf![i], json);
  }

  // Wait for each sub-report's async work, then decide.
  deferOrRunSync(ctx, report, subReports, () => {
    let passed = false;
    for (let i = 0; i < subReports.length; i++) {
      const subReport = subReports[i];
      cacheValidationResult(report, schema.anyOf![i], json, subReport.errors.length === 0);
      if (subReport.errors.length === 0) {
        passed = true;
      }
    }

    if (!passed) {
      report.addError('ANY_OF_MISSING', undefined, subReports, schema, 'anyOf');
    }
  });
}

export function compileAnyOf(state: BuildState, node: JsonSchemaInternal, checks: Check[]): void {
  const members = compileMembers(state, node.anyOf);
  const count = members.length;
  if (count === 0) {
    checks.push(ALWAYS_FALSE);
    return;
  }
  for (let i = 0; i < count; i++) {
    if (members[i] === ALWAYS_TRUE) {
      return;
    }
  }
  if (count === 1) {
    checks.push(members[0]);
    return;
  }
  checks.push((json) => {
    for (let i = 0; i < count; i++) {
      if (members[i](json)) {
        return true;
      }
    }
    return false;
  });
}

// ---------------------------------------------------------------------------
// oneOf
// ---------------------------------------------------------------------------

export function oneOfValidator(ctx: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
  // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.5.5.2
  const subReports: Report[] = [];

  for (let i = 0; i < schema.oneOf!.length; i++) {
    const subReport = Report.createSubReport(report);
    subReports.push(subReport);
    ctx._jsonValidate(subReport, schema.oneOf![i], json);
  }

  // Wait for each sub-report's async work, then decide.
  deferOrRunSync(ctx, report, subReports, () => {
    let passes = 0;
    for (let i = 0; i < subReports.length; i++) {
      const subReport = subReports[i];
      cacheValidationResult(report, schema.oneOf![i], json, subReport.errors.length === 0);
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

export function compileOneOf(state: BuildState, node: JsonSchemaInternal, checks: Check[]): void {
  const members = compileMembers(state, node.oneOf);
  const count = members.length;
  if (count === 0) {
    checks.push(ALWAYS_FALSE);
    return;
  }
  if (count === 1) {
    checks.push(members[0]);
    return;
  }
  checks.push((json) => {
    let passes = 0;
    for (let i = 0; i < count; i++) {
      if (members[i](json) && ++passes > 1) {
        return false;
      }
    }
    return passes === 1;
  });
}

// ---------------------------------------------------------------------------
// not
// ---------------------------------------------------------------------------

export function notValidator(ctx: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
  // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.5.6.2
  const subReport = Report.createSubReport(report);
  const valid = ctx._jsonValidate(subReport, schema.not!, json);
  if (subReport.asyncTasks.length === 0) {
    if (valid) {
      report.addError('NOT_PASSED', undefined, undefined, schema, 'not');
    }
    return;
  }
  deferOrRunSync(ctx, report, [subReport], () => {
    if (subReport.errors.length === 0) {
      report.addError('NOT_PASSED', undefined, undefined, schema, 'not');
    }
  });
}

export function compileNot(state: BuildState, node: JsonSchemaInternal, checks: Check[]): void {
  const inner = state.compileChild(node.not);
  checks.push((json) => !inner(json));
}

// ---------------------------------------------------------------------------
// if / then / else
// ---------------------------------------------------------------------------

export function ifValidator(ctx: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
  if (!supportsIfThenElse(ctx.options.version)) {
    return;
  }

  const conditionSchema = schema.if;
  const thenSchema = schema.then;
  const elseSchema = schema.else;

  if (conditionSchema === undefined) {
    return;
  }
  const noBranches = thenSchema === undefined && elseSchema === undefined;
  // A lone `if` only matters as an annotation for an unevaluated* at the same instance (2019-09+), so skip it
  // otherwise. Annotations attach to the instance location, so child instances don't count.
  if (noBranches && !(isModernDraft(ctx.options.version) && report.__$unevaluatedInstance === json)) {
    return;
  }

  const conditionReport = Report.createSubReport(report);
  ctx._jsonValidate(conditionReport, conditionSchema, json);
  if (conditionReport.asyncTasks.length > 0) {
    deferOrRunSync(ctx, report, [conditionReport], () => {
      cacheValidationResult(report, conditionSchema, json, conditionReport.errors.length === 0);
      const selected = conditionReport.errors.length === 0 ? thenSchema : elseSchema;
      if (selected !== undefined) {
        ctx._jsonValidate(report, selected, json);
      }
    });
    return;
  }
  cacheValidationResult(report, conditionSchema, json, conditionReport.errors.length === 0);

  const branchSchema = conditionReport.errors.length === 0 ? thenSchema : elseSchema;
  if (branchSchema === undefined) {
    return;
  }

  ctx._jsonValidate(report, branchSchema, json);
}

export function compileIf(state: BuildState, node: JsonSchemaInternal, checks: Check[]): void {
  const { version } = state.ctx.options;
  if (!supportsIfThenElse(version)) {
    return;
  }
  const { then: thenSchema, else: elseSchema } = node;
  if (node.if === undefined || (thenSchema === undefined && elseSchema === undefined)) {
    return;
  }
  const condition = state.compileChild(node.if);
  const onThen = thenSchema === undefined ? ALWAYS_TRUE : state.compileChild(thenSchema);
  const onElse = elseSchema === undefined ? ALWAYS_TRUE : state.compileChild(elseSchema);
  checks.push((json) => (condition(json) ? onThen(json) : onElse(json)));
}

export function thenValidator() {
  // handled by if
}

export function elseValidator() {
  // handled by if
}
