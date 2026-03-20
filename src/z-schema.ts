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

  /**
   * Register a global format validator available to all instances.
   * @param name - The format name (e.g. `'email'`, `'date'`).
   * @param validatorFunction - A sync or async function `(value: unknown) => boolean | Promise<boolean>`.
   */
  public static registerFormat(name: string, validatorFunction: FormatValidatorFn): void {
    return registerFormat(name, validatorFunction);
  }

  /**
   * Remove a globally registered format validator.
   * @param name - The format name to unregister.
   */
  public static unregisterFormat(name: string): void {
    return unregisterFormat(name);
  }

  /** Returns the names of all globally registered format validators. */
  public static getRegisteredFormats(): string[] {
    return getRegisteredFormats();
  }

  /** Returns a deep clone of the default options. */
  public static getDefaultOptions(): ZSchemaOptions {
    return deepClone(defaultOptions);
  }

  /**
   * Register a remote schema in the global cache so any instance can resolve `$ref` to it.
   * @param uri - The URI the schema will be known by.
   * @param schema - The schema object or JSON string.
   * @param validationOptions - Optional options used for schema preparation.
   */
  public static setRemoteReference(uri: string, schema: string | JsonSchema, validationOptions?: ZSchemaOptions) {
    const _schema = prepareRemoteSchema(schema, uri, validationOptions);
    SchemaCache.cacheSchemaByUri(uri, _schema);
  }

  /** Returns the current global schema reader, or `undefined` if none is set. */
  public static getSchemaReader() {
    return getSchemaReader();
  }

  /**
   * Set a global schema reader function used to resolve remote `$ref` URIs.
   * @param schemaReader - A function `(uri: string) => JsonSchema | undefined`, or `undefined` to clear.
   */
  public static setSchemaReader(schemaReader: SchemaReader | undefined) {
    return setSchemaReader(schemaReader);
  }

  public static schemaSymbol = schemaSymbol;

  public static jsonSymbol = jsonSymbol;

  // ----- static methods end -----

  /**
   * Create a validator instance.
   *
   * The returned type depends on the `async` and `safe` options:
   * - `{}` → `ZSchema` — `validate()` returns `true` or throws.
   * - `{ safe: true }` → `ZSchemaSafe` — `validate()` returns `{ valid, err? }`.
   * - `{ async: true }` → `ZSchemaAsync` — `validate()` returns `Promise<true>` or rejects.
   * - `{ async: true, safe: true }` → `ZSchemaAsyncSafe` — `validate()` returns `Promise<{ valid, err? }>`.
   *
   * @param options - Validator configuration. See `ZSchemaOptions` for all available settings.
   * @returns A validator instance of the appropriate variant.
   *
   * @example
   * ```ts
   * const validator = ZSchema.create();
   * validator.validate(data, schema); // throws on error
   *
   * const safe = ZSchema.create({ safe: true });
   * const result = safe.validate(data, schema); // { valid, err? }
   * ```
   */
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

  /**
   * Validate JSON data against a schema.
   * @param json - The data to validate.
   * @param schema - A JSON Schema object or a schema id string (previously registered via `validateSchema`).
   * @param options - Per-call options (`schemaPath`, `includeErrors`, `excludeErrors`).
   * @returns `true` if valid.
   * @throws {@link ValidateError} if validation fails, with a `details` array of structured errors.
   */
  validate(json: unknown, schema: JsonSchema | string, options: ValidateOptions = {}): true {
    return this._validate(json, schema, options);
  }

  /**
   * Validate JSON data against a schema, returning a result object instead of throwing.
   * @param json - The data to validate.
   * @param schema - A JSON Schema object or a schema id string.
   * @param options - Per-call options.
   * @returns `{ valid: true }` on success, or `{ valid: false, err: ValidateError }` on failure.
   */
  validateSafe(json: unknown, schema: JsonSchema | string, options?: ValidateOptions): ValidateResponse {
    try {
      this._validate(json, schema, options ?? {});
      return { valid: true };
    } catch (err) {
      return { valid: false, err: err as ValidateError };
    }
  }

  /**
   * Validate JSON data against a schema asynchronously (supports async format validators).
   * @param json - The data to validate.
   * @param schema - A JSON Schema object or a schema id string.
   * @param options - Per-call options.
   * @returns A promise that resolves to `true` if valid.
   * @throws {@link ValidateError} if validation fails (the promise rejects).
   */
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

  /**
   * Validate JSON data against a schema asynchronously, returning a result object.
   * The promise always resolves (never rejects).
   * @param json - The data to validate.
   * @param schema - A JSON Schema object or a schema id string.
   * @param options - Per-call options.
   * @returns A promise resolving to `{ valid: true }` or `{ valid: false, err: ValidateError }`.
   */
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

  /**
   * Validate one or more JSON Schemas, compiling and caching them for later use with `validate()`.
   * @param schemaOrArr - A single schema or an array of schemas (for cross-referencing).
   * @returns `true` if all schemas are valid.
   * @throws {@link ValidateError} if any schema is invalid.
   */
  validateSchema(schemaOrArr: JsonSchema | JsonSchema[]): true {
    return this._validateSchema(schemaOrArr);
  }

  /**
   * Validate one or more JSON Schemas, returning a result object instead of throwing.
   * @param schemaOrArr - A single schema or an array of schemas.
   * @returns `{ valid: true }` on success, or `{ valid: false, err: ValidateError }` on failure.
   */
  validateSchemaSafe(schemaOrArr: JsonSchema | JsonSchema[]): ValidateResponse {
    try {
      this._validateSchema(schemaOrArr);
      return { valid: true };
    } catch (err) {
      return { valid: false, err: err as ValidateError };
    }
  }
}

/**
 * Synchronous safe validator — `validate()` returns `{ valid, err? }` instead of throwing.
 * Created via `ZSchema.create({ safe: true })`.
 */
export class ZSchemaSafe extends ZSchemaBase {
  /** @internal Use ZSchema.create() instead. */
  constructor(options: ZSchemaOptions | undefined, token: symbol) {
    super(options, token);
  }

  /**
   * Validate JSON data against a schema.
   * @param json - The data to validate.
   * @param schema - A JSON Schema object or a schema id string.
   * @param options - Per-call options.
   * @returns `{ valid: true }` on success, or `{ valid: false, err: ValidateError }` on failure.
   */
  validate(json: unknown, schema: JsonSchema | string, options: ValidateOptions = {}): ValidateResponse {
    try {
      this._validate(json, schema, options);
      return { valid: true };
    } catch (err) {
      return { valid: false, err: err as ValidateError };
    }
  }

  /**
   * Validate one or more JSON Schemas.
   * @param schemaOrArr - A single schema or an array of schemas.
   * @returns `{ valid: true }` on success, or `{ valid: false, err: ValidateError }` on failure.
   */
  validateSchema(schemaOrArr: JsonSchema | JsonSchema[]): ValidateResponse {
    try {
      this._validateSchema(schemaOrArr);
      return { valid: true };
    } catch (err) {
      return { valid: false, err: err as ValidateError };
    }
  }
}

/**
 * Asynchronous throw validator — `validate()` returns `Promise<true>` or rejects.
 * Created via `ZSchema.create({ async: true })`.
 */
export class ZSchemaAsync extends ZSchemaBase {
  /** @internal Use ZSchema.create() instead. */
  constructor(options: ZSchemaOptions | undefined, token: symbol) {
    super(options, token);
  }

  /**
   * Validate JSON data against a schema asynchronously.
   * @param json - The data to validate.
   * @param schema - A JSON Schema object or a schema id string.
   * @param options - Per-call options.
   * @returns A promise that resolves to `true` if valid.
   * @throws {@link ValidateError} if validation fails (the promise rejects).
   */
  validate(json: unknown, schema: JsonSchema | string, options: ValidateOptions = {}): Promise<true> {
    return new Promise((resolve, reject) => {
      try {
        this._validate(json, schema, options, (err, valid) => (err || valid !== true ? reject(err) : resolve(valid)));
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Validate one or more JSON Schemas (synchronous, throws on error).
   * @param schemaOrArr - A single schema or an array of schemas.
   * @returns `true` if all schemas are valid.
   * @throws {@link ValidateError} if any schema is invalid.
   */
  validateSchema(schemaOrArr: JsonSchema | JsonSchema[]): true {
    return this._validateSchema(schemaOrArr);
  }
}

/**
 * Asynchronous safe validator — `validate()` returns `Promise<{ valid, err? }>` (never rejects).
 * Created via `ZSchema.create({ async: true, safe: true })`.
 */
export class ZSchemaAsyncSafe extends ZSchemaBase {
  /** @internal Use ZSchema.create() instead. */
  constructor(options: ZSchemaOptions | undefined, token: symbol) {
    super(options, token);
  }

  /**
   * Validate JSON data against a schema asynchronously.
   * The promise always resolves (never rejects).
   * @param json - The data to validate.
   * @param schema - A JSON Schema object or a schema id string.
   * @param options - Per-call options.
   * @returns A promise resolving to `{ valid: true }` or `{ valid: false, err: ValidateError }`.
   */
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

  /**
   * Validate one or more JSON Schemas.
   * @param schemaOrArr - A single schema or an array of schemas.
   * @returns `{ valid: true }` on success, or `{ valid: false, err: ValidateError }` on failure.
   */
  validateSchema(schemaOrArr: JsonSchema | JsonSchema[]): ValidateResponse {
    try {
      this._validateSchema(schemaOrArr);
      return { valid: true };
    } catch (err) {
      return { valid: false, err: err as ValidateError };
    }
  }
}
