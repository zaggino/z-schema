"use strict";

var Errors = require("./Errors");

function Report(parentReport) {
    this.parentReport = parentReport || undefined;
    this.errors = [];
    this.path = [];
    this.asyncTasks = [];
}

Report.prototype.isValid = function () {
    if (this.asyncTasks.length > 0) {
        throw new Error("Async tasks pending, can't answer isValid");
    }
    return this.errors.length === 0;
};

Report.prototype.addAsyncTask = function (fn, args, asyncTaskResultProcessFn) {
    this.asyncTasks.push([fn, args, asyncTaskResultProcessFn]);
};

Report.prototype.processAsyncTasks = function (timeout, callback) {

    var validationTimeout = timeout || 2000,
        tasksCount        = this.asyncTasks.length,
        idx               = tasksCount,
        timedOut          = false,
        self              = this;

    function respond(asyncTaskResultProcessFn) {
        return function (asyncTaskResult) {
            if (timedOut) { return; }
            asyncTaskResultProcessFn(asyncTaskResult);
            if (--tasksCount === 0) {
                var valid = self.errors.length === 0,
                    err   = valid ? undefined : self.errors;
                callback(err, valid);
            }
        };
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

};

Report.prototype.getPath = function () {
    var path = ["#"];
    if (this.parentReport) {
        path = path.concat(this.parentReport.path);
    }
    path = path.concat(this.path);
    return path.length === 1 ? "#/" : path.join("/");
};

Report.prototype.addError = function (errorCode, params, subReports) {
    if (!errorCode) { throw new Error("No errorCode passed into addError()"); }
    if (!Errors[errorCode]) { throw new Error("No errorMessage known for code " + errorCode); }

    params = params || [];

    var idx = params.length,
        errorMessage = Errors[errorCode];
    while (idx--) {
        errorMessage = errorMessage.replace("{" + idx + "}", params[idx]);
    }

    var err = {
        code: errorCode,
        message: errorMessage,
        path: this.getPath()
    };

    if (subReports !== undefined) {
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
};

module.exports = Report;
