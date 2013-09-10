/* global describe, before, it */

var zSchema = require('../src/zSchema');
var assert = require('chai').assert;

describe('Validations for referencing children:', function () {

    it('should not pass deep validation on array', function (done) {
        zSchema.validate([1, 2, 3], {
            'type': 'array',
            'items': {
                'type': 'string'
            }
        }, function (err, report) {
            assert.instanceOf(err, Error);
            done();
        });
    });

    it('should pass deep validation on array', function (done) {
        zSchema.validate([1, 2, 3, null], {
            'type': 'array',
            'items': [
                {
                    'type': 'number'
                },
                {
                    'type': 'number'
                },
                {
                    'type': 'number'
                }
            ],
            'additionalItems': {
                'type': 'null'
            }
        }, function (err, report) {
            if(err) {
                console.log(err);
            }
            assert.isTrue(report.valid);
            done();
        });
    });

    it('should pass deep validation on object', function (done) {
        zSchema.validate({
            'x': 1,
            'y': 2,
            'z': 3
        }, {
            'type': 'object',
            'properties': {
                'x': {
                    type: 'number'
                },
                'y': {
                    type: 'integer'
                }
            },
            'patternProperties': {
                'z': {}
            },
            'additionalProperties': false
        }, function (err, report) {
            if(err) {
                console.log(err);
            }
            assert.isTrue(report.valid);
            done();
        });
    });

    it('should pass resolving of definition #1', function (done) {
        zSchema.validate(5, {
            'definitions': {
                'myNumber': {
                    'type': 'number'
                }
            },
            'not': {
                '$ref': '#/definitions/myNumber'
            }
        }, function (err, report) {
            assert.instanceOf(err, Error);
            done();
        });
    });

    it('should pass resolving of definition #2', function (done) {
        var o = {
            'level1': 5
        };

        zSchema.validate(o, {
            'definitions': {
                'myNumber': {
                    'type': 'object',
                    'properties': {
                        'level1': {
                            'type': 'string'
                        }
                    },
                    'additionalProperties': false
                }
            },
            '$ref': '#/definitions/myNumber'
        }, function (err, report) {
            assert.instanceOf(err, Error);
            assert.isTrue(new RegExp('level1').test(err.errors[0].path));
            done();
        });
    });

    it('should pass resolving of definition #3', function (done) {
        var o = [
            {
                obj1: 'sss'
            },
            {
                obj2: 5
            }
        ];

        zSchema.validate(o, {
            'definitions': {
                'myObject': {
                    'type': 'object',
                    'properties': {
                        'obj1': {
                            'type': 'string'
                        }
                    },
                    'additionalProperties': false
                },
                'myObject2': {
                    'type': 'object',
                    'properties': {
                        'obj2': {
                            'type': 'number'
                        }
                    },
                    'additionalProperties': false
                }
            },
            'type': 'array',
            'items': [
                {
                    '$ref': '#/definitions/myObject'
                },
                {
                    '$ref': '#/definitions/myObject2'
                }
            ]

        }, function (err, report) {
            if(err) {
                console.log(err);
            }
            assert.isTrue(report.valid);
            done();
        });
    });

    it('should pass resolving of definition #4', function (done) {
        var o = [
            {
                obj1: 'sss'
            },
            {
                obj2: {
                    obj1: 4
                }
            }
        ];

        zSchema.validate(o, {
            'definitions': {
                'myObject': {
                    'type': 'object',
                    'properties': {
                        'obj1': {
                            'type': 'string'
                        }
                    },
                    'additionalProperties': false
                },
                'myObject2': {
                    'type': 'object',
                    'properties': {
                        'obj2': {
                            '$ref': '#/definitions/myObject'
                        }
                    },
                    'additionalProperties': false
                }
            },
            'type': 'array',
            'items': [
                {
                    '$ref': '#/definitions/myObject'
                },
                {
                    '$ref': '#/definitions/myObject2'
                }
            ]

        }, function (err, report) {
            assert.isTrue(new RegExp('/obj2/obj1').test(err.errors[0].path));
            assert.instanceOf(err, Error);
            done();
        });
    });

    it('should pass resolving of definition by id', function (done) {
        var o = [
            {
                obj1: 'sss'
            },
            {
                obj2: {
                    obj1: 4
                }
            }
        ];

        zSchema.validate(o, {
            'definitions': {
                'myObject': {
                    'id': '#foo',
                    'type': 'object',
                    'properties': {
                        'obj1': {
                            'type': 'string'
                        }
                    },
                    'additionalProperties': false
                },
                'myObject2': {
                    'type': 'object',
                    'properties': {
                        'obj2': {
                            '$ref': '#foo'
                        }
                    },
                    'additionalProperties': false
                }
            },
            'type': 'array',
            'items': [
                {
                    '$ref': '#/definitions/myObject'
                },
                {
                    '$ref': '#/definitions/myObject2'
                }
            ]

        }, function (err, report) {
            // if(err) { console.log(err); }
            assert.instanceOf(err, Error);
            done();
        });
    });

});