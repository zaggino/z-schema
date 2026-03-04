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
  __validationResultCache: Map<unknown, Map<unknown, boolean>> = new Map();
  errors: SchemaErrorDetail[] = [];
  json?: unknown;
  path: Array<number | string> = [];
  schemaPath: Array<number | string> = [];
  rootSchema?: JsonSchemaInternal;

  parentReport?: Report;
  options: ZSchemaOptions;
  reportOptions: ReportOptions;
  validateOptions: ValidateOptions = {};

  constructor(zschemaOptions: ZSchemaOptions, validateOptions?: ValidateOptions); // primary
  constructor(parentReport: Report, validateOptions?: ValidateOptions); // subreport
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
      this.__$recursiveAnchorStack = [...parentOrOptions.__$recursiveAnchorStack];
      this.__$dynamicScopeStack = [...parentOrOptions.__$dynamicScopeStack];
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

  addAsyncTask<FV, FN extends (...args: any[]) => FV>(
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
    let path: Array<string | number> = [];
    if (this.parentReport) {
      path = path.concat(this.parentReport.path);
    }
    path = path.concat(this.path);

    if (returnPathAsString !== true) {
      // Sanitize the path segments (http://tools.ietf.org/html/rfc6901#section-4)
      return (
        '#/' +
        path
          .map(function (segment) {
            segment = segment.toString();

            if (isAbsoluteUri(segment)) {
              return 'uri(' + segment + ')';
            }

            return segment.replace(/~/g, '~0').replace(/\//g, '~1');
          })
          .join('/')
      );
    }
    return path;
  }

  getSchemaPath(): Array<string | number> {
    let schemaPath: Array<string | number> = [];
    if (this.parentReport) {
      schemaPath = schemaPath.concat(this.parentReport.schemaPath);
    }
    schemaPath = schemaPath.concat(this.schemaPath);
    return schemaPath;
  }

  getSchemaId(): string | undefined {
    if (!this.rootSchema) {
      return undefined;
    }

    // get the error path as an array
    let path: Array<string | number> = [];
    if (this.parentReport) {
      path = path.concat(this.parentReport.path);
    }
    path = path.concat(this.path);

    // try to find id in the error path
    while (path.length > 0) {
      const obj = get(this.rootSchema, path);
      if (obj && obj.id) {
        return obj.id;
      }
      path.pop();
    }

    // return id of the root
    return this.rootSchema.id;
  }

  hasError(errCode: string, errParams: Array<any>) {
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
      throw new Error('No errorMessage known for code ' + errorCode);
    }

    params = params || [];

    for (let idx = 0; idx < params.length; idx++) {
      const param = params[idx] === null || isObject(params[idx]) ? JSON.stringify(params[idx]) : params[idx];
      errorMessage = errorMessage.replace('{' + idx + '}', param.toString());
    }

    const err: SchemaErrorDetail = {
      code: errorCode,
      params: params,
      message: errorMessage,
      path: this.getPath(this.options.reportPathAsArray),
      schemaPath: this.getSchemaPath(),
      schemaId: this.getSchemaId(),
      keyword: keyword,
    };

    (err as any)[schemaSymbol] = schema;
    (err as any)[jsonSymbol] = this.getJson();

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

    if (subReports != null) {
      if (!Array.isArray(subReports)) {
        subReports = [subReports];
      }
      err.inner = [];
      for (const subReport of subReports) {
        for (const error of subReport.errors) {
          err.inner.push(error);
        }
      }
      if (err.inner.length === 0) {
        err.inner = undefined;
      }
    }

    // Check if this error code should be excluded
    if (Array.isArray(this.validateOptions.excludeErrors) && this.validateOptions.excludeErrors.includes(errorCode)) {
      return;
    }

    this.errors.push(err);
  }
}
