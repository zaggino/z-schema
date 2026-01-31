import { FormatValidators } from './FormatValidators.js';
import { Report } from './Report.js';
import { whatIs } from './utils/what-is.js';
import { ucs2decode } from './utils/ucs2-decode.js';
import { isUniqueArray } from './utils/is-unique-array.js';
import { difference } from './utils/difference.js';
import { areEqual } from './utils/are-equal.js';
import { shallowClone } from './utils/shallow-clone.js';

const shouldSkipValidate = function (options, errors) {
  return (
    options &&
    Array.isArray(options.includeErrors) &&
    options.includeErrors.length > 0 &&
    !errors.some(function (err) {
      return options.includeErrors.includes(err);
    })
  );
};

export const JsonValidators = {
  multipleOf: function (report, schema, json) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.1.1.2
    if (shouldSkipValidate(this.validateOptions, ['MULTIPLE_OF'])) {
      return;
    }
    if (typeof json !== 'number') {
      return;
    }

    const stringMultipleOf = String(schema.multipleOf);
    const scale = Math.pow(10, stringMultipleOf.length - stringMultipleOf.indexOf('.') - 1);
    if (whatIs((json * scale) / (schema.multipleOf * scale)) !== 'integer') {
      report.addError('MULTIPLE_OF', [json, schema.multipleOf], null, schema);
    }
  },
  maximum: function (report, schema, json) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.1.2.2
    if (shouldSkipValidate(this.validateOptions, ['MAXIMUM', 'MAXIMUM_EXCLUSIVE'])) {
      return;
    }
    if (typeof json !== 'number') {
      return;
    }
    if (schema.exclusiveMaximum !== true) {
      if (json > schema.maximum) {
        report.addError('MAXIMUM', [json, schema.maximum], null, schema);
      }
    } else {
      if (json >= schema.maximum) {
        report.addError('MAXIMUM_EXCLUSIVE', [json, schema.maximum], null, schema);
      }
    }
  },
  exclusiveMaximum: function () {
    // covered in maximum
  },
  minimum: function (report, schema, json) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.1.3.2
    if (shouldSkipValidate(this.validateOptions, ['MINIMUM', 'MINIMUM_EXCLUSIVE'])) {
      return;
    }
    if (typeof json !== 'number') {
      return;
    }
    if (schema.exclusiveMinimum !== true) {
      if (json < schema.minimum) {
        report.addError('MINIMUM', [json, schema.minimum], null, schema);
      }
    } else {
      if (json <= schema.minimum) {
        report.addError('MINIMUM_EXCLUSIVE', [json, schema.minimum], null, schema);
      }
    }
  },
  exclusiveMinimum: function () {
    // covered in minimum
  },
  maxLength: function (report, schema, json) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.2.1.2
    if (shouldSkipValidate(this.validateOptions, ['MAX_LENGTH'])) {
      return;
    }
    if (typeof json !== 'string') {
      return;
    }
    if (ucs2decode(json).length > schema.maxLength) {
      report.addError('MAX_LENGTH', [json.length, schema.maxLength], null, schema);
    }
  },
  minLength: function (report, schema, json) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.2.2.2
    if (shouldSkipValidate(this.validateOptions, ['MIN_LENGTH'])) {
      return;
    }
    if (typeof json !== 'string') {
      return;
    }
    if (ucs2decode(json).length < schema.minLength) {
      report.addError('MIN_LENGTH', [json.length, schema.minLength], null, schema);
    }
  },
  pattern: function (report, schema, json) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.2.3.2
    if (shouldSkipValidate(this.validateOptions, ['PATTERN'])) {
      return;
    }
    if (typeof json !== 'string') {
      return;
    }
    if (RegExp(schema.pattern).test(json) === false) {
      report.addError('PATTERN', [schema.pattern, json], null, schema);
    }
  },
  additionalItems: function (report, schema, json) {
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
        report.addError('ARRAY_ADDITIONAL_ITEMS', null, null, schema);
      }
    }
  },
  items: function () {
    /*report, schema, json*/
    // covered in additionalItems
  },
  maxItems: function (report, schema, json) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.3.2.2
    if (shouldSkipValidate(this.validateOptions, ['ARRAY_LENGTH_LONG'])) {
      return;
    }
    if (!Array.isArray(json)) {
      return;
    }
    if (json.length > schema.maxItems) {
      report.addError('ARRAY_LENGTH_LONG', [json.length, schema.maxItems], null, schema);
    }
  },
  minItems: function (report, schema, json) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.3.3.2
    if (shouldSkipValidate(this.validateOptions, ['ARRAY_LENGTH_SHORT'])) {
      return;
    }
    if (!Array.isArray(json)) {
      return;
    }
    if (json.length < schema.minItems) {
      report.addError('ARRAY_LENGTH_SHORT', [json.length, schema.minItems], null, schema);
    }
  },
  uniqueItems: function (report, schema, json) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.3.4.2
    if (shouldSkipValidate(this.validateOptions, ['ARRAY_UNIQUE'])) {
      return;
    }
    if (!Array.isArray(json)) {
      return;
    }
    if (schema.uniqueItems === true) {
      const matches = [];
      if (isUniqueArray(json, matches) === false) {
        report.addError('ARRAY_UNIQUE', matches, null, schema);
      }
    }
  },
  maxProperties: function (report, schema, json) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.4.1.2
    if (shouldSkipValidate(this.validateOptions, ['OBJECT_PROPERTIES_MAXIMUM'])) {
      return;
    }
    if (whatIs(json) !== 'object') {
      return;
    }
    const keysCount = Object.keys(json).length;
    if (keysCount > schema.maxProperties) {
      report.addError('OBJECT_PROPERTIES_MAXIMUM', [keysCount, schema.maxProperties], null, schema);
    }
  },
  minProperties: function (report, schema, json) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.4.2.2
    if (shouldSkipValidate(this.validateOptions, ['OBJECT_PROPERTIES_MINIMUM'])) {
      return;
    }
    if (whatIs(json) !== 'object') {
      return;
    }
    const keysCount = Object.keys(json).length;
    if (keysCount < schema.minProperties) {
      report.addError('OBJECT_PROPERTIES_MINIMUM', [keysCount, schema.minProperties], null, schema);
    }
  },
  required: function (report, schema, json) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.4.3.2
    if (shouldSkipValidate(this.validateOptions, ['OBJECT_MISSING_REQUIRED_PROPERTY'])) {
      return;
    }
    if (whatIs(json) !== 'object') {
      return;
    }
    let idx = schema.required.length;
    while (idx--) {
      const requiredPropertyName = schema.required[idx];
      if (json[requiredPropertyName] === undefined) {
        report.addError('OBJECT_MISSING_REQUIRED_PROPERTY', [requiredPropertyName], null, schema);
      }
    }
  },
  additionalProperties: function (report, schema, json) {
    // covered in properties and patternProperties
    if (schema.properties === undefined && schema.patternProperties === undefined) {
      return JsonValidators.properties.call(this, report, schema, json);
    }
  },
  patternProperties: function (report, schema, json) {
    // covered in properties
    if (schema.properties === undefined) {
      return JsonValidators.properties.call(this, report, schema, json);
    }
  },
  properties: function (report, schema, json) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.4.4.2
    if (shouldSkipValidate(this.validateOptions, ['OBJECT_ADDITIONAL_PROPERTIES'])) {
      return;
    }
    if (whatIs(json) !== 'object') {
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
      let idx = pp.length;
      while (idx--) {
        const regExp = RegExp(pp[idx]);
        let idx2 = s.length;
        while (idx2--) {
          if (regExp.test(s[idx2]) === true) {
            s.splice(idx2, 1);
          }
        }
      }
      // Validation of the json succeeds if, after these two steps, set "s" is empty.
      if (s.length > 0) {
        // assumeAdditional can be an array of allowed properties
        let idx3 = this.options.assumeAdditional.length;
        if (idx3) {
          while (idx3--) {
            const io = s.indexOf(this.options.assumeAdditional[idx3]);
            if (io !== -1) {
              s.splice(io, 1);
            }
          }
        }
        let idx4 = s.length;
        if (idx4) {
          while (idx4--) {
            report.addError('OBJECT_ADDITIONAL_PROPERTIES', [s[idx4]], null, schema);
          }
        }
      }
    }
  },
  dependencies: function (report, schema, json) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.4.5.2
    if (shouldSkipValidate(this.validateOptions, ['OBJECT_DEPENDENCY_KEY'])) {
      return;
    }
    if (whatIs(json) !== 'object') {
      return;
    }

    const keys = Object.keys(schema.dependencies);
    let idx = keys.length;

    while (idx--) {
      // iterate all dependencies
      const dependencyName = keys[idx];
      if (json[dependencyName]) {
        const dependencyDefinition = schema.dependencies[dependencyName];
        if (whatIs(dependencyDefinition) === 'object') {
          // if dependency is a schema, validate against this schema
          validate.call(this, report, dependencyDefinition, json);
        } else {
          // Array
          // if dependency is an array, object needs to have all properties in this array
          let idx2 = dependencyDefinition.length;
          while (idx2--) {
            const requiredPropertyName = dependencyDefinition[idx2];
            if (json[requiredPropertyName] === undefined) {
              report.addError('OBJECT_DEPENDENCY_KEY', [requiredPropertyName, dependencyName], null, schema);
            }
          }
        }
      }
    }
  },
  enum: function (report, schema, json) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.5.1.2
    if (shouldSkipValidate(this.validateOptions, ['ENUM_CASE_MISMATCH', 'ENUM_MISMATCH'])) {
      return;
    }
    let match = false,
      caseInsensitiveMatch = false,
      idx = schema.enum.length;
    while (idx--) {
      if (areEqual(json, schema.enum[idx])) {
        match = true;
        break;
      } else if (areEqual(json, schema.enum[idx], { caseInsensitiveComparison: true })) {
        caseInsensitiveMatch = true;
      }
    }

    if (match === false) {
      const error =
        caseInsensitiveMatch && this.options.enumCaseInsensitiveComparison ? 'ENUM_CASE_MISMATCH' : 'ENUM_MISMATCH';
      report.addError(error, [json], null, schema);
    }
  },
  type: function (report, schema, json) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.5.2.2
    if (shouldSkipValidate(this.validateOptions, ['INVALID_TYPE'])) {
      return;
    }
    const jsonType = whatIs(json);
    if (typeof schema.type === 'string') {
      if (jsonType !== schema.type && (jsonType !== 'integer' || schema.type !== 'number')) {
        report.addError('INVALID_TYPE', [schema.type, jsonType], null, schema);
      }
    } else {
      if (schema.type.indexOf(jsonType) === -1 && (jsonType !== 'integer' || schema.type.indexOf('number') === -1)) {
        report.addError('INVALID_TYPE', [schema.type, jsonType], null, schema);
      }
    }
  },
  allOf: function (report, schema, json) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.5.3.2
    let idx = schema.allOf.length;
    while (idx--) {
      const validateResult = validate.call(this, report, schema.allOf[idx], json);
      if (this.options.breakOnFirstError && validateResult === false) {
        break;
      }
    }
  },
  anyOf: function (report, schema, json) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.5.4.2
    const subReports = [];
    let passed = false;
    let idx = schema.anyOf.length;

    while (idx-- && passed === false) {
      const subReport = new Report(report);
      subReports.push(subReport);
      passed = validate.call(this, subReport, schema.anyOf[idx], json);
    }

    if (passed === false) {
      report.addError('ANY_OF_MISSING', undefined, subReports, schema);
    }
  },
  oneOf: function (report, schema, json) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.5.5.2
    let passes = 0;
    const subReports = [];
    let idx = schema.oneOf.length;

    while (idx--) {
      const subReport = new Report(report, { maxErrors: 1 });
      subReports.push(subReport);
      if (validate.call(this, subReport, schema.oneOf[idx], json) === true) {
        passes++;
      }
    }

    if (passes === 0) {
      report.addError('ONE_OF_MISSING', undefined, subReports, schema);
    } else if (passes > 1) {
      report.addError('ONE_OF_MULTIPLE', null, null, schema);
    }
  },
  not: function (report, schema, json) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.5.6.2
    const subReport = new Report(report);
    if (validate.call(this, subReport, schema.not, json) === true) {
      report.addError('NOT_PASSED', null, null, schema);
    }
  },
  definitions: function () {
    /*report, schema, json*/
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.5.7.2
    // nothing to do here
  },
  format: function (report, schema, json) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.7.2
    const formatValidatorFn = FormatValidators[schema.format];
    if (typeof formatValidatorFn === 'function') {
      if (shouldSkipValidate(this.validateOptions, ['INVALID_FORMAT'])) {
        return;
      }
      if (report.hasError('INVALID_TYPE', [schema.type, whatIs(json)])) {
        return;
      }
      if (formatValidatorFn.length === 2) {
        // async - need to clone the path here, because it will change by the time async function reports back
        const pathBeforeAsync = shallowClone(report.path);
        report.addAsyncTask(formatValidatorFn, [json], function (result) {
          if (result !== true) {
            const backup = report.path;
            report.path = pathBeforeAsync;
            report.addError('INVALID_FORMAT', [schema.format, json], null, schema);
            report.path = backup;
          }
        });
      } else {
        // sync
        if (formatValidatorFn.call(this, json) !== true) {
          report.addError('INVALID_FORMAT', [schema.format, json], null, schema);
        }
      }
    } else if (this.options.ignoreUnknownFormats !== true) {
      report.addError('UNKNOWN_FORMAT', [schema.format], null, schema);
    }
  },
};

const recurseArray = function (report, schema, json) {
  // http://json-schema.org/latest/json-schema-validation.html#rfc.section.8.2

  let idx = json.length;

  // If "items" is an array, this situation, the schema depends on the index:
  // if the index is less than, or equal to, the size of "items",
  // the child instance must be valid against the corresponding schema in the "items" array;
  // otherwise, it must be valid against the schema defined by "additionalItems".
  if (Array.isArray(schema.items)) {
    while (idx--) {
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
  } else if (typeof schema.items === 'object') {
    // If items is a schema, then the child instance must be valid against this schema,
    // regardless of its index, and regardless of the value of "additionalItems".
    while (idx--) {
      report.path.push(idx);
      validate.call(this, report, schema.items, json[idx]);
      report.path.pop();
    }
  }
};

const recurseObject = function (report, schema, json) {
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
  let idx = keys.length;

  while (idx--) {
    const m = keys[idx],
      propertyValue = json[m];

    // s - The set of schemas for the child instance.
    const s = [];

    // 1. If set "p" contains value "m", then the corresponding schema in "properties" is added to "s".
    if (p.indexOf(m) !== -1) {
      s.push(schema.properties[m]);
    }

    // 2. For each regex in "pp", if it matches "m" successfully, the corresponding schema in "patternProperties" is added to "s".
    let idx2 = pp.length;
    while (idx2--) {
      const regexString = pp[idx2];
      if (RegExp(regexString).test(m) === true) {
        s.push(schema.patternProperties[regexString]);
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
    idx2 = s.length;
    while (idx2--) {
      report.path.push(m);
      validate.call(this, report, s[idx2], propertyValue);
      report.path.pop();
    }
  }
};

/**
 *
 * @param {Report} report
 * @param {*} schema
 * @param {*} json
 */
export function validate(report, schema, json) {
  report.commonErrorMessage = 'JSON_OBJECT_VALIDATION_FAILED';

  // check if schema is an object
  const to = whatIs(schema);
  if (to !== 'object') {
    report.addError('SCHEMA_NOT_AN_OBJECT', [to], null, schema);
    return false;
  }

  // check if schema is empty, everything is valid against empty schema
  let keys = Object.keys(schema);
  if (keys.length === 0) {
    return true;
  }

  // this method can be called recursively, so we need to remember our root
  let isRoot = false;
  if (!report.rootSchema) {
    report.rootSchema = schema;
    isRoot = true;
  }

  // follow schema.$ref keys
  if (schema.$ref !== undefined) {
    // avoid infinite loop with maxRefs
    let maxRefs = 99;
    while (schema.$ref && maxRefs > 0) {
      if (!schema.__$refResolved) {
        report.addError('REF_UNRESOLVED', [schema.$ref], null, schema);
        break;
      } else if (schema.__$refResolved === schema) {
        break;
      } else {
        schema = schema.__$refResolved;
        keys = Object.keys(schema);
      }
      maxRefs--;
    }
    if (maxRefs === 0) {
      throw new Error('Circular dependency by $ref references!');
    }
  }

  // type checking first
  const jsonType = whatIs(json);
  if (schema.type) {
    keys.splice(keys.indexOf('type'), 1);
    JsonValidators.type.call(this, report, schema, json);
    if (report.errors.length && this.options.breakOnFirstError) {
      return false;
    }
  }

  // now iterate all the keys in schema and execute validation methods
  let idx = keys.length;
  while (idx--) {
    if (JsonValidators[keys[idx]]) {
      JsonValidators[keys[idx]].call(this, report, schema, json);
      if (report.errors.length && this.options.breakOnFirstError) {
        break;
      }
    }
  }

  if (report.errors.length === 0 || this.options.breakOnFirstError === false) {
    if (jsonType === 'array') {
      recurseArray.call(this, report, schema, json);
    } else if (jsonType === 'object') {
      recurseObject.call(this, report, schema, json);
    }
  }

  if (typeof this.options.customValidator === 'function') {
    this.options.customValidator.call(this, report, schema, json);
  }

  // we don't need the root pointer anymore
  if (isRoot) {
    report.rootSchema = undefined;
  }

  // return valid just to be able to break at some code points
  return report.errors.length === 0;
}
