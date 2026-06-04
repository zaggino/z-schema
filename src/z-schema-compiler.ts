import type { JsonSchema, JsonSchemaInternal } from './json-schema-versions.js';
import type { ValidateResponse } from './z-schema-base.js';
import type { ZSchemaOptions } from './z-schema-options.js';

import { getId } from './json-schema.js';
import { shallowClone } from './utils/clone.js';
import { isAbsoluteUri } from './utils/uri.js';
import { ZSchema } from './z-schema.js';

/**
 * A {@link JsonSchema} that is guaranteed to carry an identifier — `$id` for
 * draft-06+ schemas or `id` for draft-04 — so it can be referenced by string
 * via {@link ZSchemaCompiler.validate}.
 */
export type JsonSchemaWithId = JsonSchema & ({ $id: string } | { id: string });

/**
 * Monotonic counter used to mint unique internal `$id`s for anonymous schemas
 * compiled via {@link ZSchemaCompiler.compile}. Module-scoped and deterministic
 * (no `Math.random` / `Date.now`).
 */
let anonymousSchemaCounter = 0;

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
    // Dispatch to the async/safe variants ourselves (see compile/validate), so
    // the internal validator is always a plain ZSchema. Strip the dispatch-only
    // flags off a copy before creating it — never mutate the caller's options.
    const rest: ZSchemaOptions = { ...this._options };
    delete rest.async;
    delete rest.safe;
    this._zschema = ZSchema.create(rest);
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Register a JSON Schema for later use with {@link validate} (by its `$id` / `id`).
   *
   * The schema is validated and its identified (sub-)schemas are cached under
   * their absolute `$id`/`id` URIs. Subsequent calls to `validate(data, ref)`
   * can then reference it by that identifier.
   *
   * A `$id` (or `id` for draft-04) is **required** to make the schema
   * referenceable — the parameter type enforces this. If a schema without one
   * is passed at runtime (e.g. from untyped JavaScript), the call still
   * validates the schema but emits a `console.warn`, since it cannot be
   * referenced afterwards.
   *
   * Like {@link compile}, this validates eagerly and throws on an invalid
   * schema **regardless of the `safe` option** — `safe` only affects data
   * validation, not schema validation.
   *
   * @param schema - A JSON Schema object carrying a `$id` (or `id` for draft-04).
   * @returns `this` for chaining.
   * @throws {@link ValidateError} if the schema is invalid (even in `safe` mode).
   */
  addSchema(schema: JsonSchemaWithId): this {
    if (!getId(schema as JsonSchemaInternal)) {
      console.warn(
        'z-schema: addSchema() was called with a schema that has no $id (or id for draft-04); ' +
          'it cannot be referenced via validate(data, ref).'
      );
    }
    this._zschema.validateSchema(schema);
    return this;
  }

  /**
   * Compile a JSON Schema into a reusable validation function.
   *
   * The schema is validated and compiled eagerly: invalid schemas throw a
   * {@link ValidateError} here, at compile time, **regardless of the `safe`
   * option** (`safe` only governs how the returned function reports invalid
   * *data*).
   *
   * The schema is registered in the validator's cache under an identifier (its
   * own `$id`/`id`, or a unique internal one minted for anonymous schemas), and
   * the returned function validates by that identifier. This means each
   * invocation reuses the already-compiled schema — no per-call re-compilation
   * or cloning.
   *
   * @param schema - A JSON Schema object or a boolean schema (`true`/`false`).
   * @returns A validation function whose signature is inferred from the constructor options.
   * @throws {@link ValidateError} if the schema is invalid (even in `safe` mode).
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

    // Resolve a string reference for the schema so the returned function can
    // validate by id — the cached path returns the already-compiled schema and
    // skips the per-call deep-clone + recompilation that validating by object
    // would incur.
    const ref = this._registerForCompile(resolvedSchema);

    if (this._options.async && this._options.safe) {
      return ((data: unknown) => this._zschema.validateAsyncSafe(data, ref)) as InferValidateFunction<T>;
    }
    if (this._options.async) {
      return ((data: unknown) => this._zschema.validateAsync(data, ref)) as InferValidateFunction<T>;
    }
    if (this._options.safe) {
      return ((data: unknown) => this._zschema.validateSafe(data, ref)) as InferValidateFunction<T>;
    }
    return ((data: unknown) => this._zschema.validate(data, ref)) as InferValidateFunction<T>;
  }

  /**
   * Validate and register a schema for {@link compile}, returning the string id
   * the compiled function should validate against.
   *
   * Schemas that already carry an `$id`/`id` are registered under it. Anonymous
   * schemas are given a unique absolute internal `$id` (on a private clone, so
   * the caller's object is never mutated) so they too can be cached and reused.
   */
  private _registerForCompile(resolvedSchema: JsonSchema): string {
    const existingId = getId(resolvedSchema as JsonSchemaInternal);
    if (existingId) {
      // Validates (throws on invalid) and caches under the existing id.
      this._zschema.validateSchema(resolvedSchema);
      return existingId;
    }

    const ref = `urn:z-schema:compiled:${(anonymousSchemaCounter += 1)}`;
    // `urn:` is an absolute URI, so collectAndCacheIds caches the schema by it.
    /* c8 ignore next */
    if (!isAbsoluteUri(ref)) {
      throw new Error(`Internal error: generated schema id is not absolute: ${ref}`);
    }

    // Clone before assigning the id so the caller's schema object is untouched.
    const owned = shallowClone(resolvedSchema) as JsonSchemaInternal;
    // Draft-04 reads `id`; draft-06+ reads `$id` (getId falls back to `id`).
    if (this._isDraft04(owned)) {
      owned.id = ref;
    } else {
      owned.$id = ref;
    }
    this._zschema.validateSchema(owned as JsonSchema);
    return ref;
  }

  /** Whether schema id resolution should use the draft-04 `id` keyword. */
  private _isDraft04(schema: JsonSchemaInternal): boolean {
    if (this._options.version === 'draft-04') {
      return true;
    }
    return typeof schema.$schema === 'string' && schema.$schema.includes('draft-04');
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
