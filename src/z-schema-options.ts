import type { FormatValidatorFn } from './format-validators.js';
import type { JsonSchemaVersion } from './json-schema.js';
import type { Report } from './report.js';

import { shallowClone } from './utils/clone.js';

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

export const defaultOptions: ZSchemaOptions = {
  // default version to validate against
  version: 'draft-06',
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

export const normalizeOptions = (options?: ZSchemaOptions) => {
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
