/*jshint strict:false*/
/*global describe, it*/

var ZSchema = require('../src/ZSchema');
var assert = require('chai').assert;

describe('Validations for numeric type:', function () {

    it('should accept multipleOf', function (done) {
        ZSchema.validate(10, {
            'type': 'number',
            'multipleOf': 5
        }, function (err, report) {
            if (err) {
                console.log(err);
            }
            assert.isTrue(report.valid);
            done();
        });
    });
    it('should fail if multipleOf is 0 or lower #1', function (done) {
        ZSchema.validate(10, {
            'type': 'number',
            'multipleOf': 0
        }, function (err) {
            assert.instanceOf(err, Error);
            done();
        });
    });
    it('should fail if multipleOf is 0 or lower #2', function (done) {
        ZSchema.validate(10, {
            'type': 'number',
            'multipleOf': -10
        }, function (err) {
            assert.instanceOf(err, Error);
            done();
        });
    });
    it('should fail if multipleOf is not a number', function (done) {
        ZSchema.validate('test', {
            'type': 'string',
            'multipleOf': 'xxx'
        }, function (err) {
            assert.instanceOf(err, Error);
            done();
        });
    });
    it('10 should be multiple of 5', function (done) {
        ZSchema.validate(10, {
            'type': 'number',
            'multipleOf': 5
        }, function (err, report) {
            if (err) {
                console.log(err);
            }
            assert.isTrue(report.valid);
            done();
        });
    });
    it('12 should not be multiple of 5', function (done) {
        ZSchema.validate(12, {
            'type': 'number',
            'multipleOf': 5
        }, function (err) {
            assert.instanceOf(err, Error);
            done();
        });
    });
    it('maximum should be json number #1', function (done) {
        ZSchema.validate(5, {
            'type': 'number',
            'maximum': 6
        }, function (err, report) {
            if (err) {
                console.log(err);
            }
            assert.isTrue(report.valid);
            done();
        });
    });
    it('maximum should be json number #2', function (done) {
        ZSchema.validate(5, {
            'type': 'number',
            'maximum': '6'
        }, function (err) {
            assert.instanceOf(err, Error);
            done();
        });
    });
    it('exclusiveMaximum should be boolean #1', function (done) {
        ZSchema.validate(-1, {
            'type': 'number',
            'maximum': 0,
            'exclusiveMaximum': true
        }, function (err, report) {
            if (err) {
                console.log(err);
            }
            assert.isTrue(report.valid);
            done();
        });
    });
    it('exclusiveMaximum should be boolean #2', function (done) {
        ZSchema.validate(5, {
            'type': 'number',
            'exclusiveMaximum': 4
        }, function (err) {
            assert.instanceOf(err, Error);
            done();
        });
    });
    it('few tests for maximum #1', function (done) {
        ZSchema.validate(0, {
            'type': 'number',
            'maximum': 0
        }, function (err, report) {
            if (err) {
                console.log(err);
            }
            assert.isTrue(report.valid);
            done();
        });
    });
    it('few tests for maximum #2', function (done) {
        ZSchema.validate(0, {
            'type': 'number',
            'maximum': 0,
            'exclusiveMaximum': true
        }, function (err) {
            assert.instanceOf(err, Error);
            done();
        });
    });
    it('few tests for maximum #3', function (done) {
        ZSchema.validate(0, {
            'type': 'number',
            'maximum': 0,
            'exclusiveMaximum': false
        }, function (err, report) {
            assert.isTrue(report.valid);
            done();
        });
    });
    it('few tests for maximum #4', function (done) {
        ZSchema.validate(1.001, {
            'type': 'number',
            'maximum': 1,
            'exclusiveMaximum': true
        }, function (err) {
            assert.instanceOf(err, Error);
            done();
        });
    });
    it('few tests for maximum #5', function (done) {
        ZSchema.validate(0, {
            'type': 'number',
            'maximum': 1,
            'exclusiveMaximum': true
        }, function (err, report) {
            assert.isTrue(report.valid);
            done();
        });
    });
    it('minimum should be json number #1', function (done) {
        ZSchema.validate(6, {
            'type': 'number',
            'minimum': 6
        }, function (err, report) {
            assert.isTrue(report.valid);
            done();
        });
    });
    it('minimum should be json number #2', function (done) {
        ZSchema.validate(5, {
            'type': 'number',
            'minimum': '6'
        }, function (err) {
            assert.instanceOf(err, Error);
            done();
        });
    });
    it('exclusiveMinimum should be boolean #1', function (done) {
        ZSchema.validate(1, {
            'type': 'number',
            'minimum': 0,
            'exclusiveMinimum': true
        }, function (err, report) {
            if (err) {
                console.log(err);
            }
            assert.isTrue(report.valid);
            done();
        });
    });
    it('exclusiveMinimum should be boolean #2', function (done) {
        ZSchema.validate(5, {
            'type': 'number',
            'minimum': 0,
            'exclusiveMinimum': 4
        }, function (err) {
            assert.instanceOf(err, Error);
            done();
        });
    });
    it('few tests for minimum #1', function (done) {
        ZSchema.validate(0, {
            'type': 'number',
            'minimum': 0
        }, function (err, report) {
            if (err) {
                console.log(err);
            }
            assert.isTrue(report.valid);
            done();
        });
    });
    it('few tests for minimum #2', function (done) {
        ZSchema.validate(-0.1, {
            'type': 'number',
            'minimum': 0,
            'exclusiveMinimum': true
        }, function (err) {
            assert.instanceOf(err, Error);
            done();
        });
    });
    it('few tests for minimum #3', function (done) {
        ZSchema.validate(0, {
            'type': 'number',
            'minimum': 0,
            'exclusiveMinimum': false
        }, function (err, report) {
            if (err) {
                console.log(err);
            }
            assert.isTrue(report.valid);
            done();
        });
    });
    it('few tests for minimum #4', function (done) {
        ZSchema.validate(1, {
            'type': 'number',
            'minimum': 1,
            'exclusiveMinimum': true
        }, function (err) {
            assert.instanceOf(err, Error);
            done();
        });
    });
    it('few tests for minimum #5', function (done) {
        ZSchema.validate(1.5, {
            'type': 'number',
            'minimum': 1,
            'exclusiveMinimum': true
        }, function (err, report) {
            if (err) {
                console.log(report);
            }
            assert.isTrue(report.valid);
            done();
        });
    });
});
