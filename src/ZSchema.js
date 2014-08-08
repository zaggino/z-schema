"use strict";

/*
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
    // disallow usage of keywords that this validator can't handle
    noExtraKeywords: false,
    // disallow usage of schema's without "type" defined
    noTypeless: false,
    // disallow zero length strings in validated objects
    noZeroLengthStrings: false,
    // forces "uri" format to be in fully rfc3986 compliant
    strictUris: false,
    // forces "email" format to be validated more strictly
    strictEmails: false,
    // turn on all of the above
    strict: false
};

/*
    constructor
*/
function ZSchema(options) {
    this.options = options;
}

/*
    instance methods
*/
ZSchema.prototype.compileSchema = function (schema, callback) {

};
ZSchema.prototype.validateSchema = function (schema, callback) {

};
ZSchema.prototype.validate = function (json, schema, callback) {

};

/*
    static methods
*/
ZSchema.registerFormat = function (formatName, validatorFunction) {

};

module.exports = ZSchema;
