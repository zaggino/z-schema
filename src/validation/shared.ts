import type { ErrorCode } from '../errors.js';
import type { JsonSchema, JsonSchemaAll, JsonSchemaInternal, JsonSchemaVersion } from '../json-schema-versions.js';
// JsonSchemaAll is retained for the VALIDATION_VOCAB_KEYWORDS Set key type.
import type { Report } from '../report.js';
import type { ValidateOptions, ZSchemaBase } from '../z-schema-base.js';

import { isObject } from '../utils/what-is.js';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type JsonValidatorFn = (ctx: ZSchemaBase, report: Report, schema: JsonSchema, json: unknown) => void;

// ---------------------------------------------------------------------------
// Draft / vocabulary helpers
// ---------------------------------------------------------------------------

export const shouldSkipValidate = (options: ValidateOptions, errors: readonly ErrorCode[]) =>
  options &&
  Array.isArray(options.includeErrors) &&
  options.includeErrors.length > 0 &&
  !errors.some((err) => options.includeErrors!.includes(err));

export const isModernDraft = (version: JsonSchemaVersion | 'none' | undefined) =>
  version === 'draft2019-09' || version === 'draft2020-12';

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

  const vocabulary = metaSchema.$vocabulary;
  const has2019 = Object.hasOwn(vocabulary, VOCAB_VALIDATION_2019_09);
  const has2020 = Object.hasOwn(vocabulary, VOCAB_VALIDATION_2020_12);

  if (has2019 || has2020) {
    return vocabulary[VOCAB_VALIDATION_2019_09] || vocabulary[VOCAB_VALIDATION_2020_12];
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

  const vocabulary = metaSchema.$vocabulary;

  // For draft 2020-12, only the format-assertion vocabulary enables format as assertion
  if (Object.hasOwn(vocabulary, VOCAB_FORMAT_ASSERTION_2020_12)) {
    return vocabulary[VOCAB_FORMAT_ASSERTION_2020_12];
  }

  // For draft 2019-09, check if the format vocabulary is enabled (true)
  if (Object.hasOwn(vocabulary, VOCAB_FORMAT_2019_09)) {
    return vocabulary[VOCAB_FORMAT_2019_09];
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
// Async sub-report coordination
// ---------------------------------------------------------------------------

/** Marks a sub-report drain that aborted (threw), as opposed to one that finished with validation errors. */
class AsyncAbort {
  readonly error: unknown;
  constructor(error: unknown) {
    this.error = error;
  }
}

/**
 * Preserve the traversal context needed by a decision made after async work resolves.
 * Snapshots the dynamic-scope stacks and the unevaluated-instance scope; the schema path is restored by `addAsyncTaskWithPath`.
 */
function deferredContext(ctx: ZSchemaBase, report: Report, decisionFn: () => void): () => void {
  const recursiveScope = report.__$recursiveAnchorStack.slice();
  const dynamicScope = report.__$dynamicScopeStack.slice();
  const unevaluatedInstance = report.__$unevaluatedInstance;
  return () => {
    const oldOptions = ctx.validateOptions;
    const oldRecursiveScope = report.__$recursiveAnchorStack;
    const oldDynamicScope = report.__$dynamicScopeStack;
    const oldUnevaluatedInstance = report.__$unevaluatedInstance;
    ctx.validateOptions = report.validateOptions;
    report.__$recursiveAnchorStack = recursiveScope;
    report.__$dynamicScopeStack = dynamicScope;
    report.__$unevaluatedInstance = unevaluatedInstance;
    try {
      decisionFn();
    } finally {
      ctx.validateOptions = oldOptions;
      report.__$recursiveAnchorStack = oldRecursiveScope;
      report.__$dynamicScopeStack = oldDynamicScope;
      report.__$unevaluatedInstance = oldUnevaluatedInstance;
    }
  };
}

/**
 * Wait for sub-report completion, or decide immediately when all validation is synchronous.
 * Sub-reports are drained without their own timer (the top-level report's timeout bounds the
 * whole validation). A sub-report that finishes with validation errors still counts as done;
 * only a thrown value aborts, and it is rethrown into the parent so it is never swallowed.
 */
export function deferOrRunSync(ctx: ZSchemaBase, report: Report, subReports: Report[], decisionFn: () => void): void {
  let pending = 0;
  for (let i = 0; i < subReports.length; i++) {
    if (subReports[i].asyncTasks.length > 0) {
      pending++;
    }
  }

  if (pending > 0) {
    const decide = deferredContext(ctx, report, decisionFn);
    report.addAsyncTaskWithPath(
      (callback: (result: unknown) => void) => {
        let aborted = false;
        const onDone = () => {
          if (aborted) {
            return;
          }
          if (--pending === 0) {
            callback(null);
          }
        };
        const onAbort = (error: unknown) => {
          if (aborted) {
            return;
          }
          aborted = true;
          callback(new AsyncAbort(error));
        };
        for (let i = 0; i < subReports.length; i++) {
          const subReport = subReports[i];
          if (subReport.asyncTasks.length === 0) {
            continue;
          }
          // subReport is const per iteration; pending and aborted are intentionally shared across iterations.
          // oxlint-disable-next-line no-loop-func
          subReport.drainAsyncTasks(undefined, onDone, onAbort);
        }
      },
      [],
      (result) => {
        if (result instanceof AsyncAbort) {
          throw result.error;
        }
        decide();
      }
    );
  } else {
    decisionFn();
  }
}

/**
 * Run an annotation check after pending applicators, including their selected branches.
 * Queued as a deferred task so it runs once all pending tasks have settled.
 */
export function deferUntilAsyncTasksComplete(ctx: ZSchemaBase, report: Report, decisionFn: () => void): void {
  report.addAsyncTaskWithPath(
    (callback: (result: unknown) => void) => {
      callback(null);
    },
    [],
    deferredContext(ctx, report, decisionFn),
    true
  );
}

/**
 * Run `fn` once this report's async tasks have settled if the node added tasks since `tasksBefore`
 * (deferred behind them, including tasks they add); otherwise run it immediately.
 */
export function runAfterPending(ctx: ZSchemaBase, report: Report, tasksBefore: number, fn: () => void): void {
  if (report.asyncTasks.length > tasksBefore) {
    deferUntilAsyncTasksComplete(ctx, report, fn);
  } else {
    fn();
  }
}
