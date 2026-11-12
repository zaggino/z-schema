import type { JsonSchemaInternal } from '../json-schema-versions.js';
import type { ZSchemaBase } from '../z-schema-base.js';
import type { BuildState, Check, RawNode } from './fast-shared.js';

import { Report } from '../report.js';
import { difference } from '../utils/array.js';
import { compileSchemaRegex } from '../utils/schema-regex.js';
import { isObject } from '../utils/what-is.js';
import { ALWAYS_TRUE, expectNumber, expectRecord, expectStringArray } from './fast-shared.js';
import { deferOrRunSync, shouldSkipValidate, supportsDependentKeywords } from './shared.js';

// ---------------------------------------------------------------------------
// maxProperties
// ---------------------------------------------------------------------------

export function maxPropertiesValidator(ctx: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
  // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.4.1.2
  if (shouldSkipValidate(ctx.validateOptions, ['OBJECT_PROPERTIES_MAXIMUM'])) {
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
}

// ---------------------------------------------------------------------------
// minProperties
// ---------------------------------------------------------------------------

export function minPropertiesValidator(ctx: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
  // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.4.2.2
  if (shouldSkipValidate(ctx.validateOptions, ['OBJECT_PROPERTIES_MINIMUM'])) {
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
}

// ---------------------------------------------------------------------------
// required
// ---------------------------------------------------------------------------

export function requiredValidator(ctx: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
  // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.4.3.2
  if (shouldSkipValidate(ctx.validateOptions, ['OBJECT_MISSING_REQUIRED_PROPERTY'])) {
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
}

// ---------------------------------------------------------------------------
// additionalProperties  (delegates to properties when standalone)
// ---------------------------------------------------------------------------

export function additionalPropertiesValidator(
  ctx: ZSchemaBase,
  report: Report,
  schema: JsonSchemaInternal,
  json: unknown
) {
  // covered in properties and patternProperties
  if (schema.properties === undefined && schema.patternProperties === undefined) {
    propertiesValidator(ctx, report, schema, json);
  }
}

// ---------------------------------------------------------------------------
// patternProperties  (delegates to properties when standalone)
// ---------------------------------------------------------------------------

export function patternPropertiesValidator(
  ctx: ZSchemaBase,
  report: Report,
  schema: JsonSchemaInternal,
  json: unknown
) {
  // covered in properties
  if (schema.properties === undefined) {
    propertiesValidator(ctx, report, schema, json);
  }
}

// ---------------------------------------------------------------------------
// properties
// ---------------------------------------------------------------------------

export function propertiesValidator(ctx: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
  // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.4.4.2
  if (shouldSkipValidate(ctx.validateOptions, ['OBJECT_ADDITIONAL_PROPERTIES'])) {
    return;
  }
  if (!isObject(json)) {
    return;
  }
  const properties = schema.properties === undefined ? {} : schema.properties;
  const patternProperties = schema.patternProperties === undefined ? {} : schema.patternProperties;
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
    for (let i = 0; i < pp.length; i++) {
      const ppKey = pp[i];
      const result = compileSchemaRegex(ppKey);
      if (!result.ok) {
        continue;
      }
      const regExp = result.value;
      for (let idx2 = s.length - 1; idx2 >= 0; idx2--) {
        if (regExp.test(s[idx2])) {
          s.splice(idx2, 1);
        }
      }
    }
    // Validation of the json succeeds if, after these two steps, set "s" is empty.
    if (s.length > 0) {
      // assumeAdditional can be an array of allowed properties
      if (Array.isArray(ctx.options.assumeAdditional)) {
        for (const allowed of ctx.options.assumeAdditional) {
          const io = s.indexOf(allowed);
          if (io !== -1) {
            s.splice(io, 1);
          }
        }
      }
      if (s.length > 0) {
        for (const extra of s) {
          report.addError('OBJECT_ADDITIONAL_PROPERTIES', [extra], undefined, schema, 'properties');
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// dependencies
// ---------------------------------------------------------------------------

export function dependenciesValidator(ctx: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
  // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.4.5.2
  if (shouldSkipValidate(ctx.validateOptions, ['OBJECT_DEPENDENCY_KEY'])) {
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
        ctx._jsonValidate(report, dependencyDefinition, json);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// dependentSchemas
// ---------------------------------------------------------------------------

export function dependentSchemasValidator(ctx: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
  if (!supportsDependentKeywords(schema, ctx.options.version)) {
    return;
  }
  if (!isObject(json) || !isObject(schema.dependentSchemas)) {
    return;
  }

  const keys = Object.keys(schema.dependentSchemas);

  for (const dependencyName of keys) {
    if (Object.hasOwn(json, dependencyName)) {
      const dependencySchema = schema.dependentSchemas[dependencyName];
      ctx._jsonValidate(report, dependencySchema, json);
    }
  }
}

// ---------------------------------------------------------------------------
// dependentRequired
// ---------------------------------------------------------------------------

export function dependentRequiredValidator(
  ctx: ZSchemaBase,
  report: Report,
  schema: JsonSchemaInternal,
  json: unknown
) {
  if (!supportsDependentKeywords(schema, ctx.options.version)) {
    return;
  }
  if (shouldSkipValidate(ctx.validateOptions, ['OBJECT_DEPENDENCY_KEY'])) {
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
}

// ---------------------------------------------------------------------------
// propertyNames
// ---------------------------------------------------------------------------

export function propertyNamesValidator(ctx: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
  if (shouldSkipValidate(ctx.validateOptions, ['PROPERTY_NAMES'])) {
    return;
  }

  if (!isObject(json)) {
    return;
  }

  const propertyNamesSchema = schema.propertyNames;
  if (propertyNamesSchema === undefined) {
    return;
  }

  const keys = Object.keys(json);
  const subReports: Report[] = [];
  for (const key of keys) {
    const subReport = Report.createSubReport(report);
    subReports.push(subReport);
    ctx._jsonValidate(subReport, propertyNamesSchema, key);
  }

  const addPropertyNameErrors = () => {
    for (let idx = 0; idx < keys.length; idx++) {
      if (subReports[idx].errors.length > 0) {
        report.addError('PROPERTY_NAMES', [keys[idx]], subReports[idx], schema);
      }
    }
  };

  deferOrRunSync(ctx, report, subReports, addPropertyNameErrors);
}

// ---------------------------------------------------------------------------
// fast-validator compiler: object keywords
// ---------------------------------------------------------------------------

// Compiled together into one check so `Object.keys(json)` is computed once. Must agree with `recurseObject`
// (json-validation.ts) and the object validators above: `maxPropertiesValidator`, `minPropertiesValidator`,
// `requiredValidator`, `additionalPropertiesValidator`, `patternPropertiesValidator`, `propertiesValidator`,
// `dependenciesValidator`, `dependentSchemasValidator`, `dependentRequiredValidator`, `propertyNamesValidator`.

type ObjectInstance = Record<string, unknown>;
/** A check on an object instance; the caller has established it is a non-null, non-array object. */
type ObjectCheck = (json: ObjectInstance) => boolean;
/** A check on an object instance that also receives its `Object.keys`, computed once per node visit. */
type KeysCheck = (json: ObjectInstance, keys: string[]) => boolean;

/** If `name` is present, every name in `names` must be present. */
function requiresAll(name: string, names: string[]): ObjectCheck {
  return (json) => {
    if (!Object.hasOwn(json, name)) {
      return true;
    }
    for (let i = 0; i < names.length; i++) {
      if (!Object.hasOwn(json, names[i])) {
        return false;
      }
    }
    return true;
  };
}

/** If `name` is present, `check` must pass on the whole object. */
function whenPresent(name: string, check: ObjectCheck): ObjectCheck {
  return (json) => !Object.hasOwn(json, name) || check(json);
}

function compileRequiredCheck(node: RawNode, plain: ObjectCheck[]): void {
  const { required } = node;
  if (required === undefined) {
    return;
  }
  const names = expectStringArray(required);
  const count = names.length;
  if (count === 0) {
    return;
  }
  plain.push((json) => {
    for (let i = 0; i < count; i++) {
      if (!Object.hasOwn(json, names[i])) {
        return false;
      }
    }
    return true;
  });
}

function compilePropertyCounts(node: RawNode, withKeys: KeysCheck[]): void {
  if (node.minProperties !== undefined) {
    const min = expectNumber(node.minProperties);
    withKeys.push((_json, keys) => !(keys.length < min));
  }
  if (node.maxProperties !== undefined) {
    const max = expectNumber(node.maxProperties);
    withKeys.push((_json, keys) => !(keys.length > max));
  }
}

// properties / patternProperties / additionalProperties: child traversal and the additionalProperties false rule
function compilePropertyTraversal(state: BuildState, node: RawNode, withKeys: KeysCheck[]): void {
  const { properties, patternProperties, additionalProperties } = node;
  const forbidAdditional = additionalProperties === false;
  let additional: Check | undefined;
  if (additionalProperties !== undefined && additionalProperties !== true && additionalProperties !== false) {
    additional = state.compileChild(additionalProperties);
    if (additional === ALWAYS_TRUE) {
      additional = undefined;
    }
  }
  // a key matched by nothing only matters when something reacts to it
  const needsUnmatched = forbidAdditional || additional !== undefined;

  let propertyChecks: Map<string, Check> | undefined;
  if (properties !== undefined) {
    const props = expectRecord(properties);
    const names = Object.keys(props);
    for (let i = 0; i < names.length; i++) {
      const built = state.compileChild(props[names[i]]);
      if (built !== ALWAYS_TRUE || needsUnmatched) {
        propertyChecks ??= new Map<string, Check>();
        propertyChecks.set(names[i], built);
      }
    }
  }

  const patterns: RegExp[] = [];
  const patternChecks: Check[] = [];
  if (patternProperties !== undefined) {
    const patternSchemas = expectRecord(patternProperties);
    const sources = Object.keys(patternSchemas);
    for (let i = 0; i < sources.length; i++) {
      const compiled = compileSchemaRegex(sources[i]);
      if (!compiled.ok) {
        continue; // skipped by the interpreter too
      }
      const built = state.compileChild(patternSchemas[sources[i]]);
      if (built !== ALWAYS_TRUE || needsUnmatched) {
        patterns.push(compiled.value);
        patternChecks.push(built);
      }
    }
  }

  // The options object is read at call time, like the interpreter does, so in-place edits of the array are honoured.
  const { options } = state.ctx;
  const patternCount = patterns.length;
  if (propertyChecks === undefined && patternCount === 0 && !needsUnmatched) {
    return;
  }
  withKeys.push((json, keys) => {
    for (let k = 0; k < keys.length; k++) {
      const key = keys[k];
      const value = json[key];
      let matched = false;
      if (propertyChecks !== undefined) {
        const check = propertyChecks.get(key);
        if (check !== undefined) {
          matched = true;
          if (!check(value)) {
            return false;
          }
        }
      }
      for (let i = 0; i < patternCount; i++) {
        if (patterns[i].test(key)) {
          matched = true;
          if (!patternChecks[i](value)) {
            return false;
          }
        }
      }
      if (!matched) {
        if (additional !== undefined) {
          if (!additional(value)) {
            return false;
          }
        } else if (forbidAdditional) {
          const assumed = options.assumeAdditional;
          if (!Array.isArray(assumed) || !assumed.includes(key)) {
            return false;
          }
        }
      }
    }
    return true;
  });
}

function compileDependencies(state: BuildState, node: RawNode, plain: ObjectCheck[]): void {
  const { dependencies } = node;
  if (dependencies === undefined) {
    return;
  }
  const definitions = expectRecord(dependencies);
  const names = Object.keys(definitions);
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    const definition = definitions[name];
    plain.push(
      Array.isArray(definition)
        ? requiresAll(name, expectStringArray(definition))
        : whenPresent(name, state.compileChild(definition))
    );
  }
}

function compileDependentKeywords(state: BuildState, node: RawNode, plain: ObjectCheck[]): void {
  if (!supportsDependentKeywords(node, state.ctx.options.version)) {
    return;
  }
  const { dependentRequired, dependentSchemas } = node;
  if (isObject(dependentRequired)) {
    const names = Object.keys(dependentRequired);
    for (let i = 0; i < names.length; i++) {
      const required = dependentRequired[names[i]] as unknown;
      // like the interpreter, a value that is not an array is skipped
      if (Array.isArray(required)) {
        plain.push(requiresAll(names[i], expectStringArray(required)));
      }
    }
  }
  if (isObject(dependentSchemas)) {
    const names = Object.keys(dependentSchemas);
    for (let i = 0; i < names.length; i++) {
      plain.push(whenPresent(names[i], state.compileChild(dependentSchemas[names[i]])));
    }
  }
}

function compilePropertyNames(state: BuildState, node: RawNode, withKeys: KeysCheck[]): void {
  if (node.propertyNames === undefined) {
    return;
  }
  const each = state.compileChild(node.propertyNames);
  if (each === ALWAYS_TRUE) {
    return;
  }
  withKeys.push((_json, keys) => {
    for (let i = 0; i < keys.length; i++) {
      if (!each(keys[i])) {
        return false;
      }
    }
    return true;
  });
}

// Every object keyword of a node, folded into one check so `Object.keys(json)` is computed once.
export function compileObjectKeywords(state: BuildState, node: JsonSchemaInternal, checks: Check[]): void {
  const raw = node as unknown as RawNode;
  const plain: ObjectCheck[] = [];
  const withKeys: KeysCheck[] = [];
  compileRequiredCheck(raw, plain);
  compileDependencies(state, raw, plain);
  compileDependentKeywords(state, raw, plain);
  compilePropertyCounts(raw, withKeys);
  compilePropertyTraversal(state, raw, withKeys);
  compilePropertyNames(state, raw, withKeys);
  const plainCount = plain.length;
  const keyedCount = withKeys.length;
  if (plainCount === 0 && keyedCount === 0) {
    return;
  }
  if (keyedCount === 0) {
    checks.push((json) => {
      if (!isObject(json)) {
        return true;
      }
      for (let i = 0; i < plainCount; i++) {
        if (!plain[i](json)) {
          return false;
        }
      }
      return true;
    });
    return;
  }
  checks.push((json) => {
    if (!isObject(json)) {
      return true;
    }
    for (let i = 0; i < plainCount; i++) {
      if (!plain[i](json)) {
        return false;
      }
    }
    const keys = Object.keys(json);
    for (let i = 0; i < keyedCount; i++) {
      if (!withKeys[i](json, keys)) {
        return false;
      }
    }
    return true;
  });
}
