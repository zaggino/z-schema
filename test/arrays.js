/* global describe, before, it */

var zSchema = require('../src/zSchema');
var assert = require('chai').assert;

describe('Validations for array type:', function () {

    it('should accept items on arrays', function (done) {
        zSchema.validate([], {
            'type': 'array',
            'items': []
        }, function (report) {
            if (!report.valid) {
                console.log(report);
            }
            assert.isTrue(report.valid);
            done();
        });
    });
    var schemaFromSpecification = {
        'type': 'array',
        'items': [{}, {}, {}],
        'additionalItems': false
    };
    it('should pass example from specification #1', function (done) {
        zSchema.validate([], schemaFromSpecification, function (report) {
            if (!report.valid) {
                console.log(report);
            }
            assert.isTrue(report.valid);
            done();
        });
    });
    it('should pass example from specification #2', function (done) {
        zSchema.validate([[1, 2, 3, 4], [5, 6, 7, 8]], schemaFromSpecification, function (report) {
            if (!report.valid) {
                console.log(report);
            }
            assert.isTrue(report.valid);
            done();
        });
    });
    it('should pass example from specification #3', function (done) {
        zSchema.validate([1, 2, 3], schemaFromSpecification, function (report) {
            if (!report.valid) {
                console.log(report);
            }
            assert.isTrue(report.valid);
            done();
        });
    });
    it('should pass example from specification #4', function (done) {
        zSchema.validate([1, 2, 3, 4], schemaFromSpecification, function (report) {
            assert.isFalse(report.valid);
            done();
        });
    });
    it('should not pass example from specification', function (done) {
        var o = [null, {
                'a': 'b'
            },
            true, 31.000002020013];

        zSchema.validate(o, schemaFromSpecification, function (report) {
            assert.isFalse(report.valid);
            done();
        });
    });
    it('should pass maxItems', function (done) {
        zSchema.validate([1, 2, 3], {
            'type': 'array',
            'maxItems': 3
        }, function (report) {
            assert.isTrue(report.valid);
            done();
        });
    });
    it('should not pass maxItems', function (done) {
        zSchema.validate([1, 2, 3], {
            'type': 'array',
            'maxItems': 1
        }, function (report) {
            assert.isFalse(report.valid);
            done();
        });
    });
    it('should pass minItems', function (done) {
        zSchema.validate([1, 2, 3], {
            'type': 'array',
            'minItems': 3
        }, function (report) {
            assert.isTrue(report.valid);
            done();
        });
    });
    it('should not pass minItems', function (done) {
        zSchema.validate([1, 2, 3], {
            'type': 'array',
            'minItems': 5
        }, function (report) {
            assert.isFalse(report.valid);
            done();
        });
    });
    it('should pass uniqueItems', function (done) {
        zSchema.validate([1, 2, 3], {
            'type': 'array',
            'uniqueItems': true
        }, function (report) {
            assert.isTrue(report.valid);
            done();
        });
    });
    it('should not pass uniqueItems', function (done) {
        zSchema.validate([1, 1, 1], {
            'type': 'array',
            'uniqueItems': true
        }, function (report) {
            assert.isFalse(report.valid);
            done();
        });
    });
    it('should not pass uniqueItems when order of elements is different in arrays #1', function (done) {
        zSchema.validate([[1, 2], [2, 1]], {
            'type': 'array',
            'uniqueItems': true
        }, function (report) {
            assert.isTrue(report.valid);
            done();
        });
    });
    it('should not pass uniqueItems when order of elements is different in arrays #2', function (done) {
        zSchema.validate([[1, 2], [1, 2]], {
            'type': 'array',
            'uniqueItems': true
        }, function (report) {
            assert.isFalse(report.valid);
            done();
        });
    });
    it('should pass uniqueItems with objects #1', function (done) {
        var a = [{
                'x': 'x'
            }, {
                'x': 'y'
            }];

        zSchema.validate(a, {
            'type': 'array',
            'uniqueItems': true
        }, function (report) {
            if (!report.valid) {
                console.log(report);
            }
            assert.isTrue(report.valid);
            done();
        });
    });
    it('should pass uniqueItems with objects #2', function (done) {
        var a = [{
                'a': [1, 2]
            }, {
                'a': [1, 2]
            }];
        zSchema.validate(a, {
            'type': 'array',
            'uniqueItems': true
        }, function (report) {
            assert.isFalse(report.valid);
            done();
        });
    });
});