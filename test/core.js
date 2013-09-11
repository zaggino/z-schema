/* global describe, before, it */

var zSchema = require('../src/zSchema');
var assert = require('chai').assert;

describe('Core validations:', function () {

    describe('JSON Schema primitive types:', function () {
        it('should validate array', function (done) {
            zSchema.validate([], {
                'type': 'array'
            }, function (err, report) {
                if(err) {
                    console.log(err);
                }
                assert.isTrue(report.valid);
                done();
            });
        });
        it('should validate boolean', function (done) {
            zSchema.validate(true, {
                'type': 'boolean'
            }, function (err, report) {
                if(err) {
                    console.log(err);
                }
                assert.isTrue(report.valid);
                done();
            });
        });
        it('should validate integer', function (done) {
            zSchema.validate(5, {
                'type': 'integer'
            }, function (err, report) {
                if(err) {
                    console.log(err);
                }
                assert.isTrue(report.valid);
                done();
            });
        });
        it('should validate number', function (done) {
            zSchema.validate(12.4, {
                'type': 'number'
            }, function (err, report) {
                if(err) {
                    console.log(err);
                }
                assert.isTrue(report.valid);
                done();
            });
        });
        it('should validate null', function (done) {
            zSchema.validate(null, {
                'type': 'null'
            }, function (err, report) {
                if(err) {
                    console.log(err);
                }
                assert.isTrue(report.valid);
                done();
            });
        });
        it('should validate object', function (done) {
            zSchema.validate({}, {
                'type': 'object'
            }, function (err, report) {
                if(err) {
                    console.log(err);
                }
                assert.isTrue(report.valid);
                done();
            });
        });
        it('should validate string', function (done) {
            zSchema.validate('xxx', {
                'type': 'string'
            }, function (err, report) {
                if(err) {
                    console.log(err);
                }
                assert.isTrue(report.valid);
                done();
            });
        });
        it('should not validate array as null', function (done) {
            zSchema.validate([], {
                'type': 'null'
            }, function (err, report) {
                assert.instanceOf(err, Error);
                done();
            });
        });
        it('should not validate boolean as null', function (done) {
            zSchema.validate(false, {
                'type': 'null'
            }, function (err, report) {
                assert.instanceOf(err, Error);
                done();
            });
        });
        it('should not validate integer as null', function (done) {
            zSchema.validate(0, {
                'type': 'null'
            }, function (err, report) {
                assert.instanceOf(err, Error);
                done();
            });
        });
        it('should not validate number as null', function (done) {
            zSchema.validate(0.0, {
                'type': 'null'
            }, function (err, report) {
                assert.instanceOf(err, Error);
                done();
            });
        });
        it('should not validate null as object', function (done) {
            zSchema.validate(null, {
                'type': 'object'
            }, function (err, report) {
                assert.instanceOf(err, Error);
                done();
            });
        });
        it('should not validate object as array', function (done) {
            zSchema.validate({}, {
                'type': 'array'
            }, function (err, report) {
                assert.instanceOf(err, Error);
                done();
            });
        });
        it('should not validate string as null', function (done) {
            zSchema.validate('', {
                'type': 'null'
            }, function (err, report) {
                assert.instanceOf(err, Error);
                done();
            });
        });
        it('should not confuse integer and number #1', function (done) {
            zSchema.validate(5, {
                'type': 'integer'
            }, function (err, report) {
                assert.isTrue(report.valid);
                done();
            });
        });
        it('should not confuse integer and number #2', function (done) {
            zSchema.validate(5.1, {
                'type': 'integer'
            }, function (err, report) {
                assert.instanceOf(err, Error);
                done();
            });
        });
        it('should not confuse integer and number #3', function (done) {
            zSchema.validate(5, {
                'type': 'number'
            }, function (err, report) {
                assert.isTrue(report.valid);
                done();
            });
        });
        it('should not confuse integer and number #4', function (done) {
            zSchema.validate(5.1, {
                'type': 'number'
            }, function (err, report) {
                assert.isTrue(report.valid);
                done();
            });
        });
        it('should accept arrays of types', function (done) {
            zSchema.validate(null, {
                'type': ['array', 'boolean', 'integer', 'number', 'null', 'object', 'string']
            }, function (err, report) {
                if(err) {
                    console.log(err);
                }
                assert.isTrue(report.valid);
                done();
            });
        });
        it('should not ever accept function', function (done) {
            zSchema.validate(function () {
                return 'validate me please';
            }, {
                'type': ['array', 'boolean', 'integer', 'number', 'null', 'object', 'string']
            }, function (err, report) {
                assert.instanceOf(err, Error);
                done();
            });
        });
        it('should not ever accept function #2', function (done) {
            zSchema.validate(function () {
                return 'validate me please';
            }, {
                'type': ['function', 'array', 'boolean', 'integer', 'number', 'null', 'object', 'string']
            }, function (err, report) {
                assert.instanceOf(err, Error);
                done();
            });
        });
        it('should not ever accept function #3', function (done) {
            zSchema.validate(function () {
                return 'validate me please';
            }, {
                'type': 'function'
            }, function (err, report) {
                assert.instanceOf(err, Error);
                done();
            });
        });
        it('should not accept NaN as integer', function (done) {
            zSchema.validate(NaN, {
                'type': 'integer'
            }, function (err, report) {
                assert.instanceOf(err, Error);
                done();
            });
        });
        it('should not accept NaN as number', function (done) {
            zSchema.validate(NaN, {
                'type': 'number'
            }, function (err, report) {
                assert.instanceOf(err, Error);
                done();
            });
        });
        it('should not accept long number as integer', function (done) {
            zSchema.validate(1.000000000000001, {
                'type': 'integer'
            }, function (err, report) {
                assert.instanceOf(err, Error);
                done();
            });
        });
        it('should accept long number as number', function (done) {
            zSchema.validate(1.000000000000001, {
                'type': 'number'
            }, function (err, report) {
                assert.isTrue(report.valid);
                done();
            });
        });
    });

});