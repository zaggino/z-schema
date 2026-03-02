import type { JsonSchema } from './json-schema-versions.js';
import type { ValidateResponse } from './z-schema-base.js';
import type { ZSchemaOptions } from './z-schema-options.js';

import { ZSchema } from './z-schema.js';

/**
 * A compiled validation function that throws {@link ValidateError} on failure.
 * Returned when the compiler is created without `async` or `safe` options.
 *
 * @throws {@link ValidateError} when the data does not conform to the schema.
 */
export type ValidateFunction = (data: unknown) => true;

/**
 * A compiled validation function that returns a result object instead of throwing.
 * Returned when the compiler is created with `{ safe: true }`.
 */
export type SafeValidateFunction = (data: unknown) => ValidateResponse;

/**
 * A compiled async validation function that rejects on failure.
 * Returned when the compiler is created with `{ async: true }`.
 *
 * @throws {@link ValidateError} when the data does not conform to the schema.
 */
export type AsyncValidateFunction = (data: unknown) => Promise<true>;

/**
 * A compiled async validation function that always resolves with a result object.
 * Returned when the compiler is created with `{ async: true, safe: true }`.
 */
export type AsyncSafeValidateFunction = (data: unknown) => Promise<ValidateResponse>;

/** Union of all possible compiled validation function types. */
export type CompiledValidateFunction =
  | ValidateFunction
  | SafeValidateFunction
  | AsyncValidateFunction
  | AsyncSafeValidateFunction;

/**
 * Infers the compiled validation function type from the compiler options.
 *
 * | Options                       | Inferred type                |
 * | ----------------------------- | ---------------------------- |
 * | `{}`                          | `ValidateFunction`           |
 * | `{ safe: true }`              | `SafeValidateFunction`       |
 * | `{ async: true }`             | `AsyncValidateFunction`      |
 * | `{ async: true, safe: true }` | `AsyncSafeValidateFunction`  |
 */
export type InferValidateFunction<T extends ZSchemaOptions> = T extends { async: true; safe: true }
  ? AsyncSafeValidateFunction
  : T extends { async: true }
    ? AsyncValidateFunction
    : T extends { safe: true }
      ? SafeValidateFunction
      : ValidateFunction;

/**
 * Compile-to-function wrapper around {@link ZSchema}.
 *
 * Pre-compiles a JSON Schema and returns a reusable validation function.
 * The function signature depends on the `async` and `safe` constructor options:
 *
 * | Options                       | Return type              | Behaviour                            |
 * | ----------------------------- | ------------------------ | ------------------------------------ |
 * | `{}` (default)                | `ValidateFunction`       | returns `true`, throws on error      |
 * | `{ safe: true }`              | `SafeValidateFunction`   | returns `{ valid, err? }`            |
 * | `{ async: true }`             | `AsyncValidateFunction`  | resolves `true`, rejects on error    |
 * | `{ async: true, safe: true }` | `AsyncSafeValidateFunction` | resolves `{ valid, err? }`        |
 *
 * The return type of `compile()` is automatically inferred from the constructor
 * options — no type casting is needed:
 *
 * @example
 * ```ts
 * import { ZSchemaCompiler } from 'z-schema';
 *
 * const compiler = new ZSchemaCompiler();
 * const validate = compiler.compile({ type: 'object', required: ['name'] });
 * //    ^? ValidateFunction
 *
 * const safeCompiler = new ZSchemaCompiler({ safe: true });
 * const safeValidate = safeCompiler.compile({ type: 'string' });
 * //    ^? SafeValidateFunction
 *
 * const asyncCompiler = new ZSchemaCompiler({ async: true });
 * const asyncValidate = asyncCompiler.compile({ type: 'number' });
 * //    ^? AsyncValidateFunction
 * ```
 */
export class ZSchemaCompiler<T extends ZSchemaOptions = ZSchemaOptions> {
  private readonly _zschema: ZSchema;
  private readonly _options: T;

  constructor(options?: T) {
    this._options = (options ?? {}) as T;
    // Always create a plain ZSchema so we can dispatch to the right method variant.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { async: _async, safe: _safe, ...rest } = this._options;
    this._zschema = ZSchema.create(rest);
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Register a JSON Schema for later use with {@link validate} (by its `$id` / `id`).
   *
   * The schema is compiled and cached eagerly. Subsequent calls to
   * `validate(data, schemaRef)` can reference it by its `$id`.
   *
   * @param schema - A JSON Schema object. Must have a `$id` (or `id`) to be referenceable.
   * @returns `this` for chaining.
   * @throws {@link ValidateError} if the schema is invalid.
   */
  addSchema(schema: JsonSchema): this {
    this._zschema.validateSchema(schema);
    return this;
  }

  /**
   * Compile a JSON Schema into a reusable validation function.
   *
   * The schema is validated and compiled eagerly. Subsequent calls to the
   * returned function skip schema compilation and go straight to data validation.
   *
   * @param schema - A JSON Schema object or a boolean schema (`true`/`false`).
   * @returns A validation function whose signature is inferred from the constructor options.
   */
  compile(schema: JsonSchema | boolean): InferValidateFunction<T> {
    // Boolean schemas: true accepts everything, false rejects everything.
    // Wrap in an object form so the ZSchema pipeline processes them correctly.
    let resolvedSchema: JsonSchema;
    if (typeof schema === 'boolean') {
      resolvedSchema = schema ? ({} as JsonSchema) : ({ not: {} } as JsonSchema);
    } else {
      resolvedSchema = schema;
    }

    // Pre-compile and validate the schema so errors surface at compile time.
    this._zschema.validateSchema(resolvedSchema);

    if (this._options.async && this._options.safe) {
      return ((data: unknown) => this._zschema.validateAsyncSafe(data, resolvedSchema)) as InferValidateFunction<T>;
    }
    if (this._options.async) {
      return ((data: unknown) => this._zschema.validateAsync(data, resolvedSchema)) as InferValidateFunction<T>;
    }
    if (this._options.safe) {
      return ((data: unknown) => this._zschema.validateSafe(data, resolvedSchema)) as InferValidateFunction<T>;
    }
    return ((data: unknown) => this._zschema.validate(data, resolvedSchema)) as InferValidateFunction<T>;
  }

  /**
   * Validate data against a previously-registered schema, referenced by its `$id`.
   *
   * In non-safe mode this throws on failure; in safe mode it returns a result object.
   *
   * @param data - The data to validate.
   * @param ref - A schema `$id` / `id` string (previously registered via {@link addSchema} or {@link compile}).
   * @returns The validation result, whose type depends on the constructor options.
   */
  validate(data: unknown, ref: string): InferValidateFunction<T> extends (...args: unknown[]) => infer R ? R : never {
    if (this._options.async && this._options.safe) {
      return this._zschema.validateAsyncSafe(data, ref) as never;
    }
    if (this._options.async) {
      return this._zschema.validateAsync(data, ref) as never;
    }
    if (this._options.safe) {
      return this._zschema.validateSafe(data, ref) as never;
    }

    return this._zschema.validate(data, ref) as true as never;
  }
}

export default ZSchemaCompiler;
