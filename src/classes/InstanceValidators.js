
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
        items: function () { /*report, schema, instance*/
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
            var keysCount = Object.keys(instance).length;
            report.expect(keysCount <= schema.maxProperties, 'OBJECT_PROPERTIES_MAXIMUM', {count: keysCount, maximum: schema.maxProperties});
        },
        minProperties: function (report, schema, instance) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.4.2.2
            if (!Utils.isObject(instance)) {
                return;
            }
            var keysCount = Object.keys(instance).length;
            report.expect(keysCount >= schema.minProperties, 'OBJECT_PROPERTIES_MINIMUM', {count: keysCount, minimum: schema.minProperties});
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
        additionalProperties: function (report, schema) { /*instance*/
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
                var s = Object.keys(instance);
                // The property set from "properties".
                var p = Object.keys(properties);
                // The property set from "patternProperties".
                var pp = Object.keys(patternProperties);
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
        patternProperties: function (report, schema) { /*instance*/
            // covered in properties
            if (schema.properties === undefined) {
                return InstanceValidators.properties.apply(this, arguments);
            }
        },
        dependencies: function (report, schema, instance) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.4.5.2

            if (!Utils.isObject(instance)) {
                return;
            }

            var promiseArray = [];

            Utils.forEach(schema.dependencies, function (dependency, name) {
                if (instance[name] !== undefined) {
                    if (Utils.isObject(dependency)) {
                        // errors will be added to same report
                        promiseArray.push(this._validateObject(report, dependency, instance));
                    } else { // Array
                        Utils.forEach(dependency, function (requiredProp) {
                            report.expect(instance[requiredProp] !== undefined, 'OBJECT_DEPENDENCY_KEY', { missing: requiredProp, key: name });
                        });
                    }
                }
            }, this);

            return this.options.sync ? null : Promise.all(promiseArray);
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
            if (this.options.sync) {
                var i = schema.allOf.length;
                while (i--) {
                    // _validateObject returns isValid boolean
                    if (!this._validateObject(report, schema.allOf[i], instance)) { break; }
                }
            } else {
                var self = this;
                return Promise.all(schema.allOf.map(function (sch) {
                    return self._validateObject(report, sch, instance);
                }));
            }
        },
        anyOf: function (report, schema, instance) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.5.4.2
            var subReports = [];
            if (this.options.sync) {
                var passed = false,
                    i = schema.anyOf.length;
                while (i-- && !passed) {
                    var subReport = new Report(report);
                    subReports.push(subReport);
                    passed = this._validateObject(subReport, schema.anyOf[i], instance);
                }
                report.expect(passed, 'ANY_OF_MISSING', {}, subReports);
                return;
            } else {
                var self = this,
                    passes = 0,
                    p = Promise.resolve();
                schema.anyOf.forEach(function (anyOf) {
                    p = p.then(function () {
                        if (passes > 0) { return; }
                        var subReport = new Report(report);
                        return self._validateObject(subReport, anyOf, instance)
                            .then(function () {
                                if (subReport.isValid()) {
                                    passes++;
                                } else {
                                    subReports.push(subReport);
                                }
                            });
                    });
                });
                return p.then(function () {
                    report.expect(passes >= 1, 'ANY_OF_MISSING', {}, passes === 0 ? subReports : null);
                });
            }
        },
        oneOf: function (report, schema, instance) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.5.5.2
            var passes = 0;
            var subReports = [];

            function finish() {
                report.expect(passes > 0, 'ONE_OF_MISSING', {}, passes === 0 ? subReports : null);
                report.expect(passes < 2, 'ONE_OF_MULTIPLE');
            }

            if (this.options.sync) {
                var i = schema.oneOf.length;
                while (i--) {
                    var subReport = new Report(report);
                    subReports.push(subReport);
                    if (this._validateObject(subReport, schema.oneOf[i], instance)) {
                        passes++;
                    }
                }
                return finish();
            } else {
                var self = this;
                return Promise.all(schema.oneOf.map(function (oneOf) {
                    var subReport = new Report(report);
                    return self._validateObject(subReport, oneOf, instance)
                        .then(function () {
                            if (subReport.isValid()) {
                                passes++;
                            } else {
                                subReports.push(subReport);
                            }
                        });
                })).then(finish);
            }
        },
        not: function (report, schema, instance) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.5.6.2

            var subReport = new Report(report);

            function finish() {
                report.expect(!subReport.isValid(), 'NOT_PASSED');
            }

            if (this.options.sync) {
                this._validateObject(subReport, schema.not, instance);
                finish();
            } else {
                return this._validateObject(subReport, schema.not, instance).then(finish);
            }
        },
        definitions: function () { /*report, schema, instance*/
            //http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.5.7.2
            //none
        },
        format: function (report, schema, instance) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.7.2

            var p;

            if (typeof FormatValidators[schema.format] === 'function') { // built-in format (sync)
                report.expect(FormatValidators[schema.format](instance, this), 'FORMAT', {format: schema.format, error: instance});
                return;
            }

            // custom format was registered as sync function, so we can do some speedup
            if (CustomFormatValidators[schema.format].__$sync === true) {
                try {
                    p = CustomFormatValidators[schema.format](instance);
                    if (p !== true) {
                        report.addError('FORMAT', {format: schema.format});
                    }
                } catch (err) {
                    report.addError('FORMAT', {format: schema.format, error: err});
                }

                return;
            }

            // custom format (sync or async)
            var deferred = Promise.defer();

            try {
                p = CustomFormatValidators[schema.format](instance, deferred.callback);
                if (Promise.is(p) || Utils.isBoolean(p)) {
                    deferred.resolve(p);
                }
            } catch (e) {
                deferred.reject(e);
            }

            return deferred.promise
                .then(function (valid) { // validators may return (resolve with) true/false
                    if (!valid) {
                        report.addError('FORMAT', {format: schema.format});
                    }
                })
                .catch(function (err) { // validators may throw Error or return rejected promise
                    report.addError('FORMAT', {format: schema.format, error: err});
                });
        }
    };
