    var _defaultFactoryOptions = {
        arraySize:            4,
        showOptionalElements: 0 //a number from 0 to 1 -- pseudorandom for optional
    };

    function Factory(schema, options) {
        if (!options) {
            options = {};
        }
        this.schema = ZSchema.Utils.compressSchema(schema);
        this._count = 0;
        this._handlers = [];
        this.options = ZSchema.Utils.defaults(options, _defaultFactoryOptions);
    }

    Factory.prototype = {

        /**
         *
         * @param pattern {function|string|regex} determines whether this handler satisfies a given path
         * @param handler {function|value}
         */
        addHandler: function (pattern, handler) {
            var newHandler = new FactoryHandler(pattern, handler, this);
            this._handlers.push(newHandler);
            return this;
        },

        option: function (name, def) {
            if (arguments.length < 2) {
                def = null;
            }
            return this.options.hasOwnProperty(name) ? this.options[name] : def;
        },

        uhtStringLength: function () {
            var minStringLength = this.option('uhtStringLengthMin', 1);
            var maxStringLength = this.option('uhtStringLengthMax', 10);
            var range = maxStringLength - minStringLength;
            var count = this._randomGenerator('__unhandledType')(range);
            return (minStringLength + count);
        },

        _randomString: function () {
            return this._randomGenerator('__unhandledType').string(this.uhtStringLength());
        },

        _randomBoolean: function () {
            return Math.random() > 0.5;
        },

        _randomNumber: function (minNumber, maxNumber, sigDigits) {
            switch (arguments.length) {
                case 0:
                    minNumber = this.option('uhtNumberMin', -1000);
                    maxNumber = this.option('uhtNumberMax', 1000);
                    sigDigits = this.option('sigDigits', 4);
                    break;

                case 1:
                    maxNumber = this.option('uhtNumberMax');
                    sigDigits = this.option('sigDigits', 4);
                    break;

                case 2:
                    sigDigits = this.option('sigDigits', 4);
                    break;
            }

            var scale = Math.pow(10, sigDigits);

            var range = maxNumber - minNumber;

            return minNumber + this.random('__unhandledType', range * scale) / scale;
        },

        unhandledType: function (type) {
            var out;
            switch (type) {
                case 'string':
                    out = this._randomString();
                    break;

                case 'number':
                    out = this._randomNumber();
                    break;

                case 'boolean':
                    out = this._randomBoolean();
                    break;

                default:
                    out = {};
            }
            return out;
        },

        /**
         * generates a random number for a given seed.
         * //@TODO: tie with index.
         *
         * @param seed {string} a key for which random number generator is created
         * @param range {int} optional -- a random number range.
         * @returns {number}
         */
        random: function (seed, range) {
            if (!range) {
                range = this.options.arraySize;
            }

            return this._randomGenerator(seed)(range);
        },

        _randomGenerator: function (seed) {
            if (!this._randomGenerators) {
                this._randomGenerators = {};
            }

            if (!this._randomGenerators[seed]) {
                if (!Factory._rs) {
                    Factory._rs = require('random-seed');
                }

                this._randomGenerators[seed] = Factory._rs.create(seed);
            }

            return this._randomGenerators[seed];
        },

        reset: function () {
            this._count = 0;
            this._randomGenerators = {};
            Utils.forEach(this._handlers, function (handler) {
                handler.reset();
            }, this);
        },

        index: function () {
            return this._count;
        },

        getPathHandler: function (pattern) {
            for (var i = 0; i < this._handlers.length; ++i) {
                if (this._handlers[i].handles(pattern)) {
                    return this._handlers[i];
                }
            }
            return null;
        },

        /**
         *
         * @param schemaNode {object} the item being populated
         * @param path {[string]} the current place in the schema (optional);
         */

        create: function () {
            var out = this._create(this.schema, []);

            ++this._count;
            return out;
        },

        _create: function (definition, path) {

            if (!definition) {
                throw new Error('error in _create: no definition');
            }
            if (!path) {
                path = [];
            }

            var output;

            switch (definition.type) {
                case 'object':
                    output = this.createSchemaObject(definition, path);
                    break;

                case 'array':
                    output = this.createSchemaArray(definition, path);
                    break;

                case 'string':
                    output = this.createSchemaScalar(definition, path);
                    break;

                case 'number':
                    output = this.createSchemaScalar(definition, path);
                    break;

                //@TODO: handle primitive types

                default:
                    console.log("cannot handle schema node type " + definition.type);

            }

            return output;
        },

        createSchemaObject: function (definition, prefix, count) {
            var output = {};
            var self = this;

            //@TODO: handle required

            ZSchema.Utils.forEach(definition.properties, function (definition, name) {
                if (/^__\$/.test(name)) {
                    return;
                }

                var subPattern = prefix.concat([name]);
                var pattern = subPattern.join('/');
                var handler = self.getPathHandler(subPattern);

                if (handler) {
                    output[name] = handler.handle(subPattern, count);
                } else if (definition.type == 'array') {
                    output[name] = self.createSchemaArray(definition, subPattern);
                } else if (definition.hasOwnProperty('default')) {
                    output[name] = definition.default;
                } else {
                    console.log('cannot handle object property %s for pattern %s ', name, pattern);
                    output[name] = self.unhandledType(definition.type);
                }

            });

            return output;
        },

        createSchemaScalar: function (definition, path) {
            if (!definition) {
                throw new Error('no definition passed to createSchemaArray');
            }
            var handler = this.getPathHandler(path);

            if (handler) {
                return handler.handle(path);
            } else if (definition.default) {
                return definition.default;
            } else if (definition.type == 'string' && definition.enum) {
                return definition.enum[Math.floor(Math.random() * definition.enum.length)];
            } else {
                return this.unhandledType(definition.type);
            }
        },

        createSchemaArray: function (definition, pattern) {
            if (!definition) {
                throw new Error('no definition passed to createSchemaArray');
            }
            var handler = this.getPathHandler(pattern);
            var itemHandler = this.getPathHandler(pattern.concat(['items']));

            var minItems = definition.minItems || 0;
            var maxItems = definition.maxItems || minItems;

            //  console.log('minItems: %s, maxItems: %s, count', minItems, maxItems, count);

            var out = [];
            if (handler) {
                out = handler.handle(pattern);
            } else {
                if (definition.items && ZSchema.Utils.isArray(definition.items)) {
                    for (var d = 0; d < definition.items.length; ++d) {
                        var subDefinition = definition.items[d];
                        out.push(this._create(subDefinition, pattern.concat(['item'])));
                    }
                } else {
                    var count = minItems;

                    if (maxItems > minItems) {
                        count += this.random(pattern + '.count', maxItems - minItems + 1);
                    } else if (!minItems) {
                        count += this.options.arraySize;
                    }
                    for (var i = 0; i < count; ++i) {

                        if (itemHandler) {
                            out.push(itemHandler.handle(pattern, i));
                        } else if (definition.items) {
                            var arrayItem = this.createSchemaObject(definition.items, pattern.concat(['items']), i);
                            out.push(arrayItem);
                        } else if (definition.type) {
                            out.push(this.unhandledType(definition.type));
                        }
                    }
                }
            }

            return out;
        }
    };

    /**
     *
     * @param pattern {function|string|regex} determines whether this handler satisfies a given path
     * @param handler {function|value}
     * @param factory {Factory}
     * @constructor
     */
    function FactoryHandler(pattern, handler, factory) {

        this.pattern = pattern;
        this.handler = handler;
        this.factory = factory;
        this.memo = {}; // state memory
    }

    FactoryHandler.prototype = {

        handles: function (path, count) {
            if (ZSchema.Utils.isArray(path)) {
                path = path.join('/');
            }

            //  console.log('seeing if %s handles %s', require('util').inspect(this.pattern), path);
            if (ZSchema.Utils.isFunction(this.pattern)) {
                return this.pattern(path, count);
            } else if (ZSchema.Utils.isString(this.pattern)) {
                return this.pattern == path;
            } else if (this.pattern.test) {
                return this.pattern.test(path); // pattern can be a RegExp or an object with a test method
            } else {
                throw new Error('bad pattern');
            }
        },

        reset: function () {
            this.memo = {};
        },

        /**
         * generate a value for a given endpoint
         * @param path {string}
         * @param count {integer} (optional) the array index being set.
         * @returns {*}
         */
        handle: function (path, count) {

            //  console.log('handling %s, %s', path, count);
            if (ZSchema.Utils.isFunction(this.handler)) {
                return this.handler(path, count);
            } else if (ZSchema.Utils.isArray(this.handler)) {
                return this.handler[this.factory.index()]; //@TODO: check on double array for count?
            } else {
                return this.handler;
            }
        }

    };