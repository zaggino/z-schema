import type { JsonSchema, JsonSchemaAll, JsonSchemaInternal, JsonSchemaVersion } from './json-schema-versions.js';
import type { ValidateOptions, ZSchemaBase } from './z-schema-base.js';

import { getFormatValidators } from './format-validators.js';
import { findId, getId } from './json-schema.js';
import { Report } from './report.js';
import { difference, isUniqueArray } from './utils/array.js';
import { decodeBase64, isValidBase64 } from './utils/base64.js';
import { shallowClone } from './utils/clone.js';
import { areEqual } from './utils/json.js';
import { compileSchemaRegex } from './utils/schema-regex.js';
import { unicodeLength } from './utils/unicode.js';
import { getRemotePath } from './utils/uri.js';
import { isObject, whatIs } from './utils/what-is.js';

const shouldSkipValidate = function (options: ValidateOptions, errors: any) {
  return (
    options &&
    Array.isArray(options.includeErrors) &&
    options.includeErrors.length > 0 &&
    !errors.some(function (err: any) {
      return options.includeErrors!.includes(err);
    })
  );
};

const supportsDependentKeywords = (schema: JsonSchemaInternal, version: JsonSchemaVersion | 'none' | undefined) => {
  if (typeof schema.$schema === 'string') {
    return !/draft-04|draft-06|draft-07/.test(schema.$schema);
  }
  return !(version === 'draft-04' || version === 'draft-06' || version === 'draft-07');
};

const VOCAB_VALIDATION_2019_09 = 'https://json-schema.org/draft/2019-09/vocab/validation';
const VOCAB_VALIDATION_2020_12 = 'https://json-schema.org/draft/2020-12/vocab/validation';

const VOCAB_FORMAT_2019_09 = 'https://json-schema.org/draft/2019-09/vocab/format';
const VOCAB_FORMAT_ASSERTION_2020_12 = 'https://json-schema.org/draft/2020-12/vocab/format-assertion';

const VALIDATION_VOCAB_KEYWORDS = new Set<keyof JsonSchemaAll>([
  'type',
  'multipleOf',
  'maximum',
  'exclusiveMaximum',
  'minimum',
  'exclusiveMinimum',
  'maxLength',
  'minLength',
  'pattern',
  'maxItems',
  'minItems',
  'uniqueItems',
  'maxContains',
  'minContains',
  'maxProperties',
  'minProperties',
  'required',
  'dependentRequired',
  'enum',
  'const',
  'contentEncoding',
  'contentMediaType',
]);

const isValidationVocabularyEnabled = (
  schema: JsonSchemaInternal,
  report: Report,
  version: JsonSchemaVersion | 'none' | undefined
) => {
  if (version !== 'draft2019-09' && version !== 'draft2020-12') {
    return true;
  }

  const currentSchemaMeta = schema.__$schemaResolved;
  const rootSchemaMeta =
    report.rootSchema && typeof report.rootSchema !== 'boolean' ? report.rootSchema.__$schemaResolved : undefined;
  const metaSchema = (currentSchemaMeta || rootSchemaMeta) as JsonSchemaInternal | boolean | undefined;

  if (!metaSchema || typeof metaSchema !== 'object' || !isObject(metaSchema.$vocabulary)) {
    return true;
  }

  const vocabulary = metaSchema.$vocabulary as Record<string, boolean>;
  const has2019 = Object.hasOwn(vocabulary, VOCAB_VALIDATION_2019_09);
  const has2020 = Object.hasOwn(vocabulary, VOCAB_VALIDATION_2020_12);

  if (has2019 || has2020) {
    return vocabulary[VOCAB_VALIDATION_2019_09] === true || vocabulary[VOCAB_VALIDATION_2020_12] === true;
  }

  return false;
};

/**
 * Checks whether the format-assertion vocabulary is enabled in the meta-schema.
 * For draft 2019-09: checks if the format vocabulary is set to true.
 * For draft 2020-12: checks if the format-assertion vocabulary is present and true.
 * Returns true for older drafts (format was always an assertion).
 */
const isFormatAssertionVocabEnabled = (
  schema: JsonSchemaInternal,
  report: Report,
  version: JsonSchemaVersion | 'none' | undefined
): boolean => {
  if (version !== 'draft2019-09' && version !== 'draft2020-12') {
    return true; // older drafts always assert format
  }

  const currentSchemaMeta = schema.__$schemaResolved;
  const rootSchemaMeta =
    report.rootSchema && typeof report.rootSchema !== 'boolean' ? report.rootSchema.__$schemaResolved : undefined;
  const metaSchema = (currentSchemaMeta || rootSchemaMeta) as JsonSchemaInternal | boolean | undefined;

  if (!metaSchema || typeof metaSchema !== 'object' || !isObject(metaSchema.$vocabulary)) {
    return false; // no vocabulary info, default to annotation-only for modern drafts
  }

  const vocabulary = metaSchema.$vocabulary as Record<string, boolean>;

  // For draft 2020-12, only the format-assertion vocabulary enables format as assertion
  if (Object.hasOwn(vocabulary, VOCAB_FORMAT_ASSERTION_2020_12)) {
    return vocabulary[VOCAB_FORMAT_ASSERTION_2020_12] === true;
  }

  // For draft 2019-09, check if the format vocabulary is enabled (true)
  if (Object.hasOwn(vocabulary, VOCAB_FORMAT_2019_09)) {
    return vocabulary[VOCAB_FORMAT_2019_09] === true;
  }

  return false; // default to annotation-only for modern drafts
};

type JsonValidatorFn = (this: ZSchemaBase, report: Report, schema: JsonSchema, json: unknown) => void;

function cacheValidationResult(report: Report, schema: unknown, json: unknown, passed: boolean): void {
  let schemaMap = report.__validationResultCache.get(schema);
  if (!schemaMap) {
    schemaMap = new Map();
    report.__validationResultCache.set(schema, schemaMap);
  }
  schemaMap.set(json, passed);
}

function getCachedValidationResult(report: Report, schema: unknown, json: unknown): boolean | undefined {
  return report.__validationResultCache.get(schema)?.get(json);
}

/**
 * Shared async-task aggregation pattern.
 *
 * 1. Collects async tasks from `subReports` into `report`.
 * 2. If new async tasks were added, defers `decisionFn` via `report.addAsyncTask`
 *    with proper path save/restore so error paths are correct.
 * 3. Otherwise, runs `decisionFn` synchronously.
 */
function deferOrRunSync(report: Report, subReports: Report[], decisionFn: () => void): void {
  const asyncTasksBefore = report.asyncTasks.length;
  for (const subReport of subReports) {
    report.asyncTasks.push(...subReport.asyncTasks);
  }
  const hasAsyncTasks = report.asyncTasks.length > asyncTasksBefore;

  if (hasAsyncTasks) {
    const pathBeforeAsync = shallowClone(report.path);
    report.addAsyncTask(
      (callback) => {
        setTimeout(() => callback(null), 0);
      },
      [] as any,
      () => {
        const backup = report.path;
        report.path = pathBeforeAsync;
        decisionFn();
        report.path = backup;
      }
    );
  } else {
    decisionFn();
  }
}

const getDynamicRefAnchorName = (dynamicRef: string) => {
  const hashIdx = dynamicRef.indexOf('#');
  if (hashIdx === -1) {
    return undefined;
  }
  const fragment = dynamicRef.slice(hashIdx + 1);
  if (!fragment || fragment[0] === '/') {
    return undefined;
  }
  return fragment;
};

const findDynamicAnchorInScope = (scopeSchema: JsonSchemaInternal, anchorName: string) => {
  const scopeId = getId(scopeSchema);
  const scopeBaseUri = scopeId ? getRemotePath(scopeId) : undefined;
  const found = findId(scopeSchema, anchorName, scopeBaseUri, scopeBaseUri);
  if (found && found.$dynamicAnchor === anchorName) {
    return found;
  }
  return undefined;
};

/**
 * Resolves the effective target for a $recursiveRef, walking the recursive anchor stack.
 */
const resolveRecursiveRef = (
  schema: JsonSchemaInternal,
  recursiveAnchorStack: JsonSchemaInternal[]
): JsonSchemaInternal | undefined => {
  const resolved = schema.__$recursiveRefResolved as JsonSchemaInternal | undefined;
  if (!resolved) {
    return undefined;
  }
  let target = resolved;
  if (typeof target === 'object' && target.$recursiveAnchor === true) {
    const dynamicTarget = recursiveAnchorStack[0];
    if (dynamicTarget) {
      target = dynamicTarget;
    }
  }
  return target;
};

/**
 * Resolves the effective target for a $dynamicRef, walking the dynamic scope stack.
 */
const resolveDynamicRef = (
  schema: JsonSchemaInternal,
  dynamicScopeStack: JsonSchemaInternal[]
): JsonSchemaInternal | boolean | undefined => {
  const resolved = schema.__$dynamicRefResolved as JsonSchemaInternal | boolean | undefined;
  if (typeof resolved === 'undefined' || !schema.$dynamicRef) {
    return resolved;
  }
  let target = resolved;
  const anchorName = getDynamicRefAnchorName(schema.$dynamicRef);
  if (anchorName && typeof target === 'object' && target.$dynamicAnchor === anchorName) {
    for (let scopeIdx = 0; scopeIdx < dynamicScopeStack.length; scopeIdx++) {
      const scopeSchema = dynamicScopeStack[scopeIdx];
      const scopedTarget = findDynamicAnchorInScope(scopeSchema, anchorName);
      if (scopedTarget) {
        target = scopedTarget;
        break;
      }
    }
  }
  return target;
};

// --- Unified collectEvaluated traversal for unevaluatedItems / unevaluatedProperties ---

type CollectEvaluatedItemsArgs = {
  report: Report;
  currentSchema: JsonSchemaInternal | boolean | undefined;
  json: unknown;
  mode: 'items';
  jsonArr: unknown[];
  depth: number;
};

type CollectEvaluatedPropertiesArgs = {
  report: Report;
  currentSchema: JsonSchemaInternal | boolean | undefined;
  json: unknown;
  mode: 'properties';
  jsonData: Record<string, unknown>;
  depth: number;
};

type CollectEvaluatedArgs = CollectEvaluatedItemsArgs | CollectEvaluatedPropertiesArgs;

function collectEvaluated(this: ZSchemaBase, args: CollectEvaluatedArgs): Set<number | string> | 'all' {
  const { report, currentSchema, json, mode, depth } = args;

  if (!currentSchema || typeof currentSchema === 'boolean') {
    return new Set();
  }

  if (depth > (this.options.maxRecursionDepth ?? 100)) {
    report.addError('COLLECT_EVALUATED_DEPTH_EXCEEDED', [depth]);
    return new Set();
  }

  const evaluated = new Set<number | string>();

  const merge = (other: Set<number | string> | 'all') => {
    if (other === 'all') return true;
    for (const v of other) {
      evaluated.add(v);
    }
    return false;
  };

  const recurse = (subSchema: JsonSchemaInternal | boolean | undefined): Set<number | string> | 'all' => {
    if (mode === 'items') {
      return collectEvaluated.call(this, {
        report,
        currentSchema: subSchema,
        json,
        mode: 'items',
        jsonArr: (args as CollectEvaluatedItemsArgs).jsonArr,
        depth: depth + 1,
      });
    }
    return collectEvaluated.call(this, {
      report,
      currentSchema: subSchema,
      json,
      mode: 'properties',
      jsonData: (args as CollectEvaluatedPropertiesArgs).jsonData,
      depth: depth + 1,
    });
  };

  // --- Mode-specific leaf collection ---
  if (mode === 'items') {
    const jsonArr = (args as CollectEvaluatedItemsArgs).jsonArr;

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
          const subReport = new Report(report);
          validate.call(this, subReport, currentSchema.contains as JsonSchemaInternal | boolean, jsonArr[i]);
          passed = subReport.errors.length === 0;
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
    const jsonData = (args as CollectEvaluatedPropertiesArgs).jsonData;

    // properties
    if (isObject(currentSchema.properties)) {
      for (const key of Object.keys(currentSchema.properties)) {
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
          for (const key of Object.keys(jsonData)) {
            if (result.value.test(key)) {
              evaluated.add(key);
            }
          }
        }
      }
    }

    // additionalProperties - evaluates all non-properties/non-patternProperties keys
    if (currentSchema.additionalProperties !== undefined) {
      const propKeys = isObject(currentSchema.properties) ? Object.keys(currentSchema.properties) : [];
      const patternRegexes: RegExp[] = [];
      if (isObject(currentSchema.patternProperties)) {
        for (const pattern of Object.keys(currentSchema.patternProperties)) {
          const result = compileSchemaRegex(pattern);
          if (result.ok) {
            patternRegexes.push(result.value);
          }
        }
      }
      for (const key of Object.keys(jsonData)) {
        if (propKeys.includes(key)) continue;
        if (patternRegexes.some((re) => re.test(key))) continue;
        evaluated.add(key);
      }
    }

    // dependentSchemas - only applies when the dependency key is present in the data
    if (isObject(currentSchema.dependentSchemas)) {
      for (const [depKey, depSchema] of Object.entries(currentSchema.dependentSchemas as Record<string, unknown>)) {
        if (Object.hasOwn(jsonData, depKey)) {
          if (merge(recurse(depSchema as JsonSchemaInternal | boolean))) {
            return 'all';
          }
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
    for (const subSchema of currentSchema.allOf) {
      if (merge(recurse(subSchema as JsonSchemaInternal | boolean))) {
        return 'all';
      }
    }
  }

  // anyOf - only matching branches contribute
  if (Array.isArray(currentSchema.anyOf)) {
    for (const subSchema of currentSchema.anyOf) {
      let passed = getCachedValidationResult(report, subSchema, json);
      if (passed === undefined) {
        const subReport = new Report(report);
        validate.call(this, subReport, subSchema as JsonSchemaInternal | boolean, json);
        passed = subReport.errors.length === 0;
      }
      if (passed) {
        if (merge(recurse(subSchema as JsonSchemaInternal | boolean))) {
          return 'all';
        }
      }
    }
  }

  // oneOf - only matching branches contribute
  if (Array.isArray(currentSchema.oneOf)) {
    for (const subSchema of currentSchema.oneOf) {
      let passed = getCachedValidationResult(report, subSchema, json);
      if (passed === undefined) {
        const subReport = new Report(report);
        validate.call(this, subReport, subSchema as JsonSchemaInternal | boolean, json);
        passed = subReport.errors.length === 0;
      }
      if (passed) {
        if (merge(recurse(subSchema as JsonSchemaInternal | boolean))) {
          return 'all';
        }
      }
    }
  }

  // if/then/else
  if (currentSchema.if !== undefined) {
    let condPassed = getCachedValidationResult(report, currentSchema.if, json);
    if (condPassed === undefined) {
      const condReport = new Report(report);
      validate.call(this, condReport, currentSchema.if as JsonSchemaInternal | boolean, json);
      condPassed = condReport.errors.length === 0;
    }
    if (condPassed) {
      if (merge(recurse(currentSchema.if as JsonSchemaInternal | boolean))) {
        return 'all';
      }
      if (currentSchema.then !== undefined) {
        if (merge(recurse(currentSchema.then as JsonSchemaInternal | boolean))) {
          return 'all';
        }
      }
    } else {
      if (currentSchema.else !== undefined) {
        if (merge(recurse(currentSchema.else as JsonSchemaInternal | boolean))) {
          return 'all';
        }
      }
    }
  }

  // $ref resolved
  if (currentSchema.__$refResolved && currentSchema.__$refResolved !== currentSchema) {
    if (merge(recurse(currentSchema.__$refResolved as JsonSchemaInternal))) {
      return 'all';
    }
  }

  // $recursiveRef
  const recursiveTarget = resolveRecursiveRef(currentSchema, report.__$recursiveAnchorStack);
  if (recursiveTarget && recursiveTarget !== currentSchema) {
    if (merge(recurse(recursiveTarget))) {
      return 'all';
    }
  }

  // $dynamicRef
  const dynamicTarget = resolveDynamicRef(currentSchema, report.__$dynamicScopeStack);
  if (dynamicTarget && dynamicTarget !== currentSchema) {
    if (merge(recurse(dynamicTarget as JsonSchemaInternal))) {
      return 'all';
    }
  }

  return evaluated;
}

export const JsonValidators: Record<keyof JsonSchemaAll, JsonValidatorFn> = {
  id: () => {},
  $id: () => {},
  $ref: () => {},
  $schema: () => {},
  $dynamicAnchor: () => {},
  $dynamicRef: () => {},
  $anchor: () => {},
  $defs: () => {},
  $vocabulary: () => {},
  $recursiveAnchor: () => {},
  $recursiveRef: () => {},
  examples: () => {},
  title: () => {},
  description: () => {},
  default: () => {},
  multipleOf: function (this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.1.1.2
    if (shouldSkipValidate(this.validateOptions, ['MULTIPLE_OF'])) {
      return;
    }
    if (typeof json !== 'number') {
      return;
    }

    const result = json / schema.multipleOf!;
    if (!Number.isFinite(result) || Math.abs(result - Math.round(result)) >= 1e-10) {
      report.addError('MULTIPLE_OF', [json, schema.multipleOf!], undefined, schema, 'multipleOf');
    }
  },
  maximum: function (this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.1.2.2
    if (shouldSkipValidate(this.validateOptions, ['MAXIMUM', 'MAXIMUM_EXCLUSIVE'])) {
      return;
    }
    if (typeof json !== 'number') {
      return;
    }
    if (schema.exclusiveMaximum !== true) {
      if (json > schema.maximum!) {
        report.addError('MAXIMUM', [json, schema.maximum!], undefined, schema, 'maximum');
      }
    } else {
      if (json >= schema.maximum!) {
        report.addError('MAXIMUM_EXCLUSIVE', [json, schema.maximum!], undefined, schema, 'maximum');
      }
    }
  },
  exclusiveMaximum: function (this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
    // In draft-06+, exclusiveMaximum is a standalone number
    if (typeof schema.exclusiveMaximum === 'number') {
      if (shouldSkipValidate(this.validateOptions, ['MAXIMUM_EXCLUSIVE'])) {
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
  },
  minimum: function (this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.1.3.2
    if (shouldSkipValidate(this.validateOptions, ['MINIMUM', 'MINIMUM_EXCLUSIVE'])) {
      return;
    }
    if (typeof json !== 'number') {
      return;
    }
    if (schema.exclusiveMinimum !== true) {
      if (json < schema.minimum!) {
        report.addError('MINIMUM', [json, schema.minimum!], undefined, schema, 'minimum');
      }
    } else {
      if (json <= schema.minimum!) {
        report.addError('MINIMUM_EXCLUSIVE', [json, schema.minimum!], undefined, schema, 'minimum');
      }
    }
  },
  exclusiveMinimum: function (this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
    // In draft-06+, exclusiveMinimum is a standalone number
    if (typeof schema.exclusiveMinimum === 'number') {
      if (shouldSkipValidate(this.validateOptions, ['MINIMUM_EXCLUSIVE'])) {
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
  },
  maxLength: function (this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.2.1.2
    if (shouldSkipValidate(this.validateOptions, ['MAX_LENGTH'])) {
      return;
    }
    if (typeof json !== 'string') {
      return;
    }
    if (unicodeLength(json) > schema.maxLength!) {
      report.addError('MAX_LENGTH', [json.length, schema.maxLength!], undefined, schema, 'maxLength');
    }
  },
  minLength: function (this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.2.2.2
    if (shouldSkipValidate(this.validateOptions, ['MIN_LENGTH'])) {
      return;
    }
    if (typeof json !== 'string') {
      return;
    }
    if (unicodeLength(json) < schema.minLength!) {
      report.addError('MIN_LENGTH', [json.length, schema.minLength!], undefined, schema, 'minLength');
    }
  },
  pattern: function (this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.2.3.2
    if (shouldSkipValidate(this.validateOptions, ['PATTERN'])) {
      return;
    }
    if (typeof json !== 'string') {
      return;
    }
    const result = compileSchemaRegex(schema.pattern!);
    if (!result.ok) {
      // Should not happen: schema should have been validated already
      report.addError('PATTERN', [schema.pattern!, json, result.error.message], undefined, schema, 'pattern');
      return;
    }
    if (!result.value.test(json)) {
      report.addError('PATTERN', [schema.pattern!, json], undefined, schema, 'pattern');
    }
  },
  additionalItems: function (this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
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
  },
  items: function () {
    /*report: Report, schema: JsonSchemaInternal, json: unknown*/
    // covered in additionalItems
  },
  prefixItems: function () {
    // handled in recurseArray
  },
  maxItems: function (this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
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
  },
  minItems: function (this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
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
  },
  uniqueItems: function (this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
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
  },
  maxProperties: function (this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.4.1.2
    if (shouldSkipValidate(this.validateOptions, ['OBJECT_PROPERTIES_MAXIMUM'])) {
      return;
    }
    if (!isObject(json)) {
      return;
    }
    const keysCount = Object.keys(json).length;
    if (keysCount > schema.maxProperties!) {
      report.addError(
        'OBJECT_PROPERTIES_MAXIMUM',
        [keysCount, schema.maxProperties!],
        undefined,
        schema,
        'maxProperties'
      );
    }
  },
  minProperties: function (this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.4.2.2
    if (shouldSkipValidate(this.validateOptions, ['OBJECT_PROPERTIES_MINIMUM'])) {
      return;
    }
    if (!isObject(json)) {
      return;
    }
    const keysCount = Object.keys(json).length;
    if (keysCount < schema.minProperties!) {
      report.addError(
        'OBJECT_PROPERTIES_MINIMUM',
        [keysCount, schema.minProperties!],
        undefined,
        schema,
        'minProperties'
      );
    }
  },
  required: function (this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.4.3.2
    if (shouldSkipValidate(this.validateOptions, ['OBJECT_MISSING_REQUIRED_PROPERTY'])) {
      return;
    }
    if (!isObject(json)) {
      return;
    }
    const idx = schema.required!.length;
    for (let i = 0; i < idx; i++) {
      const requiredPropertyName = schema.required![i];
      if (!Object.hasOwn(json, requiredPropertyName)) {
        report.addError('OBJECT_MISSING_REQUIRED_PROPERTY', [requiredPropertyName], undefined, schema, 'required');
      }
    }
  },
  additionalProperties: function (this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
    // covered in properties and patternProperties
    if (schema.properties === undefined && schema.patternProperties === undefined) {
      return JsonValidators.properties.call(this, report, schema, json);
    }
  },
  patternProperties: function (this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
    // covered in properties
    if (schema.properties === undefined) {
      return JsonValidators.properties.call(this, report, schema, json);
    }
  },
  properties: function (this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.4.4.2
    if (shouldSkipValidate(this.validateOptions, ['OBJECT_ADDITIONAL_PROPERTIES'])) {
      return;
    }
    if (!isObject(json)) {
      return;
    }
    const properties = schema.properties !== undefined ? schema.properties : {};
    const patternProperties = schema.patternProperties !== undefined ? schema.patternProperties : {};
    if (schema.additionalProperties === false) {
      // The property set of the json to validate.
      let s = Object.keys(json);
      // The property set from "properties".
      const p = Object.keys(properties);
      // The property set from "patternProperties".
      const pp = Object.keys(patternProperties);
      // remove from "s" all elements of "p", if any;
      s = difference(s, p);
      // for each regex in "pp", remove all elements of "s" which this regex matches.
      for (const ppKey of pp) {
        const result = compileSchemaRegex(ppKey);
        if (!result.ok) {
          continue;
        }
        const regExp = result.value;
        for (let idx2 = s.length - 1; idx2 >= 0; idx2--) {
          if (regExp.test(s[idx2]) === true) {
            s.splice(idx2, 1);
          }
        }
      }
      // Validation of the json succeeds if, after these two steps, set "s" is empty.
      if (s.length > 0) {
        // assumeAdditional can be an array of allowed properties
        if (Array.isArray(this.options.assumeAdditional)) {
          for (const allowed of this.options.assumeAdditional) {
            const io = s.indexOf(allowed);
            if (io !== -1) {
              s.splice(io, 1);
            }
          }
        }
        if (s.length > 0) {
          for (let si = s.length - 1; si >= 0; si--) {
            report.addError('OBJECT_ADDITIONAL_PROPERTIES', [s[si]], undefined, schema, 'properties');
          }
        }
      }
    }
  },
  dependencies: function (this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.4.5.2
    if (shouldSkipValidate(this.validateOptions, ['OBJECT_DEPENDENCY_KEY'])) {
      return;
    }
    if (!isObject(json)) {
      return;
    }

    const keys = Object.keys(schema.dependencies!);

    for (const dependencyName of keys) {
      // iterate all dependencies
      if (Object.hasOwn(json, dependencyName)) {
        const dependencyDefinition = schema.dependencies![dependencyName];
        if (Array.isArray(dependencyDefinition)) {
          // Array
          // if dependency is an array, object needs to have all properties in this array
          for (const requiredPropertyName of dependencyDefinition) {
            if (!Object.hasOwn(json, requiredPropertyName)) {
              report.addError(
                'OBJECT_DEPENDENCY_KEY',
                [requiredPropertyName, dependencyName],
                undefined,
                schema,
                'dependencies'
              );
            }
          }
        } else {
          // if dependency is a schema, validate against this schema
          validate.call(this, report, dependencyDefinition, json);
        }
      }
    }
  },
  enum: function (this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
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
      } else if (
        areEqual(json, enumVal, { caseInsensitiveComparison: true, maxDepth: this.options.maxRecursionDepth })
      ) {
        caseInsensitiveMatch = true;
      }
    }

    if (match === false) {
      const error =
        caseInsensitiveMatch && this.options.enumCaseInsensitiveComparison ? 'ENUM_CASE_MISMATCH' : 'ENUM_MISMATCH';
      report.addError(error, [JSON.stringify(json)], undefined, schema, 'enum');
    }
  },
  type: function (this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
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
  },
  allOf: function (this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.5.3.2
    for (let i = schema.allOf!.length - 1; i >= 0; i--) {
      const validateResult = validate.call(this, report, schema.allOf![i], json);
      if (this.options.breakOnFirstError && validateResult === false) {
        break;
      }
    }
  },
  anyOf: function (this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.5.4.2
    const subReports: Report[] = [];

    for (let i = schema.anyOf!.length - 1; i >= 0; i--) {
      const subReport = new Report(report);
      subReports.push(subReport);
      validate.call(this, subReport, schema.anyOf![i], json);
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
  },
  oneOf: function (this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.5.5.2
    const subReports: Report[] = [];

    for (let i = schema.oneOf!.length - 1; i >= 0; i--) {
      const subReport = new Report(report);
      subReports.push(subReport);
      validate.call(this, subReport, schema.oneOf![i], json);
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
  },
  not: function (this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.5.6.2
    const subReport = new Report(report);
    if (validate.call(this, subReport, schema.not!, json) === true) {
      report.addError('NOT_PASSED', undefined, undefined, schema, 'not');
    }
  },
  if: function (this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
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
    validate.call(this, conditionReport, conditionSchema as any, json);
    cacheValidationResult(report, conditionSchema, json, conditionReport.errors.length === 0);

    const branchSchema = conditionReport.errors.length === 0 ? thenSchema : elseSchema;
    if (branchSchema === undefined) {
      return;
    }

    validate.call(this, report, branchSchema as any, json);
  },
  then: function () {
    // handled by if
  },
  else: function () {
    // handled by if
  },
  dependentSchemas: function (this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
    if (!supportsDependentKeywords(schema, this.options.version)) {
      return;
    }
    if (!isObject(json) || !isObject(schema.dependentSchemas)) {
      return;
    }

    const keys = Object.keys(schema.dependentSchemas);

    for (const dependencyName of keys) {
      if (Object.hasOwn(json, dependencyName)) {
        const dependencySchema = schema.dependentSchemas[dependencyName];
        validate.call(this, report, dependencySchema, json);
      }
    }
  },
  dependentRequired: function (this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
    if (!supportsDependentKeywords(schema, this.options.version)) {
      return;
    }
    if (shouldSkipValidate(this.validateOptions, ['OBJECT_DEPENDENCY_KEY'])) {
      return;
    }
    if (!isObject(json) || !isObject(schema.dependentRequired)) {
      return;
    }

    const keys = Object.keys(schema.dependentRequired);

    for (const dependencyName of keys) {
      if (!Object.hasOwn(json, dependencyName)) {
        continue;
      }

      const requiredProperties = schema.dependentRequired[dependencyName];
      if (!Array.isArray(requiredProperties)) {
        continue;
      }

      for (const requiredPropertyName of requiredProperties) {
        if (!Object.hasOwn(json, requiredPropertyName)) {
          report.addError(
            'OBJECT_DEPENDENCY_KEY',
            [requiredPropertyName, dependencyName],
            undefined,
            schema,
            'dependentRequired'
          );
        }
      }
    }
  },
  unevaluatedItems: function (this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
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

    const evaluatedItems = collectEvaluated.call(this, {
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
      for (const idx of unevaluatedIndices) {
        const subReport = new Report(report);
        validate.call(this, subReport, unevalSchema as JsonSchemaInternal, json[idx]);
        if (subReport.errors.length > 0) {
          report.addError('ARRAY_UNEVALUATED_ITEMS', undefined, undefined, schema, 'unevaluatedItems');
          break;
        }
      }
    }
  },
  unevaluatedProperties: function (this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
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

    const evaluatedProperties = collectEvaluated.call(this, {
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

    const unevaluatedKeys = allKeys.filter((key) => !evaluatedProperties.has(key));

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
      for (const key of unevaluatedKeys) {
        const subReport = new Report(report);
        validate.call(this, subReport, unevalSchema as JsonSchemaInternal, (json as Record<string, unknown>)[key]);
        if (subReport.errors.length > 0) {
          report.addError('OBJECT_UNEVALUATED_PROPERTIES', [key], undefined, schema, 'unevaluatedProperties');
        }
      }
    }
  },
  maxContains: () => {},
  minContains: () => {},
  definitions: function () {
    /*report: Report, schema: JsonSchemaInternal, json: unknown*/
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.5.7.2
    // nothing to do here
  },
  format: function (this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.7.2
    if (this.options.formatAssertions === false) {
      return;
    }

    // When formatAssertions is explicitly true, respect the meta-schema vocabulary:
    // for draft 2019-09/2020-12, format is annotation-only unless the format-assertion
    // vocabulary is enabled in the meta-schema.
    if (this.options.formatAssertions === true) {
      if (!isFormatAssertionVocabEnabled(schema, report, this.options.version)) {
        return;
      }
    }

    const isModernDraft = this.options.version === 'draft2019-09' || this.options.version === 'draft2020-12';

    const formatValidators = getFormatValidators(this.options);
    const formatValidatorFn = formatValidators[schema.format!];
    if (typeof formatValidatorFn === 'function') {
      if (shouldSkipValidate(this.validateOptions, ['INVALID_FORMAT'])) {
        return;
      }
      if (report.hasError('INVALID_TYPE', [schema.type, whatIs(json)])) {
        return;
      }
      if (formatValidatorFn.length === 2) {
        // callback-based async - need to clone the path here, because it will change by the time async function reports back
        const pathBeforeAsync = shallowClone(report.path);
        report.addAsyncTask(formatValidatorFn, [json], function (result) {
          if (result !== true) {
            const backup = report.path;
            report.path = pathBeforeAsync;
            report.addError('INVALID_FORMAT', [schema.format!, JSON.stringify(json)], undefined, schema, 'format');
            report.path = backup;
          }
        });
      } else {
        const result = formatValidatorFn.call(this, json);
        if (result instanceof Promise) {
          // Promise-based async
          const pathBeforeAsync = shallowClone(report.path);
          const timeoutMs = this.options.asyncTimeout || 2000;
          report.addAsyncTask(
            async (callback) => {
              try {
                const timeoutPromise = new Promise<never>((_, reject) => {
                  setTimeout(() => reject(new Error('Async timeout')), timeoutMs);
                });
                const resolved = await Promise.race([result, timeoutPromise]);
                callback(resolved);
              } catch (error) {
                if ((error as Error).message === 'Async timeout') {
                  // Don't call callback, let global timeout handle it
                  return;
                }
                callback(false);
              }
            },
            [] as any,
            function (resolvedResult: boolean) {
              if (resolvedResult !== true) {
                const backup = report.path;
                report.path = pathBeforeAsync;
                report.addError('INVALID_FORMAT', [schema.format!, JSON.stringify(json)], undefined, schema, 'format');
                report.path = backup;
              }
            } as any
          );
        } else {
          // sync
          if (result !== true) {
            report.addError('INVALID_FORMAT', [schema.format!, JSON.stringify(json)], undefined, schema, 'format');
          }
        }
      }
    } else if (this.options.ignoreUnknownFormats !== true && !isModernDraft) {
      report.addError('UNKNOWN_FORMAT', [schema.format!], undefined, schema, 'format');
    }
  },
  contentEncoding: function (this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
    if (this.options.version !== 'draft-07') {
      return;
    }
    if (typeof json !== 'string') {
      return;
    }

    const contentEncoding = (schema as JsonSchemaAll).contentEncoding;
    if (contentEncoding !== 'base64') {
      return;
    }

    if (!isValidBase64(json)) {
      report.addError(
        'INVALID_FORMAT',
        ['contentEncoding:base64', JSON.stringify(json)],
        undefined,
        schema,
        'contentEncoding'
      );
    }
  },
  contentMediaType: function (this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
    if (this.options.version !== 'draft-07') {
      return;
    }
    if (typeof json !== 'string') {
      return;
    }

    const contentMediaType = (schema as JsonSchemaAll).contentMediaType;
    if (contentMediaType !== 'application/json') {
      return;
    }

    let payload = json;
    if ((schema as JsonSchemaAll).contentEncoding === 'base64') {
      const decoded = decodeBase64(json);
      if (decoded === undefined) {
        report.addError(
          'INVALID_FORMAT',
          ['contentEncoding:base64', JSON.stringify(json)],
          undefined,
          schema,
          'contentEncoding'
        );
        return;
      }
      payload = decoded;
    }

    try {
      JSON.parse(payload);
    } catch {
      report.addError(
        'INVALID_FORMAT',
        ['contentMediaType:application/json', JSON.stringify(json)],
        undefined,
        schema,
        'contentMediaType'
      );
    }
  },
  const: function (this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
    const constValue = (schema as JsonSchemaAll).const;
    if (areEqual(json, constValue, { maxDepth: this.options.maxRecursionDepth }) === false) {
      report.addError('CONST', [JSON.stringify(constValue)], undefined, schema, undefined);
    }
  },
  contains: function (this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
    if (shouldSkipValidate(this.validateOptions, ['CONTAINS'])) {
      return;
    }

    if (!Array.isArray(json)) {
      return;
    }

    const containsSchema = (schema as JsonSchemaAll).contains;
    if (containsSchema === undefined) {
      return;
    }

    const subReports: Report[] = [];
    for (let idx = 0; idx < json.length; idx++) {
      const subReport = new Report(report);
      subReports.push(subReport);
      validate.call(this, subReport, containsSchema as any, json[idx]);
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
        supportsContainsBounds && typeof (schema as JsonSchemaAll).minContains === 'number'
          ? ((schema as JsonSchemaAll).minContains ?? 1)
          : 1;
      const maxContains =
        supportsContainsBounds && typeof (schema as JsonSchemaAll).maxContains === 'number'
          ? (schema as JsonSchemaAll).maxContains
          : undefined;

      const hasEnoughMatches = matchingItems >= minContains;
      const notTooManyMatches = maxContains === undefined || matchingItems <= maxContains;

      if (!hasEnoughMatches || !notTooManyMatches) {
        report.addError('CONTAINS', undefined, subReports, schema, undefined);
      }
    };

    deferOrRunSync(report, subReports, addContainsErrorIfNeeded);
  },
  propertyNames: function (this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
    if (shouldSkipValidate(this.validateOptions, ['PROPERTY_NAMES'])) {
      return;
    }

    if (!isObject(json)) {
      return;
    }

    const propertyNamesSchema = (schema as JsonSchemaAll).propertyNames;
    if (propertyNamesSchema === undefined) {
      return;
    }

    const keys = Object.keys(json);
    const subReports: Report[] = [];
    for (const key of keys) {
      const subReport = new Report(report);
      subReports.push(subReport);
      validate.call(this, subReport, propertyNamesSchema as any, key);
    }

    const addPropertyNameErrors = () => {
      for (let idx = 0; idx < keys.length; idx++) {
        if (subReports[idx].errors.length > 0) {
          report.addError('PROPERTY_NAMES', [keys[idx]], subReports[idx], schema, undefined);
        }
      }
    };

    deferOrRunSync(report, subReports, addPropertyNameErrors);
  },
};

const recurseArray = function (this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: Array<unknown>) {
  // http://json-schema.org/latest/json-schema-validation.html#rfc.section.8.2

  const schemaUri = typeof schema.$schema === 'string' ? schema.$schema : undefined;
  const isDraft202012Schema =
    schemaUri === 'https://json-schema.org/draft/2020-12/schema' ||
    (!schemaUri && this.options.version === 'draft2020-12');
  const prefixItems = isDraft202012Schema && Array.isArray(schema.prefixItems) ? schema.prefixItems : undefined;

  if (prefixItems) {
    for (let idx = 0; idx < json.length; idx++) {
      if (idx < prefixItems.length) {
        report.path.push(idx);
        validate.call(this, report, prefixItems[idx], json[idx]);
        report.path.pop();
      } else if (schema.items !== undefined && !Array.isArray(schema.items)) {
        report.path.push(idx);
        report.schemaPath.push('items');
        validate.call(this, report, schema.items, json[idx]);
        report.schemaPath.pop();
        report.path.pop();
      }
    }
    return;
  }

  // If "items" is an array, this situation, the schema depends on the index:
  // if the index is less than, or equal to, the size of "items",
  // the child instance must be valid against the corresponding schema in the "items" array;
  // otherwise, it must be valid against the schema defined by "additionalItems".
  if (Array.isArray(schema.items)) {
    for (let idx = 0; idx < json.length; idx++) {
      // equal to doesn't make sense here
      if (idx < schema.items.length) {
        report.path.push(idx);
        validate.call(this, report, schema.items[idx], json[idx]);
        report.path.pop();
      } else {
        // might be boolean, so check that it's an object
        if (typeof schema.additionalItems === 'object') {
          report.path.push(idx);
          validate.call(this, report, schema.additionalItems, json[idx]);
          report.path.pop();
        }
      }
    }
  } else if (typeof schema.items === 'object' || typeof schema.items === 'boolean') {
    // If items is a schema, then the child instance must be valid against this schema,
    // regardless of its index, and regardless of the value of "additionalItems".
    for (let idx = 0; idx < json.length; idx++) {
      report.path.push(idx);
      // Track schema path for array items validation
      report.schemaPath.push('items');
      validate.call(this, report, schema.items, json[idx]);
      report.schemaPath.pop();
      report.path.pop();
    }
  }
};

const recurseObject = function (this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: Record<any, any>) {
  // http://json-schema.org/latest/json-schema-validation.html#rfc.section.8.3

  // If "additionalProperties" is absent, it is considered present with an empty schema as a value.
  // In addition, boolean value true is considered equivalent to an empty schema.
  let additionalProperties = schema.additionalProperties;
  if (additionalProperties === true || additionalProperties === undefined) {
    additionalProperties = {};
  }

  // p - The property set from "properties".
  const p = schema.properties ? Object.keys(schema.properties) : [];

  // pp - The property set from "patternProperties". Elements of this set will be called regexes for convenience.
  const pp = schema.patternProperties ? Object.keys(schema.patternProperties) : [];

  // m - The property name of the child.
  const keys = Object.keys(json);

  for (let ki = keys.length - 1; ki >= 0; ki--) {
    const m = keys[ki];
    const propertyValue = json[m];

    // s - The set of schemas for the child instance.
    const s = [];

    // 1. If set "p" contains value "m", then the corresponding schema in "properties" is added to "s".
    if (p.includes(m)) {
      s.push(schema.properties![m]);
    }

    // 2. For each regex in "pp", if it matches "m" successfully, the corresponding schema in "patternProperties" is added to "s".
    for (const regexString of pp) {
      const result = compileSchemaRegex(regexString);
      if (result.ok && result.value.test(m) === true) {
        s.push(schema.patternProperties![regexString]);
      }
    }

    // 3. The schema defined by "additionalProperties" is added to "s" if and only if, at this stage, "s" is empty.
    if (s.length === 0 && additionalProperties !== false) {
      s.push(additionalProperties);
    }

    // we are passing tests even without this assert because this is covered by properties check
    // if s is empty in this stage, no additionalProperties are allowed
    // report.expect(s.length !== 0, 'E001', m);

    // Instance property value must pass all schemas from s
    for (const schema_s of s) {
      report.path.push(m);
      // Track schema path for properties validation
      if (p.includes(m)) {
        // This is a defined property
        report.schemaPath.push('properties');
        report.schemaPath.push(m);
      } else {
        // This is additionalProperties or patternProperties
        report.schemaPath.push('additionalProperties');
      }
      validate.call(this, report, schema_s, propertyValue);
      report.path.pop();
      report.schemaPath.pop();
      if (p.includes(m)) {
        report.schemaPath.pop(); // pop the property name for defined properties
      }
    }
  }
};

export function validate(
  this: ZSchemaBase,
  report: Report,
  schema: boolean | JsonSchemaInternal,
  json: unknown
): boolean {
  report.commonErrorMessage = 'JSON_OBJECT_VALIDATION_FAILED';

  if (schema === true) {
    return true;
  }

  if (schema === false) {
    report.addError('SCHEMA_IS_FALSE', [], undefined, schema);
    return false;
  }

  // check if schema is an object
  if (!isObject(schema)) {
    report.addError('SCHEMA_NOT_AN_OBJECT', [whatIs(schema)], undefined, schema);
    return false;
  }

  // check if schema is empty, everything is valid against empty schema
  let keys = Object.keys(schema) as Array<keyof JsonSchema>;
  if (keys.length === 0) {
    return true;
  }

  // this method can be called recursively, so we need to remember our root
  let isRoot = false;
  if (!report.rootSchema) {
    report.rootSchema = schema;
    isRoot = true;
  }

  const recursiveAnchorStack = report.__$recursiveAnchorStack;
  const dynamicScopeStack = report.__$dynamicScopeStack;
  let pushedRecursiveAnchor = false;
  let pushedDynamicScope = false;
  const schemaId = getId(schema);
  const schemaResourceRoot = (schema as JsonSchemaInternal).__$resourceRoot;
  const dynamicScopeEntry = schemaResourceRoot || (isRoot || typeof schemaId === 'string' ? schema : undefined);
  if (dynamicScopeEntry && dynamicScopeStack[dynamicScopeStack.length - 1] !== dynamicScopeEntry) {
    dynamicScopeStack.push(dynamicScopeEntry);
    pushedDynamicScope = true;
  }
  if (schema.$recursiveAnchor === true) {
    recursiveAnchorStack.push(schema);
    pushedRecursiveAnchor = true;
  }

  // follow schema.$ref keys
  if (schema.$ref !== undefined) {
    const applySiblingKeywordsWithRef =
      this.options.version === 'draft2019-09' || this.options.version === 'draft2020-12';

    if (applySiblingKeywordsWithRef) {
      if (!schema.__$refResolved) {
        report.addError('REF_UNRESOLVED', [schema.$ref], undefined, schema);
      } else {
        validate.call(this, report, schema.__$refResolved as JsonSchemaInternal, json);
      }
      keys = keys.filter((key) => key !== '$ref');
    } else {
      // avoid infinite loop with maxRefs
      let maxRefs = 99;
      while (schema.$ref && maxRefs > 0) {
        if (!schema.__$refResolved) {
          report.addError('REF_UNRESOLVED', [schema.$ref], undefined, schema);
          break;
        } else if (schema.__$refResolved === schema) {
          break;
        } else {
          schema = schema.__$refResolved;
          keys = Object.keys(schema) as Array<keyof JsonSchema>;
        }
        maxRefs--;
      }
      if (maxRefs === 0) {
        throw new Error('Circular dependency by $ref references!');
      }
      // Reset schema path for referenced schema - paths are relative to the referenced schema
      report.schemaPath = [];
    }
  }

  // follow schema.$recursiveRef keys
  if (schema.$recursiveRef !== undefined) {
    const applySiblingKeywordsWithRecursiveRef =
      this.options.version === 'draft2019-09' || this.options.version === 'draft2020-12';

    if (applySiblingKeywordsWithRecursiveRef) {
      const recursiveRefTarget = resolveRecursiveRef(schema, recursiveAnchorStack);

      if (!recursiveRefTarget) {
        report.addError('REF_UNRESOLVED', [schema.$recursiveRef], undefined, schema);
      } else {
        validate.call(this, report, recursiveRefTarget, json);
      }
      keys = keys.filter((key) => key !== '$recursiveRef');
    }
  }

  // follow schema.$dynamicRef keys
  if (schema.$dynamicRef !== undefined) {
    const applySiblingKeywordsWithDynamicRef = this.options.version === 'draft2020-12';

    if (applySiblingKeywordsWithDynamicRef) {
      const dynamicRefTarget = resolveDynamicRef(schema, dynamicScopeStack);

      if (typeof dynamicRefTarget === 'undefined') {
        report.addError('REF_UNRESOLVED', [schema.$dynamicRef], undefined, schema);
      } else {
        validate.call(this, report, dynamicRefTarget, json);
      }
      keys = keys.filter((key) => key !== '$dynamicRef');
    }
  }

  const validationVocabularyEnabled = isValidationVocabularyEnabled(schema, report, this.options.version);
  if (!validationVocabularyEnabled) {
    keys = keys.filter((key) => !VALIDATION_VOCAB_KEYWORDS.has(key));
  }

  // type checking first
  if (validationVocabularyEnabled && schema.type) {
    keys.splice(keys.indexOf('type'), 1);
    report.schemaPath.push('type');
    JsonValidators.type.call(this, report, schema, json);
    report.schemaPath.pop();
    if (report.errors.length && this.options.breakOnFirstError) {
      if (pushedRecursiveAnchor) {
        recursiveAnchorStack.pop();
      }
      if (pushedDynamicScope) {
        dynamicScopeStack.pop();
      }
      return false;
    }
  }

  // now iterate all the keys in schema and execute validation methods
  // Defer unevaluatedItems/unevaluatedProperties to run after other validators,
  // so combinator validation results are cached and available for annotation collection
  const deferredUnevaluatedKeys: Array<keyof JsonSchema> = [];
  for (let ki = keys.length - 1; ki >= 0; ki--) {
    const key = keys[ki];
    if (key === 'unevaluatedItems' || key === 'unevaluatedProperties') {
      deferredUnevaluatedKeys.push(key);
      continue;
    }
    const validator = JsonValidators[key];
    if (validator) {
      validator.call(this, report, schema, json);
      if (report.errors.length && this.options.breakOnFirstError) {
        break;
      }
    }
  }

  // Run unevaluated* validators after all others have cached their combinator results
  if (deferredUnevaluatedKeys.length > 0 && !(report.errors.length > 0 && this.options.breakOnFirstError)) {
    for (const key of deferredUnevaluatedKeys) {
      const validator = JsonValidators[key];
      if (validator) {
        validator.call(this, report, schema, json);
        if (report.errors.length && this.options.breakOnFirstError) {
          break;
        }
      }
    }
  }

  if (report.errors.length === 0 || this.options.breakOnFirstError === false) {
    if (Array.isArray(json)) {
      recurseArray.call(this, report, schema, json);
    } else if (isObject(json)) {
      recurseObject.call(this, report, schema, json);
    }
  }

  if (typeof this.options.customValidator === 'function') {
    this.options.customValidator.call(this, report, schema, json);
  }

  if (pushedRecursiveAnchor) {
    recursiveAnchorStack.pop();
  }
  if (pushedDynamicScope) {
    dynamicScopeStack.pop();
  }

  // we don't need the root pointer anymore
  if (isRoot) {
    report.rootSchema = undefined;
  }

  // return valid just to be able to break at some code points
  return report.errors.length === 0;
}
