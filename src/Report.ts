import get from "lodash.get";
import { Errors } from "./Errors.js";
import * as Utils from "./Utils.js";
import { ZSchemaOptions } from "./ZSchema.js";

export interface SchemaError extends Error {
    /**
     * Implements the Error.name contract.  The value is always "z-schema validation error".
     */
    name: string;

    /**
     * An identifier indicating the type of error.
     * Example: "JSON_OBJECT_VALIDATION_FAILED"
     */
    message: string;

    /**
     * Returns details for each error that occurred during validation.
     * See Options.breakOnFirstError.
     */
    details?: SchemaErrorDetail[];
}

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
    params: Array<string>;
    /**
     * A JSON path indicating the location of the error.
     * Example: "#/projects/1"
     */
    path: string | any[];
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
}

export interface ReportOptions {
    maxErrors?: number;
}

export class Report {
    errors: SchemaErrorDetail[];    
    parentReport?: Report;
    options: ZSchemaOptions;
    reportOptions: ReportOptions;
    path: string[];
    asyncTasks: any[];
    rootSchema?: any;
    commonErrorMessage?: any;
    json?: any;

    constructor(parentOrOptions, reportOptions?) {
        this.parentReport = parentOrOptions instanceof Report ?
                            parentOrOptions :
                            undefined;

        this.options = parentOrOptions instanceof Report ?
                        (parentOrOptions as any).options :
                        parentOrOptions || {};

        this.reportOptions = reportOptions || {};

        this.errors = [];
        /**
         * @type {string[]}
         */
        this.path = [];
        this.asyncTasks = [];

        this.rootSchema = undefined;
        this.commonErrorMessage = undefined;
        this.json = undefined;
    }

    isValid():boolean {
        if (this.asyncTasks.length > 0) {
            throw new Error("Async tasks pending, can't answer isValid");
        }
        return this.errors.length === 0;
    }

    addAsyncTask(fn, args, asyncTaskResultProcessFn) {
        this.asyncTasks.push([fn, args, asyncTaskResultProcessFn]);
    }

    getAncestor(id) {
        if (!this.parentReport) {
            return undefined;
        }
        if (this.parentReport.getSchemaId() === id) {
            return this.parentReport;
        }
        return this.parentReport.getAncestor(id);
    }

    processAsyncTasks(timeout, callback) {
        var validationTimeout = timeout || 2000,
            tasksCount        = this.asyncTasks.length,
            idx               = tasksCount,
            timedOut          = false,
            self              = this;

        function finish() {
            setTimeout(function () {
                var valid = self.errors.length === 0,
                    err = valid ? null : self.errors;
                callback(err, valid);
            }, 0);
        }

        function respond(asyncTaskResultProcessFn) {
            return function (asyncTaskResult) {
                if (timedOut) { return; }
                asyncTaskResultProcessFn(asyncTaskResult);
                if (--tasksCount === 0) {
                    finish();
                }
            };
        }

        // finish if tasks are completed or there are any errors and breaking on first error was requested
        if (tasksCount === 0 || (this.errors.length > 0 && this.options.breakOnFirstError)) {
            finish();
            return;
        }

        while (idx--) {
            var task = this.asyncTasks[idx];
            task[0].apply(null, task[1].concat(respond(task[2])));
        }

        setTimeout(function () {
            if (tasksCount > 0) {
                timedOut = true;
                self.addError("ASYNC_TIMEOUT", [tasksCount, validationTimeout]);
                callback(self.errors, false);
            }
        }, validationTimeout);
    }

    getPath(returnPathAsString) {
        /**
         * @type {string[]|string}
         */
        var path = [];
        if (this.parentReport) {
            path = path.concat(this.parentReport.path);
        }
        path = path.concat(this.path);

        if (returnPathAsString !== true) {
            // Sanitize the path segments (http://tools.ietf.org/html/rfc6901#section-4)
            return "#/" + path.map(function (segment) {
                segment = segment.toString();

                if (Utils.isAbsoluteUri(segment)) {
                    return "uri(" + segment + ")";
                }

                return segment.replace(/\~/g, "~0").replace(/\//g, "~1");
            }).join("/");
        }
        return path;
    }

    getSchemaId() {
        if (!this.rootSchema) {
            return null;
        }

        // get the error path as an array
        var path = [];
        if (this.parentReport) {
            path = path.concat(this.parentReport.path);
        }
        path = path.concat(this.path);

        // try to find id in the error path
        while (path.length > 0) {
            var obj = get(this.rootSchema, path);
            if (obj && obj.id) { return obj.id; }
            path.pop();
        }

        // return id of the root
        return this.rootSchema.id;
    }

    hasError(errorCode, params) {
        var idx = this.errors.length;
        while (idx--) {
            if (this.errors[idx].code === errorCode) {
                // assume match
                var match = true;

                // check the params too
                var idx2 = this.errors[idx].params.length;
                while (idx2--) {
                    if (this.errors[idx].params[idx2] !== params[idx2]) {
                        match = false;
                    }
                }

                // if match, return true
                if (match) { return match; }
            }
        }
        return false;
    }

    addError(errorCode, params, subReports?, schema?) {
        if (!errorCode) { throw new Error("No errorCode passed into addError()"); }
        this.addCustomError(errorCode, Errors[errorCode], params, subReports, schema);
    }

    getJson() {
        var self: any = this;
        while (self.json === undefined) {
            self = self.parentReport;
            if (self === undefined) {
                return undefined;
            }
        }
        return self.json;
    }

    addCustomError(errorCode: string, errorMessage: string, params: string[], subReports: string | any[], schema: string | any) {
        if (this.errors.length >= this.reportOptions.maxErrors) {
            return;
        }

        if (!errorMessage) { throw new Error("No errorMessage known for code " + errorCode); }

        params = params || [];

        var idx = params.length;
        while (idx--) {
            var whatIs = Utils.whatIs(params[idx]);
            var param = (whatIs === "object" || whatIs === "null") ? JSON.stringify(params[idx]) : params[idx];
            errorMessage = errorMessage.replace("{" + idx + "}", param);
        }

        var err: SchemaErrorDetail = {
            code: errorCode,
            params: params,
            message: errorMessage,
            path: this.getPath(this.options.reportPathAsArray),
            schemaId: this.getSchemaId()
        };

        err[Utils.schemaSymbol] = schema;
        err[Utils.jsonSymbol] = this.getJson();

        if (schema && typeof schema === "string") {
            err.description = schema;
        } else if (schema && typeof schema === "object") {
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
                var subReport = subReports[idx],
                    idx2 = subReport.errors.length;
                while (idx2--) {
                    err.inner.push(subReport.errors[idx2]);
                }
            }
            if (err.inner.length === 0) {
                err.inner = undefined;
            }
        }

        this.errors.push(err);
    }
}

