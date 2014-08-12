"use strict";

var Errors = require("./Errors");

function Report(parentReport) {
    this.parentReport = parentReport || undefined;
    this.errors = [];
    this.warnings = [];
    this.path = [];
}

Report.prototype.isValid = function () {
    return this.errors.length === 0;
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
