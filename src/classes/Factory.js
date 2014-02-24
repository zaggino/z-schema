    var _defaultFactoryOptions = {
        arraySize: 4,
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
            if (!this._randomGenerators) {
                this._randomGenerators = {};
            }

            if (!this._randomGenerators[seed]) {
                if (!Factory._rs) {
                    Factory._rs = require('random-seed');
                }

                this._randomGenerators[seed] = Factory._rs.create(seed);
            }
            return this._randomGenerators[seed](range);
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

        schemaSubItem: function (schemaNode, path) {
            var out = null;
            switch (schemaNode.type) {
                case 'object':
                    out = schemaNode.properties[path];
                    break;
            }
            return null;
        },

        /**
         *
         * @param schemaNode {object} the item being populated
         * @param path {[string]} the current place in the schema (optional);
         */

        create: function (schemaNode, path) {
            if (!schemaNode) {
                schemaNode = this.schema;
            }
            if (!path) {
                path = [];
            }

            var output;

            switch (schemaNode.type) {
                case 'object':
                    output = this.createSchemaObject(schemaNode, path);
                    break;

                case 'array':
                    output = this.createSchemaArray(schemaNode, path);
                    break;

                default:
                    console.log("cannot handle schema node type " + schemaNode.type);

            }

            ++this._count;
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
                } else if (definition.default) {
                    output[name] = definition.default;
                } else {
                    console.log('cannot handle ' + pattern);
                    output[name] = {};
                }

            });

            return output;
        },

        createSchemaArray: function (definition, pattern) {
            var handler = this.getPathHandler(pattern);
            var itemHandler = this.getPathHandler(pattern.concat(['items']));

            var minItems = definition.minItems || 0;
            var maxItems = definition.maxItems || minItems;
            var count = minItems;

            if (maxItems > minItems) {
                count += this.random(pattern + '.count', maxItems - minItems + 1);
            } else if (!minItems) {
                count += this.options.arraySize;
            }

            //  console.log('minItems: %s, maxItems: %s, count', minItems, maxItems, count);

            var out = [];
            if (handler) {
                out.push(handler.handle(pattern));
            } else {
                for (var i = 0; i < count; ++i) {
                    if (definition.items) {
                        if (itemHandler) {
                            out.push(itemHandler.handle(pattern, i));
                        } else {
                            var arrayItem = this.createSchemaObject(definition.items, pattern.concat(['items']), i);
                            out.push(arrayItem);
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