/*
 * Copyright (c) 2013, Martin Zagora <zaggino@gmail.com>
 * Copyright (c) 2013, Oleksiy Krivoshey <oleksiyk@gmail.com>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 * @license http://opensource.org/licenses/MIT
 */

/*jslint node:true, nomen:true, plusplus:true, regexp:true, vars:true*/
/*jshint -W044*/
/*global zSchema*/

(function () {
    "use strict";

    var Q = require('q');

    var ValidationError = function (code, message, params, path) {
        this.code = code;
        this.message = message;
        this.path = path || "";
        this.params = params || {};
    };

    ValidationError.prototype = new Error();

    ValidationError.messages = {
        'INVALID_TYPE': 'invalid type: {type} (expected {expected})',
        'ENUM_MISMATCH': 'No enum match for: {value}',
        'ANY_OF_MISSING': 'Data does not match any schemas from "anyOf"',
        'ONE_OF_MISSING': 'Data does not match any schemas from "oneOf"',
        'ONE_OF_MULTIPLE': 'Data is valid against more than one schema from "oneOf"',
        'NOT_PASSED': 'Data matches schema from "not"',
        // Numeric errors
        'MULTIPLE_OF': 'Value {value} is not a multiple of {multipleOf}',
        'MINIMUM': 'Value {value} is less than minimum {minimum}',
        'MINIMUM_EXCLUSIVE': 'Value {value} is equal or less than exclusive minimum {minimum}',
        'MAXIMUM': 'Value {value} is greater than maximum {maximum}',
        'MAXIMUM_EXCLUSIVE': 'Value {value} is equal or greater than exclusive maximum {maximum}',
        // String errors
        'MIN_LENGTH': 'String is too short ({length} chars), minimum {minimum}',
        'MAX_LENGTH': 'String is too long ({length} chars), maximum {maximum}',
        'PATTERN': 'String does not match pattern: {pattern}',
        // Object errors
        'OBJECT_PROPERTIES_MINIMUM': 'Too few properties defined ({count}), minimum {minimum}',
        'OBJECT_PROPERTIES_MAXIMUM': 'Too many properties defined ({count}), maximum {maximum}',
        'OBJECT_REQUIRED': 'Missing required property: {property}',
        'OBJECT_ADDITIONAL_PROPERTIES': 'Additional properties not allowed',
        'OBJECT_DEPENDENCY_KEY': 'Dependency failed - key must exist: {missing} (due to key: {key})',
        // Array errors
        'ARRAY_LENGTH_SHORT': 'Array is too short ({length}), minimum {minimum}',
        'ARRAY_LENGTH_LONG': 'Array is too long ({length}), maximum {maximum}',
        'ARRAY_UNIQUE': 'Array items are not unique (indices {index1} and {index2})',
        'ARRAY_ADDITIONAL_ITEMS': 'Additional items not allowed',
        // Format errors
        'FORMAT': '{format} format validation failed: {error}',

        // Schema validation errors
        'KEYWORD_TYPE_EXPECTED': 'Keyword "{keyword}" is expected to be type of type "{type}"',
        'KEYWORD_UNDEFINED_STRICT': 'Keyword "{keyword}" must be defined in strict mode',
        'KEYWORD_UNEXPECTED': 'Keyword "{keyword}" is not expected to appear in the schema',
        'KEYWORD_MUST_BE': 'Keyword "{keyword}" must be {expression}',
        'KEYWORD_DEPENDENCY': 'Keyword "{keyword1}" requires keyword "{keyword2}"',
        'KEYWORD_PATTERN': 'Keyword "{keyword}" is not a valid RegExp pattern ({pattern})',
        'KEYWORD_VALUE_TYPE': 'Each element of keyword "{keyword}" array must be a "{type}"',
        'UNKNOWN_FORMAT': 'There is no validation function for format "{format}"'
    };

    ValidationError.prototype.addSubError = function (err) {
        if(!this.subErrors){
            this.subErrors = [];
        }

        this.subErrors.push(err);
    }

    ValidationError.createError = function (code, params, path) {
        var msg = ValidationError.messages[code];
        params = params || {};

        if (typeof msg !== 'string') {
            throw new Error('Unknown error code: ' + code);
        }

        msg = msg.replace(/\{([^{}]*)\}/g, function (whole, varName) {
            var subValue = params[varName];
            if (typeof subValue === 'string' || typeof subValue === 'number') {
                return subValue;
            }
            if (subValue && typeof subValue.toString === 'function') {
                return subValue.toString();
            }
            return whole;
        });

        return new ValidationError(code, msg, params, path);
    };

    var Utils = {
        isBoolean: function (what) {
            return typeof what === 'boolean';
        },
        isString: function (what) {
            return typeof what === 'string';
        },
        isInteger: function (what) {
            return this.isNumber(what) && what % 1 === 0;
        },
        isNumber: function (what) {
            return typeof what === 'number' && Number.isFinite(what);
        },
        isArray: function (what) {
            return Array.isArray(what);
        },
        isObject: function (what) {
            return typeof what === 'object' && what === Object(what) && !Array.isArray(what);
        },
        isFunction: function (what) {
            return typeof what === 'function';
        },
        whatIs: function (what) {
            if (what === undefined) {
                return 'undefined';
            } else if (what === null) {
                return 'null';
            } else if (this.isBoolean(what)) {
                return 'boolean';
            } else if (this.isString(what)) {
                return 'string';
            } else if (this.isArray(what)) {
                return 'array';
            } else if (this.isInteger(what)) {
                return 'integer';
            } else if (this.isNumber(what)) {
                return 'number';
            } else if (this.isObject(what)) {
                return 'object';
            } else if (this.isFunction(what)) {
                return 'function';
            } else if (Number.isNaN(what)) {
                return 'not-a-number';
            } else {
                throw new Error('Utils.whatIs does not know what this is: ' + what);
            }
        },
        isUniqueArray: function (arr, match) {
            match = match || {};
            var i, j, l = arr.length;
            for (i = 0; i < l; i++) {
                for (j = i + 1; j < l; j++) {
                    if (this.areEqual(arr[i], arr[j])) {
                        match.index1 = i;
                        match.index2 = j;
                        return false;
                    }
                }
            }
            return true;
        },
        keys: function (obj) {
            var rv = [], key;
            for (key in obj) {
                if (obj.hasOwnProperty(key)) {
                    rv.push(key);
                }
            }
            return rv;
        },
        forEach: function (obj, callback, context) {
            if (Array.isArray(obj)) {
                return obj.forEach(callback, context);
            } else if (Utils.isObject(obj)) {
                var key;
                for (key in obj) {
                    if (obj.hasOwnProperty(key)) {
                        callback.call(context, obj[key], key);
                    }
                }
            }
        },
        map: function (obj, callback, thisArg) {
            var index = -1,
                result = [];

            Utils.forEach(obj, function (val, key) {
                result[++index] = callback.call(thisArg, val, key);
            });

            return result;
        },
        defaults: function (main, def) {
            Utils.forEach(def, function (val, key) {
                if (main[key] === undefined) {
                    main[key] = val;
                }
            });
            return main;
        },
        uniq: function (arr) {
            var rv = [];
            arr.forEach(function (val) {
                if (rv.indexOf(val) === -1) {
                    rv.push(val);
                }
            });
            return rv;
        },
        difference: function (bigSet, subSet) {
            var rv = [];
            bigSet.forEach(function (val) {
                if (subSet.indexOf(val) === -1) {
                    rv.push(val);
                }
            });
            return rv;
        },
        areEqual: function (json1, json2) {
            // http://json-schema.org/latest/json-schema-core.html#rfc.section.3.6

            // Two JSON values are said to be equal if and only if:
            // both are nulls; or
            // both are booleans, and have the same value; or
            // both are strings, and have the same value; or
            // both are numbers, and have the same mathematical value; or
            if (json1 === json2) {
                return true;
            }

            var i, len;

            // both are arrays, and:
            if (this.isArray(json1) && this.isArray(json2)) {
                // have the same number of items; and
                if (json1.length !== json2.length) {
                    return false;
                }
                // items at the same index are equal according to this definition; or
                len = json1.length;
                for (i = 0; i < len; i++) {
                    if (!this.areEqual(json1[i], json2[i])) {
                        return false;
                    }
                }
                return true;
            }

            // both are objects, and:
            if (this.isObject(json1) && this.isObject(json2)) {
                // have the same set of property names; and
                var keys1 = this.keys(json1);
                var keys2 = this.keys(json2);
                if (!this.areEqual(keys1, keys2)) {
                    return false;
                }
                // values for a same property name are equal according to this definition.
                len = keys1.length;
                for (i = 0; i < len; i++) {
                    if (!this.areEqual(json1[keys1[i]], json2[keys1[i]])) {
                        return false;
                    }
                }
                return true;
            }

            return false;
        },
        decodeJSONPointer: function (str) {
            // http://tools.ietf.org/html/draft-ietf-appsawg-json-pointer-07#section-3
            return decodeURIComponent(str).replace(/~[0-1]/g, function (x) {
                return x === '~1' ? '/' : '~';
            });
        },
        _getRegExpCache: {},
        getRegExp: function (pattern) {
            if (!this._getRegExpCache[pattern]) {
                this._getRegExpCache[pattern] = new RegExp(pattern);
            }
            return this._getRegExpCache[pattern];
        },
        _getRemoteSchemaCache: {},
        getRemoteSchema: function (urlWithQuery, callback) {
            var url = urlWithQuery.split('#')[0];

            function returnSchemaFromString(str) {
                var sch = JSON.parse(str);
                // override in case of 'lying' schemas?
                if (!sch.id) {
                    sch.id = url;
                }
                if (!sch.$schema) {
                    sch.$schema = url;
                }
                callback(undefined, sch);
            }

            if (this._getRemoteSchemaCache[url]) {
                returnSchemaFromString(this._getRemoteSchemaCache[url]);
                return;
            }

            var self = this;
            var http = require('http');
            http.get(url, function (res) {
                var data = '';
                res.on('data', function (chunk) {
                    data += chunk;
                });
                res.on('end', function () {
                    returnSchemaFromString(self._getRemoteSchemaCache[url] = data);
                });
            }).on('error', function (e) {
                callback(e);
            });
        },
        // query should be valid json pointer
        resolveSchemaQuery: function resolveSchemaQuery(schema, rootSchema, queryStr) {
            zSchema.expect.string(queryStr);
            if (queryStr === '#') {
                return rootSchema;
            }

            var rv = null;
            var uriPart = queryStr.split('#')[0];
            var queryPart = queryStr.split('#')[1];

            if (queryStr.indexOf('http:') === 0 || queryStr.indexOf('https:') === 0) {
                // remote
                if (!rootSchema.__remotes || !rootSchema.__remotes[uriPart]) {
                    throw new Error('Remote is not downloaded: ' + uriPart);
                }
                rv = rootSchema.__remotes[uriPart];
            }

            // pick remote or current
            rv = rv || rootSchema;

            // we have remote schema            
            if (queryPart) {
                var queries = ('#' + queryPart).split('/');
                while (queries.length > 0) {
                    var key = Utils.decodeJSONPointer(queries.shift());
                    if (key.indexOf('#') === -1) {
                        rv = rv[key];
                    } else if (key !== '#') {
                        rv = Utils.resolveSchemaId(rv, key);
                    }
                }
            }

            if (!rv) {
                throw new Error('Could not resolve schema reference: ' + queryStr);
            }

            return rv;
        },
        resolveSchemaId: function (schema, id) {
            if (!this.isObject(schema) && !this.isArray(schema)) {
                return;
            }
            if (schema.id === id) {
                return schema;
            }
            var rv = null;
            Utils.forEach(schema, function (val) {
                if (!rv) {
                    rv = Utils.resolveSchemaId(val, id);
                }
            });
            return rv;
        }
    };

    /*
     * these functions are used to validate formats
     * method registerFormat is available for adding new formats
     */
    var FormatValidators = {
        'date': function (date) {
            if (!Utils.isString(date)) {
                return true;
            }
            // full-date from http://tools.ietf.org/html/rfc3339#section-5.6
            var re = Utils.getRegExp('^([0-9]{4})-([0-9]{2})-([0-9]{2})$');
            var matches = re.exec(date);
            if (matches === null) {
                return false;
            }
            // var year = matches[1];
            var month = matches[2];
            var day = matches[3];
            if (month < '01' || month > '12' || day < '01' || day > '31') {
                return false;
            }
            return true;
        },
        'date-time': function (dateTime) {
            if (!Utils.isString(dateTime)) {
                return true;
            }
            // date-time from http://tools.ietf.org/html/rfc3339#section-5.6
            if (!Utils.isString(dateTime)) {
                return false;
            }
            var s = dateTime.toLowerCase().split('t');
            if (!FormatValidators.date(s[0])) {
                return false;
            }
            var matches = Utils.getRegExp('^([0-9]{2}):([0-9]{2}):([0-9]{2})(.[0-9]+)?(z|([+-][0-9]{2}:[0-9]{2}))$').exec(s[1]);
            if (matches === null) {
                return false;
            }
            var hour = matches[1];
            var minute = matches[2];
            var second = matches[3];
            // var fraction = matches[4];
            // var timezone = matches[5];
            if (hour > '23' || minute > '59' || second > '59') {
                return false;
            }
            return true;
        },
        'email': function (email) {
            if (!Utils.isString(email)) {
                return true;
            }
            // https://www.owasp.org/index.php/OWASP_Validation_Regex_Repository
            var re = Utils.getRegExp('^[a-zA-Z0-9+&*-]+(?:\.[a-zA-Z0-9_+&*-]+)*@(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,7}$');
            return re.test(email);
        },
        'hostname': function (hostname) {
            if (!Utils.isString(hostname)) {
                return true;
            }
            // http://stackoverflow.com/questions/106179/regular-expression-to-match-hostname-or-ip-address
            if (hostname.indexOf('.') === -1) {
                return false;
            }
            var re = Utils.getRegExp('^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9])$');
            return re.test(hostname);
        },
        'ipv4': function (ipv4) {
            if (!Utils.isString(ipv4)) {
                return true;
            }
            // https://www.owasp.org/index.php/OWASP_Validation_Regex_Repository
            var re = Utils.getRegExp('^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$');
            return re.test(ipv4);
        },
        'ipv6': function (ipv6) {
            if (!Utils.isString(ipv6)) {
                return true;
            }
            // Stephen Ryan at Dartware @ http://forums.intermapper.com/viewtopic.php?t=452
            var re = Utils.getRegExp('^\s*((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))(%.+)?\s*$');
            return re.test(ipv6);
        },
        'uri': function (uri) {
            if (!Utils.isString(uri)) {
                return true;
            }
            // https://www.owasp.org/index.php/OWASP_Validation_Regex_Repository
            var re = Utils.getRegExp('((((https?|ftps?|gopher|telnet|nntp):\/\/)|(mailto:|news:))(%[0-9A-Fa-f]{2}|[-()_.!~*\';\/?:@&=+$,A-Za-z0-9])+)([).!\';\/?:,][[:blank:]])?');
            return re.test(uri);
        }
    };

    var CustomFormatValidators = {};

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
    }
    Report.prototype = {
        getPath: function () {
            var path = ['#'];

            if(this.parentReport){
                path = path.concat(this.parentReport.path);
            }
            path = path.concat(this.path);

            if(path.length == 1){
                return '#/'
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
            if(subReports){
                subReports.forEach(function (report) {
                    report.errors.forEach(function (_err) {
                        err.addSubError(_err)
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
        toError: function(){
            var err = new Error('Validation failed');
            err.errors = this.errors;
            err.warnings = this.warnings;
            return err;
        },
        toPromise: function(){
            if(this.isValid()){
                return Q(this)
            } else {
                return Q.reject(this.toError())
            }
        },
        goDown: function (str) {
            this.path.push(str);
        },
        goUp: function () {
            this.path.pop();
        }
    };

    /*
     * Add ability to customize validation later, right now there are no options
     */
    function zSchema(options) {
        this.options = Utils.defaults(options || {}, {
            noExtraKeywords: false, // when on, do not allow unknown keywords in schema
            noZeroLengthStrings: false, // when on, always adds minLength: 1 to schemas where type is string,
            noTypeless: false, // when on, every schema must specify a type
            forceAdditional: false, // when on, forces not to leave out some keys on schemas (additionalProperties, additionalItems)
            forceProperties: false, // when on, forces not to leave out properties or patternProperties on type-object schemas
            forceItems: false, // when on, forces not to leave out items on array-type schemas
            forceMaxLength: false // when on, forces not to leave out maxLength on string-type schemas, when format or enum is not specified
        });
        if (this.options.strict === true) {
            this.options.noExtraKeywords = true;
            this.options.noZeroLengthStrings = true;
            this.options.noTypeless = true;
            this.options.forceAdditional = true;
            this.options.forceProperties = true;
            this.options.forceItems = true;
            this.options.forceMaxLength = true;
        }
    }

    // static-methods

    /**
     * Error utility methods
     */
    zSchema.expect = {
        typeError: function (expected, what) {
            return 'Type mismatch, expected "' + expected + '", got "' + Utils.whatIs(what) + '"';
        },
        boolean: function (what) {
            if (!Utils.isBoolean(what)) {
                throw new Error(zSchema.expect.typeError('boolean', what));
            }
        },
        string: function (what) {
            if (!Utils.isString(what)) {
                throw new Error(zSchema.expect.typeError('string', what));
            }
        },
        callable: function (what) {
            if (!Utils.isFunction(what)) {
                throw new Error(zSchema.expect.typeError('function', what));
            }
        },
        object: function (what) {
            if (!Utils.isObject(what)) {
                throw new Error(zSchema.expect.typeError('object', what));
            }
        }
    }

    /*
     *  Basic validation entry, uses instance of validator with default options
     */
    zSchema.validate = function () {
        if (!this._defaultInstance) {
            var Self = this;
            this._defaultInstance = new Self();
        }
        return this._defaultInstance.validate.apply(this._defaultInstance, arguments);
    };

    /*
     *  Register your own format to use when validating
     */
    zSchema.registerFormat = function (name, func) {
        zSchema.expect.string(name);
        zSchema.expect.callable(func);

        if (FormatValidators[name]) {
            throw new Error("Cannot override built-in validator for " + name);
        }

        if (CustomFormatValidators[name]) {
            throw new Error("Cannot override existing validator for " + name);
        }

        CustomFormatValidators[name] = func;
    };

    /*
     *  Convenience method if you wish to pre-load remote schemas so validator doesn't
     *  have to do that while running validation later.
     */
    zSchema.setRemoteReference = function (url, data) {
        zSchema.expect.string(data);
        Utils._getRemoteSchemaCache[url] = data;
    };

    // instance-methods

    /**
     * Validate object against schema
     *
     * @param {Object} json Object to validate
     * @param {Object} schema Schema
     * @param {Function} [callback]
     * @returns {Object} Promise for Report
     */
    zSchema.prototype.validate = function (json, schema, callback) {
        var self = this;
        var report = new Report();

        // schema compilation is async as some remote requests may occur
        return this._compileSchema(report, schema)
            .then(function (compiledSchema) {
                // schema validation
                return self._validateSchema(report, compiledSchema)
                    .then(function () {
                        // object validation against schema
                        return self._validateObject(report, compiledSchema, json)
                            .then(function () {
                                return report.toPromise()
                            })
                    })
            })
            .then(function () {
                return report.toJSON()
            })
            .nodeify(callback)
    };

    /**
     * Compile Schema
     * @param schema
     * @param {Function} [callback]
     * @returns {Object} Promise for compiled schema
     */
    zSchema.prototype.compileSchema = function (schema, callback) {
        var self = this;
        var report = new Report();

        return this._compileSchema(report, schema)
            .then(function (compiledSchema) {
                return self._validateSchema(report, compiledSchema)
                    .then(function () {
                        return compiledSchema;
                    })

            }).nodeify(callback)
    };

    /**
     * Validate schema
     *
     * @param schema
     * @param {Function} callback
     * @returns {Object} Promise for Report
     */
    zSchema.prototype.validateSchema = function (schema, callback) {
        var report = new Report();

        return this._validateSchema(report, schema)
            .then(function () {
                return report.toJSON()
            })
            .nodeify(callback)
    };

    /*
    zSchema.prototype.validateWithCompiled = function (json, compiledSchema, callback) {
        return this.validate(json, compiledSchema, callback);
    };
    */

    zSchema.prototype._compileSchema = function (report, schema) {
        // reusing of compiled schemas
        if (schema.__compiled) {
            return Q(schema);
        }
        schema.__compiled = true;

        // fix all references
        this._fixReferences(schema);
        // then collect for downloading other schemas
        var refs = Utils.uniq(this._collectReferences(schema));

        var self = this;

        return Q.all(refs.map(function (ref) {
                // never download itself
                if (ref.indexOf(schema.$schema) !== 0 && (ref.indexOf('http:') === 0 || ref.indexOf('https:') === 0)) {
                    return self._downloadRemoteReferences(report, schema, ref.split('#')[0]);
                }
            }))
            .then(function () {
                return schema;
            })
    };

    // recurse schema and collect all references for download
    zSchema.prototype._collectReferences = function _collectReferences(schema) {
        var rv = [];
        if (schema.$ref) {
            rv.push(schema.$ref);
        }
        Utils.forEach(schema, function (val, key) {
            if (Utils.isObject(val) || Utils.isArray(val)) {
                rv = rv.concat(_collectReferences(val));
            }
        }, this);
        return rv;
    };

    // fix references according to current scope
    zSchema.prototype._fixReferences = function _fixReferences(schema, scope) {
        scope = scope || [];
        if (Utils.isString(schema.id)) {
            scope.push(schema.id);
        }
        if (schema.$ref) {
            if (scope.length > 0) {
                if (schema.$ref.indexOf('#') === 0) {
                    schema.$ref = scope.join('').split('#')[0] + schema.$ref;
                } else {
                    schema.$ref = scope.join('') + schema.$ref;
                }
            }
        }
        Utils.forEach(schema, function (val, key) {
            if (Utils.isObject(val) || Utils.isArray(val)) {
                _fixReferences(val, scope);
            }
        }, this);
        if (Utils.isString(schema.id)) {
            scope.pop();
        }
    };

    // download remote references when needed
    zSchema.prototype._downloadRemoteReferences = function (report, rootSchema, uri) {
        var self = this;
        var rv = Q.defer();

        Utils.getRemoteSchema(uri, function (err, remoteSchema) {
            if (err) {
                err.description = 'Connection failed to: ' + uri;
                return rv.reject(err);
            }

            if (!rootSchema.__remotes) {
                rootSchema.__remotes = {};
            }

            rv.resolve(self._compileSchema(report, remoteSchema)
                    .then(function (compiledRemoteSchema) {
                        rootSchema.__remotes[uri] = compiledRemoteSchema;
                    }))
        });

        return rv.promise;
    };

    zSchema.prototype._validateSchema = function (report, schema) {

        if (schema.__validated) {
            return Q(schema);
        }
        schema.__validated = true;

        var self = this;

        if (this.options.noTypeless === true) {
            report.expect(schema.type !== undefined, 'KEYWORD_UNDEFINED_STRICT', {keyword: 'type'});
        }

        Utils.forEach(schema, function (value, key) {

            if (SchemaValidators[key] !== undefined) {
                SchemaValidators[key].call(self, report, schema);
            } else {
                if (self.options.noExtraKeywords === true) {
                    report.expect(false, 'KEYWORD_UNEXPECTED', {keyword: key});
                } else {
                    report.addWarning('Unknown key "' + key + '" found in schema.')
                }
            }
        });

        return report.toPromise()
    };

    zSchema.prototype._validateObject = function (report, schema, instance) {
        zSchema.expect.object(schema);

        var self = this;

        var thisIsRoot = false;
        if (!report.rootSchema) {
            report.rootSchema = schema;
            thisIsRoot = true;
        }

        var maxRefs = 99;
        while (schema.$ref && maxRefs > 0) {
            schema = Utils.resolveSchemaQuery(schema, report.rootSchema, schema.$ref);
            maxRefs--;
        }

        return Q.all(Utils.map(schema, function (val, key) {
                if (InstanceValidators[key] !== undefined) {
                    return Q.fcall(InstanceValidators[key].bind(self), report, schema, instance);
                }
            }))
            .then(function () {

                // Children calculations
                if (Utils.isArray(instance)) {
                    return self._recurseArray(report, schema, instance);
                } else if (Utils.isObject(instance)) {
                    return self._recurseObject(report, schema, instance);
                }
            })
            .then(function () {
                if (thisIsRoot) {
                    delete report.rootSchema;
                }
                return report;
            })
    };

    zSchema.prototype._recurseArray = function (report, schema, instance) {
        // http://json-schema.org/latest/json-schema-validation.html#rfc.section.8.2

        var self = this;
        var p = Q();

        // If items is a schema, then the child instance must be valid against this schema, 
        // regardless of its index, and regardless of the value of "additionalItems".
        if (Utils.isObject(schema.items)) {

            instance.forEach(function (val, index) {
                p = p.then(function () {
                    report.goDown('[' + index + ']');
                    return self._validateObject(report, schema.items, val)
                        .then(function () {
                            report.goUp();
                        })
                })
            });

            return p;
        }

        // If "items" is an array, this situation, the schema depends on the index:
        // if the index is less than, or equal to, the size of "items", 
        // the child instance must be valid against the corresponding schema in the "items" array;
        // otherwise, it must be valid against the schema defined by "additionalItems".
        if (Utils.isArray(schema.items)) {

            instance.forEach(function (val, index) {
                
                p = p.then(function () {
                    // equal to doesnt make sense here
                    if (index < schema.items.length) {
                        report.goDown('[' + index + ']');
                        return self._validateObject(report, schema.items[index], val)
                            .then(function () {
                                report.goUp();
                            })
                    } else {
                        // might be boolean
                        if (Utils.isObject(schema.additionalItems)) {
                            report.goDown('[' + index + ']');
                            return self._validateObject(report, schema.additionalItems, val)
                                .then(function () {
                                    report.goUp();
                                })
                        }
                    }
                })

            });

            return p;
        }
    };

    zSchema.prototype._recurseObject = function (report, schema, instance) {
        // http://json-schema.org/latest/json-schema-validation.html#rfc.section.8.3

        var self = this;
        var promise = Q();

        // If "additionalProperties" is absent, it is considered present with an empty schema as a value. 
        // In addition, boolean value true is considered equivalent to an empty schema.
        var additionalProperties = schema.additionalProperties;
        if (additionalProperties === true || additionalProperties === undefined) {
            additionalProperties = {};
        }
        // p - The property set from "properties".
        var p = Utils.keys(schema.properties || {});
        // pp - The property set from "patternProperties". Elements of this set will be called regexes for convenience.
        var pp = Utils.keys(schema.patternProperties || {});
        // m - The property name of the child.
        Utils.forEach(instance, function (propertyValue, m) {
            // s - The set of schemas for the child instance.
            var s = [];

            // 1. If set "p" contains value "m", then the corresponding schema in "properties" is added to "s".
            if (p.indexOf(m) !== -1) {
                s.push(schema.properties[m]);
            }

            // 2. For each regex in "pp", if it matches "m" successfully, the corresponding schema in "patternProperties" is added to "s".
            pp.forEach(function (str) {
                if (Utils.getRegExp(str).test(m) === true) {
                    s.push(schema.patternProperties[str]);
                }
            }, this);

            // 3. The schema defined by "additionalProperties" is added to "s" if and only if, at this stage, "s" is empty.
            if (s.length === 0 && additionalProperties !== false) {
                s.push(additionalProperties);
            }

            // we are passing tests even without this assert because this is covered by properties check
            // if s is empty in this stage, no additionalProperties are allowed
            // report.expect(s.length !== 0, 'E001', m);

            // Instance property value must pass all schemas from s
            s.forEach(function (sch) {
                promise = promise.then(function () {
                    report.goDown(m);
                    return self._validateObject(report, sch, propertyValue)
                        .then(function () {
                            report.goUp();
                        })
                })

            });
        });

        return promise;
    };

    /* 
     * use this functions to validate json schema itself
     * every code here SHOULD reference json schema specification
     */
    var SchemaValidators = {
        $ref: function (report, schema) {
            // http://tools.ietf.org/html/draft-ietf-appsawg-json-pointer-07
            // http://tools.ietf.org/html/draft-pbryan-zyp-json-ref-03
            report.expect(Utils.isString(schema.$ref), 'KEYWORD_TYPE_EXPECTED', {keyword: '$ref', type: 'string'});
        },
        $schema: function (report, schema) {
            // http://json-schema.org/latest/json-schema-core.html#rfc.section.6
            report.expect(Utils.isString(schema.$schema), 'KEYWORD_TYPE_EXPECTED', {keyword: '$schema', type: 'string'});
        },
        multipleOf: function (report, schema) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.1.1.1
            var fine = report.expect(Utils.isNumber(schema.multipleOf), 'KEYWORD_TYPE_EXPECTED', {keyword: 'multipleOf', type: 'number'});
            if (!fine) return;
            report.expect(schema.multipleOf > 0, 'KEYWORD_MUST_BE', { keyword: 'multipleOf', expression:'strictly greater than 0'});
        },
        maximum: function (report, schema) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.1.2.1
            report.expect(Utils.isNumber(schema.maximum), 'KEYWORD_TYPE_EXPECTED', {keyword:'maximum', type:'number'});
        },
        exclusiveMaximum: function (report, schema) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.1.2.1
            var fine = report.expect(Utils.isBoolean(schema.exclusiveMaximum), 'KEYWORD_TYPE_EXPECTED', {keyword:'exclusiveMaximum', type:'boolean'});
            if (!fine) return;
            report.expect(schema.maximum !== undefined, 'KEYWORD_DEPENDENCY', {keyword1: 'exclusiveMaximum', keyword2: 'maximum'});
        },
        minimum: function (report, schema) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.1.3.1
            report.expect(Utils.isNumber(schema.minimum), 'KEYWORD_TYPE_EXPECTED', {keyword:'minimum', type:'number'});
        },
        exclusiveMinimum: function (report, schema) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.1.3.1
            var fine = report.expect(Utils.isBoolean(schema.exclusiveMinimum), 'KEYWORD_TYPE_EXPECTED', {keyword:'exclusiveMinimum', type:'boolean'});
            if (!fine) return;
            report.expect(schema.minimum !== undefined, 'KEYWORD_DEPENDENCY', {keyword1: 'exclusiveMinimum', keyword2: 'minimum'});
        },
        maxLength: function (report, schema) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.2.1.1
            var fine = report.expect(Utils.isInteger(schema.maxLength), 'KEYWORD_TYPE_EXPECTED', {keyword:'maxLength', type:'integer'});
            if (!fine) return;
            report.expect(schema.maxLength >= 0, 'KEYWORD_MUST_BE', {keyword: 'maxLength', expression: 'greater than, or equal to 0'});
        },
        minLength: function (report, schema) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.2.2.1
            var fine = report.expect(Utils.isInteger(schema.minLength), 'KEYWORD_TYPE_EXPECTED', {keyword:'minLength', type:'integer'});
            if (!fine) return;
            report.expect(schema.minLength >= 0, 'KEYWORD_MUST_BE', {keyword: 'minLength', expression: 'greater than, or equal to 0'});
        },
        pattern: function (report, schema) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.2.3.1
            var fine = report.expect(Utils.isString(schema.pattern), 'KEYWORD_TYPE_EXPECTED', {keyword:'pattern', type:'string'});
            if (!fine) return;
            try {
                Utils.getRegExp(schema.pattern);
            } catch (e) {
                report.addError('KEYWORD_PATTERN', {keyword: 'pattern', pattern: schema.pattern});
            }
        },
        additionalItems: function (report, schema) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.3.1.1
            var isBoolean = Utils.isBoolean(schema.additionalItems);
            var isObject = Utils.isObject(schema.additionalItems);
            var fine = report.expect(isBoolean || isObject, 'KEYWORD_TYPE_EXPECTED', {keyword: 'additionalItems', type: ['boolean', 'object']});
            if (!fine) return;
            if (isObject) {
                report.goDown('additionalItems');
                this._validateSchema(report, schema.additionalItems);
                report.goUp();
            }
        },
        items: function (report, schema) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.3.1.1

            var self = this;

            var isArray = Utils.isArray(schema.items);
            var isObject = Utils.isObject(schema.items);
            var fine = report.expect(isArray || isObject, 'KEYWORD_TYPE_EXPECTED', {keyword: 'items', type: ['array', 'object']});
            if (!fine) return;
            if (isObject) {
                report.goDown('items');
                this._validateSchema(report, schema.items)
                report.goUp();
            } else if (isArray) {
                schema.items.forEach(function (obj, index) {

                    report.goDown('items[' + index + ']');
                    self._validateSchema(report, obj)
                    report.goUp();
                });
            }

            // custom - strict mode
            if (self.options.forceAdditional === true) {
                report.expect(schema.additionalItems !== undefined, 'KEYWORD_UNDEFINED_STRICT', {keyword: 'additionalItems'});
            }

        },
        maxItems: function (report, schema) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.3.2.1
            var fine = report.expect(Utils.isInteger(schema.maxItems), 'KEYWORD_TYPE_EXPECTED', {keyword: 'maxItems', type: 'integer'});
            if (!fine) return;
            report.expect(schema.maxItems >= 0, 'KEYWORD_MUST_BE', {keyword: 'maxItems', expression: 'greater than, or equal to 0'});
        },
        minItems: function (report, schema) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.3.3.1
            var fine = report.expect(Utils.isInteger(schema.minItems), 'KEYWORD_TYPE_EXPECTED', {keyword: 'minItems', type: 'integer'});
            if (!fine) return;
            report.expect(schema.minItems >= 0, 'KEYWORD_MUST_BE', {keyword: 'minItems', expression: 'greater than, or equal to 0'});
        },
        uniqueItems: function (report, schema) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.3.4.1
            report.expect(Utils.isBoolean(schema.uniqueItems), 'KEYWORD_TYPE_EXPECTED', {keyword: 'uniqueItems', type: 'boolean'});
        },
        maxProperties: function (report, schema) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.4.1.1
            var fine = report.expect(Utils.isInteger(schema.maxProperties), 'KEYWORD_TYPE_EXPECTED', {keyword: 'maxProperties', type: 'integer'});
            if (!fine) return;
            report.expect(schema.maxProperties >= 0, 'KEYWORD_MUST_BE', {keyword: 'maxProperties', expression: 'greater than, or equal to 0'});
        },
        minProperties: function (report, schema) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.4.2.1
            var fine = report.expect(Utils.isInteger(schema.minProperties), 'KEYWORD_TYPE_EXPECTED', {keyword: 'minProperties', type: 'integer'});
            if (!fine) return;
            report.expect(schema.minProperties >= 0, 'KEYWORD_MUST_BE', {keyword: 'minProperties', expression: 'greater than, or equal to 0'});
        },
        required: function (report, schema) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.4.3.1
            var fine;
            fine = report.expect(Utils.isArray(schema.required), 'KEYWORD_TYPE_EXPECTED', {keyword: 'required', type: 'array'});
            if (!fine) return;
            fine = report.expect(schema.required.length > 0, 'KEYWORD_MUST_BE', {keyword: 'required', expression: 'an array with at least one element'});
            if (!fine) return;
            schema.required.forEach(function (el) {
                report.expect(Utils.isString(el), 'KEYWORD_VALUE_TYPE', {keyword: 'required', type: 'string'});
            }, this);
            report.expect(Utils.isUniqueArray(schema.required), 'KEYWORD_MUST_BE', {keyword: 'required', expression: 'an array with unique items'});
        },
        additionalProperties: function (report, schema) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.4.4.1
            var isBoolean = Utils.isBoolean(schema.additionalProperties);
            var isObject = Utils.isObject(schema.additionalProperties);
            var fine = report.expect(isBoolean || isObject, 'KEYWORD_TYPE_EXPECTED', {keyword: 'additionalProperties', type: ['boolean', 'object']});
            if (!fine) return;
            if (isObject) {
                report.goDown('additionalProperties');
                this._validateSchema(report, schema.additionalProperties)
                report.goUp();
            }
        },
        properties: function (report, schema) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.4.4.1
            var self = this;

            var fine = report.expect(Utils.isObject(schema.properties), 'KEYWORD_TYPE_EXPECTED', {keyword: 'properties', type: 'object'});
            if (!fine) return;
            Utils.forEach(schema.properties, function (val, propName) {
                report.goDown('properties[' + propName + ']');
                self._validateSchema(report, val)
                report.goUp();
            });

            // custom - strict mode
            if (self.options.forceAdditional === true) {
                report.expect(schema.additionalProperties !== undefined, 'KEYWORD_UNDEFINED_STRICT', {keyword: 'additionalProperties'});
            }
        },
        patternProperties: function (report, schema) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.4.4.1

            var self = this;

            var fine = report.expect(Utils.isObject(schema.patternProperties), 'KEYWORD_TYPE_EXPECTED', {keyword: 'patternProperties', type: 'object'});
            if (!fine) return;
            Utils.forEach(schema.patternProperties, function (val, propName) {
                try {
                    Utils.getRegExp(propName);
                } catch (e) {
                    report.addError('KEYWORD_PATTERN', {keyword: 'patternProperties', pattern: propName});
                }
                report.goDown('patternProperties[' + propName + ']');
                self._validateSchema(report, val)
                report.goUp();
            });
        },
        dependencies: function (report, schema) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.4.5.1

            var self = this;

            var fine = report.expect(Utils.isObject(schema.dependencies), 'KEYWORD_TYPE_EXPECTED', 'dependencies', 'object');
            if (!fine) return;
            Utils.forEach(schema.dependencies, function (schemaDependency, schemaKey) {

                var isObject = Utils.isObject(schemaDependency);
                var isArray = Utils.isArray(schemaDependency);
                report.expect(isObject || isArray, 'KEYWORD_VALUE_TYPE', {keyword: 'dependencies', type: 'object or array'} );
                if (isObject) {
                    report.goDown('dependencies[' + schemaKey + ']');
                    self._validateSchema(report, schemaDependency)
                    report.goUp();
                } else if (isArray) {
                    report.expect(schemaDependency.length > 0, 'KEYWORD_MUST_BE', {keyword: 'dependencies', expression: 'not empty array'});
                    schemaDependency.forEach(function (el) {
                        report.expect(Utils.isString(el), 'KEYWORD_VALUE_TYPE', {keyword: 'dependensices', type: 'string'});
                    });
                    report.expect(Utils.isUniqueArray(schemaDependency), {keyword: 'dependencies', expression: 'an array with unique items'});
                }
            });
        },
        enum: function (report, schema) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.5.1.1
            var fine;
            fine = report.expect(Utils.isArray(schema.enum), 'KEYWORD_TYPE_EXPECTED', {keyword: 'enum', type: 'array'});
            if (!fine) return;
            fine = report.expect(schema.enum.length > 0, 'KEYWORD_MUST_BE', {keyword: 'enum', expression:'an array with at least one element'});
            if (!fine) return;
            fine = report.expect(Utils.isUniqueArray(schema.enum), 'KEYWORD_MUST_BE', {keyword: 'enum', expression: 'an array with unique items'});
        },
        type: function (report, schema) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.5.2.1
            var primitiveTypes = ['array', 'boolean', 'integer', 'number', 'null', 'object', 'string'];
            var primitiveTypeStr = primitiveTypes.join(',');
            var isString = Utils.isString(schema.type);
            var isArray = Utils.isArray(schema.type);
            var fine;
            fine = report.expect(isString || isArray, 'KEYWORD_TYPE_EXPECTED', {keyword: 'type', type: ['string', 'array']});
            if (!fine) return;
            if (isArray) {
                schema.type.forEach(function (el) {
                    report.expect(primitiveTypes.indexOf(el) !== -1, 'KEYWORD_TYPE_EXPECTED', { keyword: 'type', type: primitiveTypeStr});
                }, this);
                report.expect(Utils.isUniqueArray(schema.type), 'KEYWORD_MUST_BE', {keyword: 'type', expression: 'an object with unique properties'});
            } else {
                report.expect(primitiveTypes.indexOf(schema.type) !== -1, 'KEYWORD_TYPE_EXPECTED', { keyword: 'type', type: primitiveTypeStr});
            }
            if (this.options.noZeroLengthStrings === true) {
                if (schema.type === 'string' || isArray && schema.type.indexOf('string') !== -1) {
                    if (schema.minLength === undefined) {
                        schema.minLength = 1;
                    }
                }
            }
            if (this.options.forceProperties === true) {
                if (schema.type === 'object' || isArray && schema.type.indexOf('object') !== -1) {
                    report.expect(schema.properties !== undefined || schema.patternProperties !== undefined, 'KEYWORD_UNDEFINED_STRICT', {keyword: 'properties'});
                }
            }
            if (this.options.forceItems === true) {
                if (schema.type === 'array' || isArray && schema.type.indexOf('array') !== -1) {
                    report.expect(schema.items !== undefined, 'KEYWORD_UNDEFINED_STRICT', {keyword: 'items'});
                }
            }
            if (this.options.forceMaxLength === true) {
                if (schema.type === 'string' || isArray && schema.type.indexOf('string') !== -1) {
                    report.expect(schema.maxLength !== undefined || schema.format !== undefined || schema.enum !== undefined, 'KEYWORD_UNDEFINED_STRICT', {keyword: 'maxLength'});
                }
            }
        },
        allOf: function (report, schema) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.5.3.1

            var self = this;

            var fine;
            fine = report.expect(Utils.isArray(schema.allOf), 'KEYWORD_TYPE_EXPECTED', {keyword: 'allOf', type: 'array'});
            if (!fine) return;
            fine = report.expect(schema.allOf.length > 0, 'KEYWORD_MUST_BE', {keyword: 'allOf', expression:'an array with at least one element'});
            if (!fine) return;
            schema.allOf.forEach(function (sch, index) {
                report.goDown('allOf[' + index + ']');
                self._validateSchema(report, sch)
                report.goUp();
            });
        },
        anyOf: function (report, schema) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.5.4.1

            var self = this;

            var fine;
            fine = report.expect(Utils.isArray(schema.anyOf), 'KEYWORD_TYPE_EXPECTED', {keyword: 'anyOf', type: 'array'});
            if (!fine) return;
            fine = report.expect(schema.anyOf.length > 0, 'KEYWORD_MUST_BE', {keyword: 'anyOf', expression: 'an array with at least one element'});
            if (!fine) return;
            schema.anyOf.forEach(function (sch, index) {
                report.goDown('anyOf[' + index + ']');
                self._validateSchema(report, sch)
                report.goUp();
            });
        },
        oneOf: function (report, schema) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.5.5.1

            var self = this;

            var fine;
            fine = report.expect(Utils.isArray(schema.oneOf), 'KEYWORD_TYPE_EXPECTED', {keyword: 'oneOf', type: 'array'});
            if (!fine) return;
            fine = report.expect(schema.oneOf.length > 0, 'KEYWORD_MUST_BE', {keyword: 'oneOf', expression: 'an array with at least one element'});
            if (!fine) return;

            schema.oneOf.forEach(function (sch, index) {
                report.goDown('oneOf[' + index + ']');
                self._validateSchema(report, sch)
                report.goUp();
            });
        },
        not: function (report, schema) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.5.6.1
            var fine;
            fine = report.expect(Utils.isObject(schema.not), 'KEYWORD_TYPE_EXPECTED', {keyword: 'not', type: 'object'});
            if (!fine) return;
            report.goDown('not');
            this._validateSchema(report, schema.not)
            report.goUp();
        },
        definitions: function (report, schema) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.5.7.1

            var self = this;

            var fine;
            fine = report.expect(Utils.isObject(schema.definitions), 'KEYWORD_TYPE_EXPECTED', {keyword: 'definitions', type: 'object'});
            if (!fine) return;

            Utils.forEach(schema.definitions, function (obj, index) {
                report.goDown('definitions[' + index + ']');
                return self._validateSchema(report, obj)
                report.goUp();

            });
        },
        format: function (report, schema) {
            var fine;
            fine = report.expect(Utils.isString(schema.format), 'KEYWORD_TYPE_EXPECTED', {keyword: 'format', type: 'string'});
            if (!fine) return;
            fine = report.expect(Utils.isFunction(FormatValidators[schema.format]) || Utils.isFunction(CustomFormatValidators[schema.format]), 'UNKNOWN_FORMAT', {format: schema.format});
            if (!fine) return;
        },
        id: function (report, schema) {
            // http://json-schema.org/latest/json-schema-core.html#rfc.section.7.2
            report.expect(Utils.isString(schema.id), 'KEYWORD_TYPE_EXPECTED', {keyword: 'id', type: 'string'});
        },
        title: function (report, schema) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.6.1
            report.expect(Utils.isString(schema.title), 'KEYWORD_TYPE_EXPECTED', {keyword: 'title', type: 'string'});
        },
        description: function (report, schema) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.6.1
            report.expect(Utils.isString(schema.description), 'KEYWORD_TYPE_EXPECTED', {keyword: 'description', type: 'string'});
        },
        'default': function (report, schema) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.6.2   
        },
        // ---- custom keys used by zSchema
        __compiled: function (report, schema) {
            zSchema.expect.boolean(schema.__compiled);
        },
        __validated: function (report, schema) {
            zSchema.expect.boolean(schema.__validated);
        }
    };

    var InstanceValidators = {
        multipleOf: function (report, schema, instance) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.1.1.2
            if (!Utils.isNumber(instance)) {
                return;
            }
            var isInteger = Utils.whatIs(instance / schema.multipleOf) === 'integer';
            report.expect(isInteger,
                'MULTIPLE_OF',
                { value: instance, multipleOf: schema.multipleOf}
            );
        },
        maximum: function (report, schema, instance) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.1.2.2
            if (!Utils.isNumber(instance)) {
                return;
            }
            if (schema.exclusiveMaximum !== true) {
                report.expect(instance <= schema.maximum,
                    'MAXIMUM',
                    { value: instance, maximum: schema.maximum}
                );
            } else {
                report.expect(instance < schema.maximum,
                    'MAXIMUM_EXCLUSIVE',
                    { value: instance, maximum: schema.maximum}
                );
            }
        },
        exclusiveMaximum: function () {
            // covered in maximum
        },
        minimum: function (report, schema, instance) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.1.3.2
            if (!Utils.isNumber(instance)) {
                return;
            }
            if (schema.exclusiveMinimum !== true) {
                report.expect(instance >= schema.minimum,
                    'MINIMUM',
                    { value: instance, minimum: schema.minimum}
                );
            } else {
                report.expect(instance > schema.minimum,
                    'MINIMUM_EXCLUSIVE',
                    { value: instance, minimum: schema.minimum}
                );
            }
        },
        exclusiveMinimum: function () {
            // covered in minimum
        },
        maxLength: function (report, schema, instance) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.2.1.2
            if (!Utils.isString(instance)) {
                return;
            }
            report.expect(instance.length <= schema.maxLength,
                'MAX_LENGTH',
                { length: instance.length, maximum: schema.maxLength}
            );
        },
        minLength: function (report, schema, instance) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.2.2.2
            if (!Utils.isString(instance)) {
                return;
            }
            report.expect(instance.length >= schema.minLength,
                'MIN_LENGTH',
                { length: instance.length, minimum: schema.minLength}
            );
        },
        pattern: function (report, schema, instance) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.2.3.2
            if (!Utils.isString(instance)) {
                return;
            }
            report.expect(Utils.getRegExp(schema.pattern).test(instance),
                'PATTERN',
                { pattern: schema.pattern});
        },
        additionalItems: function (report, schema, instance) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.3.1.2
            if (!Utils.isArray(instance)) {
                return;
            }

            // if the value of "additionalItems" is boolean value false and the value of "items" is an array, 
            // the instance is valid if its size is less than, or equal to, the size of "items".
            if (schema.additionalItems === false && Utils.isArray(schema.items)) {
                report.expect(instance.length <= schema.items.length, 'ARRAY_ADDITIONAL_ITEMS');
            }
        },
        items: function (report, schema, instance) {
            // covered in additionalItems
        },
        maxItems: function (report, schema, instance) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.3.2.2
            if (!Utils.isArray(instance)) {
                return;
            }
            report.expect(instance.length <= schema.maxItems, 'ARRAY_LENGTH_LONG', {length: instance.length, maximum: schema.maxItems});
        },
        minItems: function (report, schema, instance) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.3.3.2
            if (!Utils.isArray(instance)) {
                return;
            }
            report.expect(instance.length >= schema.minItems, 'ARRAY_LENGTH_SHORT', {length: instance.length, minimum: schema.minItems});
        },
        uniqueItems: function (report, schema, instance) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.3.4.2
            if (!Utils.isArray(instance)) {
                return;
            }
            if (schema.uniqueItems === true) {
                var matches = {};
                report.expect(Utils.isUniqueArray(instance, matches), 'ARRAY_UNIQUE', matches);
            }
        },
        maxProperties: function (report, schema, instance) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.4.1.2
            if (!Utils.isObject(instance)) {
                return;
            }
            report.expect(Utils.keys(instance).length <= schema.maxProperties, 'OBJECT_PROPERTIES_MAXIMUM', {count: Utils.keys(instance).length, maximum: schema.maxProperties});
        },
        minProperties: function (report, schema, instance) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.4.2.2
            if (!Utils.isObject(instance)) {
                return;
            }
            report.expect(Utils.keys(instance).length >= schema.minProperties, 'OBJECT_PROPERTIES_MINIMUM', {count: Utils.keys(instance).length, minimum: schema.maxProperties});
        },
        required: function (report, schema, instance) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.4.3.2
            if (!Utils.isObject(instance)) {
                return;
            }
            schema.required.forEach(function (reqProperty) {
                report.expect(instance[reqProperty] !== undefined, 'OBJECT_REQUIRED', {property: reqProperty});
            });
        },
        additionalProperties: function (report, schema, instance) {
            // covered in properties and patternProperties
            if (schema.properties === undefined && schema.patternProperties === undefined) {
                return InstanceValidators.properties.apply(this, arguments);
            }
        },
        properties: function (report, schema, instance) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.4.4.2
            if (!Utils.isObject(instance)) {
                return;
            }
            var properties = schema.properties !== undefined ? schema.properties : {};
            var patternProperties = schema.patternProperties !== undefined ? schema.patternProperties : {};
            if (schema.additionalProperties === false) {
                // The property set of the instance to validate.
                var s = Utils.keys(instance);
                // The property set from "properties".
                var p = Utils.keys(properties);
                // The property set from "patternProperties".
                var pp = Utils.keys(patternProperties);
                // remove from "s" all elements of "p", if any;
                s = Utils.difference(s, p);
                // for each regex in "pp", remove all elements of "s" which this regex matches.
                pp.forEach(function (patternProperty) {
                    var regExp = Utils.getRegExp(patternProperty);
                    for (var i = s.length - 1; i >= 0; i--) {
                        if (regExp.test(s[i]) === true) {
                            s.splice(i, 1);
                        }
                    }
                }, this);
                // Validation of the instance succeeds if, after these two steps, set "s" is empty.
                report.expect(s.length === 0, 'OBJECT_ADDITIONAL_PROPERTIES', {properties: s});
            }
        },
        patternProperties: function (report, schema, instance) {
            // covered in properties
            if (schema.properties === undefined) {
                return InstanceValidators.properties.apply(this, arguments);
            }
        },
        dependencies: function (report, schema, instance) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.4.5.2

            var self = this;
            var p = Q();

            if (!Utils.isObject(instance)) {
                return;
            }
            Utils.forEach(schema.dependencies, function (dependency, name) {

                p = p.then(function () {
                    if (instance[name] !== undefined) {
                        if (Utils.isObject(dependency)) {
                            // errors will be added to same report
                            return self._validateObject(report, dependency, instance);
                        } else { // Array
                            Utils.forEach(dependency, function (requiredProp) {
                                report.expect(instance[requiredProp] !== undefined, 'OBJECT_DEPENDENCY_KEY', { missing: requiredProp, key: name });
                            });
                        }
                    }
                })
            });

            return p;
        },
        enum: function (report, schema, instance) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.5.1.2
            var match = false;
            for (var i = 0, l = schema.enum.length; i < l; i++) {
                if (Utils.areEqual(instance, schema.enum[i])) {
                    match = true;
                    break;
                }
            }
            report.expect(match, 'ENUM_MISMATCH', {value: instance});
        },
        type: function (report, schema, instance) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.5.2.2
            var instanceType = Utils.whatIs(instance);
            if (Utils.isString(schema.type)) {
                report.expect(instanceType === schema.type || instanceType === 'integer' && schema.type === 'number',
                    'INVALID_TYPE', { expected: schema.type, type: instanceType});
            } else {
                var one = schema.type.indexOf(instanceType) !== -1;
                var two = instanceType === 'integer' && schema.type.indexOf('number') !== -1;
                report.expect(one || two, 'INVALID_TYPE', { expected: schema.type, type: instanceType});
            }
        },
        allOf: function (report, schema, instance) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.5.3.2

            var self = this;
            var p = Q();

            schema.allOf.forEach(function (sch) {
                p = p.then(function () {
                    return self._validateObject(report, sch, instance);
                })
            });

            return p;
        },
        anyOf: function (report, schema, instance) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.5.4.2
            var passes = 0;
            var subReports = [];

            var self = this;
            var p = Q();

            schema.anyOf.forEach(function (anyOf) {
                p = p.then(function () {

                    if(passes > 0) return;
                    var subReport = new Report(report);
                    return self._validateObject(subReport, anyOf, instance)
                        .then(function () {
                            if (subReport.isValid()) {
                                passes++;
                            } else {
                                subReports.push(subReport);
                            }
                        })
                })
            })

            return p.then(function () {
                report.expect(passes >= 1, 'ANY_OF_MISSING', {}, passes === 0 ? subReports : null);
            })
        },
        oneOf: function (report, schema, instance) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.5.5.2
            var self = this;
            var passes = 0;
            var subReports = [];
            
            var p = Q();

            schema.oneOf.forEach(function (oneOf) {
                p = p.then(function () {

                    var subReport = new Report(report);
                    return self._validateObject(subReport, oneOf, instance)
                        .then(function () {
                            if (subReport.isValid()) {
                                passes++;
                            } else {
                                subReports.push(subReport);
                            }
                        })
                })
            })

            return p.then(function () {
                report.expect(passes > 0, 'ONE_OF_MISSING', {}, passes === 0 ? subReports : null);
                report.expect(passes < 2, 'ONE_OF_MULTIPLE');
            })
        },
        not: function (report, schema, instance) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.5.6.2
            var subReport = new Report(report);
            return this._validateObject(subReport, schema.not, instance)
                .then(function () {
                    report.expect(!subReport.isValid(), 'NOT_PASSED');
                })
        },
        definitions: function (report, schema, instance) {
            //http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.5.7.2
            //none
        },
        format: function (report, schema, instance) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.7.2

            if(typeof FormatValidators[schema.format] === 'function'){ // built-in format (sync)
                report.expect(FormatValidators[schema.format](instance), 'FORMAT', {format: schema.format});
                return;
            }

            // custom format (sync or async)
            var deferred = Q.defer();

            try {
                var p = CustomFormatValidators[schema.format](instance, deferred.makeNodeResolver());
                if(Q.isPromise(p) || Utils.isBoolean(p)){
                    deferred.resolve(p);
                }
            } catch (e){
                deferred.reject(e);
            }

            return deferred.promise
                .then(function (valid) { // validators may return (resolve with) true/false
                    if(!valid){
                        report.addError('FORMAT', {format: schema.format})
                    }
                })
                .fail(function (err) { // validators may throw Error or return rejected promise
                    report.addError('FORMAT', {format: schema.format, error: err})
                })
        }
    }

    module.exports = zSchema;

}());
