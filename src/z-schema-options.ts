import type { FormatValidatorFn } from './format-validators.js';
import type { JsonSchemaVersion } from './json-schema-versions.js';
import type { Report } from './report.js';

import { CURRENT_DEFAULT_SCHEMA_VERSION } from './json-schema-versions.js';
import { shallowClone } from './utils/clone.js';
// These constants are consumed locally (default options + async-timeout clamping)
// and also re-exported as public API, so this cannot collapse to a bare re-export.
// oxlint-disable-next-line unicorn/prefer-export-from
import { DEFAULT_MAX_ERRORS, DEFAULT_MAX_RECURSION_DEPTH, MAX_ASYNC_TIMEOUT } from './utils/constants.js';
import { createDict } from './utils/properties.js';

export { DEFAULT_MAX_RECURSION_DEPTH, MAX_ASYNC_TIMEOUT };

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
  formatAssertions?: boolean | null;
  customValidator?: (report: Report, schema: unknown, json: unknown) => void;
  customFormats?: Record<string, FormatValidatorFn | null>;
  maxRecursionDepth?: number;
  /**
   * The most error details a `validate()` call reports, counting every detail including those
   * nested in `inner`. Default 1000. When details were left out, the error has `truncated: true`;
   * the validity of the result never depends on this limit. `Infinity` turns the limit off.
   * Applies to data validation, not to schema validation.
   */
  maxErrors?: number;
}

/**
 * Every option as a required key, so `defaultOptions` cannot compile without listing a newly added option.
 * An option without a default is listed with the value `undefined`.
 */
type EveryOption = { [K in keyof Required<ZSchemaOptions>]: ZSchemaOptions[K] };

/** The default of every option. Its own keys are the list of known options (see `normalizeOptions`). */
export const defaultOptions: ZSchemaOptions = {
  // default version to validate against
  version: CURRENT_DEFAULT_SCHEMA_VERSION,
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
  // ignore references that cannot be resolved (remote schemas)
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
  // control format assertion behavior:
  //   true  - respect vocabulary: for draft 2019-09/2020-12, check meta-schema $vocabulary
  //           to determine if format is assertion or annotation-only
  //   false - format is always annotation-only (never asserts)
  //   null  - legacy behavior: always assert format validation
  formatAssertions: null,
  // function to be called on every schema
  customValidator: null as unknown as undefined,
  // format validators for this instance only; no default
  customFormats: undefined,
  // maximum recursion depth for deeply nested schema/data traversal (prevents stack overflow)
  maxRecursionDepth: DEFAULT_MAX_RECURSION_DEPTH,
  // maximum number of error details one validation reports (counted through inner)
  maxErrors: DEFAULT_MAX_ERRORS,
} satisfies EveryOption;

/**
 * The limit to use for a `maxErrors` value: a number of at least 1 is rounded down (`Infinity` stays),
 * a smaller number becomes 1, and anything that is not a number (or is `NaN`) becomes the default.
 */
export const resolveMaxErrors = (value: unknown): number => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return DEFAULT_MAX_ERRORS;
  }
  return value >= 1 ? Math.floor(value) : 1;
};

/**
 * `ZSchema.create` dispatch flags. They have no default but are accepted, so the caller's options
 * object (which the validator stores as-is) never has to be stripped of them.
 */
const FACTORY_DISPATCH_KEYS = new Set<string>(['async', 'safe']);

export const normalizeOptions = (options?: ZSchemaOptions) => {
  let normalized;

  // options
  if (typeof options === 'object') {
    let keys = Object.keys(options) as Array<keyof ZSchemaOptions>;

    // check that the options are correctly configured
    // (own keys of the defaults only, so a key such as `constructor` or `__proto__` is not an option)
    for (const key of keys) {
      if (!Object.hasOwn(defaultOptions, key) && !FACTORY_DISPATCH_KEYS.has(key)) {
        throw new Error(`Unexpected option passed to constructor: ${key}`);
      }
    }

    // copy the default options into passed options (an option without a default is left as it is)
    keys = Object.keys(defaultOptions) as Array<keyof ZSchemaOptions>;
    for (const key of keys) {
      const defaultValue = defaultOptions[key];
      if (defaultValue !== undefined && options[key] === undefined) {
        (options as Record<string, unknown>)[key] = shallowClone(defaultValue);
      }
    }

    // The instance writes into this map (registerFormat / unregisterFormat), so it gets a copy of its own:
    // the caller's map is left alone and instances created from the same map do not share formats.
    if (typeof options.customFormats === 'object' && options.customFormats !== null) {
      options.customFormats = createDict(options.customFormats);
    }

    normalized = options;
  } else {
    normalized = shallowClone(defaultOptions);
  }

  // Clamp asyncTimeout to prevent resource exhaustion (CWE-400)
  if (normalized.asyncTimeout != null) {
    normalized.asyncTimeout = Math.min(Math.max(normalized.asyncTimeout, 0), MAX_ASYNC_TIMEOUT);
  }

  normalized.maxErrors = resolveMaxErrors(normalized.maxErrors);

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
