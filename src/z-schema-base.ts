import type { ValidateError } from './errors.js';
import type { FormatValidatorFn } from './format-validators.js';
import type { JsonSchemaVersion } from './json-schema.js';
import type { SchemaErrorDetail } from './report.js';
import type { ZSchemaOptions } from './z-schema-options.js';

import { type Errors, getValidateError } from './errors.js';
import { getSupportedFormats } from './format-validators.js';
import { type JsonSchema, type JsonSchemaInternal, VERSION_SCHEMA_URL_MAPPING } from './json-schema.js';
import { validate as validateJson } from './json-validation.js';
import { Report } from './report.js';
import { SchemaCache } from './schema-cache.js';
import { SchemaCompiler } from './schema-compiler.js';
import { SchemaValidator } from './schema-validator.js';
import { deepClone } from './utils/clone.js';
import { get, sortedKeys } from './utils/json.js';
import { copyProp } from './utils/properties.js';
import { getRemotePath } from './utils/uri.js';
import { whatIs } from './utils/what-is.js';
import { defaultOptions, normalizeOptions } from './z-schema-options.js';

export interface ValidateOptions {
  schemaPath?: string;
  includeErrors?: Array<keyof typeof Errors>;
  excludeErrors?: Array<keyof typeof Errors>;
}

export type ValidateResponse = { valid: boolean; err?: ValidateError };

export type ValidateCallback = (err: ValidateResponse['err'], valid: ValidateResponse['valid']) => void;

export class ZSchemaBase {
  scache: SchemaCache;
  sc: SchemaCompiler;
  sv: SchemaValidator;
  validateOptions: ValidateOptions = {};
  options: ZSchemaOptions;

  constructor(options?: ZSchemaOptions) {
    if (!(options as any)?.__called_from_factory__) {
      throw new Error('do not use new ZSchema(), use ZSchema.create() instead');
    }
    delete (options as any).__called_from_factory__;

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

  _validate(json: unknown, schema: JsonSchema | string, options: ValidateOptions, callback: ValidateCallback): void;
  _validate(json: unknown, schema: JsonSchema | string, callback: ValidateCallback): void;
  _validate(json: unknown, schema: JsonSchema | string, options: ValidateOptions): true;
  _validate(json: unknown, schema: JsonSchema | string): true;
  _validate(
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
      this._validate(json, schema, options ?? {});
      return { valid: true };
    } catch (err) {
      return { valid: false, err: err as ValidateError };
    }
  }

  // validateAsync always returns true, implement using try-catch
  validateAsync(json: unknown, schema: JsonSchema | string, options?: ValidateOptions): Promise<true> {
    return new Promise((resolve, reject) => {
      try {
        this._validate(json, schema, options || {}, (err, valid) =>
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
        this._validate(json, schema, options || {}, (err, valid) => {
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
