import type { JsonSchemaInternal } from '../json-schema-versions.js';
import type { Report } from '../report.js';
import type { ZSchemaBase } from '../z-schema-base.js';

import { difference } from '../utils/array.js';
import { compileSchemaRegex } from '../utils/schema-regex.js';
import { isObject } from '../utils/what-is.js';
import { deferOrRunSync, shouldSkipValidate, supportsDependentKeywords } from './shared.js';

// ---------------------------------------------------------------------------
// maxProperties
// ---------------------------------------------------------------------------

export function maxPropertiesValidator(this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
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
}

// ---------------------------------------------------------------------------
// minProperties
// ---------------------------------------------------------------------------

export function minPropertiesValidator(this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
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
}

// ---------------------------------------------------------------------------
// required
// ---------------------------------------------------------------------------

export function requiredValidator(this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
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
}

// ---------------------------------------------------------------------------
// additionalProperties  (delegates to properties when standalone)
// ---------------------------------------------------------------------------

export function additionalPropertiesValidator(
  this: ZSchemaBase,
  report: Report,
  schema: JsonSchemaInternal,
  json: unknown
) {
  // covered in properties and patternProperties
  if (schema.properties === undefined && schema.patternProperties === undefined) {
    return propertiesValidator.call(this, report, schema, json);
  }
}

// ---------------------------------------------------------------------------
// patternProperties  (delegates to properties when standalone)
// ---------------------------------------------------------------------------

export function patternPropertiesValidator(
  this: ZSchemaBase,
  report: Report,
  schema: JsonSchemaInternal,
  json: unknown
) {
  // covered in properties
  if (schema.properties === undefined) {
    return propertiesValidator.call(this, report, schema, json);
  }
}

// ---------------------------------------------------------------------------
// properties
// ---------------------------------------------------------------------------

export function propertiesValidator(this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
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

export function dependenciesValidator(this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
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
        this._jsonValidate(report, dependencyDefinition, json);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// dependentSchemas
// ---------------------------------------------------------------------------

export function dependentSchemasValidator(
  this: ZSchemaBase,
  report: Report,
  schema: JsonSchemaInternal,
  json: unknown
) {
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
      this._jsonValidate(report, dependencySchema, json);
    }
  }
}

// ---------------------------------------------------------------------------
// dependentRequired
// ---------------------------------------------------------------------------

export function dependentRequiredValidator(
  this: ZSchemaBase,
  report: Report,
  schema: JsonSchemaInternal,
  json: unknown
) {
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
}

// ---------------------------------------------------------------------------
// propertyNames
// ---------------------------------------------------------------------------

export function propertyNamesValidator(this: ZSchemaBase, report: Report, schema: JsonSchemaInternal, json: unknown) {
  if (shouldSkipValidate(this.validateOptions, ['PROPERTY_NAMES'])) {
    return;
  }

  if (!isObject(json)) {
    return;
  }

  const propertyNamesSchema = schema.propertyNames;
  if (propertyNamesSchema === undefined) {
    return;
  }

  const Report_ = report.constructor as typeof Report;
  const keys = Object.keys(json);
  const subReports: Report[] = [];
  for (const key of keys) {
    const subReport = new Report_(report);
    subReports.push(subReport);
    this._jsonValidate(subReport, propertyNamesSchema as any, key);
  }

  const addPropertyNameErrors = () => {
    for (let idx = 0; idx < keys.length; idx++) {
      if (subReports[idx].errors.length > 0) {
        report.addError('PROPERTY_NAMES', [keys[idx]], subReports[idx], schema, undefined);
      }
    }
  };

  deferOrRunSync(report, subReports, addPropertyNameErrors);
}
