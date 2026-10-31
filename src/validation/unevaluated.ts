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

interface CollectEvaluatedItemsArgs {
  report: Report;
  currentSchema: JsonSchemaInternal | boolean | undefined;
  json: unknown;
  mode: 'items';
  jsonArr: unknown[];
  depth: number;
}

interface CollectEvaluatedPropertiesArgs {
  report: Report;
  currentSchema: JsonSchemaInternal | boolean | undefined;
  json: unknown;
  mode: 'properties';
  jsonData: Record<string, unknown>;
  depth: number;
}

type CollectEvaluatedArgs = CollectEvaluatedItemsArgs | CollectEvaluatedPropertiesArgs;

function collectEvaluated(ctx: ZSchemaBase, args: CollectEvaluatedArgs): Set<number | string> | 'all' {
  const { report, currentSchema, json, mode, depth } = args;

  if (!currentSchema || typeof currentSchema === 'boolean') {
    return new Set();
  }

  if (depth > (ctx.options.maxRecursionDepth ?? 100)) {
    report.addError('COLLECT_EVALUATED_DEPTH_EXCEEDED', [depth]);
    return new Set();
  }

  const evaluated = new Set<number | string>();

  const merge = (other: Set<number | string> | 'all') => {
    if (other === 'all') {
      return true;
    }
    for (const v of other) {
      evaluated.add(v);
    }
    return false;
  };

  const recurse = (subSchema: JsonSchemaInternal | boolean | undefined): Set<number | string> | 'all' => {
    if (mode === 'items') {
      return collectEvaluated(ctx, {
        report,
        currentSchema: subSchema,
        json,
        mode: 'items',
        jsonArr: args.jsonArr,
        depth: depth + 1,
      });
    }
    return collectEvaluated(ctx, {
      report,
      currentSchema: subSchema,
      json,
      mode: 'properties',
      jsonData: args.jsonData,
      depth: depth + 1,
    });
  };

  // --- Mode-specific leaf collection ---
  if (mode === 'items') {
    const { jsonArr } = args;

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
        return 'all';
      }
    }

    // additionalItems (2019-09) - when items is array form and additionalItems is present and not false
    if (
      currentSchema.additionalItems !== undefined &&
      currentSchema.additionalItems !== false &&
      Array.isArray(currentSchema.items)
    ) {
      return 'all';
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
      return 'all';
    }
  } else {
    // mode === 'properties'
    const { jsonData } = args;

    // properties
    if (isObject(currentSchema.properties)) {
      const propKeysCE = Object.keys(currentSchema.properties);
      for (let i = 0; i < propKeysCE.length; i++) {
        const key = propKeysCE[i];
        if (Object.hasOwn(jsonData, key)) {
          evaluated.add(key);
        }
      }
    }

    // patternProperties
    if (isObject(currentSchema.patternProperties)) {
      for (const pattern of Object.keys(currentSchema.patternProperties)) {
        const result = compileSchemaRegex(pattern);
        if (result.ok) {
          const jdKeys = Object.keys(jsonData);
          for (let i = 0; i < jdKeys.length; i++) {
            if (result.value.test(jdKeys[i])) {
              evaluated.add(jdKeys[i]);
            }
          }
        }
      }
    }

    // additionalProperties - evaluates all non-properties/non-patternProperties keys
    if (currentSchema.additionalProperties !== undefined) {
      const propKeySet = new Set(isObject(currentSchema.properties) ? Object.keys(currentSchema.properties) : []);
      const patternRegexes: RegExp[] = [];
      if (isObject(currentSchema.patternProperties)) {
        for (const pattern of Object.keys(currentSchema.patternProperties)) {
          const result = compileSchemaRegex(pattern);
          if (result.ok) {
            patternRegexes.push(result.value);
          }
        }
      }
      const apKeys = Object.keys(jsonData);
      for (let i = 0; i < apKeys.length; i++) {
        const key = apKeys[i];
        if (propKeySet.has(key)) {
          continue;
        }
        let matchedPattern = false;
        for (let pi = 0; pi < patternRegexes.length; pi++) {
          if (patternRegexes[pi].test(key)) {
            matchedPattern = true;
            break;
          }
        }
        if (matchedPattern) {
          continue;
        }
        evaluated.add(key);
      }
    }

    // dependentSchemas - only applies when the dependency key is present in the data
    if (isObject(currentSchema.dependentSchemas)) {
      for (const [depKey, depSchema] of Object.entries(currentSchema.dependentSchemas as Record<string, unknown>)) {
        if (Object.hasOwn(jsonData, depKey) && merge(recurse(depSchema as JsonSchemaInternal | boolean))) {
          return 'all';
        }
      }
    }

    // unevaluatedProperties: true in a sub-schema means all props are evaluated
    if (currentSchema.unevaluatedProperties === true) {
      return 'all';
    }
  }

  // --- Shared combinator traversal ---

  // allOf
  if (Array.isArray(currentSchema.allOf)) {
    for (let i = 0; i < currentSchema.allOf.length; i++) {
      if (merge(recurse(currentSchema.allOf[i]))) {
        return 'all';
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
      if (passed && merge(recurse(subSchema))) {
        return 'all';
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
      if (passed && merge(recurse(subSchema))) {
        return 'all';
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
      if (merge(recurse(currentSchema.if))) {
        return 'all';
      }
      if (currentSchema.then !== undefined && merge(recurse(currentSchema.then))) {
        return 'all';
      }
    } else if (currentSchema.else !== undefined && merge(recurse(currentSchema.else))) {
      return 'all';
    }
  }

  // $ref resolved
  if (
    currentSchema.__$refResolved &&
    currentSchema.__$refResolved !== currentSchema &&
    merge(recurse(currentSchema.__$refResolved))
  ) {
    return 'all';
  }

  // $recursiveRef
  const recursiveTarget = resolveRecursiveRef(currentSchema, report.__$recursiveAnchorStack);
  if (recursiveTarget && recursiveTarget !== currentSchema && merge(recurse(recursiveTarget))) {
    return 'all';
  }

  // $dynamicRef
  const dynamicTarget = resolveDynamicRef(currentSchema, report.__$dynamicScopeStack);
  if (dynamicTarget && dynamicTarget !== currentSchema && merge(recurse(dynamicTarget))) {
    return 'all';
  }

  return evaluated;
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

  if (json.length === 0) {
    return;
  }

  const evaluatedItems = collectEvaluated(ctx, {
    report,
    currentSchema: schema,
    json,
    mode: 'items',
    jsonArr: json,
    depth: 0,
  });

  if (evaluatedItems === 'all') {
    return;
  }

  const unevaluatedIndices: number[] = [];
  for (let i = 0; i < json.length; i++) {
    if (!evaluatedItems.has(i)) {
      unevaluatedIndices.push(i);
    }
  }

  if (unevaluatedIndices.length === 0) {
    return;
  }

  if (unevalSchema === false) {
    report.addError('ARRAY_UNEVALUATED_ITEMS', undefined, undefined, schema, 'unevaluatedItems');
  } else {
    // unevaluatedItems as a schema — validate each unevaluated item against it
    // A sub-report that already has an error decides immediately, even with its own or earlier async work
    // pending: errors are never removed and only one error is ever emitted, so waiting cannot change the outcome.
    let pendingReports: Report[] | undefined;
    for (let i = 0; i < unevaluatedIndices.length; i++) {
      const idx = unevaluatedIndices[i];
      const subReport = Report.createSubReport(report);
      ctx._jsonValidate(subReport, unevalSchema, json[idx]);
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

  const evaluatedProperties = collectEvaluated(ctx, {
    report,
    currentSchema: schema,
    json,
    mode: 'properties',
    jsonData: json as Record<string, unknown>,
    depth: 0,
  });

  if (evaluatedProperties === 'all') {
    return;
  }

  const unevaluatedKeys: string[] = [];
  for (let i = 0; i < allKeys.length; i++) {
    if (!evaluatedProperties.has(allKeys[i])) {
      unevaluatedKeys.push(allKeys[i]);
    }
  }

  if (unevaluatedKeys.length === 0) {
    return;
  }

  if (unevalSchema === false) {
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
    for (let i = 0; i < unevaluatedKeys.length; i++) {
      const key = unevaluatedKeys[i];
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
