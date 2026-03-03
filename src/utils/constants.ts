/**
 * Default maximum recursion depth for deeply nested schema/data traversal.
 * Used as the default for {@link ZSchemaOptions.maxRecursionDepth} and
 * internal helpers like `deepClone` and `collectIds`.
 */
export const DEFAULT_MAX_RECURSION_DEPTH = 100;

/**
 * Maximum allowed value for {@link ZSchemaOptions.asyncTimeout} in milliseconds.
 * Values exceeding this limit are clamped during option normalization to
 * prevent resource exhaustion (CWE-400).
 */
export const MAX_ASYNC_TIMEOUT = 60_000;

/**
 * Maximum allowed length for a JSON Schema `pattern` regular expression string.
 * Patterns exceeding this limit are rejected by {@link compileSchemaRegex} to
 * mitigate Regular Expression Denial-of-Service (CWE-1333) and regex injection
 * (CWE-95).
 */
export const MAX_SCHEMA_REGEX_LENGTH = 10_000;
