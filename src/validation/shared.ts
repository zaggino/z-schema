import type { JsonSchema, JsonSchemaAll, JsonSchemaInternal, JsonSchemaVersion } from '../json-schema-versions.js';
// JsonSchemaAll is retained for the VALIDATION_VOCAB_KEYWORDS Set key type.
import type { Report } from '../report.js';
import type { ValidateOptions, ZSchemaBase } from '../z-schema-base.js';

import { isObject } from '../utils/what-is.js';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type JsonValidatorFn = (this: ZSchemaBase, report: Report, schema: JsonSchema, json: unknown) => void;

// ---------------------------------------------------------------------------
// Draft / vocabulary helpers
// ---------------------------------------------------------------------------

export const shouldSkipValidate = function (options: ValidateOptions, errors: any) {
  return (
    options &&
    Array.isArray(options.includeErrors) &&
    options.includeErrors.length > 0 &&
    !errors.some(function (err: any) {
      return options.includeErrors!.includes(err);
    })
  );
};

export const supportsDependentKeywords = (
  schema: JsonSchemaInternal,
  version: JsonSchemaVersion | 'none' | undefined
) => {
  if (typeof schema.$schema === 'string') {
    return !/draft-04|draft-06|draft-07/.test(schema.$schema);
  }
  return !(version === 'draft-04' || version === 'draft-06' || version === 'draft-07');
};

// ---------------------------------------------------------------------------
// Vocabulary constants
// ---------------------------------------------------------------------------

const VOCAB_VALIDATION_2019_09 = 'https://json-schema.org/draft/2019-09/vocab/validation';
const VOCAB_VALIDATION_2020_12 = 'https://json-schema.org/draft/2020-12/vocab/validation';

const VOCAB_FORMAT_2019_09 = 'https://json-schema.org/draft/2019-09/vocab/format';
const VOCAB_FORMAT_ASSERTION_2020_12 = 'https://json-schema.org/draft/2020-12/vocab/format-assertion';

export const VALIDATION_VOCAB_KEYWORDS = new Set<keyof JsonSchemaAll>([
  'type',
  'multipleOf',
  'maximum',
  'exclusiveMaximum',
  'minimum',
  'exclusiveMinimum',
  'maxLength',
  'minLength',
  'pattern',
  'maxItems',
  'minItems',
  'uniqueItems',
  'maxContains',
  'minContains',
  'maxProperties',
  'minProperties',
  'required',
  'dependentRequired',
  'enum',
  'const',
  'contentEncoding',
  'contentMediaType',
]);

export const isValidationVocabularyEnabled = (
  schema: JsonSchemaInternal,
  report: Report,
  version: JsonSchemaVersion | 'none' | undefined
) => {
  if (version !== 'draft2019-09' && version !== 'draft2020-12') {
    return true;
  }

  const currentSchemaMeta = schema.__$schemaResolved;
  const rootSchemaMeta =
    report.rootSchema && typeof report.rootSchema !== 'boolean' ? report.rootSchema.__$schemaResolved : undefined;
  const metaSchema = (currentSchemaMeta || rootSchemaMeta) as JsonSchemaInternal | boolean | undefined;

  if (!metaSchema || typeof metaSchema !== 'object' || !isObject(metaSchema.$vocabulary)) {
    return true;
  }

  const vocabulary = metaSchema.$vocabulary as Record<string, boolean>;
  const has2019 = Object.hasOwn(vocabulary, VOCAB_VALIDATION_2019_09);
  const has2020 = Object.hasOwn(vocabulary, VOCAB_VALIDATION_2020_12);

  if (has2019 || has2020) {
    return vocabulary[VOCAB_VALIDATION_2019_09] === true || vocabulary[VOCAB_VALIDATION_2020_12] === true;
  }

  return false;
};

/**
 * Checks whether the format-assertion vocabulary is enabled in the meta-schema.
 * For draft 2019-09: checks if the format vocabulary is set to true.
 * For draft 2020-12: checks if the format-assertion vocabulary is present and true.
 * Returns true for older drafts (format was always an assertion).
 */
export const isFormatAssertionVocabEnabled = (
  schema: JsonSchemaInternal,
  report: Report,
  version: JsonSchemaVersion | 'none' | undefined
): boolean => {
  if (version !== 'draft2019-09' && version !== 'draft2020-12') {
    return true; // older drafts always assert format
  }

  const currentSchemaMeta = schema.__$schemaResolved;
  const rootSchemaMeta =
    report.rootSchema && typeof report.rootSchema !== 'boolean' ? report.rootSchema.__$schemaResolved : undefined;
  const metaSchema = (currentSchemaMeta || rootSchemaMeta) as JsonSchemaInternal | boolean | undefined;

  if (!metaSchema || typeof metaSchema !== 'object' || !isObject(metaSchema.$vocabulary)) {
    return false; // no vocabulary info, default to annotation-only for modern drafts
  }

  const vocabulary = metaSchema.$vocabulary as Record<string, boolean>;

  // For draft 2020-12, only the format-assertion vocabulary enables format as assertion
  if (Object.hasOwn(vocabulary, VOCAB_FORMAT_ASSERTION_2020_12)) {
    return vocabulary[VOCAB_FORMAT_ASSERTION_2020_12] === true;
  }

  // For draft 2019-09, check if the format vocabulary is enabled (true)
  if (Object.hasOwn(vocabulary, VOCAB_FORMAT_2019_09)) {
    return vocabulary[VOCAB_FORMAT_2019_09] === true;
  }

  return false; // default to annotation-only for modern drafts
};

// ---------------------------------------------------------------------------
// Validation result caching
// ---------------------------------------------------------------------------

export function cacheValidationResult(report: Report, schema: unknown, json: unknown, passed: boolean): void {
  let schemaMap = report.__validationResultCache.get(schema);
  if (!schemaMap) {
    schemaMap = new Map();
    report.__validationResultCache.set(schema, schemaMap);
  }
  schemaMap.set(json, passed);
}

export function getCachedValidationResult(report: Report, schema: unknown, json: unknown): boolean | undefined {
  return report.__validationResultCache.get(schema)?.get(json);
}

// ---------------------------------------------------------------------------
// Async task aggregation
// ---------------------------------------------------------------------------

/**
 * Shared async-task aggregation pattern.
 *
 * 1. Collects async tasks from `subReports` into `report`.
 * 2. If new async tasks were added, defers `decisionFn` via `report.addAsyncTask`
 *    with proper path save/restore so error paths are correct.
 * 3. Otherwise, runs `decisionFn` synchronously.
 */
export function deferOrRunSync(report: Report, subReports: Report[], decisionFn: () => void): void {
  const asyncTasksBefore = report.asyncTasks.length;
  for (const subReport of subReports) {
    report.asyncTasks.push(...subReport.asyncTasks);
  }
  const hasAsyncTasks = report.asyncTasks.length > asyncTasksBefore;

  if (hasAsyncTasks) {
    report.addAsyncTaskWithPath(
      (callback) => {
        setTimeout(() => callback(null), 0);
      },
      [] as any,
      () => {
        decisionFn();
      }
    );
  } else {
    decisionFn();
  }
}
