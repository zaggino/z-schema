/*jshint strict:false*/
/*global describe, it*/

var zSchema = require('../src/ZSchema');
var assert = require('chai').assert;

zSchema.registerFormat('regex', function () {
    return true;
});

describe('Validations for API:', function () {

    this.timeout(10000);

    var compiledSchema = null;
    var schema = {
        '$ref': 'http://json-schema.org/draft-04/schema#'
    };

    var schemaDownloaded = {
        'id': 'http://json-schema.org/draft-04/schema#',
        '$schema': 'http://json-schema.org/draft-04/schema#',
        'description': 'Core schema meta-schema',
        'definitions': {
            'schemaArray': {
                'type': 'array',
                'minItems': 1,
                'items': {
                    '$ref': '#'
                }
            },
            'positiveInteger': {
                'type': 'integer',
                'minimum': 0
            },
            'positiveIntegerDefault0': {
                'allOf': [{
                    '$ref': '#/definitions/positiveInteger'
                }, {
                    'default': 0
                }]
            },
            'simpleTypes': {
                'enum': ['array', 'boolean', 'integer', 'null', 'number', 'object', 'string']
            },
            'stringArray': {
                'type': 'array',
                'items': {
                    'type': 'string'
                },
                'minItems': 1,
                'uniqueItems': true
            }
        },
        'type': 'object',
        'properties': {
            'id': {
                'type': 'string',
                'format': 'uri'
            },
            '$schema': {
                'type': 'string',
                'format': 'uri'
            },
            'title': {
                'type': 'string'
            },
            'description': {
                'type': 'string'
            },
            'default': {},
            'multipleOf': {
                'type': 'number',
                'minimum': 0,
                'exclusiveMinimum': true
            },
            'maximum': {
                'type': 'number'
            },
            'exclusiveMaximum': {
                'type': 'boolean',
                'default': false
            },
            'minimum': {
                'type': 'number'
            },
            'exclusiveMinimum': {
                'type': 'boolean',
                'default': false
            },
            'maxLength': {
                '$ref': '#/definitions/positiveInteger'
            },
            'minLength': {
                '$ref': '#/definitions/positiveIntegerDefault0'
            },
            'pattern': {
                'type': 'string',
                'format': 'regex'
            },
            'additionalItems': {
                'anyOf': [
                    {
                        'type': 'boolean'
                    },
                    {
                        '$ref': '#'
                    }
                ],
                'default': {}
            },
            'items': {
                'anyOf': [
                    {
                        '$ref': '#'
                    },
                    {
                        '$ref': '#/definitions/schemaArray'
                    }
                ],
                'default': {}
            },
            'maxItems': {
                '$ref': '#/definitions/positiveInteger'
            },
            'minItems': {
                '$ref': '#/definitions/positiveIntegerDefault0'
            },
            'uniqueItems': {
                'type': 'boolean',
                'default': false
            },
            'maxProperties': {
                '$ref': '#/definitions/positiveInteger'
            },
            'minProperties': {
                '$ref': '#/definitions/positiveIntegerDefault0'
            },
            'required': {
                '$ref': '#/definitions/stringArray'
            },
            'additionalProperties': {
                'anyOf': [
                    {
                        'type': 'boolean'
                    },
                    {
                        '$ref': '#'
                    }
                ],
                'default': {}
            },
            'definitions': {
                'type': 'object',
                'additionalProperties': {
                    '$ref': '#'
                },
                'default': {}
            },
            'properties': {
                'type': 'object',
                'additionalProperties': {
                    '$ref': '#'
                },
                'default': {}
            },
            'patternProperties': {
                'type': 'object',
                'additionalProperties': {
                    '$ref': '#'
                },
                'default': {}
            },
            'dependencies': {
                'type': 'object',
                'additionalProperties': {
                    'anyOf': [
                        {
                            '$ref': '#'
                        },
                        {
                            '$ref': '#/definitions/stringArray'
                        }
                    ]
                }
            },
            'enum': {
                'type': 'array',
                'minItems': 1,
                'uniqueItems': true
            },
            'type': {
                'anyOf': [
                    {
                        '$ref': '#/definitions/simpleTypes'
                    },
                    {
                        'type': 'array',
                        'items': {
                            '$ref': '#/definitions/simpleTypes'
                        },
                        'minItems': 1,
                        'uniqueItems': true
                    }
                ]
            },
            'allOf': {
                '$ref': '#/definitions/schemaArray'
            },
            'anyOf': {
                '$ref': '#/definitions/schemaArray'
            },
            'oneOf': {
                '$ref': '#/definitions/schemaArray'
            },
            'not': {
                '$ref': '#'
            }
        },
        'dependencies': {
            'exclusiveMaximum': ['maximum'],
            'exclusiveMinimum': ['minimum']
        },
        'default': {}
    };

    it('should compile official schema downloaded', function (done) {
        var ins = new zSchema();
        ins.compileSchema(schemaDownloaded, function (err, sch) {
            if (err) {
                console.error(err);
            }
            assert.isNull(err);
            compiledSchema = sch;
            done();
        });
    });
    it('should compile official schema', function (done) {
        var ins = new zSchema();
        ins.compileSchema(schema, function (err, sch) {
            assert.isNull(err);
            compiledSchema = sch;
            done();
        });
    });
    it('should return with resolved with promise for compiled schema #1', function (done) {
        var valid = {
            'type': 'string'
        };
        var ins = new zSchema();
        ins.validate(valid, compiledSchema)
            .then(function (report) {
                assert.isTrue(report.valid);
                done();
            })
            .done();
    });
    it('should return with rejected promise for compiled schema #2', function (done) {
        var valid = {
            'type': 'abrakadabra'
        };
        var ins = new zSchema();
        ins.validate(valid, compiledSchema)
            .fail(function (err) {
                assert.instanceOf(err, Error);
                done();
            })
            .done();
    });
    it('should return resolved promise for schema', function (done) {
        var sch = {
            'type': 'string'
        };
        var ins = new zSchema();
        ins.validate(sch, compiledSchema)
            .then(function (report) {
                assert.isTrue(report.valid);
                done();
            })
            .done();
    });
    it('should return rejected promise for schema', function (done) {
        var sch = {
            'type': null
        };
        var ins = new zSchema();
        ins.validate(sch, compiledSchema)
            .fail(function (err) {
                assert.instanceOf(err, Error);
                done();
            })
            .done();
    });
});
