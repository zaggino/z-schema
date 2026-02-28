import type { ValidateError } from './errors.js';
import type { FormatValidatorFn } from './format-validators.js';
import type { JsonSchema } from './json-schema-versions.js';
import type { ValidateOptions, ValidateResponse } from './z-schema-base.js';
import type { ZSchemaOptions } from './z-schema-options.js';
import type { SchemaReader } from './z-schema-reader.js';

import './z-schema-versions.js';

import { getRegisteredFormats, registerFormat, unregisterFormat } from './format-validators.js';
import { prepareRemoteSchema, SchemaCache } from './schema-cache.js';
import { deepClone } from './utils/clone.js';
import { jsonSymbol, schemaSymbol } from './utils/symbols.js';
import { FACTORY_TOKEN, ZSchemaBase } from './z-schema-base.js';
import { defaultOptions } from './z-schema-options.js';
import { getSchemaReader, setSchemaReader } from './z-schema-reader.js';

export class ZSchema extends ZSchemaBase {
  /** @internal Use ZSchema.create() instead. */
  constructor(options: ZSchemaOptions | undefined, token: symbol) {
    super(options, token);
  }

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
    const _schema = prepareRemoteSchema(schema, uri, validationOptions);
    SchemaCache.cacheSchemaByUri(uri, _schema);
  }

  public static getSchemaReader() {
    return getSchemaReader();
  }

  public static setSchemaReader(schemaReader: SchemaReader | undefined) {
    return setSchemaReader(schemaReader);
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
    if (isAsync && isSafe) {
      return new ZSchemaAsyncSafe(options, FACTORY_TOKEN);
    }
    if (isAsync) {
      return new ZSchemaAsync(options, FACTORY_TOKEN);
    }
    if (isSafe) {
      return new ZSchemaSafe(options, FACTORY_TOKEN);
    }
    return new ZSchema(options, FACTORY_TOKEN);
  }

  validate(json: unknown, schema: JsonSchema | string, options: ValidateOptions = {}): true {
    return this._validate(json, schema, options);
  }

  validateSafe(json: unknown, schema: JsonSchema | string, options?: ValidateOptions): ValidateResponse {
    try {
      this._validate(json, schema, options ?? {});
      return { valid: true };
    } catch (err) {
      return { valid: false, err: err as ValidateError };
    }
  }

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

  validateSchema(schemaOrArr: JsonSchema | JsonSchema[]): true {
    return this._validateSchema(schemaOrArr);
  }

  validateSchemaSafe(schemaOrArr: JsonSchema | JsonSchema[]): ValidateResponse {
    try {
      this._validateSchema(schemaOrArr);
      return { valid: true };
    } catch (err) {
      return { valid: false, err: err as ValidateError };
    }
  }
}

export class ZSchemaSafe extends ZSchemaBase {
  /** @internal Use ZSchema.create() instead. */
  constructor(options: ZSchemaOptions | undefined, token: symbol) {
    super(options, token);
  }

  validate(json: unknown, schema: JsonSchema | string, options: ValidateOptions = {}): ValidateResponse {
    try {
      this._validate(json, schema, options);
      return { valid: true };
    } catch (err) {
      return { valid: false, err: err as ValidateError };
    }
  }

  validateSchema(schemaOrArr: JsonSchema | JsonSchema[]): ValidateResponse {
    try {
      this._validateSchema(schemaOrArr);
      return { valid: true };
    } catch (err) {
      return { valid: false, err: err as ValidateError };
    }
  }
}

export class ZSchemaAsync extends ZSchemaBase {
  /** @internal Use ZSchema.create() instead. */
  constructor(options: ZSchemaOptions | undefined, token: symbol) {
    super(options, token);
  }

  validate(json: unknown, schema: JsonSchema | string, options: ValidateOptions = {}): Promise<true> {
    return new Promise((resolve, reject) => {
      try {
        this._validate(json, schema, options, (err, valid) => (err || valid !== true ? reject(err) : resolve(valid)));
      } catch (err) {
        reject(err);
      }
    });
  }

  validateSchema(schemaOrArr: JsonSchema | JsonSchema[]): true {
    return this._validateSchema(schemaOrArr);
  }
}

export class ZSchemaAsyncSafe extends ZSchemaBase {
  /** @internal Use ZSchema.create() instead. */
  constructor(options: ZSchemaOptions | undefined, token: symbol) {
    super(options, token);
  }

  validate(json: unknown, schema: JsonSchema | string, options: ValidateOptions = {}): Promise<ValidateResponse> {
    return new Promise((resolve) => {
      try {
        this._validate(json, schema, options, (err, valid) => {
          resolve({ valid, err });
        });
      } catch (err) {
        resolve({ valid: false, err: err as ValidateError });
      }
    });
  }

  validateSchema(schemaOrArr: JsonSchema | JsonSchema[]): ValidateResponse {
    try {
      this._validateSchema(schemaOrArr);
      return { valid: true };
    } catch (err) {
      return { valid: false, err: err as ValidateError };
    }
  }
}
