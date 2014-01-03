/*jshint strict:false*/
/*global describe, it*/

var ZSchema = require('../src/ZSchema');
var assert = require('chai').assert;

describe('Core validations:', function () {

    describe('JSON Schema primitive types:', function () {
        it('should validate array', function (done) {
            ZSchema.validate([], {
                'type': 'array'
            }, function (err, report) {
                if (err) {
                    console.log(err);
                }
                assert.isTrue(report.valid);
                done();
            });
        });
        it('should validate boolean', function (done) {
            ZSchema.validate(true, {
                'type': 'boolean'
            }, function (err, report) {
                if (err) {
                    console.log(err);
                }
                assert.isTrue(report.valid);
                done();
            });
        });
        it('should validate integer', function (done) {
            ZSchema.validate(5, {
                'type': 'integer'
            }, function (err, report) {
                if (err) {
                    console.log(err);
                }
                assert.isTrue(report.valid);
                done();
            });
        });
        it('should validate number', function (done) {
            ZSchema.validate(12.4, {
                'type': 'number'
            }, function (err, report) {
                if (err) {
                    console.log(err);
                }
                assert.isTrue(report.valid);
                done();
            });
        });
        it('should validate null', function (done) {
            ZSchema.validate(null, {
                'type': 'null'
            }, function (err, report) {
                if (err) {
                    console.log(err);
                }
                assert.isTrue(report.valid);
                done();
            });
        });
        it('should validate object', function (done) {
            ZSchema.validate({}, {
                'type': 'object'
            }, function (err, report) {
                if (err) {
                    console.log(err);
                }
                assert.isTrue(report.valid);
                done();
            });
        });
        it('should validate string', function (done) {
            ZSchema.validate('xxx', {
                'type': 'string'
            }, function (err, report) {
                if (err) {
                    console.log(err);
                }
                assert.isTrue(report.valid);
                done();
            });
        });
        it('should not validate array as null', function (done) {
            ZSchema.validate([], {
                'type': 'null'
            }, function (err) {
                assert.instanceOf(err, Error);
                done();
            });
        });
        it('should not validate boolean as null', function (done) {
            ZSchema.validate(false, {
                'type': 'null'
            }, function (err) {
                assert.instanceOf(err, Error);
                done();
            });
        });
        it('should not validate integer as null', function (done) {
            ZSchema.validate(0, {
                'type': 'null'
            }, function (err) {
                assert.instanceOf(err, Error);
                done();
            });
        });
        it('should not validate number as null', function (done) {
            ZSchema.validate(0.0, {
                'type': 'null'
            }, function (err) {
                assert.instanceOf(err, Error);
                done();
            });
        });
        it('should not validate null as object', function (done) {
            ZSchema.validate(null, {
                'type': 'object'
            }, function (err) {
                assert.instanceOf(err, Error);
                done();
            });
        });
        it('should not validate object as array', function (done) {
            ZSchema.validate({}, {
                'type': 'array'
            }, function (err) {
                assert.instanceOf(err, Error);
                done();
            });
        });
        it('should not validate string as null', function (done) {
            ZSchema.validate('', {
                'type': 'null'
            }, function (err) {
                assert.instanceOf(err, Error);
                done();
            });
        });
        it('should not confuse integer and number #1', function (done) {
            ZSchema.validate(5, {
                'type': 'integer'
            }, function (err, report) {
                assert.isTrue(report.valid);
                done();
            });
        });
        it('should not confuse integer and number #2', function (done) {
            ZSchema.validate(5.1, {
                'type': 'integer'
            }, function (err) {
                assert.instanceOf(err, Error);
                done();
            });
        });
        it('should not confuse integer and number #3', function (done) {
            ZSchema.validate(5, {
                'type': 'number'
            }, function (err, report) {
                assert.isTrue(report.valid);
                done();
            });
        });
        it('should not confuse integer and number #4', function (done) {
            ZSchema.validate(5.1, {
                'type': 'number'
            }, function (err, report) {
                assert.isTrue(report.valid);
                done();
            });
        });
        it('should accept arrays of types', function (done) {
            ZSchema.validate(null, {
                'type': ['array', 'boolean', 'integer', 'number', 'null', 'object', 'string']
            }, function (err, report) {
                if (err) {
                    console.log(err);
                }
                assert.isTrue(report.valid);
                done();
            });
        });
        it('should not ever accept function', function (done) {
            ZSchema.validate(function () {
                return 'validate me please';
            }, {
                'type': ['array', 'boolean', 'integer', 'number', 'null', 'object', 'string']
            }, function (err) {
                assert.instanceOf(err, Error);
                done();
            });
        });
        it('should not ever accept function #2', function (done) {
            ZSchema.validate(function () {
                return 'validate me please';
            }, {
                'type': ['function', 'array', 'boolean', 'integer', 'number', 'null', 'object', 'string']
            }, function (err) {
                assert.instanceOf(err, Error);
                done();
            });
        });
        it('should not ever accept function #3', function (done) {
            ZSchema.validate(function () {
                return 'validate me please';
            }, {
                'type': 'function'
            }, function (err) {
                assert.instanceOf(err, Error);
                done();
            });
        });
        it('should not accept NaN as integer', function (done) {
            ZSchema.validate(NaN, {
                'type': 'integer'
            }, function (err) {
                assert.instanceOf(err, Error);
                done();
            });
        });
        it('should not accept NaN as number', function (done) {
            ZSchema.validate(NaN, {
                'type': 'number'
            }, function (err) {
                assert.instanceOf(err, Error);
                done();
            });
        });
        it('should not accept long number as integer', function (done) {
            ZSchema.validate(1.000000000000001, {
                'type': 'integer'
            }, function (err) {
                assert.instanceOf(err, Error);
                done();
            });
        });
        it('should accept long number as number', function (done) {
            ZSchema.validate(1.000000000000001, {
                'type': 'number'
            }, function (err, report) {
                assert.isTrue(report.valid);
                done();
            });
        });
    });
});
