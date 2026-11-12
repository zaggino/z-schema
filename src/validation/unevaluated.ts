import type { JsonSchemaInternal } from '../json-schema-versions.js';
import type { ZSchemaBase } from '../z-schema-base.js';
import type { BuildState, Check, FastValidator } from './fast-shared.js';

import { Report } from '../report.js';
import { compileSchemaRegex } from '../utils/schema-regex.js';
import { isObject } from '../utils/what-is.js';
import { unsupported } from './fast-shared.js';
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

// ---------------------------------------------------------------------------
// Fast validator compilers
// ---------------------------------------------------------------------------

type EvaluatedMode = 'items' | 'properties';

/** Build-time twin of one `collectEvaluated` visit; `true` means everything counts as evaluated. */
type Collector = (
  json: unknown,
  dataKeys: string[] | undefined,
  evaluated: Set<number | string>,
  depth: number
) => boolean;

interface CollectorMemo {
  readonly items: Map<object, Collector>;
  readonly properties: Map<object, Collector>;
}

/**
 * Thrown by a collector past the recursion limit. The interpreter reports an error there, so the fast validator
 * must not decide that instance: `_fastAccepts` catches the throw and hands the instance to the interpreter.
 */
const COLLECT_DEPTH_EXCEEDED = new Error('collectEvaluated depth exceeded');

/** A boolean or missing sub-schema: contributes nothing. */
const NOTHING: Collector = () => false;

// Collectors are memoised per build and mode. A WeakMap keyed by the build state keeps the memo private to this module.
const collectorMemos = new WeakMap<BuildState, CollectorMemo>();

function memoFor(state: BuildState): CollectorMemo {
  let memo = collectorMemos.get(state);
  if (memo === undefined) {
    memo = { items: new Map<object, Collector>(), properties: new Map<object, Collector>() };
    collectorMemos.set(state, memo);
  }
  return memo;
}

function collectorFor(state: BuildState, node: unknown, mode: EvaluatedMode): Collector {
  if (!node || typeof node === 'boolean') {
    return NOTHING;
  }
  if (typeof node !== 'object' || Array.isArray(node)) {
    return unsupported();
  }
  const schema = node as JsonSchemaInternal;
  const memo = mode === 'items' ? memoFor(state).items : memoFor(state).properties;
  const known = memo.get(schema);
  if (known !== undefined) {
    return known;
  }
  // Registered before descending so a $ref cycle terminates.
  const slot = { fn: NOTHING };
  memo.set(schema, (json, dataKeys, evaluated, depth) => slot.fn(json, dataKeys, evaluated, depth));

  // The interpreter follows these through dynamic scope stacks, which the fast validator does not model.
  if (schema.$recursiveRef !== undefined || schema.$dynamicRef !== undefined) {
    return unsupported();
  }
  const maxDepth = state.ctx.options.maxRecursionDepth ?? 100;
  const tail = compileTail(state, schema, mode);
  const built =
    mode === 'items'
      ? compileItemsCollector(state, schema, maxDepth, tail)
      : compilePropertiesCollector(state, schema, maxDepth, tail);
  slot.fn = built;
  memo.set(schema, built);
  return built;
}

/** The combinator and `$ref` traversal shared by both modes; `undefined` when the node has none. */
function compileTail(state: BuildState, node: JsonSchemaInternal, mode: EvaluatedMode): Collector | undefined {
  const allOf: Collector[] = [];
  if (Array.isArray(node.allOf)) {
    for (let i = 0; i < node.allOf.length; i++) {
      const collect = collectorFor(state, node.allOf[i], mode);
      if (collect !== NOTHING) {
        allOf.push(collect);
      }
    }
  }

  // anyOf / oneOf: only members that pass contribute; a member that contributes nothing needs no pass check at run time
  const anyOfChecks: FastValidator[] = [];
  const anyOfCollectors: Collector[] = [];
  const oneOfChecks: FastValidator[] = [];
  const oneOfCollectors: Collector[] = [];
  const groups: Array<[unknown, FastValidator[], Collector[]]> = [
    [node.anyOf, anyOfChecks, anyOfCollectors],
    [node.oneOf, oneOfChecks, oneOfCollectors],
  ];
  for (let g = 0; g < groups.length; g++) {
    const [members, checks, collectors] = groups[g];
    if (!Array.isArray(members)) {
      continue;
    }
    for (let i = 0; i < members.length; i++) {
      const check = state.compileChild(members[i]);
      const collect = collectorFor(state, members[i], mode);
      if (collect !== NOTHING) {
        checks.push(check);
        collectors.push(collect);
      }
    }
  }

  let ifCheck: FastValidator | undefined;
  let ifCollector: Collector = NOTHING;
  let thenCollector: Collector | undefined;
  let elseCollector: Collector | undefined;
  if (node.if !== undefined) {
    ifCheck = state.compileChild(node.if);
    ifCollector = collectorFor(state, node.if, mode);
    thenCollector = node.then === undefined ? undefined : collectorFor(state, node.then, mode);
    elseCollector = node.else === undefined ? undefined : collectorFor(state, node.else, mode);
  }

  const resolved = node.__$refResolved as unknown;
  const refCollector = resolved && resolved !== node ? collectorFor(state, resolved, mode) : undefined;

  if (
    allOf.length === 0 &&
    anyOfChecks.length === 0 &&
    oneOfChecks.length === 0 &&
    ifCheck === undefined &&
    refCollector === undefined
  ) {
    return undefined;
  }

  return (json, dataKeys, evaluated, depth) => {
    const next = depth + 1;
    for (let i = 0; i < allOf.length; i++) {
      if (allOf[i](json, dataKeys, evaluated, next)) {
        return true;
      }
    }
    for (let i = 0; i < anyOfChecks.length; i++) {
      if (anyOfChecks[i](json) && anyOfCollectors[i](json, dataKeys, evaluated, next)) {
        return true;
      }
    }
    for (let i = 0; i < oneOfChecks.length; i++) {
      if (oneOfChecks[i](json) && oneOfCollectors[i](json, dataKeys, evaluated, next)) {
        return true;
      }
    }
    if (ifCheck !== undefined) {
      if (ifCheck(json)) {
        if (ifCollector(json, dataKeys, evaluated, next)) {
          return true;
        }
        if (thenCollector !== undefined && thenCollector(json, dataKeys, evaluated, next)) {
          return true;
        }
      } else if (elseCollector !== undefined && elseCollector(json, dataKeys, evaluated, next)) {
        return true;
      }
    }
    return refCollector !== undefined && refCollector(json, dataKeys, evaluated, next);
  };
}

function compileItemsCollector(
  state: BuildState,
  node: JsonSchemaInternal,
  maxDepth: number,
  tail: Collector | undefined
): Collector {
  const prefixCount = Array.isArray(node.prefixItems) ? node.prefixItems.length : 0;
  let tupleCount = 0;
  let all = false;
  const { items } = node;
  if (items !== undefined) {
    if (Array.isArray(items)) {
      tupleCount = items.length;
      if (node.additionalItems !== undefined && node.additionalItems !== false) {
        all = true;
      }
    } else if (items !== false) {
      all = true;
    }
  }
  if (node.unevaluatedItems === true) {
    all = true;
  }
  if (all) {
    // the interpreter returns before it reaches the contains pass and the combinators
    return (_json, _dataKeys, _evaluated, depth) => {
      if (depth > maxDepth) {
        throw COLLECT_DEPTH_EXCEEDED;
      }
      return true;
    };
  }
  const leading = prefixCount > tupleCount ? prefixCount : tupleCount;
  const containsCheck = node.contains === undefined ? undefined : state.compileChild(node.contains);

  return (json, _dataKeys, evaluated, depth) => {
    if (depth > maxDepth) {
      throw COLLECT_DEPTH_EXCEEDED;
    }
    const arr = json as unknown[];
    const { length } = arr;
    const lead = leading < length ? leading : length;
    for (let i = 0; i < lead; i++) {
      evaluated.add(i);
    }
    if (containsCheck !== undefined) {
      for (let i = 0; i < length; i++) {
        if (containsCheck(arr[i])) {
          evaluated.add(i);
        }
      }
    }
    return tail !== undefined && tail(json, undefined, evaluated, depth);
  };
}

function compilePropertiesCollector(
  state: BuildState,
  node: JsonSchemaInternal,
  maxDepth: number,
  tail: Collector | undefined
): Collector {
  const schemaProps = node.properties as Record<string, unknown> | undefined;
  const hasProps = isObject(schemaProps);
  const propKeys = hasProps ? Object.keys(schemaProps) : [];

  let patternRegexes: RegExp[] | undefined;
  if (isObject(node.patternProperties)) {
    patternRegexes = [];
    const patterns = Object.keys(node.patternProperties);
    for (let i = 0; i < patterns.length; i++) {
      const result = compileSchemaRegex(patterns[i]);
      if (result.ok) {
        patternRegexes.push(result.value);
      }
    }
  }

  const hasAdditional = node.additionalProperties !== undefined;

  const depKeys: string[] = [];
  const depCollectors: Collector[] = [];
  if (isObject(node.dependentSchemas)) {
    const schemas = node.dependentSchemas as Record<string, unknown>;
    const names = Object.keys(schemas);
    for (let i = 0; i < names.length; i++) {
      const collect = collectorFor(state, schemas[names[i]], 'properties');
      if (collect !== NOTHING) {
        depKeys.push(names[i]);
        depCollectors.push(collect);
      }
    }
  }
  const unevaluatedTrue = node.unevaluatedProperties === true;

  return (json, dataKeys, evaluated, depth) => {
    if (depth > maxDepth) {
      throw COLLECT_DEPTH_EXCEEDED;
    }
    const data = json as Record<string, unknown>;
    const keys = dataKeys!;

    for (let i = 0; i < propKeys.length; i++) {
      if (Object.hasOwn(data, propKeys[i])) {
        evaluated.add(propKeys[i]);
      }
    }

    if (patternRegexes !== undefined) {
      for (let pi = 0; pi < patternRegexes.length; pi++) {
        const regex = patternRegexes[pi];
        for (let i = 0; i < keys.length; i++) {
          if (regex.test(keys[i])) {
            evaluated.add(keys[i]);
          }
        }
      }
    }

    if (hasAdditional) {
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
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
        if (!matchedPattern) {
          evaluated.add(key);
        }
      }
    }

    for (let i = 0; i < depKeys.length; i++) {
      if (Object.hasOwn(data, depKeys[i]) && depCollectors[i](json, dataKeys, evaluated, depth + 1)) {
        return true;
      }
    }

    if (unevaluatedTrue) {
      return true;
    }
    return tail !== undefined && tail(json, dataKeys, evaluated, depth);
  };
}

/** Twin of {@link unevaluatedItemsValidator}. */
export function compileUnevaluatedItems(state: BuildState, node: JsonSchemaInternal, checks: Check[]): void {
  const keyword = node.unevaluatedItems as unknown;
  if (keyword === undefined || keyword === true) {
    return;
  }
  const unevaluated = keyword === false ? undefined : state.compileChild(keyword);
  const collect = collectorFor(state, node, 'items');

  checks.push((json) => {
    if (!Array.isArray(json)) {
      return true;
    }
    const { length } = json;
    if (length === 0) {
      return true;
    }
    const evaluated = new Set<number | string>();
    if (collect(json, undefined, evaluated, 0)) {
      return true;
    }
    for (let i = 0; i < length; i++) {
      if (evaluated.has(i)) {
        continue;
      }
      if (unevaluated === undefined || !unevaluated(json[i])) {
        return false;
      }
    }
    return true;
  });
}

/** Twin of {@link unevaluatedPropertiesValidator}. */
export function compileUnevaluatedProperties(state: BuildState, node: JsonSchemaInternal, checks: Check[]): void {
  const keyword = node.unevaluatedProperties as unknown;
  if (keyword === undefined || keyword === true) {
    return;
  }
  const unevaluated = keyword === false ? undefined : state.compileChild(keyword);
  const collect = collectorFor(state, node, 'properties');

  checks.push((json) => {
    if (!isObject(json)) {
      return true;
    }
    const keys = Object.keys(json);
    if (keys.length === 0) {
      return true;
    }
    const evaluated = new Set<number | string>();
    if (collect(json, keys, evaluated, 0)) {
      return true;
    }
    for (let i = 0; i < keys.length; i++) {
      if (evaluated.has(keys[i])) {
        continue;
      }
      if (unevaluated === undefined || !unevaluated((json as Record<string, unknown>)[keys[i]])) {
        return false;
      }
    }
    return true;
  });
}
