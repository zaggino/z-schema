
    /***** Utility methods *****/

    var Utils = {
        isBoolean: function (what) {
            return typeof what === 'boolean';
        },
        isString: function (what) {
            return typeof what === 'string';
        },
        isInteger: function (what) {
            return Utils.isNumber(what) && what % 1 === 0;
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
                return "undefined";
            } else if (what === null) {
                return "null";
            } else if (Utils.isBoolean(what)) {
                return "boolean";
            } else if (Utils.isString(what)) {
                return "string";
            } else if (Utils.isArray(what)) {
                return "array";
            } else if (Utils.isInteger(what)) {
                return "integer";
            } else if (Utils.isNumber(what)) {
                return "number";
            } else if (Utils.isObject(what)) {
                return "object";
            } else if (Utils.isFunction(what)) {
                return "function";
            } else if (Number.isNaN(what)) {
                return "not-a-number";
            } else {
                throw new Error("Utils.whatIs does not know what Utils is: " + what);
            }
        },
        isUniqueArray: function (arr, match) {
            match = match || {};
            var i, j, l = arr.length;
            for (i = 0; i < l; i++) {
                for (j = i + 1; j < l; j++) {
                    if (Utils.areEqual(arr[i], arr[j])) {
                        match.index1 = i;
                        match.index2 = j;
                        return false;
                    }
                }
            }
            return true;
        },
        isAbsoluteUri: function (str) {
            return Utils.getRegExp('^https?\:\/\/').test(str);
        },
        forEach: function (obj, callback, context) {
            if (Array.isArray(obj)) {
                return obj.forEach(callback, context);
            } else if (Utils.isObject(obj)) {
                var key;
                for (key in obj) {
                    if (obj.hasOwnProperty(key)) {
                        callback.call(context, obj[key], key, context);
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
            if (Utils.isArray(json1) && Utils.isArray(json2)) {
                // have the same number of items; and
                if (json1.length !== json2.length) {
                    return false;
                }
                // items at the same index are equal according to Utils definition; or
                len = json1.length;
                for (i = 0; i < len; i++) {
                    if (!Utils.areEqual(json1[i], json2[i])) {
                        return false;
                    }
                }
                return true;
            }

            // both are objects, and:
            if (Utils.isObject(json1) && Utils.isObject(json2)) {
                // have the same set of property names; and
                var keys1 = Object.keys(json1);
                var keys2 = Object.keys(json2);
                if (!Utils.areEqual(keys1, keys2)) {
                    return false;
                }
                // values for a same property name are equal according to Utils definition.
                len = keys1.length;
                for (i = 0; i < len; i++) {
                    if (!Utils.areEqual(json1[keys1[i]], json2[keys1[i]])) {
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
            if (!Utils._getRegExpCache[pattern]) {
                Utils._getRegExpCache[pattern] = new RegExp(pattern);
            }
            return Utils._getRegExpCache[pattern];
        },
        _getRemoteSchemaCache: {},
        getRemoteSchema: function (urlWithQuery, callback) {
            var self = Utils,
                url = urlWithQuery.split('#')[0];

            function returnSchemaFromString(str, url) {
                var sch;

                try {
                    sch = JSON.parse(str);
                } catch (e) {
                    delete self._getRemoteSchemaCache[url];
                    throw new Error('Not a JSON data at: ' + url + ', ' + e);
                }

                // override in case of 'lying' schemas?
                if (!sch.id) {
                    sch.id = url;
                }
                if (!sch.$schema) {
                    sch.$schema = url;
                }
                sch.__$downloadedFrom = url;
                return callback ? callback(undefined, sch) : sch;
            }

            if (self._getRemoteSchemaCache[url]) {
                return returnSchemaFromString(self._getRemoteSchemaCache[url], url);
            }

            if (!callback) {
                // sync mode, checking in cache only
                return;
            }

            Utils.getUrl(url, function (error, response, body) {
                if (error) {
                    callback(error);
                    return;
                }
                returnSchemaFromString(self._getRemoteSchemaCache[url] = body, url);
            });
        },
        getUrl: function getUrl(url, callback) {
            if (typeof XMLHttpRequest != 'undefined') {
                var httpRequest = new XMLHttpRequest();
                httpRequest.open('GET', url, true);
                httpRequest.onload = function(){
                    if (httpRequest.status >= 200 && request.status < 400){
                        // Success!
                        callback(null, {}, request.responseText);
                    } else {
                        // We reached our target server, but it returned an error
                        callback(new Error('bad status: ' + httpRequest.status));
                    }
                };
            } else {
                request.get(url, callback);
            }
        },
        // query should be valid json pointer
        resolveSchemaQuery: function resolveSchemaQuery(schema, rootSchema, queryStr, allowNull, sync) {
            ZSchema.expect.string(queryStr);
            if (queryStr === '#') {
                return rootSchema;
            }

            var rv = null;
            var uriPart = queryStr.split('#')[0];
            var queryPart = queryStr.split('#')[1];

            if (uriPart) {
                if (uriPart.indexOf('http:') === 0 || uriPart.indexOf('https:') === 0) {
                    // remote
                    if (!rootSchema.__remotes || !rootSchema.__remotes[uriPart]) {
                        if (!sync) {
                            throw new Error('Remote is not downloaded: ' + uriPart);
                        } else {
                            throw new Error('Use .setRemoteReference to download references in sync mode: ' + uriPart);
                        }
                    }
                    rv = rootSchema.__remotes[uriPart];
                } else {
                    // it's a local ID
                    rv = Utils.resolveSchemaId(rootSchema, uriPart);
                }
            } else {
                rv = rootSchema;
            }

            // we have the schema and query to resolve in it
            if (rv && queryPart) {
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

            if (!rv && !allowNull) {
                throw new Error('Could not resolve schema reference: ' + queryStr);
            }

            return rv;
        },
        resolveSchemaId: function (schema, id) {
            if (!Utils.isObject(schema) && !Utils.isArray(schema)) {
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
        },
        
        compressSchema: function (schema) {
            var validator = new ZSchema({ sync: true });
            validator.validateSchema(schema);

            var report = new ZSchema.Report();
            if (validator.options.sync) {
                if (!schema.__$compiled) {
                    validator._compileSchema(report, schema);
                }
                if (!schema.__$validated) {
                    validator._validateSchema(report, schema);
                }
            }

            function _compress(value, key, context) {
                if (Utils.isObject(value)) {

                    if (value.hasOwnProperty('__$refResolved')) {
                        context[key] = value.__$refResolved;
                    }
                    else {
                        Utils.forEach(value, _compress, value);
                    }
                } else if (Utils.isArray(value)) {
                    Utils.forEach(value, _compress, value);
                }
            }

            Utils.forEach(schema, _compress, schema);
            return schema;
        }
    };