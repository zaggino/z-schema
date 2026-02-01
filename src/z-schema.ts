import get from 'lodash.get';
import { Report, SchemaError, SchemaErrorDetail } from './report.js';
import { FormatValidatorFn, FormatValidators } from './format-validators.js';
import { validate as validateJson } from './json-validation.js';
import { getSchema, cacheSchemaByUri, getRemotePath } from './schema-cache.js';
import { compileSchema } from './schema-compilation.js';
import { validateSchema } from './schema-validation.js';
import { shallowClone } from './utils/shallow-clone.js';
import { deepClone } from './utils/deep-clone.js';
import { whatIs } from './utils/what-is.js';
import { schemaSymbol, jsonSymbol } from './utils/symbols.js';
import type { Errors } from './errors.js';
// import schemas so they don't have to be downloaded for validation purposes
import type { JsonSchema } from './json-schema.js';
import _Draft4Schema from './schemas/schema.json' with { type: 'json' };
import _Draft4HyperSchema from './schemas/hyper-schema.json' with { type: 'json' };

const Draft4Schema: JsonSchema = _Draft4Schema;
const Draft4HyperSchema: JsonSchema = _Draft4HyperSchema;

/**
 * default options
 */
const defaultOptions = {
  // default timeout for all async tasks
  asyncTimeout: 2000,
  // force additionalProperties and additionalItems to be defined on "object" and "array" types
  forceAdditional: false,
  // assume additionalProperties and additionalItems are defined as "false" where appropriate
  assumeAdditional: false,
  // do case insensitive comparison for enums
  enumCaseInsensitiveComparison: false,
  // force items to be defined on "array" types
  forceItems: false,
  // force minItems to be defined on "array" types
  forceMinItems: false,
  // force maxItems to be defined on "array" types
  forceMaxItems: false,
  // force minLength to be defined on "string" types
  forceMinLength: false,
  // force maxLength to be defined on "string" types
  forceMaxLength: false,
  // force properties or patternProperties to be defined on "object" types
  forceProperties: false,
  // ignore references that cannot be resolved (remote schemas) // TODO: make sure this is only for remote schemas, not local ones
  ignoreUnresolvableReferences: false,
  // disallow usage of keywords that this validator can't handle
  noExtraKeywords: false,
  // disallow usage of schema's without "type" defined
  noTypeless: false,
  // disallow zero length strings in validated objects
  noEmptyStrings: false,
  // disallow zero length arrays in validated objects
  noEmptyArrays: false,
  // forces "uri" format to be in fully rfc3986 compliant
  strictUris: false,
  // turn on some of the above
  strictMode: false,
  // report error paths as an array of path segments to get to the offending node
  reportPathAsArray: false,
  // stop validation as soon as an error is found
  breakOnFirstError: false,
  // check if schema follows best practices and common sense
  pedanticCheck: false,
  // ignore unknown formats (do not report them as an error)
  ignoreUnknownFormats: false,
  // function to be called on every schema
  customValidator: null,
};

const normalizeOptions = (options) => {
  let normalized;

  // options
  if (typeof options === 'object') {
    let keys = Object.keys(options),
      idx = keys.length,
      key;

    // check that the options are correctly configured
    while (idx--) {
      key = keys[idx];
      if (defaultOptions[key] === undefined) {
        throw new Error('Unexpected option passed to constructor: ' + key);
      }
    }

    // copy the default options into passed options
    keys = Object.keys(defaultOptions);
    idx = keys.length;
    while (idx--) {
      key = keys[idx];
      if (options[key] === undefined) {
        options[key] = shallowClone(defaultOptions[key]);
      }
    }

    normalized = options;
  } else {
    normalized = shallowClone(defaultOptions);
  }

  if (normalized.strictMode === true) {
    normalized.forceAdditional = true;
    normalized.forceItems = true;
    normalized.forceMaxLength = true;
    normalized.forceProperties = true;
    normalized.noExtraKeywords = true;
    normalized.noTypeless = true;
    normalized.noEmptyStrings = true;
    normalized.noEmptyArrays = true;
  }

  return normalized;
};

export interface ZSchemaOptions {
  asyncTimeout?: number;
  forceAdditional?: boolean;
  assumeAdditional?: boolean | string[];
  enumCaseInsensitiveComparison?: boolean;
  forceItems?: boolean;
  forceMinItems?: boolean;
  forceMaxItems?: boolean;
  forceMinLength?: boolean;
  forceMaxLength?: boolean;
  forceProperties?: boolean;
  ignoreUnresolvableReferences?: boolean;
  noExtraKeywords?: boolean;
  noTypeless?: boolean;
  noEmptyStrings?: boolean;
  noEmptyArrays?: boolean;
  strictUris?: boolean;
  strictMode?: boolean;
  reportPathAsArray?: boolean;
  breakOnFirstError?: boolean;
  pedanticCheck?: boolean;
  ignoreUnknownFormats?: boolean;
  customValidator?: (report: Report, schema: unknown, json: unknown) => void;
}

export interface ValidateOptions {
  schemaPath?: string;
  includeErrors?: Array<keyof typeof Errors>;
}

export type ValidateCallback = (e: Error | SchemaErrorDetail[] | null, valid: boolean) => void;

// a sync function that loads schemas for future use, for example from schemas directory, during server startup
type SchemaReader = (uri: string) => unknown;

export class ZSchema {
  public static registerFormat(name: string, validatorFunction: FormatValidatorFn): void {
    FormatValidators[name] = validatorFunction;
  }

  public static unregisterFormat(name: string): void {
    delete FormatValidators[name];
  }

  public static getRegisteredFormats(): string[] {
    return Object.keys(FormatValidators);
  }

  public static getDefaultOptions(): ZSchemaOptions {
    return deepClone(defaultOptions);
  }

  public lastReport: Report | undefined;
  protected cache: Record<string, string>;
  protected referenceCache: Array<string>;
  protected validateOptions: ValidateOptions;
  options: ZSchemaOptions;

  constructor(options?: ZSchemaOptions) {
    this.cache = {};
    this.referenceCache = [];
    this.validateOptions = {};

    this.options = normalizeOptions(options);

    // Disable strict validation for the built-in schemas
    const metaschemaOptions = normalizeOptions({});

    this.setRemoteReference('http://json-schema.org/draft-04/schema', Draft4Schema, metaschemaOptions);
    this.setRemoteReference('http://json-schema.org/draft-04/hyper-schema', Draft4HyperSchema, metaschemaOptions);
  }

  /** Used by SchemaCache to break circular dependency with SchemaCompilation */
  _compileSchema(report: Report, schema: unknown): boolean {
    return compileSchema.call(this, report, schema);
  }

  /**
   * @param schema - JSON object representing schema
   * @returns {boolean} true if schema is valid.
   */
  validateSchema(schema: unknown): boolean {
    if (Array.isArray(schema) && schema.length === 0) {
      throw new Error('.validateSchema was called with an empty array');
    }

    const report = new Report(this.options);

    schema = getSchema.call(this, report, schema);

    const compiled = compileSchema.call(this, report, schema);
    if (compiled) {
      validateSchema.call(this, report, schema);
    }

    this.lastReport = report;
    return report.isValid();
  }

  validate(json: unknown, schema: JsonSchema, options?: ValidateOptions, callback?: ValidateCallback): boolean;
  validate(json: unknown, schema: JsonSchema, callback?): boolean;
  validate(json: unknown, schema: JsonSchema): boolean;
  validate(
    json: unknown,
    schema: JsonSchema,
    options?: ValidateOptions | ValidateCallback,
    callback?: ValidateCallback
  ): boolean {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    if (!options) {
      options = {};
    }

    this.validateOptions = options;

    const schemaType = whatIs(schema);
    if (schemaType !== 'string' && schemaType !== 'object') {
      const e = new Error(
        'Invalid .validate call - schema must be a string or object but ' + schemaType + ' was passed!'
      );
      if (callback) {
        setTimeout(function () {
          callback(e, false);
        }, 0);
        return;
      }
      throw e;
    }

    let foundError = false;
    const report = new Report(this.options);
    report.json = json;

    if (typeof schema === 'string') {
      const schemaName = schema;
      schema = getSchema.call(this, report, schemaName);
      if (!schema) {
        throw new Error("Schema with id '" + schemaName + "' wasn't found in the validator cache!");
      }
    } else {
      schema = getSchema.call(this, report, schema);
    }

    let compiled = false;
    if (!foundError) {
      compiled = compileSchema.call(this, report, schema);
    }
    if (!compiled) {
      this.lastReport = report;
      foundError = true;
    }

    let validated = false;
    if (!foundError) {
      validated = validateSchema.call(this, report, schema);
    }
    if (!validated) {
      this.lastReport = report;
      foundError = true;
    }

    if (options.schemaPath) {
      report.rootSchema = schema;
      schema = get(schema, options.schemaPath);
      if (!schema) {
        throw new Error("Schema path '" + options.schemaPath + "' wasn't found in the schema!");
      }
    }

    if (!foundError) {
      validateJson.call(this, report, schema, json);
    }

    if (callback) {
      report.processAsyncTasks(this.options.asyncTimeout, callback);
      return;
    } else if (report.asyncTasks.length > 0) {
      throw new Error(
        'This validation has async tasks and cannot be done in sync mode, please provide callback argument.'
      );
    }

    // assign lastReport so errors are retrievable in sync mode
    this.lastReport = report;
    return report.isValid();
  }

  /**
   * Returns an Error object for the most recent failed validation, or null if the validation was successful.
   */
  getLastError(): SchemaError {
    if (this.lastReport.errors.length === 0) {
      return null;
    }
    const e: SchemaError = new Error();
    e.name = 'z-schema validation error';
    e.message = this.lastReport.commonErrorMessage;
    e.details = this.lastReport.errors;
    return e;
  }

  /**
   * Returns the error details for the most recent validation, or undefined if the validation was successful.
   * This is the same list as the SchemaError.details property.
   */
  getLastErrors(): SchemaErrorDetail[] {
    return this.lastReport && this.lastReport.errors.length > 0 ? this.lastReport.errors : null;
  }

  setRemoteReference(uri, schema, validationOptions) {
    if (typeof schema === 'string') {
      schema = JSON.parse(schema);
    } else {
      schema = deepClone(schema);
    }

    if (validationOptions) {
      schema.__$validationOptions = normalizeOptions(validationOptions);
    }

    cacheSchemaByUri(this.cache, uri, schema);
  }

  compileSchema(schema) {
    const report = new Report(this.options);

    schema = getSchema.call(this, report, schema);

    compileSchema.call(this, report, schema);

    this.lastReport = report;
    return report.isValid();
  }

  getMissingReferences(arr?) {
    arr = arr || this.lastReport.errors;
    let res = [],
      idx = arr.length;
    while (idx--) {
      const error = arr[idx];
      if (error.code === 'UNRESOLVABLE_REFERENCE') {
        const reference = error.params[0];
        if (res.indexOf(reference) === -1) {
          res.push(reference);
        }
      }
      if (error.inner) {
        res = res.concat(this.getMissingReferences(error.inner));
      }
    }
    return res;
  }

  getMissingRemoteReferences() {
    const missingReferences = this.getMissingReferences();
    const missingRemoteReferences = [];
    let idx = missingReferences.length;
    while (idx--) {
      const remoteReference = getRemotePath(missingReferences[idx]);
      if (remoteReference && missingRemoteReferences.indexOf(remoteReference) === -1) {
        missingRemoteReferences.push(remoteReference);
      }
    }
    return missingRemoteReferences;
  }

  getResolvedSchema(schema) {
    const report = new Report(this.options);
    schema = getSchema.call(this, report, schema);

    // clone before making any modifications
    schema = deepClone(schema);

    const visited = [];

    // clean-up the schema and resolve references
    const cleanup = function (schema) {
      let key;
      const typeOf = whatIs(schema);
      if (typeOf !== 'object' && typeOf !== 'array') {
        return;
      }

      if (schema.___$visited) {
        return;
      }

      schema.___$visited = true;
      visited.push(schema);

      if (schema.$ref && schema.__$refResolved) {
        const from = schema.__$refResolved;
        const to = schema;
        delete schema.$ref;
        delete schema.__$refResolved;
        for (key in from) {
          if (Object.prototype.hasOwnProperty.call(from, key)) {
            to[key] = from[key];
          }
        }
      }
      for (key in schema) {
        if (Object.prototype.hasOwnProperty.call(schema, key)) {
          if (key.indexOf('__$') === 0) {
            delete schema[key];
          } else {
            cleanup(schema[key]);
          }
        }
      }
    };

    cleanup(schema);
    visited.forEach(function (s) {
      delete s.___$visited;
    });

    this.lastReport = report;
    if (report.isValid()) {
      return schema;
    } else {
      throw this.getLastError();
    }
  }

  static schemaReader: SchemaReader;

  setSchemaReader(schemaReader) {
    return ZSchema.setSchemaReader(schemaReader);
  }

  getSchemaReader() {
    return ZSchema.schemaReader;
  }

  static setSchemaReader(schemaReader) {
    ZSchema.schemaReader = schemaReader;
  }

  static schemaSymbol = schemaSymbol;

  static jsonSymbol = jsonSymbol;
}
