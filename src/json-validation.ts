import type { JsonSchemaAll, JsonSchemaInternal } from './json-schema-versions.js';
import type { ZSchemaBase } from './z-schema-base.js';

import { getId } from './json-schema.js';
import { Report } from './report.js';
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
  getCachedValidationResult,
  isValidationVocabularyEnabled,
  type JsonValidatorFn,
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

// ---------------------------------------------------------------------------
// collectEvaluated — unified traversal for unevaluatedItems / unevaluatedProperties
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// unevaluatedItems
// ---------------------------------------------------------------------------

function unevaluatedItemsValidator(this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
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
}

// ---------------------------------------------------------------------------
// unevaluatedProperties
// ---------------------------------------------------------------------------

function unevaluatedPropertiesValidator(this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
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
}

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

export const JsonValidators: Record<keyof JsonSchemaAll, JsonValidatorFn> = {
  // no-op validators (metadata / handled elsewhere)
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
// recurseArray
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// recurseObject
// ---------------------------------------------------------------------------

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

  for (const m of keys) {
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

// ---------------------------------------------------------------------------
// validate — main entry point
// ---------------------------------------------------------------------------

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
  let keys = Object.keys(schema) as Array<keyof JsonSchemaAll>;
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
          keys = Object.keys(schema) as Array<keyof JsonSchemaAll>;
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
  const deferredUnevaluatedKeys: Array<keyof JsonSchemaAll> = [];
  for (const key of keys) {
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
