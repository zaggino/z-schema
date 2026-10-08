import type { ErrorCode, ErrorParam } from './errors.js';
import type { JsonSchema, JsonSchemaAll, JsonSchemaInternal } from './json-schema-versions.js';
import type { ValidateCallback, ValidateOptions } from './z-schema-base.js';
import type { ZSchemaOptions } from './z-schema-options.js';

import { Errors, getValidateError } from './errors.js';
import { shallowClone } from './utils/clone.js';
import { MAX_ASYNC_TIMEOUT } from './utils/constants.js';
import { get } from './utils/json.js';
import { jsonSymbol, schemaSymbol } from './utils/symbols.js';
import { isAbsoluteUri } from './utils/uri.js';
import { isObject } from './utils/what-is.js';

const ASYNC_TIMEOUT_POLL_MS = 10;

export interface SchemaErrorDetail {
  /**
   * Example: "Expected type string but found type array"
   */
  message: string;
  /**
   * An error identifier that can be used to format a custom error message.
   * Example: "INVALID_TYPE"
   */
  code: string;
  /**
   * Format parameters that can be used to format a custom error message.
   * Example: ["string","array"]
   */
  params: ErrorParam[];
  /**
   * A JSON path indicating the location of the error.
   * Example: "#/projects/1"
   */
  path: string | Array<string | number>;
  /**
   * A JSON path indicating the location in the schema where the constraint is defined.
   * Example: ["properties", "name", "type"]
   */
  schemaPath?: Array<string | number>;
  /**
   * The schema rule description, which is included for certain errors where
   * this information is useful (e.g. to describe a constraint).
   */
  title?: string;
  description?: string;

  /**
   * Returns details for sub-schemas that failed to match.  For example, if the schema
   * uses the "oneOf" constraint to accept several alternative possibilities, each
   * alternative will have its own inner detail object explaining why it failed to match.
   */
  inner?: SchemaErrorDetail[];

  schemaId?: string;

  /**
   * The schema keyword that caused this validation error.
   * Example: "required", "type", "minLength"
   */
  keyword?: keyof JsonSchemaAll;
}

export interface ReportOptions {
  maxErrors?: number;
}

/**
 * Whether sub-reports created through {@link Report.createSubReport} may defer
 * materialization of their error details. Test-only switch, see
 * {@link setSubReportErrorDeferral}.
 */
let deferralEnabled = true;

/**
 * Enables or disables deferred error materialization for sub-reports. Deferral is
 * purely an optimization: the observable error details are identical either way.
 * Exists so tests can run differential comparisons.
 *
 * @internal
 */
export function setSubReportErrorDeferral(enabled: boolean): void {
  deferralEnabled = enabled;
}

function pathToString(path: Array<string | number>): string {
  // Sanitize the path segments (http://tools.ietf.org/html/rfc6901#section-4)
  return `#/${path
    .map((segment) => {
      segment = segment.toString();

      if (isAbsoluteUri(segment)) {
        return `uri(${segment})`;
      }

      return segment.replaceAll('~', '~0').replaceAll('/', '~1');
    })
    .join('/')}`;
}

/**
 * Finds the closest `id` along `path` (consumed destructively) in `rootSchema`.
 */
function findSchemaId(rootSchema: JsonSchemaInternal, path: Array<string | number>): string | undefined {
  // try to find id in the error path
  while (path.length > 0) {
    const obj = get(rootSchema, path);
    if (isObject(obj) && typeof obj.id === 'string') {
      return obj.id;
    }
    path.pop();
  }

  // return id of the root
  return rootSchema.id;
}

/**
 * Builds an error detail from snapshotted inputs. This is the single place that defines the
 * shape and key order of error details, shared by eager adds and deferred materialization.
 * `path` becomes the returned `path` when `pathAsArray` is set, so it must be a private copy.
 */
function buildErrorDetail(
  errorCode: string,
  errorMessage: string,
  params: ErrorParam[],
  path: Array<string | number>,
  schemaPath: Array<string | number>,
  rootSchema: JsonSchemaInternal | undefined,
  json: unknown,
  schema: JsonSchema | boolean | undefined,
  keyword: keyof JsonSchemaAll | undefined,
  inner: SchemaErrorDetail[] | null,
  pathAsArray: boolean | undefined
): SchemaErrorDetail {
  for (let idx = 0; idx < params.length; idx++) {
    const param = params[idx] === null || isObject(params[idx]) ? JSON.stringify(params[idx]) : params[idx];
    errorMessage = errorMessage.replace(`{${idx}}`, param.toString());
  }

  const err = {
    code: errorCode,
    params,
    message: errorMessage,
    path: pathAsArray === true ? path : pathToString(path),
    schemaPath,
    schemaId: rootSchema ? findSchemaId(rootSchema, path.slice()) : undefined,
    keyword,
    [schemaSymbol]: schema,
    [jsonSymbol]: json,
  } as SchemaErrorDetail;

  if (schema && typeof schema === 'string') {
    err.description = schema;
  } else if (schema && typeof schema === 'object') {
    if (schema.title) {
      err.title = schema.title;
    }
    if (schema.description) {
      err.description = schema.description;
    }
  }

  if (inner !== null) {
    err.inner = inner.length === 0 ? undefined : materializeEntries(inner);
  }

  return err;
}

/**
 * An error recorded by a deferred sub-report. It holds snapshots of everything needed to build
 * the real {@link SchemaErrorDetail} later (only if the error ends up observable, e.g. inside an
 * `inner` list of an eager report). `code` and `params` are real fields so `hasError` works unchanged.
 */
class PendingError {
  code: string;
  params: ErrorParam[];
  errorMessage: string;
  path: Array<string | number>;
  schemaPath: Array<string | number>;
  rootSchema: JsonSchemaInternal | undefined;
  report: Report;
  schema: JsonSchema | boolean | undefined;
  keyword: keyof JsonSchemaAll | undefined;
  // null = no `inner` key; an empty array = `inner: undefined` (mirrors the eager shape)
  inner: SchemaErrorDetail[] | null;
  materialized?: SchemaErrorDetail;

  constructor(
    code: string,
    params: ErrorParam[],
    errorMessage: string,
    path: Array<string | number>,
    schemaPath: Array<string | number>,
    rootSchema: JsonSchemaInternal | undefined,
    report: Report,
    schema: JsonSchema | boolean | undefined,
    keyword: keyof JsonSchemaAll | undefined,
    inner: SchemaErrorDetail[] | null
  ) {
    this.code = code;
    this.params = params;
    this.errorMessage = errorMessage;
    this.path = path;
    this.schemaPath = schemaPath;
    this.rootSchema = rootSchema;
    this.report = report;
    this.schema = schema;
    this.keyword = keyword;
    this.inner = inner;
  }

  materialize(): SchemaErrorDetail {
    if (this.materialized === undefined) {
      this.materialized = buildErrorDetail(
        this.code,
        this.errorMessage,
        this.params,
        this.path,
        this.schemaPath,
        this.rootSchema,
        this.report.getJson(),
        this.schema,
        this.keyword,
        this.inner,
        this.report.options.reportPathAsArray
      );
    }
    return this.materialized;
  }
}

/**
 * Replaces any {@link PendingError} entries with their materialized details. Returns the input
 * array itself when nothing needs materializing.
 */
function materializeEntries(entries: SchemaErrorDetail[]): SchemaErrorDetail[] {
  for (let i = 0; i < entries.length; i++) {
    if ((entries[i] as unknown) instanceof PendingError) {
      const out = entries.slice(0, i);
      for (let j = i; j < entries.length; j++) {
        const entry = entries[j] as unknown;
        out.push(entry instanceof PendingError ? entry.materialize() : (entry as SchemaErrorDetail));
      }
      return out;
    }
  }
  return entries;
}

type TaskResult = unknown;
type TaskFn = (...args: unknown[]) => TaskResult;
type TaskFnArgs = Parameters<TaskFn>;
type TaskProcessFn = (result: ReturnType<TaskFn>) => void;
type AsyncTask = [TaskFn, TaskFnArgs, TaskProcessFn];

export class Report {
  asyncTasks: AsyncTask[] = [];
  commonErrorMessage?: string;
  __$recursiveAnchorStack: JsonSchemaInternal[] = [];
  __$dynamicScopeStack: JsonSchemaInternal[] = [];
  __validationResultCache = new Map<unknown, Map<unknown, boolean>>();
  errors: SchemaErrorDetail[] = [];
  json?: unknown;
  path: Array<number | string> = [];
  schemaPath: Array<number | string> = [];
  rootSchema?: JsonSchemaInternal;

  parentReport?: Report;
  options: ZSchemaOptions;
  reportOptions: ReportOptions;
  validateOptions: ValidateOptions = {};
  /**
   * When set, `addCustomError` records a cheap {@link PendingError} instead of building the full
   * detail. Only ever set on JSON-validation sub-reports via {@link Report.createSubReport}.
   */
  deferErrors = false;

  /**
   * Creates a sub-report whose errors are materialized lazily. Safe because the errors of such
   * sub-reports are only observed through `.errors.length`, `hasError`, or as `inner` of a parent
   * error. Deferral is disabled when a `customValidator` is set, since it may read `report.errors`.
   */
  static createSubReport(parent: Report): Report {
    const report = new Report(parent);
    report.deferErrors = deferralEnabled && typeof parent.options.customValidator !== 'function';
    return report;
  }

  constructor(parentOrOptions: ZSchemaOptions | Report, validateOptions?: ValidateOptions); // primary | subreport
  constructor(parentReport: Report, reportOptions: ReportOptions, validateOptions?: ValidateOptions); // subreport with options
  constructor(
    parentOrOptions: ZSchemaOptions | Report,
    reportOptionsOrValidate?: ReportOptions | ValidateOptions,
    validateOptions?: ValidateOptions
  ) {
    this.parentReport = parentOrOptions instanceof Report ? parentOrOptions : undefined;
    this.options = parentOrOptions instanceof Report ? parentOrOptions.options : parentOrOptions || {};
    if (parentOrOptions instanceof Report) {
      // subreport
      this.reportOptions = (reportOptionsOrValidate as ReportOptions) || {};
      this.validateOptions = validateOptions || parentOrOptions.validateOptions;
      this.__$recursiveAnchorStack = parentOrOptions.__$recursiveAnchorStack.slice();
      this.__$dynamicScopeStack = parentOrOptions.__$dynamicScopeStack.slice();
      this.__validationResultCache = parentOrOptions.__validationResultCache;
    } else {
      // primary
      this.reportOptions = {};
      this.validateOptions = (reportOptionsOrValidate as ValidateOptions) || {};
      this.__$recursiveAnchorStack = [];
      this.__$dynamicScopeStack = [];
      this.__validationResultCache = new Map();
    }
  }

  isValid(): boolean {
    if (this.asyncTasks.length > 0) {
      throw new Error("Async tasks pending, can't answer isValid");
    }
    return this.errors.length === 0;
  }

  addAsyncTask<FN extends (...args: any[]) => any>(
    fn: FN,
    args: Parameters<FN>,
    asyncTaskResultProcessFn: (result: ReturnType<FN>) => void
  ) {
    this.asyncTasks.push([fn, args, asyncTaskResultProcessFn as TaskProcessFn]);
  }

  /**
   * Like {@link addAsyncTask}, but automatically saves the current `path` and
   * restores it around `processFn`.  This eliminates the manual
   * path-save/restore boilerplate that every async-aware validator would
   * otherwise need.
   */
  addAsyncTaskWithPath(fn: (...args: any[]) => any, args: any[], processFn: (result: any) => void) {
    const pathBefore = shallowClone(this.path);
    this.asyncTasks.push([
      fn,
      args,
      (result: TaskResult) => {
        const backup = this.path;
        this.path = pathBefore;
        processFn(result);
        this.path = backup;
      },
    ]);
  }

  getAncestor(id: string): Report | undefined {
    if (!this.parentReport) {
      return undefined;
    }
    if (this.parentReport.getSchemaId() === id) {
      return this.parentReport;
    }
    return this.parentReport.getAncestor(id);
  }

  processAsyncTasks(timeout: number | undefined, callback: ValidateCallback) {
    const validationTimeout = Math.min(Math.max(timeout || 2000, 0), MAX_ASYNC_TIMEOUT);
    const timeoutAt = Date.now() + validationTimeout;
    let tasksCount = this.asyncTasks.length;
    let timedOut = false;

    const finish = () => {
      setTimeout(() => {
        const valid = this.errors.length === 0;
        const err = valid ? undefined : getValidateError({ details: this.errors });
        callback(err, valid);
      }, 0);
    };

    const respond = (asyncTaskResultProcessFn: TaskProcessFn) => (asyncTaskResult: TaskResult) => {
      if (timedOut) {
        return;
      }
      asyncTaskResultProcessFn(asyncTaskResult);
      if (--tasksCount === 0) {
        finish();
      }
    };

    // finish if tasks are completed or there are any errors and breaking on first error was requested
    if (tasksCount === 0 || (this.errors.length > 0 && this.options.breakOnFirstError)) {
      finish();
      return;
    }

    for (let i = 0; i < this.asyncTasks.length; i++) {
      const [fn, fnArgs, processFn] = this.asyncTasks[i];
      const respondCallback = respond(processFn);
      fn(...fnArgs, respondCallback);
    }

    const checkTimeout = () => {
      if (timedOut || tasksCount <= 0) {
        return;
      }
      if (Date.now() >= timeoutAt) {
        timedOut = true;
        this.addError('ASYNC_TIMEOUT', [tasksCount, validationTimeout]);
        callback(getValidateError({ details: this.errors }), false);
        return;
      }
      setTimeout(checkTimeout, ASYNC_TIMEOUT_POLL_MS);
    };
    setTimeout(checkTimeout, ASYNC_TIMEOUT_POLL_MS);
  }

  getPath(returnPathAsString?: boolean) {
    const path: Array<string | number> = this.parentReport
      ? this.parentReport.path.concat(this.path)
      : this.path.slice();

    if (returnPathAsString !== true) {
      return pathToString(path);
    }
    return path;
  }

  getSchemaPath(): Array<string | number> {
    if (this.parentReport) {
      return this.parentReport.schemaPath.concat(this.schemaPath);
    }
    return this.schemaPath.slice();
  }

  getSchemaId(): string | undefined {
    if (!this.rootSchema) {
      return undefined;
    }

    // get the error path as an array
    return findSchemaId(
      this.rootSchema,
      this.parentReport ? this.parentReport.path.concat(this.path) : this.path.slice()
    );
  }

  hasError(errCode: string, errParams: any[]) {
    for (let idx = 0; idx < this.errors.length; idx++) {
      if (this.errors[idx].code === errCode) {
        // assume match
        let match = true;

        // check the params too
        for (let idx2 = 0; idx2 < this.errors[idx].params.length; idx2++) {
          if (this.errors[idx].params[idx2] !== errParams[idx2]) {
            match = false;
          }
        }

        // if match, return true
        if (match) {
          return match;
        }
      }
    }
    return false;
  }

  addError(
    errCode: ErrorCode,
    errParams?: ErrorParam[],
    subReports?: Report | Report[],
    schema?: JsonSchema | boolean,
    keyword?: keyof JsonSchemaAll
  ) {
    if (!errCode) {
      throw new Error('No errorCode passed into addError()');
    }
    this.addCustomError(errCode, Errors[errCode], errParams, subReports, schema, keyword);
  }

  // this returns the root object being validated (the one passed into validator.validate)
  getJson(): unknown {
    if (this.json) {
      return this.json;
    }
    if (this.parentReport) {
      return this.parentReport.getJson();
    }
    return undefined;
  }

  addCustomError(
    errorCode: ErrorCode,
    errorMessage: string,
    params?: ErrorParam[],
    subReports?: Report | Report[],
    schema?: JsonSchema | boolean,
    keyword?: keyof JsonSchemaAll
  ) {
    if (typeof this.reportOptions.maxErrors === 'number' && this.errors.length >= this.reportOptions.maxErrors) {
      return;
    }

    if (!errorMessage) {
      throw new Error(`No errorMessage known for code ${errorCode}`);
    }

    params ||= [];

    // Check if this error code should be excluded
    if (Array.isArray(this.validateOptions.excludeErrors) && this.validateOptions.excludeErrors.includes(errorCode)) {
      return;
    }

    // snapshot: path arrays keep mutating as traversal continues
    const path = this.parentReport ? this.parentReport.path.concat(this.path) : this.path.slice();
    const schemaPath = this.parentReport
      ? this.parentReport.schemaPath.concat(this.schemaPath)
      : this.schemaPath.slice();

    let inner: SchemaErrorDetail[] | null = null;
    if (subReports != null) {
      if (!Array.isArray(subReports)) {
        subReports = [subReports];
      }
      inner = [];
      for (let si = 0; si < subReports.length; si++) {
        const errs = subReports[si].errors;
        for (let ei = 0; ei < errs.length; ei++) {
          inner.push(errs[ei]);
        }
      }
    }

    if (this.deferErrors) {
      this.errors.push(
        new PendingError(
          errorCode,
          params,
          errorMessage,
          path,
          schemaPath,
          this.rootSchema,
          this,
          schema,
          keyword,
          inner
        ) as unknown as SchemaErrorDetail
      );
      return;
    }

    this.errors.push(
      buildErrorDetail(
        errorCode,
        errorMessage,
        params,
        path,
        schemaPath,
        this.rootSchema,
        this.getJson(),
        schema,
        keyword,
        inner,
        this.options.reportPathAsArray
      )
    );
  }
}
