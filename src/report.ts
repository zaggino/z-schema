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
 * An error recorded by a deferred sub-report, and the single snapshot form of every error added
 * through {@link Report.addCustomError}. It captures everything needed to build the real
 * {@link SchemaErrorDetail} (the path arrays keep mutating during traversal, so they are copied at
 * add time, as are the root schema and the `reportPathAsArray` option). The detail is built only
 * by {@link PendingError.materialize}, which defines the shape and key order of error details for
 * both eager adds and deferred errors that end up observable (e.g. inside an `inner` list).
 *
 * `code`, `params` and `keyword` are real fields so `hasError` works unchanged; the remaining
 * {@link SchemaErrorDetail} fields are getters that materialize on demand.
 */
class PendingError implements SchemaErrorDetail {
  readonly code: string;
  readonly params: ErrorParam[];
  readonly keyword: keyof JsonSchemaAll | undefined;
  private readonly errorMessage: string;
  private readonly dataPath: Array<string | number>;
  private readonly snapshotSchemaPath: Array<string | number>;
  private readonly rootSchema: JsonSchemaInternal | undefined;
  private readonly pathAsArray: boolean;
  private readonly report: Report;
  private readonly schema: JsonSchema | boolean | undefined;
  // null = no `inner` key; an empty array = `inner: undefined` (mirrors the eager shape)
  private readonly innerEntries: SchemaErrorDetail[] | null;
  private detail?: SchemaErrorDetail;

  constructor(
    report: Report,
    code: string,
    errorMessage: string,
    params: ErrorParam[],
    dataPath: Array<string | number>,
    snapshotSchemaPath: Array<string | number>,
    schema: JsonSchema | boolean | undefined,
    keyword: keyof JsonSchemaAll | undefined,
    innerEntries: SchemaErrorDetail[] | null
  ) {
    this.code = code;
    this.params = params;
    this.keyword = keyword;
    this.errorMessage = errorMessage;
    this.dataPath = dataPath;
    this.snapshotSchemaPath = snapshotSchemaPath;
    this.rootSchema = report.rootSchema;
    this.pathAsArray = report.options.reportPathAsArray === true;
    this.report = report;
    this.schema = schema;
    this.innerEntries = innerEntries;
  }

  get message(): string {
    return this.materialize().message;
  }

  get path(): string | Array<string | number> {
    return this.materialize().path;
  }

  get schemaPath(): Array<string | number> | undefined {
    return this.materialize().schemaPath;
  }

  get schemaId(): string | undefined {
    return this.materialize().schemaId;
  }

  get title(): string | undefined {
    return this.materialize().title;
  }

  get description(): string | undefined {
    return this.materialize().description;
  }

  get inner(): SchemaErrorDetail[] | undefined {
    return this.materialize().inner;
  }

  /**
   * Builds (once) the plain error detail. May throw while formatting params, exactly as the
   * pre-deferral eager construction did.
   */
  materialize(): SchemaErrorDetail {
    if (this.detail === undefined) {
      this.detail = this.build();
    }
    return this.detail;
  }

  private build(): SchemaErrorDetail {
    const { params } = this;
    let { errorMessage } = this;
    for (let idx = 0; idx < params.length; idx++) {
      const param = params[idx] === null || isObject(params[idx]) ? JSON.stringify(params[idx]) : params[idx];
      errorMessage = errorMessage.replace(`{${idx}}`, param.toString());
    }

    const { schema } = this;
    const err = {
      code: this.code,
      params,
      message: errorMessage,
      path: this.pathAsArray ? this.dataPath : pathToString(this.dataPath),
      schemaPath: this.snapshotSchemaPath,
      schemaId: this.rootSchema ? findSchemaId(this.rootSchema, this.dataPath.slice()) : undefined,
      keyword: this.keyword,
      [schemaSymbol]: schema,
      [jsonSymbol]: this.report.getJson(),
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

    if (this.innerEntries !== null) {
      err.inner = this.innerEntries.length === 0 ? undefined : materializeEntries(this.innerEntries);
    }

    return err;
  }
}

/**
 * Replaces any {@link PendingError} entries with their materialized details. Returns the input
 * array itself when nothing needs materializing. The `instanceof` check is what keeps public
 * `inner`/`details` lists made of plain own-key objects rather than getter-backed records.
 */
function materializeEntries(entries: SchemaErrorDetail[]): SchemaErrorDetail[] {
  for (let i = 0; i < entries.length; i++) {
    if (entries[i] instanceof PendingError) {
      const out = entries.slice(0, i);
      for (let j = i; j < entries.length; j++) {
        const entry = entries[j];
        out.push(entry instanceof PendingError ? entry.materialize() : entry);
      }
      return out;
    }
  }
  return entries;
}

/**
 * True when formatting `params` into a message cannot throw (string, number, boolean, null).
 */
function areParamsSafe(params: ErrorParam[]): boolean {
  for (let i = 0; i < params.length; i++) {
    const p = params[i] as unknown;
    if (p !== null && typeof p !== 'string' && typeof p !== 'number' && typeof p !== 'boolean') {
      return false;
    }
  }
  return true;
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
   *
   * @internal
   */
  deferErrors = false;

  /**
   * Creates a sub-report whose errors are materialized lazily. Safe because the errors of such
   * sub-reports are only observed through `.errors.length`, `hasError`, or as `inner` of a parent
   * error. Deferral is disabled when a `customValidator` is set, since it may read `report.errors`.
   *
   * @internal
   */
  static createSubReport(parent: Report): Report {
    const report = new Report(parent);
    report.deferErrors = typeof parent.options.customValidator !== 'function';
    return report;
  }

  /**
   * Replaces pending (deferred) errors of this report and its ancestors with plain error details,
   * in place. Used before handing a report to user code that may read `errors`.
   *
   * @internal
   */
  materializeErrors(): void {
    const { errors } = this;
    for (let i = 0; i < errors.length; i++) {
      const err = errors[i];
      if (err instanceof PendingError) {
        errors[i] = err.materialize();
      }
    }
    this.parentReport?.materializeErrors();
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

    // Formatting params into the message can throw for exotic values (undefined, circular objects,
    // BigInt, symbols). Eager reports always threw at that point, before the excludeErrors check,
    // so keep that order whenever formatting could throw; with safe params the order is unobservable.
    const safeParams = areParamsSafe(params);
    const excluded =
      Array.isArray(this.validateOptions.excludeErrors) && this.validateOptions.excludeErrors.includes(errorCode);
    if (safeParams && excluded) {
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

    const pending = new PendingError(this, errorCode, errorMessage, params, path, schemaPath, schema, keyword, inner);

    if (safeParams) {
      this.errors.push(this.deferErrors ? pending : pending.materialize());
      return;
    }

    // unsafe params: build first (throws exactly when the eager path did), then apply excludeErrors
    const detail = pending.materialize();
    if (excluded) {
      return;
    }
    this.errors.push(detail);
  }
}
