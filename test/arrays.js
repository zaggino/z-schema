/*jshint strict:false*/
/*global describe, it*/

var ZSchema = require('../src/ZSchema');
var assert = require('chai').assert;

describe('Validations for array type:', function () {

    it('should accept items on arrays', function (done) {
        ZSchema.validate([], {
            'type': 'array',
            'items': []
        }, function (err, report) {
            if (err) {
                console.log(err);
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
        ZSchema.validate([], schemaFromSpecification, function (err, report) {
            if (err) {
                console.log(err);
            }
            assert.isTrue(report.valid);
            done();
        });
    });
    it('should pass example from specification #2', function (done) {
        ZSchema.validate([[1, 2, 3, 4], [5, 6, 7, 8]], schemaFromSpecification, function (err, report) {
            if (err) {
                console.log(err);
            }
            assert.isTrue(report.valid);
            done();
        });
    });
    it('should pass example from specification #3', function (done) {
        ZSchema.validate([1, 2, 3], schemaFromSpecification, function (err, report) {
            if (err) {
                console.log(err);
            }
            assert.isTrue(report.valid);
            done();
        });
    });
    it('should pass example from specification #4', function (done) {
        ZSchema.validate([1, 2, 3, 4], schemaFromSpecification, function (err) {
            assert.instanceOf(err, Error);
            done();
        });
    });
    it('should not pass example from specification', function (done) {
        var o = [null, {
                'a': 'b'
            },
            true, 31.000002020013];

        ZSchema.validate(o, schemaFromSpecification, function (err) {
            assert.instanceOf(err, Error);
            done();
        });
    });
    it('should pass maxItems', function (done) {
        ZSchema.validate([1, 2, 3], {
            'type': 'array',
            'maxItems': 3
        }, function (err, report) {
            assert.isTrue(report.valid);
            done();
        });
    });
    it('should not pass maxItems', function (done) {
        ZSchema.validate([1, 2, 3], {
            'type': 'array',
            'maxItems': 1
        }, function (err) {
            assert.instanceOf(err, Error);
            done();
        });
    });
    it('should pass minItems', function (done) {
        ZSchema.validate([1, 2, 3], {
            'type': 'array',
            'minItems': 3
        }, function (err, report) {
            assert.isTrue(report.valid);
            done();
        });
    });
    it('should not pass minItems', function (done) {
        ZSchema.validate([1, 2, 3], {
            'type': 'array',
            'minItems': 5
        }, function (err) {
            assert.instanceOf(err, Error);
            done();
        });
    });
    it('should pass uniqueItems', function (done) {
        ZSchema.validate([1, 2, 3], {
            'type': 'array',
            'uniqueItems': true
        }, function (err, report) {
            assert.isTrue(report.valid);
            done();
        });
    });
    it('should not pass uniqueItems', function (done) {
        ZSchema.validate([1, 1, 1], {
            'type': 'array',
            'uniqueItems': true
        }, function (err) {
            assert.instanceOf(err, Error);
            done();
        });
    });
    it('should not pass uniqueItems when order of elements is different in arrays #1', function (done) {
        ZSchema.validate([[1, 2], [2, 1]], {
            'type': 'array',
            'uniqueItems': true
        }, function (err, report) {
            assert.isTrue(report.valid);
            done();
        });
    });
    it('should not pass uniqueItems when order of elements is different in arrays #2', function (done) {
        ZSchema.validate([[1, 2], [1, 2]], {
            'type': 'array',
            'uniqueItems': true
        }, function (err) {
            assert.instanceOf(err, Error);
            done();
        });
    });
    it('should pass uniqueItems with objects #1', function (done) {
        var a = [{
                'x': 'x'
            }, {
                'x': 'y'
            }];

        ZSchema.validate(a, {
            'type': 'array',
            'uniqueItems': true
        }, function (err, report) {
            if (err) {
                console.log(err);
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
        ZSchema.validate(a, {
            'type': 'array',
            'uniqueItems': true
        }, function (err) {
            assert.instanceOf(err, Error);
            done();
        });
    });
});
