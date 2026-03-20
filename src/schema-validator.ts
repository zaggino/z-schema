import type { JsonSchema, JsonSchemaInternal } from './json-schema-versions.js';
import type { ZSchemaBase } from './z-schema-base.js';

import { isFormatSupported } from './format-validators.js';
import { getId } from './json-schema.js';
import { validate } from './json-validation.js';
import { Report } from './report.js';
import { isUniqueArray } from './utils/array.js';
import { shallowClone } from './utils/clone.js';
import { compileSchemaRegex } from './utils/schema-regex.js';
import { isInteger, isObject } from './utils/what-is.js';

const SchemaValidators = {
  $ref: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    // http://tools.ietf.org/html/draft-ietf-appsawg-json-pointer-07
    // http://tools.ietf.org/html/draft-pbryan-zyp-json-ref-03
    if (typeof schema.$ref !== 'string') {
      report.addError('KEYWORD_TYPE_EXPECTED', ['$ref', 'string'], undefined, schema, '$ref');
    }
  },
  $schema: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    // http://json-schema.org/latest/json-schema-core.html#rfc.section.6
    if (typeof schema.$schema !== 'string') {
      report.addError('KEYWORD_TYPE_EXPECTED', ['$schema', 'string'], undefined, schema, '$schema');
    }
  },
  multipleOf: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.1.1.1
    if (typeof schema.multipleOf !== 'number') {
      report.addError('KEYWORD_TYPE_EXPECTED', ['multipleOf', 'number'], undefined, schema, 'multipleOf');
    } else if (schema.multipleOf <= 0) {
      report.addError('KEYWORD_MUST_BE', ['multipleOf', 'strictly greater than 0'], undefined, schema, 'multipleOf');
    }
  },
  maximum: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.1.2.1
    if (typeof schema.maximum !== 'number') {
      report.addError('KEYWORD_TYPE_EXPECTED', ['maximum', 'number'], undefined, schema, 'maximum');
    }
  },
  exclusiveMaximum: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.1.2.1
    if (report.options.version === 'draft-04') {
      if (typeof schema.exclusiveMaximum !== 'boolean') {
        report.addError(
          'KEYWORD_TYPE_EXPECTED',
          ['exclusiveMaximum', 'boolean'],
          undefined,
          schema,
          'exclusiveMaximum'
        );
      } else if (schema.maximum === undefined) {
        report.addError('KEYWORD_DEPENDENCY', ['exclusiveMaximum', 'maximum'], undefined, schema, 'exclusiveMaximum');
      }
    } else {
      if (typeof schema.exclusiveMaximum !== 'boolean' && typeof schema.exclusiveMaximum !== 'number') {
        report.addError(
          'KEYWORD_TYPE_EXPECTED',
          ['exclusiveMaximum', ['boolean', 'number']],
          undefined,
          schema,
          'exclusiveMaximum'
        );
      }
    }
  },
  minimum: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.1.3.1
    if (typeof schema.minimum !== 'number') {
      report.addError('KEYWORD_TYPE_EXPECTED', ['minimum', 'number'], undefined, schema, 'minimum');
    }
  },
  exclusiveMinimum: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    if (report.options.version === 'draft-04') {
      // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.1.3.1
      if (typeof schema.exclusiveMinimum !== 'boolean') {
        report.addError(
          'KEYWORD_TYPE_EXPECTED',
          ['exclusiveMinimum', 'boolean'],
          undefined,
          schema,
          'exclusiveMinimum'
        );
      } else if (schema.minimum === undefined) {
        report.addError('KEYWORD_DEPENDENCY', ['exclusiveMinimum', 'minimum'], undefined, schema, 'exclusiveMinimum');
      }
    } else {
      if (typeof schema.exclusiveMinimum !== 'boolean' && typeof schema.exclusiveMinimum !== 'number') {
        report.addError(
          'KEYWORD_TYPE_EXPECTED',
          ['exclusiveMinimum', ['boolean', 'number']],
          undefined,
          schema,
          'exclusiveMinimum'
        );
      }
    }
  },
  maxLength: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.2.1.1
    if (!isInteger(schema.maxLength)) {
      report.addError('KEYWORD_TYPE_EXPECTED', ['maxLength', 'integer'], undefined, schema, 'maxLength');
    } else if (schema.maxLength < 0) {
      report.addError('KEYWORD_MUST_BE', ['maxLength', 'greater than, or equal to 0'], undefined, schema, 'maxLength');
    }
  },
  minLength: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.2.2.1
    if (!isInteger(schema.minLength)) {
      report.addError('KEYWORD_TYPE_EXPECTED', ['minLength', 'integer'], undefined, schema, 'minLength');
    } else if (schema.minLength < 0) {
      report.addError('KEYWORD_MUST_BE', ['minLength', 'greater than, or equal to 0'], undefined, schema, 'minLength');
    }
  },
  pattern: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.2.3.1
    if (typeof schema.pattern !== 'string') {
      report.addError('KEYWORD_TYPE_EXPECTED', ['pattern', 'string'], undefined, schema, 'pattern');
    } else {
      // Use shared regex compilation helper
      // Import at top of file
      const result = compileSchemaRegex(schema.pattern);
      if (!result.ok) {
        report.addError(
          'KEYWORD_PATTERN',
          ['pattern', schema.pattern, result.error.message],
          undefined,
          schema,
          'pattern'
        );
      }
    }
  },
  additionalItems: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.3.1.1
    if (typeof schema.additionalItems !== 'boolean' && !isObject(schema.additionalItems)) {
      report.addError(
        'KEYWORD_TYPE_EXPECTED',
        ['additionalItems', ['boolean', 'object']],
        undefined,
        schema,
        'additionalItems'
      );
    } else if (isObject(schema.additionalItems)) {
      report.path.push('additionalItems');
      this.validateSchema(report, schema.additionalItems);
      report.path.pop();
    }
  },
  items: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.3.1.1
    if (Array.isArray(schema.items)) {
      for (let idx = 0; idx < schema.items.length; idx++) {
        report.path.push('items');
        report.path.push(idx);
        this.validateSchema(report, schema.items[idx]);
        report.path.pop();
        report.path.pop();
      }
    } else if (isObject(schema.items) || (report.options.version !== 'draft-04' && typeof schema.items === 'boolean')) {
      report.path.push('items');
      this.validateSchema(report, schema.items as JsonSchemaInternal);
      report.path.pop();
    } else {
      report.addError(
        'KEYWORD_TYPE_EXPECTED',
        ['items', report.options.version === 'draft-04' ? ['array', 'object'] : ['array', 'object', 'boolean']],
        undefined,
        schema,
        'items'
      );
    }

    // custom - strict mode
    if (this.options.forceAdditional === true && schema.additionalItems === undefined && Array.isArray(schema.items)) {
      report.addError('KEYWORD_UNDEFINED_STRICT', ['additionalItems'], undefined, schema, 'additionalItems');
    }
    // custom - assume defined false mode
    if (this.options.assumeAdditional && schema.additionalItems === undefined && Array.isArray(schema.items)) {
      schema.additionalItems = false;
    }
  },
  maxItems: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.3.2.1
    if (typeof schema.maxItems !== 'number') {
      report.addError('KEYWORD_TYPE_EXPECTED', ['maxItems', 'integer'], undefined, schema, 'maxItems');
    } else if (schema.maxItems < 0) {
      report.addError('KEYWORD_MUST_BE', ['maxItems', 'greater than, or equal to 0'], undefined, schema, 'maxItems');
    }
  },
  minItems: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.3.3.1
    if (!isInteger(schema.minItems)) {
      report.addError('KEYWORD_TYPE_EXPECTED', ['minItems', 'integer'], undefined, schema, 'minItems');
    } else if (schema.minItems < 0) {
      report.addError('KEYWORD_MUST_BE', ['minItems', 'greater than, or equal to 0'], undefined, schema, 'minItems');
    }
  },
  uniqueItems: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.3.4.1
    if (typeof schema.uniqueItems !== 'boolean') {
      report.addError('KEYWORD_TYPE_EXPECTED', ['uniqueItems', 'boolean'], undefined, schema, 'uniqueItems');
    }
  },
  maxProperties: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.4.1.1
    if (!isInteger(schema.maxProperties)) {
      report.addError('KEYWORD_TYPE_EXPECTED', ['maxProperties', 'integer'], undefined, schema, 'maxProperties');
    } else if (schema.maxProperties < 0) {
      report.addError(
        'KEYWORD_MUST_BE',
        ['maxProperties', 'greater than, or equal to 0'],
        undefined,
        schema,
        'maxProperties'
      );
    }
  },
  minProperties: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.4.2.1
    if (!isInteger(schema.minProperties)) {
      report.addError('KEYWORD_TYPE_EXPECTED', ['minProperties', 'integer'], undefined, schema, 'minProperties');
    } else if (schema.minProperties < 0) {
      report.addError(
        'KEYWORD_MUST_BE',
        ['minProperties', 'greater than, or equal to 0'],
        undefined,
        schema,
        'minProperties'
      );
    }
  },
  required: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.4.3.1
    if (!Array.isArray(schema.required)) {
      report.addError('KEYWORD_TYPE_EXPECTED', ['required', 'array'], undefined, schema, 'required');
    } else if (report.options.version === 'draft-04' && schema.required.length === 0) {
      report.addError(
        'KEYWORD_MUST_BE',
        ['required', 'an array with at least one element'],
        undefined,
        schema,
        'required'
      );
    } else {
      for (const item of schema.required) {
        if (typeof item !== 'string') {
          report.addError('KEYWORD_VALUE_TYPE', ['required', 'string'], undefined, schema, 'required');
        }
      }
      if (isUniqueArray(schema.required) === false) {
        report.addError('KEYWORD_MUST_BE', ['required', 'an array with unique items'], undefined, schema, 'required');
      }
    }
  },
  additionalProperties: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.4.4.1
    if (typeof schema.additionalProperties !== 'boolean' && !isObject(schema.additionalProperties)) {
      report.addError(
        'KEYWORD_TYPE_EXPECTED',
        ['additionalProperties', ['boolean', 'object']],
        undefined,
        schema,
        'additionalProperties'
      );
    } else if (isObject(schema.additionalProperties)) {
      report.path.push('additionalProperties');
      this.validateSchema(report, schema.additionalProperties);
      report.path.pop();
    }
  },
  properties: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.4.4.1
    if (!isObject(schema.properties)) {
      report.addError('KEYWORD_TYPE_EXPECTED', ['properties', 'object'], undefined, schema, 'properties');
      return;
    }

    const keys = Object.keys(schema.properties);
    for (const key of keys) {
      const val = schema.properties[key];
      report.path.push('properties');
      report.path.push(key);
      this.validateSchema(report, val);
      report.path.pop();
      report.path.pop();
    }

    // custom - strict mode
    if (this.options.forceAdditional === true && schema.additionalProperties === undefined) {
      report.addError('KEYWORD_UNDEFINED_STRICT', ['additionalProperties'], undefined, schema, 'additionalProperties');
    }
    // custom - assume defined false mode
    if (this.options.assumeAdditional && schema.additionalProperties === undefined) {
      schema.additionalProperties = false;
    }
    // custom - forceProperties
    if (this.options.forceProperties === true && keys.length === 0) {
      report.addError('CUSTOM_MODE_FORCE_PROPERTIES', ['properties'], undefined, schema, 'properties');
    }
  },
  patternProperties: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.4.4.1
    if (!isObject(schema.patternProperties)) {
      report.addError('KEYWORD_TYPE_EXPECTED', ['patternProperties', 'object'], undefined, schema, 'patternProperties');
      return;
    }

    // Use shared regex compilation helper
    const keys = Object.keys(schema.patternProperties);
    for (const key of keys) {
      const val = schema.patternProperties[key];
      const result = compileSchemaRegex(key);
      if (!result.ok) {
        report.addError(
          'KEYWORD_PATTERN',
          ['patternProperties', key, result.error.message],
          undefined,
          schema,
          'patternProperties'
        );
      }
      report.path.push('patternProperties');
      report.path.push(key);
      this.validateSchema(report, val);
      report.path.pop();
      report.path.pop();
    }

    // custom - forceProperties
    if (this.options.forceProperties === true && keys.length === 0) {
      report.addError('CUSTOM_MODE_FORCE_PROPERTIES', ['patternProperties'], undefined, schema, 'patternProperties');
    }
  },
  dependencies: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.4.5.1
    if (!isObject(schema.dependencies)) {
      report.addError('KEYWORD_TYPE_EXPECTED', ['dependencies', 'object'], undefined, schema, 'dependencies');
    } else {
      const keys = Object.keys(schema.dependencies);
      for (const schemaKey of keys) {
        const schemaDependency = (schema.dependencies as Record<string, unknown>)[schemaKey];
        const isSchemaDependency =
          isObject(schemaDependency) ||
          (report.options.version !== 'draft-04' && typeof schemaDependency === 'boolean');

        if (isSchemaDependency) {
          report.path.push('dependencies');
          report.path.push(schemaKey);
          this.validateSchema(report, schemaDependency as JsonSchemaInternal);
          report.path.pop();
          report.path.pop();
        } else if (Array.isArray(schemaDependency)) {
          const depArray = schemaDependency as string[];
          if (report.options.version === 'draft-04' && depArray.length === 0) {
            report.addError('KEYWORD_MUST_BE', ['dependencies', 'not empty array'], undefined, schema, 'dependencies');
          }
          for (const dep of depArray) {
            if (typeof dep !== 'string') {
              report.addError('KEYWORD_VALUE_TYPE', ['dependencies', 'string'], undefined, schema, 'dependencies');
            }
          }
          if (isUniqueArray(depArray) === false) {
            report.addError(
              'KEYWORD_MUST_BE',
              ['dependencies', 'an array with unique items'],
              undefined,
              schema,
              'dependencies'
            );
          }
        } else {
          report.addError(
            'KEYWORD_VALUE_TYPE',
            ['dependencies', report.options.version === 'draft-04' ? 'object or array' : 'boolean, object or array'],
            undefined,
            schema,
            'dependencies'
          );
        }
      }
    }
  },
  enum: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.5.1.1
    if (Array.isArray(schema.enum) === false) {
      report.addError('KEYWORD_TYPE_EXPECTED', ['enum', 'array'], undefined, schema, 'enum');
    } else if (schema.enum.length === 0) {
      report.addError('KEYWORD_MUST_BE', ['enum', 'an array with at least one element'], undefined, schema, 'enum');
    } else if (isUniqueArray(schema.enum) === false) {
      report.addError('KEYWORD_MUST_BE', ['enum', 'an array with unique elements'], undefined, schema, 'enum');
    }
  },
  type: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.5.2.1
    const primitiveTypes = ['array', 'boolean', 'integer', 'number', 'null', 'object', 'string'];
    const primitiveTypeStr = primitiveTypes.join(',');
    const isArray = Array.isArray(schema.type);

    if (Array.isArray(schema.type)) {
      for (const typeItem of schema.type) {
        if (!primitiveTypes.includes(typeItem)) {
          report.addError('KEYWORD_TYPE_EXPECTED', ['type', primitiveTypeStr], undefined, schema, 'type');
        }
      }
      if (isUniqueArray(schema.type) === false) {
        report.addError('KEYWORD_MUST_BE', ['type', 'an object with unique properties'], undefined, schema, 'type');
      }
    } else if (typeof schema.type === 'string') {
      if (!primitiveTypes.includes(schema.type)) {
        report.addError('KEYWORD_TYPE_EXPECTED', ['type', primitiveTypeStr], undefined, schema, 'type');
      }
    } else {
      report.addError('KEYWORD_TYPE_EXPECTED', ['type', ['string', 'array']], undefined, schema, 'type');
    }

    if (this.options.noEmptyStrings === true) {
      if (schema.type === 'string' || (isArray && schema.type!.includes('string'))) {
        if (schema.minLength === undefined && schema.enum === undefined && schema.format === undefined) {
          schema.minLength = 1;
        }
      }
    }
    if (this.options.noEmptyArrays === true) {
      if (schema.type === 'array' || (isArray && schema.type!.includes('array'))) {
        if (schema.minItems === undefined) {
          schema.minItems = 1;
        }
      }
    }
    if (this.options.forceProperties === true) {
      if (schema.type === 'object' || (isArray && schema.type!.includes('object'))) {
        if (schema.properties === undefined && schema.patternProperties === undefined) {
          report.addError('KEYWORD_UNDEFINED_STRICT', ['properties'], undefined, schema, 'properties');
        }
      }
    }
    if (this.options.forceItems === true) {
      if (schema.type === 'array' || (isArray && schema.type!.includes('array'))) {
        if (schema.items === undefined) {
          report.addError('KEYWORD_UNDEFINED_STRICT', ['items'], undefined, schema, 'items');
        }
      }
    }
    if (this.options.forceMinItems === true) {
      if (schema.type === 'array' || (isArray && schema.type!.includes('array'))) {
        if (schema.minItems === undefined) {
          report.addError('KEYWORD_UNDEFINED_STRICT', ['minItems'], undefined, schema, 'minItems');
        }
      }
    }
    if (this.options.forceMaxItems === true) {
      if (schema.type === 'array' || (isArray && schema.type!.includes('array'))) {
        if (schema.maxItems === undefined) {
          report.addError('KEYWORD_UNDEFINED_STRICT', ['maxItems'], undefined, schema, 'maxItems');
        }
      }
    }
    if (this.options.forceMinLength === true) {
      if (schema.type === 'string' || (isArray && schema.type!.includes('string'))) {
        if (
          schema.minLength === undefined &&
          schema.format === undefined &&
          schema.enum === undefined &&
          schema.pattern === undefined
        ) {
          report.addError('KEYWORD_UNDEFINED_STRICT', ['minLength'], undefined, schema, 'minLength');
        }
      }
    }
    if (this.options.forceMaxLength === true) {
      if (schema.type === 'string' || (isArray && schema.type!.includes('string'))) {
        if (
          schema.maxLength === undefined &&
          schema.format === undefined &&
          schema.enum === undefined &&
          schema.pattern === undefined
        ) {
          report.addError('KEYWORD_UNDEFINED_STRICT', ['maxLength'], undefined, schema, 'maxLength');
        }
      }
    }
  },
  allOf: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.5.3.1
    if (Array.isArray(schema.allOf) === false) {
      report.addError('KEYWORD_TYPE_EXPECTED', ['allOf', 'array'], undefined, schema, 'allOf');
    } else if (schema.allOf.length === 0) {
      report.addError('KEYWORD_MUST_BE', ['allOf', 'an array with at least one element'], undefined, schema, 'allOf');
    } else {
      for (let idx = 0; idx < schema.allOf.length; idx++) {
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
      report.addError('KEYWORD_TYPE_EXPECTED', ['anyOf', 'array'], undefined, schema, 'anyOf');
    } else if (schema.anyOf.length === 0) {
      report.addError('KEYWORD_MUST_BE', ['anyOf', 'an array with at least one element'], undefined, schema, 'anyOf');
    } else {
      for (let idx = 0; idx < schema.anyOf.length; idx++) {
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
      report.addError('KEYWORD_TYPE_EXPECTED', ['oneOf', 'array'], undefined, schema, 'oneOf');
    } else if (schema.oneOf.length === 0) {
      report.addError('KEYWORD_MUST_BE', ['oneOf', 'an array with at least one element'], undefined, schema, 'oneOf');
    } else {
      for (let idx = 0; idx < schema.oneOf.length; idx++) {
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
    const notSchema = schema.not;
    const isValidNotSchema =
      report.options.version === 'draft-04'
        ? isObject(notSchema)
        : typeof notSchema === 'boolean' || isObject(notSchema);

    if (!isValidNotSchema) {
      report.addError(
        'KEYWORD_TYPE_EXPECTED',
        ['not', report.options.version === 'draft-04' ? 'object' : ['boolean', 'object']],
        undefined,
        schema,
        'not'
      );
    } else {
      report.path.push('not');
      this.validateSchema(report, notSchema as JsonSchemaInternal);
      report.path.pop();
    }
  },
  if: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    if (report.options.version !== 'draft-07') {
      return;
    }

    const ifSchema = schema.if;
    const isValidIfSchema = typeof ifSchema === 'boolean' || isObject(ifSchema);
    if (!isValidIfSchema) {
      report.addError('KEYWORD_TYPE_EXPECTED', ['if', ['boolean', 'object']], undefined, schema, 'if');
      return;
    }

    report.path.push('if');
    this.validateSchema(report, ifSchema as JsonSchemaInternal);
    report.path.pop();
  },
  then: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    if (report.options.version !== 'draft-07') {
      return;
    }

    const thenSchema = schema.then;
    const isValidThenSchema = typeof thenSchema === 'boolean' || isObject(thenSchema);
    if (!isValidThenSchema) {
      report.addError('KEYWORD_TYPE_EXPECTED', ['then', ['boolean', 'object']], undefined, schema, 'then');
      return;
    }

    report.path.push('then');
    this.validateSchema(report, thenSchema as JsonSchemaInternal);
    report.path.pop();
  },
  else: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    if (report.options.version !== 'draft-07') {
      return;
    }

    const elseSchema = schema.else;
    const isValidElseSchema = typeof elseSchema === 'boolean' || isObject(elseSchema);
    if (!isValidElseSchema) {
      report.addError('KEYWORD_TYPE_EXPECTED', ['else', ['boolean', 'object']], undefined, schema, 'else');
      return;
    }

    report.path.push('else');
    this.validateSchema(report, elseSchema as JsonSchemaInternal);
    report.path.pop();
  },
  definitions: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.5.7.1
    if (!isObject(schema.definitions)) {
      report.addError('KEYWORD_TYPE_EXPECTED', ['definitions', 'object'], undefined, schema, 'definitions');
    } else {
      const keys = Object.keys(schema.definitions);
      for (const key of keys) {
        const val = schema.definitions[key];
        report.path.push('definitions');
        report.path.push(key);
        this.validateSchema(report, val);
        report.path.pop();
        report.path.pop();
      }
    }
  },
  $defs: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    if (report.options.version !== 'draft2019-09' && report.options.version !== 'draft2020-12') {
      return;
    }

    if (!isObject(schema.$defs)) {
      report.addError('KEYWORD_TYPE_EXPECTED', ['$defs', 'object'], undefined, schema, '$defs');
      return;
    }

    const keys = Object.keys(schema.$defs);
    for (const key of keys) {
      const val = schema.$defs[key];
      report.path.push('$defs');
      report.path.push(key);
      this.validateSchema(report, val as JsonSchemaInternal);
      report.path.pop();
      report.path.pop();
    }
  },
  format: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    if (this.options.formatAssertions === false) {
      return;
    }

    if (typeof schema.format !== 'string') {
      report.addError('KEYWORD_TYPE_EXPECTED', ['format', 'string'], undefined, schema, 'format');
    } else {
      const isModernDraft = this.options.version === 'draft2019-09' || this.options.version === 'draft2020-12';
      if (
        !isFormatSupported(schema.format, this.options.customFormats) &&
        this.options.ignoreUnknownFormats !== true &&
        !isModernDraft
      ) {
        report.addError('UNKNOWN_FORMAT', [schema.format], undefined, schema, 'format');
      }
    }
  },
  contentEncoding: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    if (report.options.version !== 'draft-07') {
      return;
    }

    if (typeof schema.contentEncoding !== 'string') {
      report.addError('KEYWORD_TYPE_EXPECTED', ['contentEncoding', 'string'], undefined, schema, 'contentEncoding');
    }
  },
  contentMediaType: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    if (report.options.version !== 'draft-07') {
      return;
    }

    if (typeof schema.contentMediaType !== 'string') {
      report.addError('KEYWORD_TYPE_EXPECTED', ['contentMediaType', 'string'], undefined, schema, 'contentMediaType');
    }
  },
  id: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    // http://json-schema.org/latest/json-schema-core.html#rfc.section.7.2
    if (typeof schema.id !== 'string') {
      report.addError('KEYWORD_TYPE_EXPECTED', ['id', 'string'], undefined, schema, 'id');
    }
  },
  title: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.6.1
    if (typeof schema.title !== 'string') {
      report.addError('KEYWORD_TYPE_EXPECTED', ['title', 'string'], undefined, schema, 'title');
    }
  },
  description: function (this: SchemaValidator, report: Report, schema: JsonSchemaInternal) {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.6.1
    if (typeof schema.description !== 'string') {
      report.addError('KEYWORD_TYPE_EXPECTED', ['description', 'string'], undefined, schema, 'description');
    }
  },
  default: function (this: SchemaValidator) /* report, schema */ {
    // http://json-schema.org/latest/json-schema-validation.html#rfc.section.6.2
    // There are no restrictions placed on the value of this keyword.
  },
} as const;

export class SchemaValidator {
  constructor(private validator: ZSchemaBase) {}

  get options() {
    return this.validator.options;
  }

  validateArrayOfSchemas(report: Report, arr: Array<JsonSchemaInternal | boolean>) {
    for (const schema of arr) {
      this.validateSchema(report, schema);
    }
    return report.isValid();
  }

  validateSchema(report: Report, schema: JsonSchemaInternal | boolean | Array<JsonSchemaInternal | boolean>) {
    report.commonErrorMessage = 'SCHEMA_VALIDATION_FAILED';

    // if schema is an array, assume it's an array of schemas
    if (Array.isArray(schema)) {
      return this.validateArrayOfSchemas(report, schema);
    }

    if (typeof schema === 'boolean') {
      return true;
    }

    // do not revalidate schema that has already been validated once
    if (schema.__$validated) {
      return true;
    }

    // if $schema is present, this schema should validate against that $schema
    const hasParentSchema = schema.$schema && getId(schema) !== schema.$schema;
    if (hasParentSchema) {
      if (schema.__$schemaResolved && schema.__$schemaResolved !== schema) {
        const subReport = new Report(report);
        const valid = validate.call(this.validator, subReport, schema.__$schemaResolved, schema);
        if (valid === false) {
          report.addError('PARENT_SCHEMA_VALIDATION_FAILED', undefined, subReport, schema, '$schema');
        }
      } else {
        if (this.validator.options.ignoreUnresolvableReferences !== true) {
          report.addError('REF_UNRESOLVED', [schema.$schema!], undefined, schema, '$schema');
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
        report.addError('KEYWORD_UNDEFINED_STRICT', ['type'], undefined, schema, 'type');
      }
    }

    const keys = Object.keys(schema);
    for (const key of keys) {
      if (key.startsWith('__')) {
        continue;
      }
      if (Object.hasOwn(SchemaValidators, key)) {
        SchemaValidators[key as keyof typeof SchemaValidators].call(this, report, schema);
      } else if (!hasParentSchema) {
        if (this.validator.options.noExtraKeywords === true) {
          report.addError('KEYWORD_UNEXPECTED', [key], undefined, schema, undefined);
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
        for (let idx = 0; idx < schema.enum.length; idx++) {
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
