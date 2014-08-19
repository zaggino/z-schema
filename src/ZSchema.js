"use strict";

require("./Polyfills");
var Report            = require("./Report");
var FormatValidators  = require("./FormatValidators");
var JsonValidation    = require("./JsonValidation");
var SchemaCache       = require("./SchemaCache");
var SchemaCompilation = require("./SchemaCompilation");
var SchemaValidation  = require("./SchemaValidation");
var Utils             = require("./Utils");

/*
    default options
*/
var defaultOptions = {
    // default timeout for all async tasks
    asyncTimeout: 2000,
    // force additionalProperties and additionalItems to be defined on "object" and "array" types
    forceAdditional: false,
    // assume additionalProperties and additionalItems are defined as "false" where appropriate
    assumeAdditional: false,
    // force items to be defined on "array" types
    forceItems: false,
    // force maxLength to be defined on "string" types
    forceMaxLength: false,
    // force properties or patternProperties to be defined on "object" types
    forceProperties: false,
    // ignore references that cannot be resolved (remote schemas) // TODO: make sure this is only for remote schemas, not local ones
    ignoreUnresolvableReferences: false,
    // disallow usage of keywords that this validator can't handle
    noExtraKeywords: false,
    // disallow usage of schema's without "type" defined
    noTypeless: false,
    // disallow zero length strings in validated objects
    noEmptyStrings: false,
    // forces "uri" format to be in fully rfc3986 compliant
    strictUris: false,
    // turn on some of the above
    strictMode: false
};

/*
    constructor
*/
function ZSchema(options) {
    this.cache = {};

    // options
    if (typeof options === "object") {
        var keys = Object.keys(options),
            idx = keys.length;
        while (idx--) {
            var key = keys[idx];
            if (defaultOptions[key] === undefined) {
                throw new Error("Unexpected option passed to constructor: " + key);
            }
        }
        this.options = options;
    } else {
        this.options = Utils.clone(defaultOptions);
    }

    if (this.options.strictMode === true) {
        this.options.forceAdditional  = true;
        this.options.forceItems       = true;
        this.options.forceMaxLength   = true;
        this.options.forceProperties  = true;
        this.options.noExtraKeywords  = true;
        this.options.noTypeless       = true;
        this.options.noEmptyStrings   = true;
    }
}

/*
    instance methods
*/
ZSchema.prototype.compileSchema = function (schema) {
    var report = new Report();
    SchemaCompilation.compileSchema.call(this, report, schema);
    this.lastReport = report;
    return report.isValid();
};
ZSchema.prototype.validateSchema = function (schema) {
    var report = new Report();
    var compiled = SchemaCompilation.compileSchema.call(this, report, schema);
    if (compiled) { SchemaValidation.validateSchema.call(this, report, schema); }
    this.lastReport = report;
    return report.isValid();
};
ZSchema.prototype.validate = function (json, schema, callback) {
    var report = new Report();

    var compiled = SchemaCompilation.compileSchema.call(this, report, schema);
    if (!compiled) {
        this.lastReport = report;
        return false;
    }

    var validated = SchemaValidation.validateSchema.call(this, report, schema);
    if (!validated) {
        this.lastReport = report;
        return false;
    }

    JsonValidation.validate.call(this, report, schema, json);

    if (callback) {
        report.processAsyncTasks(this.options.asyncTimeout, callback);
        return;
    } else if (report.asyncTasks.length > 0) {
        throw new Error("This validation has async tasks and cannot be done in sync mode, please provide callback argument.");
    }

    // assign lastReport so errors are retrievable in sync mode
    this.lastReport = report;
    return report.isValid();
};
ZSchema.prototype.getLastError = function () {
    return this.lastReport.errors.length > 0 ? this.lastReport.errors : undefined;
};
ZSchema.prototype.setRemoteReference = function (uri, schema) {
    if (typeof schema === "string") {
        schema = JSON.parse(schema);
    }
    SchemaCache.cacheSchemaByUri.call(this, uri, schema);
};

/*
    static methods
*/
ZSchema.registerFormat = function (formatName, validatorFunction) {
    FormatValidators[formatName] = validatorFunction;
};
ZSchema.registerFormatter = function (/* formatterName, formatterFunction */) {

};

module.exports = ZSchema;
