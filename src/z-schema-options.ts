import type { FormatValidatorFn } from './format-validators.js';
import type { Report } from './report.js';

import { CURRENT_DEFAULT_SCHEMA_VERSION, type JsonSchemaVersion } from './json-schema-versions.js';
import { shallowClone } from './utils/clone.js';
import { DEFAULT_MAX_RECURSION_DEPTH, MAX_ASYNC_TIMEOUT } from './utils/constants.js';

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
}

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
  // maximum recursion depth for deeply nested schema/data traversal (prevents stack overflow)
  maxRecursionDepth: DEFAULT_MAX_RECURSION_DEPTH,
};

export const normalizeOptions = (options?: ZSchemaOptions) => {
  let normalized;

  // options
  if (typeof options === 'object') {
    let keys = Object.keys(options) as Array<keyof ZSchemaOptions>;

    // check that the options are correctly configured
    for (const key of keys) {
      if (defaultOptions[key] === undefined) {
        throw new Error('Unexpected option passed to constructor: ' + key);
      }
    }

    // copy the default options into passed options
    keys = Object.keys(defaultOptions) as Array<keyof ZSchemaOptions>;
    for (const key of keys) {
      if (options[key] === undefined) {
        (options as any)[key] = shallowClone(defaultOptions[key]);
      }
    }

    normalized = options;
  } else {
    normalized = shallowClone(defaultOptions);
  }

  // Clamp asyncTimeout to prevent resource exhaustion (CWE-400)
  if (normalized.asyncTimeout != null) {
    normalized.asyncTimeout = Math.min(Math.max(normalized.asyncTimeout, 0), MAX_ASYNC_TIMEOUT);
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
