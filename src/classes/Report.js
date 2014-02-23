
    var Report = function (parentReport) {
        if (parentReport) {
            this.parentReport = parentReport;
            Utils.forEach(parentReport, function (val, key) {
                this[key] = val;
            }, this);
        }
        this.errors = [];
        this.warnings = [];
        this.path = [];
    };
    Report.prototype = {
        getPath: function () {
            var path = ['#'];

            if (this.parentReport) {
                path = path.concat(this.parentReport.path);
            }
            path = path.concat(this.path);

            if (path.length == 1) {
                return '#/';
            }

            return path.join('/');
        },
        addWarning: function (message) {
            this.warnings.push({
                message: message,
                path: this.getPath()
            });
            return true;
        },
        addError: function (code, params, subReports) {
            var err = ValidationError.createError(code, params, this.getPath());
            if (subReports) {
                subReports.forEach(function (report) {
                    report.errors.forEach(function (_err) {
                        err.addSubError(_err);
                    }, this);
                }, this);
            }
            this.errors.push(err);
            return false;
        },
        expect: function (bool, code, params, subReports) {
            if (!bool) {
                this.addError(code, params, subReports);
                return false;
            } else {
                return true;
            }
        },
        isValid: function () {
            return this.errors.length === 0;
        },
        toJSON: function () {
            return {
                valid: this.errors.length === 0,
                errors: this.errors,
                warnings: this.warnings
            };
        },
        toError: function () {
            var err = new Error('Validation failed');
            err.errors = this.errors;
            err.warnings = this.warnings;
            return err;
        },
        toPromise: function () {
            if (this.isValid()) {
                return Promise.resolve(this);
            } else {
                return Promise.reject(this.toError());
            }
        },
        goDown: function (str) {
            this.path.push(str);
        },
        goUp: function () {
            this.path.pop();
        }
    };