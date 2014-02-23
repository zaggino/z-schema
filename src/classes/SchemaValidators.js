
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
            if (!fine) { return; }
            report.expect(schema.multipleOf > 0, 'KEYWORD_MUST_BE', { keyword: 'multipleOf', expression: 'strictly greater than 0'});
        },
        maximum: function (report, schema) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.1.2.1
            report.expect(Utils.isNumber(schema.maximum), 'KEYWORD_TYPE_EXPECTED', {keyword: 'maximum', type: 'number'});
        },
        exclusiveMaximum: function (report, schema) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.1.2.1
            var fine = report.expect(Utils.isBoolean(schema.exclusiveMaximum),
                'KEYWORD_TYPE_EXPECTED', {keyword: 'exclusiveMaximum', type: 'boolean'});
            if (!fine) { return; }
            report.expect(schema.maximum !== undefined, 'KEYWORD_DEPENDENCY', {keyword1: 'exclusiveMaximum', keyword2: 'maximum'});
        },
        minimum: function (report, schema) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.1.3.1
            report.expect(Utils.isNumber(schema.minimum), 'KEYWORD_TYPE_EXPECTED', {keyword: 'minimum', type: 'number'});
        },
        exclusiveMinimum: function (report, schema) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.1.3.1
            var fine = report.expect(Utils.isBoolean(schema.exclusiveMinimum),
                'KEYWORD_TYPE_EXPECTED', {keyword: 'exclusiveMinimum', type: 'boolean'});
            if (!fine) { return; }
            report.expect(schema.minimum !== undefined, 'KEYWORD_DEPENDENCY', {keyword1: 'exclusiveMinimum', keyword2: 'minimum'});
        },
        maxLength: function (report, schema) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.2.1.1
            var fine = report.expect(Utils.isInteger(schema.maxLength), 'KEYWORD_TYPE_EXPECTED', {keyword: 'maxLength', type: 'integer'});
            if (!fine) { return; }
            report.expect(schema.maxLength >= 0, 'KEYWORD_MUST_BE', {keyword: 'maxLength', expression: 'greater than, or equal to 0'});
        },
        minLength: function (report, schema) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.2.2.1
            var fine = report.expect(Utils.isInteger(schema.minLength), 'KEYWORD_TYPE_EXPECTED', {keyword: 'minLength', type: 'integer'});
            if (!fine) { return; }
            report.expect(schema.minLength >= 0, 'KEYWORD_MUST_BE', {keyword: 'minLength', expression: 'greater than, or equal to 0'});
        },
        pattern: function (report, schema) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.2.3.1
            var fine = report.expect(Utils.isString(schema.pattern), 'KEYWORD_TYPE_EXPECTED', {keyword: 'pattern', type: 'string'});
            if (!fine) { return; }
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
            if (!fine) { return; }
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
            if (!fine) { return; }
            if (isObject) {
                report.goDown('items');
                this._validateSchema(report, schema.items);
                report.goUp();
            } else if (isArray) {
                schema.items.forEach(function (obj, index) {
                    report.goDown('items[' + index + ']');
                    self._validateSchema(report, obj);
                    report.goUp();
                });
            }
            // custom - strict mode
            if (this.options.forceAdditional === true) {
                report.expect(schema.additionalItems !== undefined, 'KEYWORD_UNDEFINED_STRICT', {keyword: 'additionalItems'});
            }
        },
        maxItems: function (report, schema) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.3.2.1
            var fine = report.expect(Utils.isInteger(schema.maxItems), 'KEYWORD_TYPE_EXPECTED', {keyword: 'maxItems', type: 'integer'});
            if (!fine) { return; }
            report.expect(schema.maxItems >= 0, 'KEYWORD_MUST_BE', {keyword: 'maxItems', expression: 'greater than, or equal to 0'});
        },
        minItems: function (report, schema) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.3.3.1
            var fine = report.expect(Utils.isInteger(schema.minItems), 'KEYWORD_TYPE_EXPECTED', {keyword: 'minItems', type: 'integer'});
            if (!fine) { return; }
            report.expect(schema.minItems >= 0, 'KEYWORD_MUST_BE', {keyword: 'minItems', expression: 'greater than, or equal to 0'});
        },
        uniqueItems: function (report, schema) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.3.4.1
            report.expect(Utils.isBoolean(schema.uniqueItems), 'KEYWORD_TYPE_EXPECTED', {keyword: 'uniqueItems', type: 'boolean'});
        },
        maxProperties: function (report, schema) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.4.1.1
            var fine = report.expect(Utils.isInteger(schema.maxProperties), 'KEYWORD_TYPE_EXPECTED', {keyword: 'maxProperties', type: 'integer'});
            if (!fine) { return; }
            report.expect(schema.maxProperties >= 0, 'KEYWORD_MUST_BE', {keyword: 'maxProperties', expression: 'greater than, or equal to 0'});
        },
        minProperties: function (report, schema) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.4.2.1
            var fine = report.expect(Utils.isInteger(schema.minProperties), 'KEYWORD_TYPE_EXPECTED', {keyword: 'minProperties', type: 'integer'});
            if (!fine) { return; }
            report.expect(schema.minProperties >= 0, 'KEYWORD_MUST_BE', {keyword: 'minProperties', expression: 'greater than, or equal to 0'});
        },
        required: function (report, schema) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.4.3.1
            var fine;
            fine = report.expect(Utils.isArray(schema.required), 'KEYWORD_TYPE_EXPECTED', {keyword: 'required', type: 'array'});
            if (!fine) { return; }
            fine = report.expect(schema.required.length > 0,
                'KEYWORD_MUST_BE', {keyword: 'required', expression: 'an array with at least one element'});
            if (!fine) { return; }
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
            if (!fine) { return; }
            if (isObject) {
                report.goDown('additionalProperties');
                this._validateSchema(report, schema.additionalProperties);
                report.goUp();
            }
        },
        properties: function (report, schema) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.4.4.1
            var self = this;

            var fine = report.expect(Utils.isObject(schema.properties), 'KEYWORD_TYPE_EXPECTED', {keyword: 'properties', type: 'object'});
            if (!fine) { return; }
            Utils.forEach(schema.properties, function (val, propName) {
                report.goDown('properties[' + propName + ']');
                self._validateSchema(report, val);
                report.goUp();
            });

            // custom - strict mode
            if (this.options.forceAdditional === true) {
                report.expect(schema.additionalProperties !== undefined, 'KEYWORD_UNDEFINED_STRICT', {keyword: 'additionalProperties'});
            }
        },
        patternProperties: function (report, schema) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.4.4.1
            var self = this;
            var fine = report.expect(Utils.isObject(schema.patternProperties),
                'KEYWORD_TYPE_EXPECTED', {keyword: 'patternProperties', type: 'object'});
            if (!fine) { return; }
            Utils.forEach(schema.patternProperties, function (val, propName) {
                try {
                    Utils.getRegExp(propName);
                } catch (e) {
                    report.addError('KEYWORD_PATTERN', {keyword: 'patternProperties', pattern: propName});
                }
                report.goDown('patternProperties[' + propName + ']');
                self._validateSchema(report, val);
                report.goUp();
            });
        },
        dependencies: function (report, schema) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.4.5.1

            var self = this;

            var fine = report.expect(Utils.isObject(schema.dependencies), 'KEYWORD_TYPE_EXPECTED', 'dependencies', 'object');
            if (!fine) { return; }
            Utils.forEach(schema.dependencies, function (schemaDependency, schemaKey) {

                var isObject = Utils.isObject(schemaDependency);
                var isArray = Utils.isArray(schemaDependency);
                report.expect(isObject || isArray, 'KEYWORD_VALUE_TYPE', {keyword: 'dependencies', type: 'object or array'});
                if (isObject) {
                    report.goDown('dependencies[' + schemaKey + ']');
                    self._validateSchema(report, schemaDependency);
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
            if (!fine) { return; }
            fine = report.expect(schema.enum.length > 0, 'KEYWORD_MUST_BE', {keyword: 'enum', expression: 'an array with at least one element'});
            if (!fine) { return; }
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
            if (!fine) { return; }
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
                    report.expect(schema.properties !== undefined || schema.patternProperties !== undefined,
                        'KEYWORD_UNDEFINED_STRICT', {keyword: 'properties'});
                }
            }
            if (this.options.forceItems === true) {
                if (schema.type === 'array' || isArray && schema.type.indexOf('array') !== -1) {
                    report.expect(schema.items !== undefined, 'KEYWORD_UNDEFINED_STRICT', {keyword: 'items'});
                }
            }
            if (this.options.forceMaxLength === true) {
                if (schema.type === 'string' || isArray && schema.type.indexOf('string') !== -1) {
                    report.expect(schema.maxLength !== undefined || schema.format !== undefined || schema.enum !== undefined,
                        'KEYWORD_UNDEFINED_STRICT', {keyword: 'maxLength'});
                }
            }
        },
        allOf: function (report, schema) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.5.3.1

            var self = this;

            var fine;
            fine = report.expect(Utils.isArray(schema.allOf), 'KEYWORD_TYPE_EXPECTED', {keyword: 'allOf', type: 'array'});
            if (!fine) { return; }
            fine = report.expect(schema.allOf.length > 0, 'KEYWORD_MUST_BE', {keyword: 'allOf', expression: 'an array with at least one element'});
            if (!fine) { return; }
            schema.allOf.forEach(function (sch, index) {
                report.goDown('allOf[' + index + ']');
                self._validateSchema(report, sch);
                report.goUp();
            });
        },
        anyOf: function (report, schema) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.5.4.1

            var self = this;

            var fine;
            fine = report.expect(Utils.isArray(schema.anyOf), 'KEYWORD_TYPE_EXPECTED', {keyword: 'anyOf', type: 'array'});
            if (!fine) { return; }
            fine = report.expect(schema.anyOf.length > 0, 'KEYWORD_MUST_BE', {keyword: 'anyOf', expression: 'an array with at least one element'});
            if (!fine) { return; }
            schema.anyOf.forEach(function (sch, index) {
                report.goDown('anyOf[' + index + ']');
                self._validateSchema(report, sch);
                report.goUp();
            });
        },
        oneOf: function (report, schema) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.5.5.1

            var self = this;

            var fine;
            fine = report.expect(Utils.isArray(schema.oneOf), 'KEYWORD_TYPE_EXPECTED', {keyword: 'oneOf', type: 'array'});
            if (!fine) { return; }
            fine = report.expect(schema.oneOf.length > 0, 'KEYWORD_MUST_BE', {keyword: 'oneOf', expression: 'an array with at least one element'});
            if (!fine) { return; }

            schema.oneOf.forEach(function (sch, index) {
                report.goDown('oneOf[' + index + ']');
                self._validateSchema(report, sch);
                report.goUp();
            });
        },
        not: function (report, schema) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.5.6.1
            var fine;
            fine = report.expect(Utils.isObject(schema.not), 'KEYWORD_TYPE_EXPECTED', {keyword: 'not', type: 'object'});
            if (!fine) { return; }
            report.goDown('not');
            this._validateSchema(report, schema.not);
            report.goUp();
        },
        definitions: function (report, schema) {
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.5.7.1
            var self = this;
            var fine;
            fine = report.expect(Utils.isObject(schema.definitions), 'KEYWORD_TYPE_EXPECTED', {keyword: 'definitions', type: 'object'});
            if (!fine) { return; }
            Utils.forEach(schema.definitions, function (obj, index) {
                report.goDown('definitions[' + index + ']');
                self._validateSchema(report, obj);
                report.goUp();
            });
        },
        format: function (report, schema) {
            var fine;
            fine = report.expect(Utils.isString(schema.format), 'KEYWORD_TYPE_EXPECTED', {keyword: 'format', type: 'string'});
            if (!fine) { return; }
            fine = report.expect(Utils.isFunction(FormatValidators[schema.format]) || Utils.isFunction(CustomFormatValidators[schema.format]),
                'UNKNOWN_FORMAT', {format: schema.format});
            if (!fine) { return; }
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
        'default': function () { /*report, schema*/
            // http://json-schema.org/latest/json-schema-validation.html#rfc.section.6.2
        },
        // ---- custom keys used by ZSchema
        __$compiled: function (report, schema) {
            ZSchema.expect.boolean(schema.__$compiled);
        },
        __$validated: function (report, schema) {
            ZSchema.expect.boolean(schema.__$validated);
        }
    };