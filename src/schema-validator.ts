import type { ZSchema } from './z-schema.js';
import { validate } from './json-validation.js';
import { Report } from './report.js';
import { isObject, whatIs } from './utils/what-is.js';
import { shallowClone } from './utils/clone.js';
import { JsonSchema, JsonSchemaInternal } from './json-schema.js';
import { isUniqueArray } from './utils/array.js';
import { isFormatSupported } from './format-validators.js';
import { compileSchemaRegex } from './utils/schema-regex.js';

const SchemaValidators = {
  $ref: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    // http://tools.ietf.org/html/draft-ietf-appsawg-json-pointer-07
    // http://tools.ietf.org/html/draft-pbryan-zyp-json-ref-03
    if (typeof schema.$ref !== 'string') {
      report.addError('KEYWORD_TYPE_EXPECTED', ['$ref', 'string']);
    }
  },
  $schema: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    // http://json-schema.org/latest/json-schema-core.html#rfc.section.6
    if (typeof schema.$schema !== 'string') {
      report.addError('KEYWORD_TYPE_EXPECTED', ['$schema', 'string']);
    }
  },
  multipleOf: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.1.1.1
    if (typeof schema.multipleOf !== 'number') {
      report.addError('KEYWORD_TYPE_EXPECTED', ['multipleOf', 'number']);
    } else if (schema.multipleOf <= 0) {
      report.addError('KEYWORD_MUST_BE', ['multipleOf', 'strictly greater than 0']);
    }
  },
  maximum: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.1.2.1
    if (typeof schema.maximum !== 'number') {
      report.addError('KEYWORD_TYPE_EXPECTED', ['maximum', 'number']);
    }
  },
  exclusiveMaximum: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.1.2.1
    if (typeof schema.exclusiveMaximum !== 'boolean') {
      report.addError('KEYWORD_TYPE_EXPECTED', ['exclusiveMaximum', 'boolean']);
    } else if (schema.maximum === undefined) {
      report.addError('KEYWORD_DEPENDENCY', ['exclusiveMaximum', 'maximum']);
    }
  },
  minimum: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.1.3.1
    if (typeof schema.minimum !== 'number') {
      report.addError('KEYWORD_TYPE_EXPECTED', ['minimum', 'number']);
    }
  },
  exclusiveMinimum: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.1.3.1
    if (typeof schema.exclusiveMinimum !== 'boolean') {
      report.addError('KEYWORD_TYPE_EXPECTED', ['exclusiveMinimum', 'boolean']);
    } else if (schema.minimum === undefined) {
      report.addError('KEYWORD_DEPENDENCY', ['exclusiveMinimum', 'minimum']);
    }
  },
  maxLength: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.2.1.1
    if (whatIs(schema.maxLength) !== 'integer') {
      report.addError('KEYWORD_TYPE_EXPECTED', ['maxLength', 'integer']);
    } else if (schema.maxLength! < 0) {
      report.addError('KEYWORD_MUST_BE', ['maxLength', 'greater than, or equal to 0']);
    }
  },
  minLength: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.2.2.1
    if (whatIs(schema.minLength) !== 'integer') {
      report.addError('KEYWORD_TYPE_EXPECTED', ['minLength', 'integer']);
    } else if (schema.minLength! < 0) {
      report.addError('KEYWORD_MUST_BE', ['minLength', 'greater than, or equal to 0']);
    }
  },
  pattern: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.2.3.1
    if (typeof schema.pattern !== 'string') {
      report.addError('KEYWORD_TYPE_EXPECTED', ['pattern', 'string']);
    } else {
      // Use shared regex compilation helper
      // Import at top of file
      const result = compileSchemaRegex(schema.pattern);
      if (!result.ok) {
        report.addError('KEYWORD_PATTERN', ['pattern', schema.pattern, result.error.message]);
      }
    }
  },
  additionalItems: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.3.1.1
    const type = whatIs(schema.additionalItems);
    if (type !== 'boolean' && type !== 'object') {
      report.addError('KEYWORD_TYPE_EXPECTED', ['additionalItems', ['boolean', 'object']]);
    } else if (isObject(schema.additionalItems)) {
      report.path.push('additionalItems');
      this.validateSchema(report, schema.additionalItems);
      report.path.pop();
    }
  },
  items: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.3.1.1
    const type = whatIs(schema.items);
    if (type === 'object') {
      report.path.push('items');
      this.validateSchema(report, schema.items!);
      report.path.pop();
    } else if (Array.isArray(schema.items)) {
      let idx = schema.items.length;
      while (idx--) {
        report.path.push('items');
        report.path.push(idx);
        this.validateSchema(report, schema.items[idx]);
        report.path.pop();
        report.path.pop();
      }
    } else {
      report.addError('KEYWORD_TYPE_EXPECTED', ['items', ['array', 'object']]);
    }

    // custom - strict mode
    if (this.options.forceAdditional === true && schema.additionalItems === undefined && Array.isArray(schema.items)) {
      report.addError('KEYWORD_UNDEFINED_STRICT', ['additionalItems']);
    }
    // custome - assume defined false mode
    if (this.options.assumeAdditional && schema.additionalItems === undefined && Array.isArray(schema.items)) {
      schema.additionalItems = false;
    }
  },
  maxItems: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.3.2.1
    if (typeof schema.maxItems !== 'number') {
      report.addError('KEYWORD_TYPE_EXPECTED', ['maxItems', 'integer']);
    } else if (schema.maxItems < 0) {
      report.addError('KEYWORD_MUST_BE', ['maxItems', 'greater than, or equal to 0']);
    }
  },
  minItems: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.3.3.1
    if (whatIs(schema.minItems) !== 'integer') {
      report.addError('KEYWORD_TYPE_EXPECTED', ['minItems', 'integer']);
    } else if (schema.minItems! < 0) {
      report.addError('KEYWORD_MUST_BE', ['minItems', 'greater than, or equal to 0']);
    }
  },
  uniqueItems: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.3.4.1
    if (typeof schema.uniqueItems !== 'boolean') {
      report.addError('KEYWORD_TYPE_EXPECTED', ['uniqueItems', 'boolean']);
    }
  },
  maxProperties: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.4.1.1
    if (whatIs(schema.maxProperties) !== 'integer') {
      report.addError('KEYWORD_TYPE_EXPECTED', ['maxProperties', 'integer']);
    } else if (schema.maxProperties! < 0) {
      report.addError('KEYWORD_MUST_BE', ['maxProperties', 'greater than, or equal to 0']);
    }
  },
  minProperties: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.4.2.1
    if (whatIs(schema.minProperties) !== 'integer') {
      report.addError('KEYWORD_TYPE_EXPECTED', ['minProperties', 'integer']);
    } else if (schema.minProperties! < 0) {
      report.addError('KEYWORD_MUST_BE', ['minProperties', 'greater than, or equal to 0']);
    }
  },
  required: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.4.3.1
    if (whatIs(schema.required) !== 'array') {
      report.addError('KEYWORD_TYPE_EXPECTED', ['required', 'array']);
    } else if (schema.required!.length === 0) {
      report.addError('KEYWORD_MUST_BE', ['required', 'an array with at least one element']);
    } else {
      let idx = schema.required!.length;
      while (idx--) {
        if (typeof schema.required![idx] !== 'string') {
          report.addError('KEYWORD_VALUE_TYPE', ['required', 'string']);
        }
      }
      if (isUniqueArray(schema.required!) === false) {
        report.addError('KEYWORD_MUST_BE', ['required', 'an array with unique items']);
      }
    }
  },
  additionalProperties: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.4.4.1
    const type = whatIs(schema.additionalProperties);
    if (type !== 'boolean' && type !== 'object') {
      report.addError('KEYWORD_TYPE_EXPECTED', ['additionalProperties', ['boolean', 'object']]);
    } else if (isObject(schema.additionalProperties)) {
      report.path.push('additionalProperties');
      this.validateSchema(report, schema.additionalProperties);
      report.path.pop();
    }
  },
  properties: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.4.4.1
    if (whatIs(schema.properties) !== 'object') {
      report.addError('KEYWORD_TYPE_EXPECTED', ['properties', 'object']);
      return;
    }

    const keys = Object.keys(schema.properties!);
    let idx = keys.length;
    while (idx--) {
      const key = keys[idx];
      const val = schema.properties![key];
      report.path.push('properties');
      report.path.push(key);
      this.validateSchema(report, val);
      report.path.pop();
      report.path.pop();
    }

    // custom - strict mode
    if (this.options.forceAdditional === true && schema.additionalProperties === undefined) {
      report.addError('KEYWORD_UNDEFINED_STRICT', ['additionalProperties']);
    }
    // custome - assume defined false mode
    if (this.options.assumeAdditional && schema.additionalProperties === undefined) {
      schema.additionalProperties = false;
    }
    // custom - forceProperties
    if (this.options.forceProperties === true && keys.length === 0) {
      report.addError('CUSTOM_MODE_FORCE_PROPERTIES', ['properties']);
    }
  },
  patternProperties: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.4.4.1
    if (whatIs(schema.patternProperties) !== 'object') {
      report.addError('KEYWORD_TYPE_EXPECTED', ['patternProperties', 'object']);
      return;
    }

    // Use shared regex compilation helper
    const keys = Object.keys(schema.patternProperties!);
    let idx = keys.length;
    while (idx--) {
      const key = keys[idx],
        val = schema.patternProperties![key];
      const result = compileSchemaRegex(key);
      if (!result.ok) {
        report.addError('KEYWORD_PATTERN', ['patternProperties', key, result.error.message]);
      }
      report.path.push('patternProperties');
      report.path.push(key);
      this.validateSchema(report, val);
      report.path.pop();
      report.path.pop();
    }

    // custom - forceProperties
    if (this.options.forceProperties === true && keys.length === 0) {
      report.addError('CUSTOM_MODE_FORCE_PROPERTIES', ['patternProperties']);
    }
  },
  dependencies: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.4.5.1
    if (whatIs(schema.dependencies) !== 'object') {
      report.addError('KEYWORD_TYPE_EXPECTED', ['dependencies', 'object']);
    } else {
      const keys = Object.keys(schema.dependencies!);
      let idx = keys.length;
      while (idx--) {
        const schemaKey = keys[idx];
        const schemaDependency = schema.dependencies![schemaKey];
        const type = whatIs(schemaDependency);
        if (type === 'object') {
          report.path.push('dependencies');
          report.path.push(schemaKey);
          this.validateSchema(report, schemaDependency as any);
          report.path.pop();
          report.path.pop();
        } else if (type === 'array') {
          let idx2 = schemaDependency.length;
          if (idx2 === 0) {
            report.addError('KEYWORD_MUST_BE', ['dependencies', 'not empty array']);
          }
          while (idx2--) {
            if (typeof schemaDependency[idx2] !== 'string') {
              report.addError('KEYWORD_VALUE_TYPE', ['dependensices', 'string']);
            }
          }
          if (isUniqueArray(schemaDependency) === false) {
            report.addError('KEYWORD_MUST_BE', ['dependencies', 'an array with unique items']);
          }
        } else {
          report.addError('KEYWORD_VALUE_TYPE', ['dependencies', 'object or array']);
        }
      }
    }
  },
  enum: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.5.1.1
    if (Array.isArray(schema.enum) === false) {
      report.addError('KEYWORD_TYPE_EXPECTED', ['enum', 'array']);
    } else if (schema.enum.length === 0) {
      report.addError('KEYWORD_MUST_BE', ['enum', 'an array with at least one element']);
    } else if (isUniqueArray(schema.enum) === false) {
      report.addError('KEYWORD_MUST_BE', ['enum', 'an array with unique elements']);
    }
  },
  type: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.5.2.1
    const primitiveTypes = ['array', 'boolean', 'integer', 'number', 'null', 'object', 'string'];
    const primitiveTypeStr = primitiveTypes.join(',');
    const isArray = Array.isArray(schema.type);

    if (Array.isArray(schema.type)) {
      let idx = schema.type.length;
      while (idx--) {
        if (primitiveTypes.indexOf(schema.type[idx]) === -1) {
          report.addError('KEYWORD_TYPE_EXPECTED', ['type', primitiveTypeStr]);
        }
      }
      if (isUniqueArray(schema.type) === false) {
        report.addError('KEYWORD_MUST_BE', ['type', 'an object with unique properties']);
      }
    } else if (typeof schema.type === 'string') {
      if (primitiveTypes.indexOf(schema.type) === -1) {
        report.addError('KEYWORD_TYPE_EXPECTED', ['type', primitiveTypeStr]);
      }
    } else {
      report.addError('KEYWORD_TYPE_EXPECTED', ['type', ['string', 'array']]);
    }

    if (this.options.noEmptyStrings === true) {
      if (schema.type === 'string' || (isArray && schema.type!.indexOf('string') !== -1)) {
        if (schema.minLength === undefined && schema.enum === undefined && schema.format === undefined) {
          schema.minLength = 1;
        }
      }
    }
    if (this.options.noEmptyArrays === true) {
      if (schema.type === 'array' || (isArray && schema.type!.indexOf('array') !== -1)) {
        if (schema.minItems === undefined) {
          schema.minItems = 1;
        }
      }
    }
    if (this.options.forceProperties === true) {
      if (schema.type === 'object' || (isArray && schema.type!.indexOf('object') !== -1)) {
        if (schema.properties === undefined && schema.patternProperties === undefined) {
          report.addError('KEYWORD_UNDEFINED_STRICT', ['properties']);
        }
      }
    }
    if (this.options.forceItems === true) {
      if (schema.type === 'array' || (isArray && schema.type!.indexOf('array') !== -1)) {
        if (schema.items === undefined) {
          report.addError('KEYWORD_UNDEFINED_STRICT', ['items']);
        }
      }
    }
    if (this.options.forceMinItems === true) {
      if (schema.type === 'array' || (isArray && schema.type!.indexOf('array') !== -1)) {
        if (schema.minItems === undefined) {
          report.addError('KEYWORD_UNDEFINED_STRICT', ['minItems']);
        }
      }
    }
    if (this.options.forceMaxItems === true) {
      if (schema.type === 'array' || (isArray && schema.type!.indexOf('array') !== -1)) {
        if (schema.maxItems === undefined) {
          report.addError('KEYWORD_UNDEFINED_STRICT', ['maxItems']);
        }
      }
    }
    if (this.options.forceMinLength === true) {
      if (schema.type === 'string' || (isArray && schema.type!.indexOf('string') !== -1)) {
        if (
          schema.minLength === undefined &&
          schema.format === undefined &&
          schema.enum === undefined &&
          schema.pattern === undefined
        ) {
          report.addError('KEYWORD_UNDEFINED_STRICT', ['minLength']);
        }
      }
    }
    if (this.options.forceMaxLength === true) {
      if (schema.type === 'string' || (isArray && schema.type!.indexOf('string') !== -1)) {
        if (
          schema.maxLength === undefined &&
          schema.format === undefined &&
          schema.enum === undefined &&
          schema.pattern === undefined
        ) {
          report.addError('KEYWORD_UNDEFINED_STRICT', ['maxLength']);
        }
      }
    }
  },
  allOf: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.5.3.1
    if (Array.isArray(schema.allOf) === false) {
      report.addError('KEYWORD_TYPE_EXPECTED', ['allOf', 'array']);
    } else if (schema.allOf.length === 0) {
      report.addError('KEYWORD_MUST_BE', ['allOf', 'an array with at least one element']);
    } else {
      let idx = schema.allOf.length;
      while (idx--) {
        report.path.push('allOf');
        report.path.push(idx);
        this.validateSchema(report, schema.allOf[idx]);
        report.path.pop();
        report.path.pop();
      }
    }
  },
  anyOf: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.5.4.1
    if (Array.isArray(schema.anyOf) === false) {
      report.addError('KEYWORD_TYPE_EXPECTED', ['anyOf', 'array']);
    } else if (schema.anyOf.length === 0) {
      report.addError('KEYWORD_MUST_BE', ['anyOf', 'an array with at least one element']);
    } else {
      let idx = schema.anyOf.length;
      while (idx--) {
        report.path.push('anyOf');
        report.path.push(idx);
        this.validateSchema(report, schema.anyOf[idx]);
        report.path.pop();
        report.path.pop();
      }
    }
  },
  oneOf: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.5.5.1
    if (Array.isArray(schema.oneOf) === false) {
      report.addError('KEYWORD_TYPE_EXPECTED', ['oneOf', 'array']);
    } else if (schema.oneOf.length === 0) {
      report.addError('KEYWORD_MUST_BE', ['oneOf', 'an array with at least one element']);
    } else {
      let idx = schema.oneOf.length;
      while (idx--) {
        report.path.push('oneOf');
        report.path.push(idx);
        this.validateSchema(report, schema.oneOf[idx]);
        report.path.pop();
        report.path.pop();
      }
    }
  },
  not: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.5.6.1
    if (whatIs(schema.not) !== 'object') {
      report.addError('KEYWORD_TYPE_EXPECTED', ['not', 'object']);
    } else {
      report.path.push('not');
      this.validateSchema(report, schema.not!);
      report.path.pop();
    }
  },
  definitions: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.5.7.1
    if (whatIs(schema.definitions) !== 'object') {
      report.addError('KEYWORD_TYPE_EXPECTED', ['definitions', 'object']);
    } else {
      const keys = Object.keys(schema.definitions!);
      let idx = keys.length;
      while (idx--) {
        const key = keys[idx],
          val = schema.definitions![key];
        report.path.push('definitions');
        report.path.push(key);
        this.validateSchema(report, val);
        report.path.pop();
        report.path.pop();
      }
    }
  },
  format: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    if (typeof schema.format !== 'string') {
      report.addError('KEYWORD_TYPE_EXPECTED', ['format', 'string']);
    } else {
      if (!isFormatSupported(schema.format) && this.options.ignoreUnknownFormats !== true) {
        report.addError('UNKNOWN_FORMAT', [schema.format]);
      }
    }
  },
  id: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    // http://json-schema.org/latest/json-schema-core.html#rfc.section.7.2
    if (typeof schema.id !== 'string') {
      report.addError('KEYWORD_TYPE_EXPECTED', ['id', 'string']);
    }
  },
  title: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.6.1
    if (typeof schema.title !== 'string') {
      report.addError('KEYWORD_TYPE_EXPECTED', ['title', 'string']);
    }
  },
  description: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.6.1
    if (typeof schema.description !== 'string') {
      report.addError('KEYWORD_TYPE_EXPECTED', ['description', 'string']);
    }
  },
  default: function (this: SchemaValidator /* report, schema */) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.6.2
    // There are no restrictions placed on the value of this keyword.
  },
} as const;

export class SchemaValidator {
  constructor(private validator: ZSchema) {}

  get options() {
    return this.validator.options;
  }

  validateArrayOfSchemas(report: Report, arr: JsonSchemaInternal[]) {
    let idx = arr.length;
    while (idx--) {
      this.validateSchema(report, arr[idx]);
    }
    return report.isValid();
  }

  validateSchema(report: Report, schema: JsonSchemaInternal | JsonSchemaInternal[]) {
    report.commonErrorMessage = 'SCHEMA_VALIDATION_FAILED';

    // if schema is an array, assume it's an array of schemas
    if (Array.isArray(schema)) {
      return this.validateArrayOfSchemas(report, schema);
    }

    // do not revalidate schema that has already been validated once
    if (schema.__$validated) {
      return true;
    }

    // if $schema is present, this schema should validate against that $schema
    const hasParentSchema = schema.$schema && schema.id !== schema.$schema;
    if (hasParentSchema) {
      if (schema.__$schemaResolved && schema.__$schemaResolved !== schema) {
        const subReport = new Report(report);
        const valid = validate.call(this.validator, subReport, schema.__$schemaResolved, schema);
        if (valid === false) {
          report.addError('PARENT_SCHEMA_VALIDATION_FAILED', undefined, subReport);
        }
      } else {
        if (this.validator.options.ignoreUnresolvableReferences !== true) {
          report.addError('REF_UNRESOLVED', [schema.$schema!]);
        }
      }
    }

    if (this.validator.options.noTypeless === true) {
      // issue #36 - inherit type to anyOf, oneOf, allOf if noTypeless is defined
      if (schema.type !== undefined) {
        let schemas: JsonSchema[] = [];
        if (Array.isArray(schema.anyOf)) {
          schemas = schemas.concat(schema.anyOf);
        }
        if (Array.isArray(schema.oneOf)) {
          schemas = schemas.concat(schema.oneOf);
        }
        if (Array.isArray(schema.allOf)) {
          schemas = schemas.concat(schema.allOf);
        }
        schemas.forEach(function (sch) {
          if (!sch.type) {
            sch.type = schema.type;
          }
        });
      }
      // end issue #36
      if (
        schema.enum === undefined &&
        schema.type === undefined &&
        schema.anyOf === undefined &&
        schema.oneOf === undefined &&
        schema.not === undefined &&
        schema.$ref === undefined
      ) {
        report.addError('KEYWORD_UNDEFINED_STRICT', ['type']);
      }
    }

    const keys = Object.keys(schema);
    let idx = keys.length;
    while (idx--) {
      const key = keys[idx];
      if (key.indexOf('__') === 0) {
        continue;
      }
      if (Object.prototype.hasOwnProperty.call(SchemaValidators, key)) {
        SchemaValidators[key as keyof typeof SchemaValidators].call(this, report, schema);
      } else if (!hasParentSchema) {
        if (this.validator.options.noExtraKeywords === true) {
          report.addError('KEYWORD_UNEXPECTED', [key]);
        }
      }
    }

    if (this.validator.options.pedanticCheck === true) {
      if (schema.enum) {
        // break recursion
        const tmpSchema = shallowClone(schema);
        delete tmpSchema.enum;
        delete tmpSchema.default;

        report.path.push('enum');
        idx = schema.enum.length;
        while (idx--) {
          report.path.push(idx);
          validate.call(this.validator, report, tmpSchema, schema.enum[idx]);
          report.path.pop();
        }
        report.path.pop();
      }

      if (schema.default) {
        report.path.push('default');
        validate.call(this.validator, report, schema, schema.default);
        report.path.pop();
      }
    }

    const isValid = report.isValid();
    if (isValid) {
      schema.__$validated = true;
    }
    return isValid;
  }
}
