import type { JsonSchemaInternal } from '../json-schema-versions.js';
import type { ZSchemaBase } from '../z-schema-base.js';

import { Report } from '../report.js';
import { compileSchemaRegex } from '../utils/schema-regex.js';
import { isObject } from '../utils/what-is.js';
import { resolveDynamicRef, resolveRecursiveRef } from './ref.js';
import { deferOrRunSync, getCachedValidationResult } from './shared.js';

// ---------------------------------------------------------------------------
// collectEvaluated — unified traversal for unevaluatedItems / unevaluatedProperties
// ---------------------------------------------------------------------------

/**
 * Collects the evaluated indices (items mode, `dataKeys === undefined`, `json` is the array) or property names
 * (properties mode, `dataKeys === Object.keys(json)`) of `currentSchema` and every applicator reachable from it into
 * `evaluated`. Returns `true` when everything counts as evaluated (the contents of `evaluated` are then irrelevant).
 */
function collectEvaluated(
  ctx: ZSchemaBase,
  report: Report,
  currentSchema: JsonSchemaInternal | boolean | undefined,
  json: unknown,
  dataKeys: string[] | undefined,
  evaluated: Set<number | string>,
  depth: number
): boolean {
  if (!currentSchema || typeof currentSchema === 'boolean') {
    return false;
  }

  if (depth > (ctx.options.maxRecursionDepth ?? 100)) {
    report.addError('COLLECT_EVALUATED_DEPTH_EXCEEDED', [depth]);
    return false;
  }

  // --- Mode-specific leaf collection ---
  if (dataKeys === undefined) {
    const jsonArr = json as unknown[];

    // prefixItems (2020-12 tuple)
    if (Array.isArray(currentSchema.prefixItems)) {
      const len = Math.min(currentSchema.prefixItems.length, jsonArr.length);
      for (let i = 0; i < len; i++) {
        evaluated.add(i);
      }
    }

    // items - can be array (2019-09 tuple) or schema (evaluates all)
    if (currentSchema.items !== undefined) {
      if (Array.isArray(currentSchema.items)) {
        const len = Math.min(currentSchema.items.length, jsonArr.length);
        for (let i = 0; i < len; i++) {
          evaluated.add(i);
        }
      } else if (currentSchema.items !== false) {
        return true;
      }
    }

    // additionalItems (2019-09) - when items is array form and additionalItems is present and not false
    if (
      currentSchema.additionalItems !== undefined &&
      currentSchema.additionalItems !== false &&
      Array.isArray(currentSchema.items)
    ) {
      return true;
    }

    // contains - evaluates specific indices that match the schema
    if (currentSchema.contains !== undefined) {
      for (let i = 0; i < jsonArr.length; i++) {
        let passed = getCachedValidationResult(report, currentSchema.contains, jsonArr[i]);
        if (passed === undefined) {
          const subReport = Report.createSubReport(report);
          ctx._jsonValidate(subReport, currentSchema.contains, jsonArr[i]);
          // An unsettled (async-pending) result is not a success. Applicators cache their result before the
          // deferred unevaluated* phase runs, so this fallback is a defensive path.
          passed = settledPass(subReport);
        }
        if (passed) {
          evaluated.add(i);
        }
      }
    }

    // unevaluatedItems: true means all items evaluated
    if (currentSchema.unevaluatedItems === true) {
      return true;
    }
  } else {
    // properties mode
    const jsonData = json as Record<string, unknown>;
    const schemaProps = currentSchema.properties;

    // properties
    if (isObject(schemaProps)) {
      const propKeys = Object.keys(schemaProps);
      for (let i = 0; i < propKeys.length; i++) {
        const key = propKeys[i];
        if (Object.hasOwn(jsonData, key)) {
          evaluated.add(key);
        }
      }
    }

    // patternProperties - patterns are compiled once per node and shared with the additionalProperties pass
    let patternRegexes: RegExp[] | undefined;
    const schemaPatterns = currentSchema.patternProperties;
    if (isObject(schemaPatterns)) {
      patternRegexes = [];
      const patterns = Object.keys(schemaPatterns);
      for (let pi = 0; pi < patterns.length; pi++) {
        const result = compileSchemaRegex(patterns[pi]);
        if (result.ok) {
          patternRegexes.push(result.value);
        }
      }
      for (let pi = 0; pi < patternRegexes.length; pi++) {
        const regex = patternRegexes[pi];
        for (let i = 0; i < dataKeys.length; i++) {
          if (regex.test(dataKeys[i])) {
            evaluated.add(dataKeys[i]);
          }
        }
      }
    }

    // additionalProperties - evaluates all non-properties/non-patternProperties keys
    if (currentSchema.additionalProperties !== undefined) {
      const hasProps = isObject(schemaProps);
      for (let i = 0; i < dataKeys.length; i++) {
        const key = dataKeys[i];
        if (hasProps && Object.hasOwn(schemaProps, key)) {
          continue;
        }
        let matchedPattern = false;
        if (patternRegexes !== undefined) {
          for (let pi = 0; pi < patternRegexes.length; pi++) {
            if (patternRegexes[pi].test(key)) {
              matchedPattern = true;
              break;
            }
          }
        }
        if (matchedPattern) {
          continue;
        }
        evaluated.add(key);
      }
    }

    // dependentSchemas - only applies when the dependency key is present in the data
    const { dependentSchemas } = currentSchema;
    if (isObject(dependentSchemas)) {
      const depKeys = Object.keys(dependentSchemas);
      for (let i = 0; i < depKeys.length; i++) {
        const depKey = depKeys[i];
        if (
          Object.hasOwn(jsonData, depKey) &&
          collectEvaluated(
            ctx,
            report,
            (dependentSchemas as Record<string, JsonSchemaInternal | boolean>)[depKey],
            json,
            dataKeys,
            evaluated,
            depth + 1
          )
        ) {
          return true;
        }
      }
    }

    // unevaluatedProperties: true in a sub-schema means all props are evaluated
    if (currentSchema.unevaluatedProperties === true) {
      return true;
    }
  }

  // --- Shared combinator traversal ---

  // allOf
  if (Array.isArray(currentSchema.allOf)) {
    for (let i = 0; i < currentSchema.allOf.length; i++) {
      if (collectEvaluated(ctx, report, currentSchema.allOf[i], json, dataKeys, evaluated, depth + 1)) {
        return true;
      }
    }
  }

  // anyOf - only matching branches contribute
  if (Array.isArray(currentSchema.anyOf)) {
    for (let i = 0; i < currentSchema.anyOf.length; i++) {
      const subSchema = currentSchema.anyOf[i];
      let passed = getCachedValidationResult(report, subSchema, json);
      if (passed === undefined) {
        const subReport = Report.createSubReport(report);
        ctx._jsonValidate(subReport, subSchema, json);
        passed = settledPass(subReport);
      }
      if (passed && collectEvaluated(ctx, report, subSchema, json, dataKeys, evaluated, depth + 1)) {
        return true;
      }
    }
  }

  // oneOf - only matching branches contribute
  if (Array.isArray(currentSchema.oneOf)) {
    for (let i = 0; i < currentSchema.oneOf.length; i++) {
      const subSchema = currentSchema.oneOf[i];
      let passed = getCachedValidationResult(report, subSchema, json);
      if (passed === undefined) {
        const subReport = Report.createSubReport(report);
        ctx._jsonValidate(subReport, subSchema, json);
        passed = settledPass(subReport);
      }
      if (passed && collectEvaluated(ctx, report, subSchema, json, dataKeys, evaluated, depth + 1)) {
        return true;
      }
    }
  }

  // if/then/else
  if (currentSchema.if !== undefined) {
    let condPassed = getCachedValidationResult(report, currentSchema.if, json);
    if (condPassed === undefined) {
      const condReport = Report.createSubReport(report);
      ctx._jsonValidate(condReport, currentSchema.if, json);
      condPassed = settledPass(condReport);
    }
    if (condPassed) {
      if (collectEvaluated(ctx, report, currentSchema.if, json, dataKeys, evaluated, depth + 1)) {
        return true;
      }
      if (
        currentSchema.then !== undefined &&
        collectEvaluated(ctx, report, currentSchema.then, json, dataKeys, evaluated, depth + 1)
      ) {
        return true;
      }
    } else if (
      currentSchema.else !== undefined &&
      collectEvaluated(ctx, report, currentSchema.else, json, dataKeys, evaluated, depth + 1)
    ) {
      return true;
    }
  }

  // $ref resolved
  if (
    currentSchema.__$refResolved &&
    currentSchema.__$refResolved !== currentSchema &&
    collectEvaluated(ctx, report, currentSchema.__$refResolved, json, dataKeys, evaluated, depth + 1)
  ) {
    return true;
  }

  // $recursiveRef
  const recursiveTarget = resolveRecursiveRef(currentSchema, report.__$recursiveAnchorStack);
  if (
    recursiveTarget &&
    recursiveTarget !== currentSchema &&
    collectEvaluated(ctx, report, recursiveTarget, json, dataKeys, evaluated, depth + 1)
  ) {
    return true;
  }

  // $dynamicRef
  const dynamicTarget = resolveDynamicRef(currentSchema, report.__$dynamicScopeStack);
  if (
    dynamicTarget &&
    dynamicTarget !== currentSchema &&
    collectEvaluated(ctx, report, dynamicTarget, json, dataKeys, evaluated, depth + 1)
  ) {
    return true;
  }

  return false;
}

/** A sub-report result counts as a pass only when it has neither errors nor unsettled async work. */
function settledPass(r: Report): boolean {
  return r.errors.length === 0 && r.asyncTasks.length === 0;
}

// ---------------------------------------------------------------------------
// unevaluatedItems
// ---------------------------------------------------------------------------

export function unevaluatedItemsValidator(ctx: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
  if (!Array.isArray(json)) {
    return;
  }

  // unevaluatedItems: true means all items are valid
  if (schema.unevaluatedItems === true) {
    return;
  }

  const unevalSchema = schema.unevaluatedItems;
  if (unevalSchema === undefined) {
    return;
  }

  // Snapshot the length: a customValidator may mutate the data while items are validated, and only the items
  // present when annotations were collected are checked.
  const { length } = json;
  if (length === 0) {
    return;
  }

  const evaluatedItems = new Set<number | string>();
  if (collectEvaluated(ctx, report, schema, json, undefined, evaluatedItems, 0)) {
    return;
  }

  if (unevalSchema === false) {
    for (let i = 0; i < length; i++) {
      if (!evaluatedItems.has(i)) {
        report.addError('ARRAY_UNEVALUATED_ITEMS', undefined, undefined, schema, 'unevaluatedItems');
        return;
      }
    }
  } else {
    // unevaluatedItems as a schema — validate each unevaluated item against it
    // A sub-report that already has an error decides immediately, even with its own or earlier async work
    // pending: errors are never removed and only one error is ever emitted, so waiting cannot change the outcome.
    let pendingReports: Report[] | undefined;
    for (let i = 0; i < length; i++) {
      if (evaluatedItems.has(i)) {
        continue;
      }
      const subReport = Report.createSubReport(report);
      ctx._jsonValidate(subReport, unevalSchema, json[i]);
      if (subReport.errors.length > 0) {
        report.addError('ARRAY_UNEVALUATED_ITEMS', undefined, undefined, schema, 'unevaluatedItems');
        return;
      }
      if (subReport.asyncTasks.length > 0) {
        if (pendingReports === undefined) {
          pendingReports = [];
        }
        pendingReports.push(subReport);
      }
    }
    if (pendingReports !== undefined) {
      const reports = pendingReports;
      deferOrRunSync(ctx, report, reports, () => {
        for (let i = 0; i < reports.length; i++) {
          if (reports[i].errors.length > 0) {
            report.addError('ARRAY_UNEVALUATED_ITEMS', undefined, undefined, schema, 'unevaluatedItems');
            break;
          }
        }
      });
    }
  }
}

// ---------------------------------------------------------------------------
// unevaluatedProperties
// ---------------------------------------------------------------------------

export function unevaluatedPropertiesValidator(
  ctx: ZSchemaBase,
  report: Report,
  schema: JsonSchemaInternal,
  json: unknown
) {
  if (!isObject(json)) {
    return;
  }

  // unevaluatedProperties: true means all properties are valid
  if (schema.unevaluatedProperties === true) {
    return;
  }

  // unevaluatedProperties: false or unevaluatedProperties: {schema} both need evaluation
  const unevalSchema = schema.unevaluatedProperties;
  if (unevalSchema === undefined) {
    return;
  }

  const allKeys = Object.keys(json);
  if (allKeys.length === 0) {
    return;
  }

  const evaluatedProperties = new Set<number | string>();
  if (collectEvaluated(ctx, report, schema, json, allKeys, evaluatedProperties, 0)) {
    return;
  }

  if (unevalSchema === false) {
    // The error message joins every unevaluated key, so the list is only built on this path.
    const unevaluatedKeys: string[] = [];
    for (let i = 0; i < allKeys.length; i++) {
      if (!evaluatedProperties.has(allKeys[i])) {
        unevaluatedKeys.push(allKeys[i]);
      }
    }
    if (unevaluatedKeys.length === 0) {
      return;
    }
    report.addError(
      'OBJECT_UNEVALUATED_PROPERTIES',
      [unevaluatedKeys.join(', ')],
      undefined,
      schema,
      'unevaluatedProperties'
    );
  } else {
    // unevaluatedProperties as a schema — validate each unevaluated key against it
    // Keys that already have an error report immediately (errors are never removed); only keys whose outcome
    // still depends on async work are decided later, so their errors may follow later keys' errors (see the
    // async error-order caveat in docs/features.md).
    let pendingReports: Report[] | undefined;
    let pendingKeys: string[] | undefined;
    for (let i = 0; i < allKeys.length; i++) {
      const key = allKeys[i];
      if (evaluatedProperties.has(key)) {
        continue;
      }
      const subReport = Report.createSubReport(report);
      ctx._jsonValidate(subReport, unevalSchema, (json as Record<string, unknown>)[key]);
      if (subReport.errors.length > 0) {
        report.addError('OBJECT_UNEVALUATED_PROPERTIES', [key], undefined, schema, 'unevaluatedProperties');
      } else if (subReport.asyncTasks.length > 0) {
        if (pendingReports === undefined || pendingKeys === undefined) {
          pendingReports = [];
          pendingKeys = [];
        }
        pendingReports.push(subReport);
        pendingKeys.push(key);
      }
    }
    if (pendingReports !== undefined && pendingKeys !== undefined) {
      const reports = pendingReports;
      const keys = pendingKeys;
      deferOrRunSync(ctx, report, reports, () => {
        for (let i = 0; i < reports.length; i++) {
          if (reports[i].errors.length > 0) {
            report.addError('OBJECT_UNEVALUATED_PROPERTIES', [keys[i]], undefined, schema, 'unevaluatedProperties');
          }
        }
      });
    }
  }
}
