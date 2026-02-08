import { Report, SchemaErrorDetail } from './report.js';
import {
  FormatValidatorFn,
  getRegisteredFormats,
  getSupportedFormats,
  registerFormat,
  unregisterFormat,
} from './format-validators.js';
import { validate as validateJson } from './json-validation.js';
import { SchemaCache } from './schema-cache.js';
import { SchemaCompiler } from './schema-compiler.js';
import { SchemaValidator } from './schema-validator.js';
import { shallowClone, deepClone } from './utils/clone.js';
import { whatIs } from './utils/what-is.js';
import { schemaSymbol, jsonSymbol } from './utils/symbols.js';
import { getRemotePath } from './utils/uri.js';
import { getValidateError, ValidateError, type Errors } from './errors.js';
// import schemas so they don't have to be downloaded for validation purposes
import type { JsonSchema, JsonSchemaInternal } from './json-schema.js';
import _Draft4Schema from './schemas/draft-04-schema.json' with { type: 'json' };
import _Draft4HyperSchema from './schemas/draft-04-hyper-schema.json' with { type: 'json' };
import { sortedKeys, get } from './utils/json.js';
import { copyProp } from './utils/properties.js';

// TODO: currently unsupported 'draft-06', 'draft-07', '2019-09', '2020-12'
export type JsonSchemaVersion = 'draft-04';

const defaultOptions: ZSchemaOptions = {
  version: 'draft-04',
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
  customValidator: null as unknown as undefined,
};

const normalizeOptions = (options?: ZSchemaOptions) => {
  let normalized;

  // options
  if (typeof options === 'object') {
    let keys = Object.keys(options) as Array<keyof ZSchemaOptions>;
    let idx = keys.length;
    let key;

    // check that the options are correctly configured
    while (idx--) {
      key = keys[idx];
      if (defaultOptions[key] === undefined) {
        throw new Error('Unexpected option passed to constructor: ' + key);
      }
    }

    // copy the default options into passed options
    keys = Object.keys(defaultOptions) as Array<keyof ZSchemaOptions>;
    idx = keys.length;
    while (idx--) {
      key = keys[idx];
      if (options[key] === undefined) {
        (options as any)[key] = shallowClone(defaultOptions[key]);
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
  version?: JsonSchemaVersion | 'none';
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
  customFormats?: Record<string, FormatValidatorFn | null>;
}

export interface ValidateOptions {
  schemaPath?: string;
  includeErrors?: Array<keyof typeof Errors>;
  excludeErrors?: Array<keyof typeof Errors>;
}

export type ValidateResponse = { valid: boolean; err?: ValidateError };

export type ValidateCallback = (err: ValidateResponse['err'], valid: ValidateResponse['valid']) => void;

// a sync function that loads schemas for future use, for example from schemas directory, during server startup
export type SchemaReader = (uri: string) => JsonSchema;

class ZSchemaImpl {
  scache: SchemaCache;
  sc: SchemaCompiler;
  sv: SchemaValidator;
  validateOptions: ValidateOptions = {};
  options: ZSchemaOptions;

  constructor(options?: ZSchemaOptions) {
    this.scache = new SchemaCache(this);
    this.sc = new SchemaCompiler(this);
    this.sv = new SchemaValidator(this);
    this.options = normalizeOptions(options);
  }

  getDefaultSchemaId(): string {
    return this.options.version && this.options.version !== 'none'
      ? VERSION_SCHEMA_URL_MAPPING[this.options.version]
      : VERSION_SCHEMA_URL_MAPPING[defaultOptions.version as JsonSchemaVersion];
  }

  validate(json: unknown, schema: JsonSchema | string, options: ValidateOptions, callback: ValidateCallback): void;
  validate(json: unknown, schema: JsonSchema | string, callback: ValidateCallback): void;
  validate(json: unknown, schema: JsonSchema | string, options: ValidateOptions): true;
  validate(json: unknown, schema: JsonSchema | string): true;
  validate(
    json: unknown,
    schema: JsonSchema | string,
    options?: ValidateOptions | ValidateCallback,
    callback?: ValidateCallback
  ): true | void {
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
    const report = new Report(this.options, options);
    report.json = json;

    let _schema: JsonSchemaInternal;
    if (typeof schema === 'string') {
      const schemaName = schema;
      _schema = this.scache.getSchema(report, schemaName)!;
      if (!_schema) {
        const e = new Error("Schema with id '" + schemaName + "' wasn't found in the validator cache!");
        if (callback) {
          setTimeout(function () {
            callback(e, false);
          }, 0);
          return;
        }
        throw e;
      }
    } else {
      _schema = this.scache.getSchema(report, schema)!;
    }

    let compiled = false;
    if (!foundError) {
      compiled = this.sc.compileSchema(report, _schema);
    }
    if (!compiled) {
      foundError = true;
    }

    let validated = false;
    if (!foundError) {
      validated = this.sv.validateSchema(report, _schema);
    }
    if (!validated) {
      foundError = true;
    }

    if (options.schemaPath) {
      report.rootSchema = _schema;
      _schema = get(_schema, options.schemaPath);
      if (!_schema) {
        const e = new Error("Schema path '" + options.schemaPath + "' wasn't found in the schema!");
        if (callback) {
          setTimeout(function () {
            callback(e, false);
          }, 0);
          return;
        }
        throw e;
      }
    }

    if (!foundError) {
      validateJson.call(this, report, _schema, json);
    }

    if (callback) {
      report.processAsyncTasks(this.options.asyncTimeout, callback);
      return;
    } else if (report.asyncTasks.length > 0) {
      throw new Error(
        'This validation has async tasks and cannot be done in sync mode, please provide callback argument.'
      );
    }

    if (!report.isValid()) {
      throw getValidateError({
        message: report.commonErrorMessage!,
        details: report.errors,
      });
    }
    return true;
  }

  /**
   * Validates JSON data against a schema and returns a result object.
   * This method never throws and provides backward compatibility.
   */
  validateSafe(json: unknown, schema: JsonSchema | string, options?: ValidateOptions): ValidateResponse {
    try {
      this.validate(json, schema, options ?? {});
      return { valid: true };
    } catch (err) {
      return { valid: false, err: err as ValidateError };
    }
  }

  // validateAsync always returns true, implement using try-catch
  validateAsync(json: unknown, schema: JsonSchema | string, options?: ValidateOptions): Promise<true> {
    return new Promise((resolve, reject) => {
      try {
        this.validate(json, schema, options || {}, (err, valid) =>
          err || valid !== true ? reject(err) : resolve(valid)
        );
      } catch (err) {
        reject(err);
      }
    });
  }

  // validateAsyncSafe never throws, but returns complex object
  validateAsyncSafe(json: unknown, schema: JsonSchema | string, options?: ValidateOptions): Promise<ValidateResponse> {
    return new Promise((resolve) => {
      try {
        this.validate(json, schema, options || {}, (err, valid) => {
          resolve({ valid, err });
        });
      } catch (err) {
        resolve({ valid: false, err: err as ValidateError });
      }
    });
  }

  compileSchema(schemaOrArr: JsonSchema | JsonSchema[]): void {
    if (Array.isArray(schemaOrArr) && schemaOrArr.length === 0) {
      throw new Error('.compileSchema was called with an empty array');
    }

    const report = new Report(this.options);

    if (Array.isArray(schemaOrArr)) {
      const arr = this.scache.getSchema(report, schemaOrArr)!;
      const compiled = this.sc.compileSchema(report, arr);
      if (compiled) {
        this.sv.validateSchema(report, arr);
      }
    } else {
      const schema = this.scache.getSchema(report, schemaOrArr)!;
      const compiled = this.sc.compileSchema(report, schema);
      if (compiled) {
        this.sv.validateSchema(report, schema);
      }
    }

    if (!report.isValid()) {
      throw getValidateError({ message: report.commonErrorMessage!, details: report.errors });
    }
  }

  /**
   * Compiles a schema and returns a result object.
   * This method never throws and provides safe schema compilation.
   */
  compileSchemaSafe(schema: JsonSchema | JsonSchema[]): ValidateResponse {
    try {
      this.compileSchema(schema);
      return { valid: true };
    } catch (err) {
      return { valid: false, err: err as ValidateError };
    }
  }

  /**
   * Validates a schema against the meta schema.
   * Returns true if valid, throws ValidateError if invalid.
   */
  validateSchema(schema: JsonSchema | JsonSchema[]): true {
    this.compileSchema(schema);
    return true;
  }

  /**
   * Validates a schema and returns a result object.
   * This method never throws and provides safe schema validation.
   */
  validateSchemaSafe(schemaOrArr: JsonSchema | JsonSchema[]): ValidateResponse {
    try {
      this.validateSchema(schemaOrArr);
      return { valid: true };
    } catch (err) {
      return { valid: false, err: err as ValidateError };
    }
  }

  // instance scoped format functions
  public registerFormat(name: string, validatorFunction: FormatValidatorFn): void {
    if (!this.options.customFormats) {
      this.options.customFormats = {};
    }
    this.options.customFormats[name] = validatorFunction;
  }

  public unregisterFormat(name: string): void {
    if (!this.options.customFormats) {
      this.options.customFormats = {};
    }
    this.options.customFormats[name] = null;
  }

  public getRegisteredFormats(): string[] {
    return sortedKeys(this.options.customFormats || {}).filter((key) => this.options.customFormats?.[key] != null);
  }

  public getSupportedFormats(): string[] {
    return getSupportedFormats(this.options.customFormats);
  }

  setRemoteReference(uri: string, schema: string | JsonSchema, validationOptions?: ZSchemaOptions) {
    let _schema: JsonSchemaInternal;

    if (typeof schema === 'string') {
      _schema = JSON.parse(schema);
    } else {
      _schema = deepClone(schema);
    }

    if (validationOptions) {
      _schema.__$validationOptions = normalizeOptions(validationOptions);
    }

    this.scache.cacheSchemaByUri(uri, _schema);
  }

  getMissingReferences(err: ValidateError): string[] {
    if (!err) return [];
    const details = err.details || [];
    const missingRefs: string[] = [];
    function collect(details: SchemaErrorDetail[]) {
      for (const detail of details) {
        if (detail.code === 'UNRESOLVABLE_REFERENCE' || detail.code === 'SCHEMA_NOT_REACHABLE') {
          missingRefs.push(detail.params[0] as string);
        }
        if (detail.inner) {
          collect(detail.inner);
        }
      }
    }
    collect(details);
    return missingRefs;
  }

  getMissingRemoteReferences(err: ValidateError) {
    const missingReferences = this.getMissingReferences(err);
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

  getResolvedSchema(schemaId: string): JsonSchema | undefined {
    const report = new Report(this.options);
    const schema = this.scache.getSchemaByUri(report, schemaId);
    if (!schema) return undefined;

    const clonedSchema = deepClone(schema);

    const visited: any[] = [];

    // clean-up the schema and resolve references
    const cleanup = function (schema: any) {
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
          copyProp(from, to, key);
        }
      }
      for (key in schema) {
        if (Object.prototype.hasOwnProperty.call(schema, key)) {
          if (key.indexOf('__$') === 0) {
            delete (schema as any)[key];
          } else {
            cleanup((schema as any)[key]);
          }
        }
      }
    };

    cleanup(clonedSchema);
    visited.forEach(function (s) {
      delete s.___$visited;
    });

    return clonedSchema;
  }
}

export class ZSchema extends ZSchemaImpl {
  // ----- static methods start -----

  // class scoped format functions
  public static registerFormat(name: string, validatorFunction: FormatValidatorFn): void {
    return registerFormat(name, validatorFunction);
  }

  public static unregisterFormat(name: string): void {
    return unregisterFormat(name);
  }

  public static getRegisteredFormats(): string[] {
    return getRegisteredFormats();
  }

  // default options for validator instance
  public static getDefaultOptions(): ZSchemaOptions {
    return deepClone(defaultOptions);
  }

  public static setRemoteReference(uri: string, schema: string | JsonSchema, validationOptions?: ZSchemaOptions) {
    let _schema: JsonSchemaInternal;

    if (typeof schema === 'string') {
      _schema = JSON.parse(schema);
    } else {
      _schema = deepClone(schema);
    }

    if (validationOptions) {
      _schema.__$validationOptions = normalizeOptions(validationOptions);
    }

    SchemaCache.cacheSchemaByUri(uri, _schema);
  }

  private static schemaReader: SchemaReader | undefined;

  public static getSchemaReader(): SchemaReader | undefined {
    return ZSchema.schemaReader;
  }

  public static setSchemaReader(schemaReader: SchemaReader | undefined) {
    ZSchema.schemaReader = schemaReader;
  }

  public static schemaSymbol = schemaSymbol;

  public static jsonSymbol = jsonSymbol;

  // ----- static methods end -----

  public static create(options: ZSchemaOptions & { async: true; safe: true }): ZSchemaAsyncSafe;
  public static create(options: ZSchemaOptions & { async: true }): ZSchemaAsync;
  public static create(options: ZSchemaOptions & { safe: true }): ZSchemaSafe;
  public static create(options?: ZSchemaOptions): ZSchema;
  public static create(
    options: ZSchemaOptions & { async?: true; safe?: true } = {}
  ): ZSchema | ZSchemaSafe | ZSchemaAsync | ZSchemaAsyncSafe {
    const isAsync = options.async;
    const isSafe = options.safe;
    delete options.async;
    delete options.safe;
    (options as any).__called_from_factory__ = true;
    if (isAsync && isSafe) {
      return new ZSchemaAsyncSafe(options);
    }
    if (isAsync) {
      return new ZSchemaAsync(options);
    }
    if (isSafe) {
      return new ZSchemaSafe(options);
    }
    return new ZSchema(options);
  }

  constructor(options?: ZSchemaOptions) {
    if (!(options as any)?.__called_from_factory__) {
      throw new Error('do not use new ZSchema(), use ZSchema.create() instead');
    }
    delete (options as any).__called_from_factory__;
    super(options);
  }
}

export class ZSchemaSafe extends ZSchema {
  constructor(options?: ZSchemaOptions) {
    super(options);
  }

  // @ts-expect-error: we need to replace original validate signature here
  validate(json: unknown, schema: JsonSchema | string, options: ValidateOptions = {}): ValidateResponse {
    try {
      super.validate(json, schema, options);
      return { valid: true };
    } catch (err) {
      return { valid: false, err: err as ValidateError };
    }
  }
}

export class ZSchemaAsync extends ZSchema {
  constructor(options?: ZSchemaOptions) {
    super(options);
  }

  // @ts-expect-error: we need to replace original validate signature here
  validate(json: unknown, schema: JsonSchema | string, options: ValidateOptions = {}): Promise<true> {
    return new Promise((resolve, reject) => {
      try {
        super.validate(json, schema, options, (err, valid) => (err || valid !== true ? reject(err) : resolve(valid)));
      } catch (err) {
        reject(err);
      }
    });
  }
}

export class ZSchemaAsyncSafe extends ZSchema {
  constructor(options?: ZSchemaOptions) {
    super(options);
  }

  // @ts-expect-error: we need to replace original validate signature here
  validate(json: unknown, schema: JsonSchema | string, options: ValidateOptions = {}): Promise<ValidateResponse> {
    return new Promise((resolve) => {
      try {
        super.validate(json, schema, options, (err, valid) => {
          resolve({ valid, err });
        });
      } catch (err) {
        resolve({ valid: false, err: err as ValidateError });
      }
    });
  }
}

const Draft4Schema: JsonSchema = _Draft4Schema;
const Draft4HyperSchema: JsonSchema = _Draft4HyperSchema;

export const VERSION_SCHEMA_URL_MAPPING: Record<JsonSchemaVersion, string> = {
  'draft-04': 'http://json-schema.org/draft-04/schema#',
};

ZSchema.setRemoteReference('http://json-schema.org/draft-04/schema', Draft4Schema, { version: 'none' });
ZSchema.setRemoteReference('http://json-schema.org/draft-04/hyper-schema', Draft4HyperSchema, { version: 'none' });
