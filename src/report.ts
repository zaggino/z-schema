import type { ErrorCode, ErrorParam } from './errors.js';
import { Errors, getValidateError } from './errors.js';
import type { JsonSchema, JsonSchemaInternal } from './json-schema.js';
import { get } from './utils/json.js';
import { jsonSymbol, schemaSymbol } from './utils/symbols.js';
import { isAbsoluteUri } from './utils/uri.js';
import { whatIs } from './utils/what-is.js';
import type { ValidateCallback, ValidateOptions } from './z-schema-base.js';
import type { ZSchemaOptions } from './z-schema-options.js';

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
  keyword?: keyof JsonSchema;
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
  errors: SchemaErrorDetail[] = [];
  json?: unknown;
  path: Array<number | string> = [];
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
    } else {
      // primary
      this.reportOptions = {};
      this.validateOptions = (reportOptionsOrValidate as ValidateOptions) || {};
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
    const validationTimeout = timeout || 2000;
    let tasksCount = this.asyncTasks.length;
    let idx = tasksCount;
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

    while (idx--) {
      const [fn, fnArgs, processFn] = this.asyncTasks[idx];
      const respondCallback = respond(processFn);
      fn(...fnArgs, respondCallback);
    }

    setTimeout(() => {
      if (tasksCount > 0) {
        timedOut = true;
        this.addError('ASYNC_TIMEOUT', [tasksCount, validationTimeout]);
        callback(getValidateError({ details: this.errors }), false);
      }
    }, validationTimeout);
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
    let idx = this.errors.length;
    while (idx--) {
      if (this.errors[idx].code === errCode) {
        // assume match
        let match = true;

        // check the params too
        let idx2 = this.errors[idx].params.length;
        while (idx2--) {
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
    schema?: JsonSchema,
    keyword?: keyof JsonSchema
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
    schema?: JsonSchema,
    keyword?: keyof JsonSchema
  ) {
    if (typeof this.reportOptions.maxErrors === 'number' && this.errors.length >= this.reportOptions.maxErrors) {
      return;
    }

    if (!errorMessage) {
      throw new Error('No errorMessage known for code ' + errorCode);
    }

    params = params || [];

    let idx = params.length;
    while (idx--) {
      const paramType = whatIs(params[idx]);
      const param = paramType === 'object' || paramType === 'null' ? JSON.stringify(params[idx]) : params[idx];
      errorMessage = errorMessage.replace('{' + idx + '}', param.toString());
    }

    const err: SchemaErrorDetail = {
      code: errorCode,
      params: params,
      message: errorMessage,
      path: this.getPath(this.options.reportPathAsArray),
      schemaId: this.getSchemaId(),
      keyword: keyword,
    };

    // TODO v8: remove Symbol usage
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
      idx = subReports.length;
      while (idx--) {
        const subReport = subReports[idx];
        let idx2 = subReport.errors.length;
        while (idx2--) {
          err.inner.push(subReport.errors[idx2]);
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
