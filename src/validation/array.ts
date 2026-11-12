import type { JsonSchemaInternal } from '../json-schema-versions.js';
import type { ZSchemaBase } from '../z-schema-base.js';
import type { BuildState, Check, RawNode } from './fast-shared.js';

import { Report } from '../report.js';
import { isUniqueArray } from '../utils/array.js';
import { ALWAYS_TRUE, expectNumber } from './fast-shared.js';
import {
  cacheValidationResult,
  deferOrRunSync,
  honouredPrefixItems,
  shouldSkipValidate,
  supportsContainsBounds,
} from './shared.js';

// ---------------------------------------------------------------------------
// additionalItems
// ---------------------------------------------------------------------------

export function additionalItemsValidator(ctx: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
  // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.3.1.2
  if (shouldSkipValidate(ctx.validateOptions, ['ARRAY_ADDITIONAL_ITEMS'])) {
    return;
  }
  if (!Array.isArray(json)) {
    return;
  }
  // if the value of "additionalItems" is boolean value false and the value of "items" is an array,
  // the json is valid if its size is less than, or equal to, the size of "items".
  if (schema.additionalItems === false && Array.isArray(schema.items) && json.length > schema.items.length) {
    report.addError('ARRAY_ADDITIONAL_ITEMS', undefined, undefined, schema, 'additionalItems');
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

export function maxItemsValidator(ctx: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
  // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.3.2.2
  if (shouldSkipValidate(ctx.validateOptions, ['ARRAY_LENGTH_LONG'])) {
    return;
  }
  if (!Array.isArray(json)) {
    return;
  }
  if (json.length > schema.maxItems!) {
    report.addError('ARRAY_LENGTH_LONG', [json.length, schema.maxItems!], undefined, schema, 'maxItems');
  }
}

export function compileMaxItems(_state: BuildState, node: JsonSchemaInternal, checks: Check[]): void {
  const maxItems = expectNumber(node.maxItems);
  checks.push((json) => !Array.isArray(json) || !(json.length > maxItems));
}

// ---------------------------------------------------------------------------
// minItems
// ---------------------------------------------------------------------------

export function minItemsValidator(ctx: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
  // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.3.3.2
  if (shouldSkipValidate(ctx.validateOptions, ['ARRAY_LENGTH_SHORT'])) {
    return;
  }
  if (!Array.isArray(json)) {
    return;
  }
  if (json.length < schema.minItems!) {
    report.addError('ARRAY_LENGTH_SHORT', [json.length, schema.minItems!], undefined, schema, 'minItems');
  }
}

export function compileMinItems(_state: BuildState, node: JsonSchemaInternal, checks: Check[]): void {
  const minItems = expectNumber(node.minItems);
  checks.push((json) => !Array.isArray(json) || !(json.length < minItems));
}

// ---------------------------------------------------------------------------
// uniqueItems
// ---------------------------------------------------------------------------

export function uniqueItemsValidator(ctx: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
  // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.3.4.2
  if (shouldSkipValidate(ctx.validateOptions, ['ARRAY_UNIQUE'])) {
    return;
  }
  if (!Array.isArray(json)) {
    return;
  }
  if (schema.uniqueItems === true) {
    const matches: any[] = [];
    if (!isUniqueArray(json, matches, ctx.options.maxRecursionDepth)) {
      report.addError('ARRAY_UNIQUE', matches, undefined, schema, 'uniqueItems');
    }
  }
}

export function compileUniqueItems(state: BuildState, node: JsonSchemaInternal, checks: Check[]): void {
  if (node.uniqueItems !== true) {
    return;
  }
  const maxDepth = state.ctx.options.maxRecursionDepth;
  checks.push((json) => !Array.isArray(json) || isUniqueArray(json, undefined, maxDepth));
}

// ---------------------------------------------------------------------------
// contains
// ---------------------------------------------------------------------------

export function containsValidator(ctx: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
  if (shouldSkipValidate(ctx.validateOptions, ['CONTAINS'])) {
    return;
  }

  if (!Array.isArray(json)) {
    return;
  }

  const containsSchema = schema.contains;
  if (containsSchema === undefined) {
    return;
  }

  const subReports: Report[] = [];
  for (let idx = 0; idx < json.length; idx++) {
    const subReport = Report.createSubReport(report);
    subReports.push(subReport);
    ctx._jsonValidate(subReport, containsSchema, json[idx]);
  }

  const addContainsErrorIfNeeded = () => {
    let matchingItems = 0;
    for (let i = 0; i < subReports.length; i++) {
      cacheValidationResult(report, containsSchema, json[i], subReports[i].errors.length === 0);
      if (subReports[i].errors.length === 0) {
        matchingItems += 1;
      }
    }

    const boundsHonoured = supportsContainsBounds(ctx.options.version);
    const minContains: number =
      boundsHonoured && typeof schema.minContains === 'number' ? (schema.minContains ?? 1) : 1;
    const maxContains = boundsHonoured && typeof schema.maxContains === 'number' ? schema.maxContains : undefined;

    const hasEnoughMatches = matchingItems >= minContains;
    const notTooManyMatches = maxContains === undefined || matchingItems <= maxContains;

    if (!hasEnoughMatches || !notTooManyMatches) {
      report.addError('CONTAINS', undefined, subReports, schema);
    }
  };

  deferOrRunSync(ctx, report, subReports, addContainsErrorIfNeeded);
}

// contains, with minContains / maxContains (honoured on 2019-09 and later only)
export function compileContains(state: BuildState, node: JsonSchemaInternal, checks: Check[]): void {
  const raw = node as unknown as RawNode;
  if (raw.contains === undefined) {
    return;
  }
  const each = state.compileChild(raw.contains);
  const { version } = state.ctx.options;
  const supportsBounds = supportsContainsBounds(version);
  const min = supportsBounds && typeof raw.minContains === 'number' ? raw.minContains : 1;
  const max = supportsBounds && typeof raw.maxContains === 'number' ? raw.maxContains : undefined;

  if (max === undefined) {
    if (min <= 0) {
      // always satisfied; the sub-schema was still compiled so an unsupported one rejects the build
      return;
    }
    checks.push((json) => {
      if (!Array.isArray(json)) {
        return true;
      }
      let matches = 0;
      for (let i = 0; i < json.length; i++) {
        if (each(json[i]) && ++matches >= min) {
          return true;
        }
      }
      return false;
    });
    return;
  }
  checks.push((json) => {
    if (!Array.isArray(json)) {
      return true;
    }
    let matches = 0;
    for (let i = 0; i < json.length; i++) {
      if (each(json[i])) {
        matches++;
        if (matches > max) {
          return false;
        }
      }
    }
    return matches >= min;
  });
}

// ---------------------------------------------------------------------------
// maxContains / minContains  (no-op — handled inside contains)
// ---------------------------------------------------------------------------

export function maxContainsValidator() {
  // no-op: maxContains is evaluated inside the `contains` validator
}
export function minContainsValidator() {
  // no-op: minContains is evaluated inside the `contains` validator
}

// ---------------------------------------------------------------------------
// fast-validator compiler: items / prefixItems / additionalItems
// ---------------------------------------------------------------------------

// Compiled together because they select the child schema per index. Must agree with `recurseArray`
// (json-validation.ts) and `additionalItemsValidator`.
export function compileItemKeywords(state: BuildState, node: JsonSchemaInternal, checks: Check[]): void {
  const raw = node as unknown as RawNode;
  const { items, additionalItems } = raw;

  if (additionalItems === false && Array.isArray(items)) {
    const tupleLength = items.length;
    checks.push((json) => !Array.isArray(json) || !(json.length > tupleLength));
  }

  let head: unknown[] | undefined;
  let tail: unknown;
  const prefixItems = honouredPrefixItems(node, state.ctx.options.version);
  if (prefixItems !== undefined) {
    head = prefixItems;
    if (items !== undefined && !Array.isArray(items)) {
      tail = items;
    }
  } else if (Array.isArray(items)) {
    head = items;
    if (typeof additionalItems === 'object') {
      tail = additionalItems;
    }
  } else if (typeof items === 'object' || typeof items === 'boolean') {
    tail = items;
  }

  const headChecks: Check[] = [];
  if (head !== undefined) {
    for (let i = 0; i < head.length; i++) {
      headChecks.push(state.compileChild(head[i]));
    }
  }
  let tailCheck: Check | undefined;
  if (tail !== undefined) {
    tailCheck = state.compileChild(tail);
    if (tailCheck === ALWAYS_TRUE) {
      tailCheck = undefined;
    }
  }

  const headCount = headChecks.length;
  if (headCount === 0) {
    if (tailCheck === undefined) {
      return;
    }
    const each = tailCheck;
    checks.push((json) => {
      if (!Array.isArray(json)) {
        return true;
      }
      for (let i = 0; i < json.length; i++) {
        if (!each(json[i])) {
          return false;
        }
      }
      return true;
    });
    return;
  }
  const rest = tailCheck;
  checks.push((json) => {
    if (!Array.isArray(json)) {
      return true;
    }
    const { length } = json;
    const headEnd = length < headCount ? length : headCount;
    for (let i = 0; i < headEnd; i++) {
      if (!headChecks[i](json[i])) {
        return false;
      }
    }
    if (rest !== undefined) {
      for (let i = headEnd; i < length; i++) {
        if (!rest(json[i])) {
          return false;
        }
      }
    }
    return true;
  });
}
