"use strict";

require("./Polyfills");
var Report            = require("./Report");
var JsonValidation    = require("./JsonValidation");
var SchemaCache       = require("./SchemaCache");
var SchemaCompilation = require("./SchemaCompilation");
var SchemaValidation  = require("./SchemaValidation");
var Utils             = require("./Utils");

/*
    // TODO: review these, make sure each has its own testcase
    default options
*/
var defaultOptions = {
    // force additionalProperties and additionalItems to be defined on "object" and "array" types
    forceAdditional: false,
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
    noZeroLengthStrings: false,
    // forces "uri" format to be in fully rfc3986 compliant
    strictUris: false,
    // turn on all of the above
    strict: false
};

/*
    constructor
*/
function ZSchema(options) {
    this.options = options || Utils.clone(defaultOptions);
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
ZSchema.prototype.validate = function (json, schema) {
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

    // assign lastReport so errors are retrievable in sync mode
    this.lastReport = report;

    return report.isValid();
};
ZSchema.prototype.getLastError = function () {
    return this.lastReport.errors;
};

/*
    static methods
*/
ZSchema.setRemoteReference = function (uri, schema) {
    if (typeof schema === "string") {
        schema = JSON.parse(schema);
    }
    SchemaCache.cacheSchemaByUri(uri, schema);
};
ZSchema.registerFormat = function (/* formatName, validatorFunction */) {

};
ZSchema.registerFormatter = function (/* formatterName, formatterFunction */) {

};

module.exports = ZSchema;
