
    /*
     * Add ability to customize validation later, right now there are no options
     */
    function ZSchema(options) {
        this.options = Utils.defaults(options || {}, {
            noExtraKeywords: false, // when on, do not allow unknown keywords in schema
            noZeroLengthStrings: false, // when on, always adds minLength: 1 to schemas where type is string,
            noTypeless: false, // when on, every schema must specify a type
            forceAdditional: false, // when on, forces not to leave out some keys on schemas (additionalProperties, additionalItems)
            forceProperties: false, // when on, forces not to leave out properties or patternProperties on type-object schemas
            forceItems: false, // when on, forces not to leave out items on array-type schemas
            forceMaxLength: false, // when on, forces not to leave out maxLength on string-type schemas, when format or enum is not specified
            noSchemaCache: false, // when on, schema caching is disabled - cache is used to resolve references by id between schemas
            strictUris: false, // when on, strict uris by rfc3986 are required - https://github.com/zaggino/z-schema/issues/18
            sync: false // when on, features that require async handling are disabled - https://github.com/zaggino/z-schema/issues/19
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
        // schema-cache can be turned off for memory / performance gain when not required
        if (this.options.noSchemaCache !== true) {
            this.schemaCache = {};
        }
    }

    // static-methods

    /**
     * Error utility methods
     */
    ZSchema.expect = {
        typeError: function (expected, what) {
            return 'Type mismatch, expected "' + expected + '", got "' + Utils.whatIs(what) + '"';
        },
        boolean: function (what) {
            if (!Utils.isBoolean(what)) {
                throw new Error(ZSchema.expect.typeError('boolean', what));
            }
        },
        string: function (what) {
            if (!Utils.isString(what)) {
                throw new Error(ZSchema.expect.typeError('string', what));
            }
        },
        callable: function (what) {
            if (!Utils.isFunction(what)) {
                throw new Error(ZSchema.expect.typeError('function', what));
            }
        },
        object: function (what) {
            if (!Utils.isObject(what)) {
                throw new Error(ZSchema.expect.typeError('object', what));
            }
        }
    };

    /*
     *  Basic validation entry, uses instance of validator with default options
     */
    ZSchema.validate = function () {
        if (!this._defaultInstance) {
            var Self = this;
            this._defaultInstance = new Self();
        }
        return this._defaultInstance.validate.apply(this._defaultInstance, arguments);
    };

    /*
     *  Register your own format function to use when validating
     *
     *  `func` can be sync or async and can either return a promise or
     *  execute a classic callback passed as last argument
     */
    ZSchema.registerFormat = function (name, func) {
        ZSchema.expect.string(name);
        ZSchema.expect.callable(func);

        if (FormatValidators[name]) {
            throw new Error('Cannot override built-in validator for ' + name);
        }

        if (CustomFormatValidators[name]) {
            throw new Error('Cannot override existing validator for ' + name);
        }

        CustomFormatValidators[name] = func;
    };

    /**
     * Register your own format validation function and tell ZSchema to call it in sync mode (performance)
     */
    ZSchema.registerFormatSync = function (name, func) {
        func.__$sync = true;
        return ZSchema.registerFormat(name, func);
    };

    /*
     *  Convenience method if you wish to pre-load remote schemas so validator doesn't
     *  have to do that while running validation later.
     */
    ZSchema.setRemoteReference = function (url, data) {
        ZSchema.expect.string(data);
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
    ZSchema.prototype.validate = function (json, schema, callback) {
        var self = this;
        var report = new Report();

        if (this.options.sync) {

            if (!schema.__$compiled) {
                this._compileSchema(report, schema);
            }
            if (!schema.__$validated) {
                this._validateSchema(report, schema);
            }
            this._validateObject(report, schema, json);
            this._lastError = report.toJSON();
            return report.isValid();

        } else {

            // schema compilation is async as some remote requests may occur
            return this._compileSchema(report, schema)
                .then(function (compiledSchema) {
                    // schema validation
                    return self._validateSchema(report, compiledSchema)
                        .then(function () {
                            // object validation against schema
                            return self._validateObject(report, compiledSchema, json)
                                .then(function () {
                                    return report.toPromise();
                                });
                        });
                })
                .then(function () {
                    return report.toJSON();
                })
                .nodeify(callback);
        }
    };

    ZSchema.prototype.getLastError = function () {
        return this._lastError;
    };

    /**
     * Compile Schema
     * @param schema
     * @param {Function} [callback]
     * @returns {Object} Promise for compiled schema
     */
    ZSchema.prototype.compileSchema = function (schema, callback) {
        var self = this;

        if (Array.isArray(schema)) {
            return this.options.sync ? this.compileSchemasSync(schema) : this.compileSchemas(schema, callback);
        }

        var report = new Report();

        if (this.options.sync) {
            this._compileSchema(report, schema);
            this._validateSchema(report, schema);
            this._lastError = report.toJSON();
            if (report.isValid()) {
                return schema;
            } else {
                throw report.toError();
            }
        } else {
            return this._compileSchema(report, schema).then(function (compiledSchema) {
                return self._validateSchema(report, compiledSchema).then(function () {
                    return compiledSchema;
                });
            }).nodeify(callback);
        }
    };

    /**
     * Compile multiple schemas in one batch
     * @param {Array} array of schemas
     * @param {Function} callback
     * @returns {Object} Promise
     */
    ZSchema.prototype.compileSchemas = function (arr, callback) {
        var self = this,
            compileSchemasFinished = Promise.defer(),
            compiled = [],
            failed = [],
            lastError;

        var loopArrayFinished;
        function loopArray() {
            // condition
            if (arr.length === 0) { return loopArrayFinished.resolve(); }
            // body
            var nextSchema = arr.shift();
            self.compileSchema(nextSchema).then(function () {
                compiled.push(nextSchema);
            }).catch(function (err) {
                    lastError = err;
                    failed.push(nextSchema);
                }).finally(function () {
                    loopArray();
                });
        }

        var lastArrayLength;
        function loopCompile() {
            // condition
            if (arr.length === 0) { return compileSchemasFinished.resolve(compiled); }
            if (arr.length === lastArrayLength) { return compileSchemasFinished.reject(lastError); }
            // body
            lastArrayLength = arr.length;
            loopArrayFinished = Promise.defer();
            loopArrayFinished.promise.then(function () {
                arr = failed;
                failed = [];
                loopCompile();
            });
            loopArray();
        }
        loopCompile();

        return compileSchemasFinished.promise.nodeify(callback);
    };

    ZSchema.prototype.compileSchemasSync = function (arr) {
        var self = this,
            lastError,
            compiled,
            retArr = [];

        function cycle() {
            compiled = 0;
            arr.forEach(function (sch, i) {
                try {
                    self.compileSchema(sch);
                } catch (e) {
                    lastError = e;
                    return;
                }
                compiled++;
                retArr.push(sch);
                arr.splice(i, 1);
            });
        }

        do {
            cycle();
        } while (compiled > 0);

        if (arr.length === 0) {
            return retArr;
        } else {
            throw lastError;
        }
    };

    /**
     * Validate schema
     *
     * @param schema
     * @param {Function} callback
     * @returns {Object} Promise for Report
     */
    ZSchema.prototype.validateSchema = function (schema, callback) {
        var report = new Report();
        report.expect(Utils.isObject(schema), 'SCHEMA_TYPE_EXPECTED');

        if (this.options.sync) {
            this._validateSchema(report, schema);
            this._lastError = report.toJSON();
            if (report.isValid()) {
                return schema;
            } else {
                throw report.toError();
            }
        } else {
            return this._validateSchema(report, schema)
                .then(function () {
                    return report.toJSON();
                })
                .nodeify(callback);
        }
    };

    // recurse schema and collect all references for download
    ZSchema.prototype._collectReferences = function _collectReferences(schema) {
        var arr = [];
        if (schema.$ref) {
            arr.push(schema);
        }
        Utils.forEach(schema, function (val, key) {
            if (typeof key === 'string' && key.indexOf('__') === 0) {
                return;
            }
            if (Utils.isObject(val) || Utils.isArray(val)) {
                arr = arr.concat(_collectReferences(val));
            }
        }, this);
        return arr;
    };

    ZSchema.prototype._compileSchema = function (report, schema) {
        // reusing of compiled schemas
        if (schema.__$compiled) {
            return this.options.sync ? schema : Promise.resolve(schema);
        }

        // fix all references
        this._fixInnerReferences(schema);
        this._fixOuterReferences(schema);

        // then collect for downloading other schemas
        var refObjs = this._collectReferences(schema);
        var refs = Utils.uniq(refObjs.map(function (obj) {
            return obj.$ref;
        }));

        function afterDownload() {
            refObjs.forEach(function (refObj) {
                if (!refObj.__$refResolved) {
                    refObj.__$refResolved = Utils.resolveSchemaQuery(refObj, schema, refObj.$ref, true, self.options.sync) || null;
                }
                if (self.schemaCache && self.schemaCache[refObj.$ref]) {
                    refObj.__$refResolved = self.schemaCache[refObj.$ref];
                }
                report.expect(refObj.__$refResolved != null, 'UNRESOLVABLE_REFERENCE', {ref: refObj.$ref});
            });
            if (report.isValid()) {
                schema.__$compiled = true;
            }
            if (schema.id && self.schemaCache) {
                self.schemaCache[schema.id] = schema;
            }
            return schema;
        }

        function download() {
            return refs.map(function (ref) {
                // never download itself
                if (ref.indexOf(schema.$schema) === 0) {
                    return;
                }
                // download if it is a remote
                if (ref.indexOf('http:') === 0 || ref.indexOf('https:') === 0) {
                    return self._downloadRemoteReferences(report, schema, ref.split('#')[0]);
                }
            });
        }

        var self = this;
        if (this.options.sync) {
            download();
            afterDownload();
        } else {
            return Promise.all(download()).then(afterDownload);
        }
    };

    ZSchema.prototype._fixInnerReferences = function _fixInnerReferences(rootSchema, schema) {
        if (!schema) {
            schema = rootSchema;
        }
        if (schema.$ref && schema.__$refResolved !== null && schema.$ref.indexOf('http:') !== 0 && schema.$ref.indexOf('https:') !== 0) {
            schema.__$refResolved = Utils.resolveSchemaQuery(schema, rootSchema, schema.$ref, true, this.options.sync) || null;
        }
        Utils.forEach(schema, function (val, key) {
            if (typeof key === 'string' && key.indexOf('__') === 0) {
                return;
            }
            if (Utils.isObject(val) || Utils.isArray(val)) {
                _fixInnerReferences.call(this, rootSchema, val);
            }
        }, this);
    };

    // fix references according to current scope
    ZSchema.prototype._fixOuterReferences = function _fixOuterReferences(schema, scope) {
        scope = scope || [];
        if (Utils.isString(schema.id)) {
            scope.push(schema.id);
        }
        if (schema.$ref && !schema.__$refResolved && !Utils.isAbsoluteUri(schema.$ref)) {
            if (scope.length > 0) {
                var s = scope.join('').split('#')[0];
                if (schema.$ref[0] === '#') {
                    schema.$ref = s + schema.$ref;
                } else {
                    schema.$ref = s.substring(0, 1 + s.lastIndexOf('/')) + schema.$ref;
                }
            }
        }
        Utils.forEach(schema, function (val, key) {
            if (typeof key === 'string' && key.indexOf('__') === 0) {
                return;
            }
            if (Utils.isObject(val) || Utils.isArray(val)) {
                _fixOuterReferences(val, scope);
            }
        }, this);
        if (Utils.isString(schema.id)) {
            scope.pop();
        }
    };

    // download remote references when needed
    ZSchema.prototype._downloadRemoteReferences = function (report, rootSchema, uri) {
        if (!rootSchema.__remotes) {
            rootSchema.__remotes = {};
        }

        // do not try to download self
        if (rootSchema.id && uri === rootSchema.id.split('#')[0]) {
            rootSchema.__remotes[uri] = rootSchema;
            return this.options.sync ? null : Promise.resolve();
        }

        if (this.options.sync) {
            // getRemoteSchema is sync when callback is not specified
            var remoteSchema = Utils.getRemoteSchema(uri);
            if (remoteSchema) {
                this._compileSchema(report, remoteSchema);
                rootSchema.__remotes[uri] = remoteSchema;
            }
        } else {
            var self = this,
                p = Promise.defer();
            Utils.getRemoteSchema(uri, function (err, remoteSchema) {
                if (err) {
                    err.description = 'Connection failed to: ' + uri;
                    return p.reject(err);
                }
                p.resolve(self._compileSchema(report, remoteSchema)
                    .then(function (compiledRemoteSchema) {
                        rootSchema.__remotes[uri] = compiledRemoteSchema;
                    }));
            });
            return p.promise;
        }
    };

    ZSchema.prototype._validateSchema = function (report, schema) {
        if (schema.__$validated) {
            return this.options.sync ? schema : Promise.resolve(schema);
        }

        var self = this,
            hasParentSchema = schema.$schema && schema.id !== schema.$schema;

        var finish = function () {
            // run sync validations over schema keywords
            if (self.options.noTypeless === true) {
                report.expect(schema.type !== undefined || schema.anyOf !== undefined || schema.oneOf !== undefined ||
                    schema.not  !== undefined || schema.$ref  !== undefined, 'KEYWORD_UNDEFINED_STRICT', {keyword: 'type'});
            }
            Utils.forEach(schema, function (value, key) {
                if (typeof key === 'string' && key.indexOf('__') === 0) {
                    return;
                }
                if (SchemaValidators[key] !== undefined) {
                    SchemaValidators[key].call(self, report, schema);
                } else if (!hasParentSchema) {
                    if (self.options.noExtraKeywords === true) {
                        report.expect(false, 'KEYWORD_UNEXPECTED', {keyword: key});
                    } else {
                        report.addWarning('Unknown key "' + key + '" found in schema.');
                    }
                }
            });
            if (report.isValid()) {
                schema.__$validated = true;
            }
            self._lastError = report.toJSON();
            return self.options.sync ? report.isValid() : report.toPromise();
        };

        // if $schema is present, this schema should validate against that $schema
        if (hasParentSchema) {
            if (this.options.sync) {
                // remote schema will not be validated in sync mode - assume that schema is correct
                return finish();
            } else {
                var rv = Promise.defer();
                Utils.getRemoteSchema(schema.$schema, function (err, remoteSchema) {
                    if (err) {
                        report.addError('SCHEMA_NOT_REACHABLE', {uri: schema.$schema});
                        rv.resolve();
                        return;
                    }
                    // prevent recursion here
                    if (schema.__$downloadedFrom !== remoteSchema.__$downloadedFrom) {
                        self.validate(schema, remoteSchema, function (err) {
                            if (err) {
                                report.errors = report.errors.concat(err.errors);
                            }
                            rv.resolve();
                        });
                    } else {
                        rv.resolve();
                    }
                });
                return rv.promise.then(finish);
            }
        } else {
            return finish();
        }
    };

    ZSchema.prototype._validateObject = function (report, schema, instance) {
        ZSchema.expect.object(schema);

        var self = this;

        var thisIsRoot = false;
        if (!report.rootSchema) {
            report.rootSchema = schema;
            thisIsRoot = true;
        }

        var maxRefs = 99;
        while (schema.$ref && maxRefs > 0) {
            if (schema.__$refResolved) {
                schema = schema.__$refResolved;
            } else {
                schema = Utils.resolveSchemaQuery(schema, report.rootSchema, schema.$ref, false, self.options.sync);
            }
            maxRefs--;
        }

        function step1(val, key) {
            if (InstanceValidators[key] !== undefined) {
                return InstanceValidators[key].call(self, report, schema, instance);
            }
        }

        function step2() {
            // Children calculations
            if (Utils.isArray(instance)) {
                return self._recurseArray(report, schema, instance);
            } else if (Utils.isObject(instance)) {
                return self._recurseObject(report, schema, instance);
            }
        }

        function step3() {
            if (thisIsRoot) {
                delete report.rootSchema;
            }
            return report;
        }

        if (this.options.sync) {
            Utils.forEach(schema, step1);
            step2();
            step3();
            self._lastError = report.toJSON();
            return report.isValid();
        } else {
            return Promise.all(Utils.map(schema, step1)).then(step2).then(step3);
        }
    };

    ZSchema.prototype._recurseArray = function (report, schema, instance) {
        // http://json-schema.org/latest/json-schema-validation.html#rfc.section.8.2

        var p, self = this;

        // If items is a schema, then the child instance must be valid against this schema,
        // regardless of its index, and regardless of the value of "additionalItems".
        if (Utils.isObject(schema.items)) {

            if (this.options.sync) {
                instance.forEach(function (val, index) {
                    report.goDown('[' + index + ']');
                    this._validateObject(report, schema.items, val);
                    report.goUp();
                }, this);
                return;
            } else {
                p = Promise.resolve();
                instance.forEach(function (val, index) {
                    p = p.then(function () {
                        report.goDown('[' + index + ']');
                        return self._validateObject(report, schema.items, val)
                            .then(function () {
                                report.goUp();
                            });
                    });
                });
                return p;
            }

        }

        // If "items" is an array, this situation, the schema depends on the index:
        // if the index is less than, or equal to, the size of "items",
        // the child instance must be valid against the corresponding schema in the "items" array;
        // otherwise, it must be valid against the schema defined by "additionalItems".
        if (Utils.isArray(schema.items)) {

            if (this.options.sync) {
                instance.forEach(function (val, index) {
                    // equal to doesnt make sense here
                    if (index < schema.items.length) {
                        report.goDown('[' + index + ']');
                        this._validateObject(report, schema.items[index], val);
                        report.goUp();
                    } else {
                        // might be boolean
                        if (Utils.isObject(schema.additionalItems)) {
                            report.goDown('[' + index + ']');
                            this._validateObject(report, schema.additionalItems, val);
                            report.goUp();
                        }
                    }
                }, this);
                return;
            } else {
                p = Promise.resolve();
                instance.forEach(function (val, index) {
                    p = p.then(function () {
                        // equal to doesnt make sense here
                        if (index < schema.items.length) {
                            report.goDown('[' + index + ']');
                            return self._validateObject(report, schema.items[index], val)
                                .then(function () {
                                    report.goUp();
                                });
                        } else {
                            // might be boolean
                            if (Utils.isObject(schema.additionalItems)) {
                                report.goDown('[' + index + ']');
                                return self._validateObject(report, schema.additionalItems, val)
                                    .then(function () {
                                        report.goUp();
                                    });
                            }
                        }
                    });
                });
                return p;
            }
        }
    };

    ZSchema.prototype._recurseObject = function (report, schema, instance) {
        // http://json-schema.org/latest/json-schema-validation.html#rfc.section.8.3

        var self = this;
        var promise = this.options.sync ? null : Promise.resolve();

        // If "additionalProperties" is absent, it is considered present with an empty schema as a value.
        // In addition, boolean value true is considered equivalent to an empty schema.
        var additionalProperties = schema.additionalProperties;
        if (additionalProperties === true || additionalProperties === undefined) {
            additionalProperties = {};
        }
        // p - The property set from "properties".
        var p = Object.keys(schema.properties || {});
        // pp - The property set from "patternProperties". Elements of this set will be called regexes for convenience.
        var pp = Object.keys(schema.patternProperties || {});
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
                if (this.options.sync) {
                    report.goDown(m);
                    this._validateObject(report, sch, propertyValue);
                    report.goUp();
                } else {
                    promise = promise.then(function () {
                        report.goDown(m);
                        return self._validateObject(report, sch, propertyValue)
                            .then(function () {
                                report.goUp();
                            });
                    });
                }
            }, this);
        }, this);

        return this.options.sync ? null : promise;
    };