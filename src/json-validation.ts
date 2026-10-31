import type { JsonSchemaAll, JsonSchemaInternal } from './json-schema-versions.js';
import type { Report } from './report.js';
import type { JsonValidatorFn } from './validation/shared.js';
import type { ZSchemaBase } from './z-schema-base.js';
import type { ZSchemaOptions } from './z-schema-options.js';

import { getId } from './json-schema.js';
import { compileSchemaRegex } from './utils/schema-regex.js';
import { isObject, whatIs } from './utils/what-is.js';
import {
  additionalItemsValidator,
  containsValidator,
  itemsValidator,
  maxContainsValidator,
  maxItemsValidator,
  minContainsValidator,
  minItemsValidator,
  prefixItemsValidator,
  uniqueItemsValidator,
} from './validation/array.js';
import {
  allOfValidator,
  anyOfValidator,
  elseValidator,
  ifValidator,
  notValidator,
  oneOfValidator,
  thenValidator,
} from './validation/combinators.js';
import {
  exclusiveMaximumValidator,
  exclusiveMinimumValidator,
  maximumValidator,
  minimumValidator,
  multipleOfValidator,
} from './validation/numeric.js';
import {
  additionalPropertiesValidator,
  dependenciesValidator,
  dependentRequiredValidator,
  dependentSchemasValidator,
  maxPropertiesValidator,
  minPropertiesValidator,
  patternPropertiesValidator,
  propertiesValidator,
  propertyNamesValidator,
  requiredValidator,
} from './validation/object.js';
import { resolveDynamicRef, resolveRecursiveRef } from './validation/ref.js';
import {
  deferUntilAsyncTasksComplete,
  runAfterPending,
  isModernDraft,
  isValidationVocabularyEnabled,
  VALIDATION_VOCAB_KEYWORDS,
} from './validation/shared.js';
import {
  contentEncodingValidator,
  contentMediaTypeValidator,
  formatValidator,
  maxLengthValidator,
  minLengthValidator,
  patternValidator,
} from './validation/string.js';
import { constValidator, enumValidator, typeValidator } from './validation/type.js';
import { unevaluatedItemsValidator, unevaluatedPropertiesValidator } from './validation/unevaluated.js';

// ---------------------------------------------------------------------------
// definitions  (no-op)
// ---------------------------------------------------------------------------

function definitionsValidator() {
  /*report: Report, schema: JsonSchemaInternal, json: unknown*/
  // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.5.7.2
  // nothing to do here
}

// ---------------------------------------------------------------------------
// JsonValidators — keyword dispatch table
// ---------------------------------------------------------------------------

const noopValidator: JsonValidatorFn = () => {
  // intentional no-op: metadata keyword or handled elsewhere in the pipeline
};

export const JsonValidators: Record<keyof JsonSchemaAll, JsonValidatorFn> = {
  // no-op validators (metadata / handled elsewhere)
  id: noopValidator,
  $id: noopValidator,
  $ref: noopValidator,
  $schema: noopValidator,
  $dynamicAnchor: noopValidator,
  $dynamicRef: noopValidator,
  $anchor: noopValidator,
  $defs: noopValidator,
  $vocabulary: noopValidator,
  $recursiveAnchor: noopValidator,
  $recursiveRef: noopValidator,
  examples: noopValidator,
  title: noopValidator,
  description: noopValidator,
  default: noopValidator,

  // type validators
  type: typeValidator,
  enum: enumValidator,
  const: constValidator,

  // numeric validators
  multipleOf: multipleOfValidator,
  maximum: maximumValidator,
  exclusiveMaximum: exclusiveMaximumValidator,
  minimum: minimumValidator,
  exclusiveMinimum: exclusiveMinimumValidator,

  // string validators
  maxLength: maxLengthValidator,
  minLength: minLengthValidator,
  pattern: patternValidator,
  format: formatValidator,
  contentEncoding: contentEncodingValidator,
  contentMediaType: contentMediaTypeValidator,

  // array validators
  additionalItems: additionalItemsValidator,
  items: itemsValidator,
  prefixItems: prefixItemsValidator,
  maxItems: maxItemsValidator,
  minItems: minItemsValidator,
  uniqueItems: uniqueItemsValidator,
  contains: containsValidator,
  maxContains: maxContainsValidator,
  minContains: minContainsValidator,
  unevaluatedItems: unevaluatedItemsValidator,

  // object validators
  maxProperties: maxPropertiesValidator,
  minProperties: minPropertiesValidator,
  required: requiredValidator,
  additionalProperties: additionalPropertiesValidator,
  patternProperties: patternPropertiesValidator,
  properties: propertiesValidator,
  dependencies: dependenciesValidator,
  dependentSchemas: dependentSchemasValidator,
  dependentRequired: dependentRequiredValidator,
  propertyNames: propertyNamesValidator,
  unevaluatedProperties: unevaluatedPropertiesValidator,

  // combinator validators
  allOf: allOfValidator,
  anyOf: anyOfValidator,
  oneOf: oneOfValidator,
  not: notValidator,
  if: ifValidator,
  then: thenValidator,
  else: elseValidator,

  // misc
  definitions: definitionsValidator,
};

// ---------------------------------------------------------------------------
// keyword plan
// ---------------------------------------------------------------------------

/** Validators that never add errors or async tasks, so `validate()` can skip their keys entirely. */
const NOOP_VALIDATORS: ReadonlySet<JsonValidatorFn> = new Set<JsonValidatorFn>([
  noopValidator,
  definitionsValidator,
  itemsValidator,
  prefixItemsValidator,
  thenValidator,
  elseValidator,
  maxContainsValidator,
  minContainsValidator,
]);

/**
 * Per-schema-node dispatch plan, cached lazily on the node under {@link keywordPlanSymbol}.
 * Symbol keys are skipped by `Object.keys`, `for...in` and `JSON.stringify`, so the plan never leaks into clones or output.
 * @internal
 */
export interface KeywordPlan {
  /** `Object.keys(schema).length === 0` (raw count, includes internal keys). */
  readonly empty: boolean;
  /**
   * Keys of `schema` in original order that have a non-no-op validator. Internal `__$*` keys, unknown keywords and
   * no-op keywords (`$ref`, `items`, `then`, ...) are dropped, as is `type` when `schema.type` is truthy because it
   * is dispatched first. Dropping no-op keys is behavior-preserving: they never add errors or async tasks, so neither
   * results nor the point where `breakOnFirstError` stops change. Must be treated as read-only.
   */
  readonly keys: ReadonlyArray<keyof JsonSchemaAll>;
  /** `keys` contains `unevaluatedItems` or `unevaluatedProperties` (the only consumers of a lone `if` annotation). */
  readonly unevaluated: boolean;
  /** Value of {@link planEpoch} when the plan was built; a plan from an older epoch is stale. */
  readonly epoch: number;
  /** Lazily computed `keys` minus `VALIDATION_VOCAB_KEYWORDS`, used when the validation vocabulary is disabled. */
  keysVocabDisabled?: ReadonlyArray<keyof JsonSchemaAll>;
}

const keywordPlanSymbol: unique symbol = Symbol('z-schema.keywordPlan');

/**
 * Bumped after every `customValidator` call. A customValidator may add/remove keywords on already-compiled nodes,
 * so every plan stored before the last call is stale. Plans are also never read from or stored in the cache while
 * a customValidator is configured (see {@link planFor}).
 */
let planEpoch = 0;

type PlannedSchema = JsonSchemaInternal & { [keywordPlanSymbol]?: KeywordPlan };

function buildKeywordPlan(schema: JsonSchemaInternal): KeywordPlan {
  const all = Object.keys(schema) as Array<keyof JsonSchemaAll>;
  const skipType = !!schema.type;
  const keys: Array<keyof JsonSchemaAll> = [];
  let unevaluated = false;
  for (let i = 0; i < all.length; i++) {
    const key = all[i];
    const validator = Object.hasOwn(JsonValidators, key) ? JsonValidators[key] : undefined;
    if (!validator || NOOP_VALIDATORS.has(validator) || (skipType && key === 'type')) {
      continue;
    }
    keys.push(key);
    if (key === 'unevaluatedItems' || key === 'unevaluatedProperties') {
      unevaluated = true;
    }
  }
  return { empty: all.length === 0, keys, unevaluated, epoch: planEpoch };
}

/**
 * Get (building and caching on first use) the keyword plan of a schema node.
 * Frozen/sealed schemas get a fresh plan on every call.
 * @internal
 */
export function getKeywordPlan(schema: JsonSchemaInternal): KeywordPlan {
  const planned = schema as PlannedSchema;
  let plan = planned[keywordPlanSymbol];
  if (plan === undefined || plan.epoch !== planEpoch) {
    plan = buildKeywordPlan(schema);
    if (Object.isExtensible(schema)) {
      Object.defineProperty(planned, keywordPlanSymbol, {
        value: plan,
        enumerable: false,
        configurable: true,
        writable: true,
      });
    }
  }
  return plan;
}

/**
 * Drop the cached keyword plan of a schema node. Must be called by any code that adds a validation
 * keyword to a schema node after it may have been used as a schema (e.g. schema-validator's
 * `assumeAdditional` / `noEmptyStrings` / `noEmptyArrays` / `noTypeless` rewrites).
 * @internal
 */
export function invalidateKeywordPlan(schema: JsonSchemaInternal): void {
  const planned = schema as PlannedSchema;
  if (planned[keywordPlanSymbol] !== undefined) {
    planned[keywordPlanSymbol] = undefined;
  }
}

/**
 * Plan for the node being validated. With a customValidator configured the hook may mutate compiled nodes at any
 * time, so use a fresh uncached plan (matches main, which re-read `Object.keys` on every visit).
 */
function planFor(ctx: ZSchemaBase, schema: JsonSchemaInternal): KeywordPlan {
  return typeof ctx.options.customValidator === 'function' ? buildKeywordPlan(schema) : getKeywordPlan(schema);
}

/**
 * Cold path: `breakOnFirstError` is set and errors already exist when the keyword loop starts (from a
 * `$ref`/`$recursiveRef`/`$dynamicRef` sibling or earlier in the report). Main checked the error state after
 * every key that has a validator (no-ops included), so it ran only the first validator-bearing key of its key list
 * and then broke. Reproduce that exactly, including a no-op first key running nothing.
 */
function runFirstKeyOnly(
  ctx: ZSchemaBase,
  report: Report,
  schema: JsonSchemaInternal,
  json: unknown,
  validationVocabularyEnabled: boolean
): void {
  const { version } = ctx.options;
  const is2019Plus = version === 'draft2019-09' || version === 'draft2020-12';
  let keys = Object.keys(schema) as Array<keyof JsonSchemaAll>;
  const dropped = new Set<string>();
  if (is2019Plus && schema.$ref !== undefined) {
    dropped.add('$ref');
  }
  if (is2019Plus && schema.$recursiveRef !== undefined) {
    dropped.add('$recursiveRef');
  }
  if (version === 'draft2020-12' && schema.$dynamicRef !== undefined) {
    dropped.add('$dynamicRef');
  }
  if (!validationVocabularyEnabled) {
    keys = keys.filter((k) => !VALIDATION_VOCAB_KEYWORDS.has(k));
  } else if (schema.type) {
    dropped.add('type');
  }
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (dropped.has(key) || key === 'unevaluatedItems' || key === 'unevaluatedProperties') {
      continue;
    }
    if (!Object.hasOwn(JsonValidators, key)) {
      continue;
    }
    const validator = JsonValidators[key];
    if (!NOOP_VALIDATORS.has(validator)) {
      validator(ctx, report, schema, json);
    }
    return;
  }
}

function getVocabDisabledKeys(plan: KeywordPlan): ReadonlyArray<keyof JsonSchemaAll> {
  let filtered = plan.keysVocabDisabled;
  if (filtered === undefined) {
    const out: Array<keyof JsonSchemaAll> = [];
    for (let i = 0; i < plan.keys.length; i++) {
      if (!VALIDATION_VOCAB_KEYWORDS.has(plan.keys[i])) {
        out.push(plan.keys[i]);
      }
    }
    filtered = out;
    plan.keysVocabDisabled = filtered;
  }
  return filtered;
}

// ---------------------------------------------------------------------------
// recurseArray
// ---------------------------------------------------------------------------

function recurseArray(ctx: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown[]) {
  // http://json-schema.org/latest/json-schema-validation.html#rfc.section.8.2

  const schemaUri = typeof schema.$schema === 'string' ? schema.$schema : undefined;
  const isDraft202012Schema =
    schemaUri === 'https://json-schema.org/draft/2020-12/schema' ||
    (!schemaUri && ctx.options.version === 'draft2020-12');
  const prefixItems = isDraft202012Schema && Array.isArray(schema.prefixItems) ? schema.prefixItems : undefined;

  if (prefixItems) {
    for (let idx = 0; idx < json.length; idx++) {
      if (idx < prefixItems.length) {
        report.path.push(idx);
        validate(ctx, report, prefixItems[idx], json[idx]);
        report.path.pop();
      } else if (schema.items !== undefined && !Array.isArray(schema.items)) {
        report.path.push(idx);
        report.schemaPath.push('items');
        validate(ctx, report, schema.items, json[idx]);
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
        validate(ctx, report, schema.items[idx], json[idx]);
        report.path.pop();
      } else if (typeof schema.additionalItems === 'object') {
        // might be boolean, so check that it's an object
        report.path.push(idx);
        validate(ctx, report, schema.additionalItems, json[idx]);
        report.path.pop();
      }
    }
  } else if (typeof schema.items === 'object' || typeof schema.items === 'boolean') {
    // If items is a schema, then the child instance must be valid against this schema,
    // regardless of its index, and regardless of the value of "additionalItems".
    for (let idx = 0; idx < json.length; idx++) {
      report.path.push(idx);
      // Track schema path for array items validation
      report.schemaPath.push('items');
      validate(ctx, report, schema.items, json[idx]);
      report.schemaPath.pop();
      report.path.pop();
    }
  }
}

// ---------------------------------------------------------------------------
// recurseObject
// ---------------------------------------------------------------------------

function recurseObject(ctx: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: Record<string, unknown>) {
  // http://json-schema.org/latest/json-schema-validation.html#rfc.section.8.3

  // If "additionalProperties" is absent, it is considered present with an empty schema as a value.
  // In addition, boolean value true is considered equivalent to an empty schema.
  let { additionalProperties } = schema;
  if (additionalProperties === true || additionalProperties === undefined) {
    additionalProperties = {};
  }

  // p - The property set from "properties".
  const p = schema.properties ? Object.keys(schema.properties) : [];

  // pp - The property set from "patternProperties". Elements of this set will be called regexes for convenience.
  const pp = schema.patternProperties ? Object.keys(schema.patternProperties) : [];

  // m - The property name of the child.
  const keys = Object.keys(json);

  // Precompile patternProperties regexes once before the per-key loop
  const ppCompiled: Array<{ key: string; re: RegExp }> = [];
  for (let i = 0; i < pp.length; i++) {
    const r = compileSchemaRegex(pp[i]);
    if (r.ok) {
      ppCompiled.push({ key: pp[i], re: r.value });
    }
  }

  for (const m of keys) {
    const propertyValue = json[m];

    // Hoist membership check: compute once per key
    const isProp = p.includes(m);

    // s - The set of schemas for the child instance.
    const s = [];

    // 1. If set "p" contains value "m", then the corresponding schema in "properties" is added to "s".
    if (isProp) {
      s.push(schema.properties![m]);
    }

    // 2. For each regex in "pp", if it matches "m" successfully, the corresponding schema in "patternProperties" is added to "s".
    for (let i = 0; i < ppCompiled.length; i++) {
      if (ppCompiled[i].re.test(m)) {
        s.push(schema.patternProperties![ppCompiled[i].key]);
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
      if (isProp) {
        // This is a defined property
        report.schemaPath.push('properties', m);
      } else {
        // This is additionalProperties or patternProperties
        report.schemaPath.push('additionalProperties');
      }
      validate(ctx, report, schema_s, propertyValue);
      report.path.pop();
      report.schemaPath.pop();
      if (isProp) {
        report.schemaPath.pop(); // pop the property name for defined properties
      }
    }
  }
}

function runCustomValidator(
  ctx: ZSchemaBase,
  report: Report,
  schema: JsonSchemaInternal,
  json: unknown,
  hook: NonNullable<ZSchemaOptions['customValidator']>
): void {
  // customValidator may have been installed mid-validation, after this report started deferring
  if (report.deferErrors) {
    report.materializeErrors();
  }
  hook.call(ctx, report, schema, json);
  // the hook may have mutated compiled nodes: invalidate every plan stored so far
  planEpoch++;
}

// ---------------------------------------------------------------------------
// validate — main entry point
// ---------------------------------------------------------------------------

export function validate(
  ctx: ZSchemaBase,
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
  let plan = planFor(ctx, schema);
  if (plan.empty) {
    return true;
  }
  const asyncTasksBefore = report.asyncTasks.length;
  // While this node is traversed, a lone `if` at this same instance must record its annotation.
  // Child instances get their own value, so the scope is keyed by instance identity.
  const unevaluatedScoped = plan.unevaluated;
  const prevUnevaluatedInstance = report.__$unevaluatedInstance;
  if (unevaluatedScoped) {
    report.__$unevaluatedInstance = json;
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
  const schemaResourceRoot = schema.__$resourceRoot;
  const dynamicScopeEntry = schemaResourceRoot || (isRoot || typeof schemaId === 'string' ? schema : undefined);
  if (dynamicScopeEntry && dynamicScopeStack.at(-1) !== dynamicScopeEntry) {
    dynamicScopeStack.push(dynamicScopeEntry);
    pushedDynamicScope = true;
  }
  if (schema.$recursiveAnchor === true) {
    recursiveAnchorStack.push(schema);
    pushedRecursiveAnchor = true;
  }

  // follow schema.$ref keys
  if (schema.$ref !== undefined) {
    const applySiblingKeywordsWithRef = isModernDraft(ctx.options.version);

    if (applySiblingKeywordsWithRef) {
      if (schema.__$refResolved) {
        validate(ctx, report, schema.__$refResolved, json);
      } else {
        report.addError('REF_UNRESOLVED', [schema.$ref], undefined, schema);
      }
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
          plan = planFor(ctx, schema);
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
    const applySiblingKeywordsWithRecursiveRef = isModernDraft(ctx.options.version);

    if (applySiblingKeywordsWithRecursiveRef) {
      const recursiveRefTarget = resolveRecursiveRef(schema, recursiveAnchorStack);

      if (recursiveRefTarget) {
        validate(ctx, report, recursiveRefTarget, json);
      } else {
        report.addError('REF_UNRESOLVED', [schema.$recursiveRef], undefined, schema);
      }
    }
  }

  // follow schema.$dynamicRef keys
  if (schema.$dynamicRef !== undefined) {
    const applySiblingKeywordsWithDynamicRef = ctx.options.version === 'draft2020-12';

    if (applySiblingKeywordsWithDynamicRef) {
      const dynamicRefTarget = resolveDynamicRef(schema, dynamicScopeStack);

      if (dynamicRefTarget === undefined) {
        report.addError('REF_UNRESOLVED', [schema.$dynamicRef], undefined, schema);
      } else {
        validate(ctx, report, dynamicRefTarget, json);
      }
    }
  }

  const validationVocabularyEnabled = isValidationVocabularyEnabled(schema, report, ctx.options.version);
  const keys = validationVocabularyEnabled ? plan.keys : getVocabDisabledKeys(plan);

  // type checking first
  if (validationVocabularyEnabled && schema.type) {
    report.schemaPath.push('type');
    JsonValidators.type(ctx, report, schema, json);
    report.schemaPath.pop();
    if (report.errors.length && ctx.options.breakOnFirstError) {
      if (pushedRecursiveAnchor) {
        recursiveAnchorStack.pop();
      }
      if (pushedDynamicScope) {
        dynamicScopeStack.pop();
      }
      if (unevaluatedScoped) {
        report.__$unevaluatedInstance = prevUnevaluatedInstance;
      }
      return false;
    }
  }

  // now iterate all the keys in schema and execute validation methods
  // Defer unevaluatedItems/unevaluatedProperties to run after other validators,
  // so combinator validation results are cached and available for annotation collection
  let deferredUnevaluatedKeys: Array<keyof JsonSchemaAll> | undefined;
  // Captured once; consumed (set to undefined) when chained after a deferred unevaluated* check.
  let hook = typeof ctx.options.customValidator === 'function' ? ctx.options.customValidator : undefined;
  const exactStop = ctx.options.breakOnFirstError && report.errors.length > 0;
  if (exactStop) {
    runFirstKeyOnly(ctx, report, schema, json, validationVocabularyEnabled);
  }
  const loopEnd = exactStop ? 0 : keys.length;
  for (let i = 0; i < loopEnd; i++) {
    const key = keys[i];
    if (key === 'unevaluatedItems' || key === 'unevaluatedProperties') {
      if (deferredUnevaluatedKeys === undefined) {
        deferredUnevaluatedKeys = [key];
      } else {
        deferredUnevaluatedKeys.push(key);
      }
      continue;
    }
    // every key in the plan has a non-no-op validator
    JsonValidators[key](ctx, report, schema, json);
    if (report.errors.length && ctx.options.breakOnFirstError) {
      break;
    }
  }

  // Run unevaluated* validators after all others have cached their combinator results.
  // If this node's applicators queued async tasks, the check is deferred until they complete.
  if (deferredUnevaluatedKeys !== undefined && !(report.errors.length > 0 && ctx.options.breakOnFirstError)) {
    const unevaluatedKeys = deferredUnevaluatedKeys;
    if (report.asyncTasks.length > asyncTasksBefore) {
      // The hook is chained after this decision: it may queue more async work (an async unevaluated* schema),
      // and the hook must see its result.
      const chained = hook;
      hook = undefined;
      deferUntilAsyncTasksComplete(ctx, report, () => {
        const before = report.asyncTasks.length;
        validateUnevaluated(ctx, report, schema, json, unevaluatedKeys);
        if (chained !== undefined) {
          runAfterPending(ctx, report, before, () => {
            runCustomValidator(ctx, report, schema, json, chained);
          });
        }
      });
    } else {
      validateUnevaluated(ctx, report, schema, json, unevaluatedKeys);
    }
  }

  if (report.errors.length === 0 || ctx.options.breakOnFirstError === false) {
    if (Array.isArray(json)) {
      recurseArray(ctx, report, schema, json);
    } else if (isObject(json)) {
      recurseObject(ctx, report, schema, json);
    }
  }

  if (hook !== undefined) {
    if (report.asyncTasks.length > asyncTasksBefore) {
      // async results for this node are not settled yet: run the hook once they are
      const deferredHook = hook;
      deferUntilAsyncTasksComplete(ctx, report, () => {
        runCustomValidator(ctx, report, schema, json, deferredHook);
      });
    } else {
      runCustomValidator(ctx, report, schema, json, hook);
    }
  }

  if (pushedRecursiveAnchor) {
    recursiveAnchorStack.pop();
  }
  if (pushedDynamicScope) {
    dynamicScopeStack.pop();
  }
  if (unevaluatedScoped) {
    report.__$unevaluatedInstance = prevUnevaluatedInstance;
  }

  // we don't need the root pointer anymore
  if (isRoot) {
    report.rootSchema = undefined;
  }

  // return valid just to be able to break at some code points
  return report.errors.length === 0;
}

function validateUnevaluated(
  ctx: ZSchemaBase,
  report: Report,
  schema: JsonSchemaInternal,
  json: unknown,
  keys: Array<keyof JsonSchemaAll>
) {
  if (report.errors.length > 0 && ctx.options.breakOnFirstError) {
    return;
  }
  for (let i = 0; i < keys.length; i++) {
    const validator = JsonValidators[keys[i]];
    if (validator) {
      validator(ctx, report, schema, json);
      if (report.errors.length && ctx.options.breakOnFirstError) {
        break;
      }
    }
  }
}
