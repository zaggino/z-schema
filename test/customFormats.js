/*jshint strict:false*/
/*global describe, it*/

var zSchema = require('../src/ZSchema');
var assert = require('chai').assert;
var Promise = require('bluebird');

describe('Custom format validators:', function () {
    zSchema.registerFormat('xstring', function (str) {
        return str === 'xxx';
    });

    zSchema.registerFormatSync('xstringSync', function (str) {
        return str === 'xxx';
    });

    zSchema.registerFormat('xstringAsyncPromise', function (str) {
        return Promise.delay(100).return(str === 'xxx');
    });

    zSchema.registerFormat('xstringAsyncCb', function (str, cb) {
        setTimeout(function () {
            cb(null, str === 'xxx');
        }, 100);
    });

    it('should pass sync format validation', function (done) {
        zSchema.validate('xxx', {
            'type': 'string',
            'format': 'xstring'
        }, function (err, report) {
            if (err) {
                console.log(err);
            }
            assert.isTrue(report.valid);
            done();
        });
    });

    it('should not pass sync format validation', function (done) {
        zSchema.validate('yyy', {
            'type': 'string',
            'format': 'xstring'
        }, function (err) {
            assert.instanceOf(err, Error);
            done();
        });
    });

    it('should pass forced sync format validation', function (done) {
        zSchema.validate('xxx', {
            'type': 'string',
            'format': 'xstringSync'
        }, function (err, report) {
            if (err) {
                console.log(err);
            }
            assert.isTrue(report.valid);
            done();
        });
    });

    it('should not pass forced sync format validation', function (done) {
        zSchema.validate('yyy', {
            'type': 'string',
            'format': 'xstringSync'
        }, function (err) {
            assert.instanceOf(err, Error);
            done();
        });
    });

    it('should pass async (promise) format validation', function (done) {
        zSchema.validate('xxx', {
            'type': 'string',
            'format': 'xstringAsyncPromise'
        }, function (err, report) {
            if (err) {
                console.log(err);
            }
            assert.isTrue(report.valid);
            done();
        });
    });

    it('should not pass async (promise) format validation', function (done) {
        zSchema.validate('yyy', {
            'type': 'string',
            'format': 'xstringAsyncPromise'
        }, function (err) {
            assert.instanceOf(err, Error);
            done();
        });
    });

    it('should pass async (callback) format validation', function (done) {
        zSchema.validate('xxx', {
            'type': 'string',
            'format': 'xstringAsyncCb'
        }, function (err, report) {
            if (err) {
                console.log(err);
            }
            assert.isTrue(report.valid);
            done();
        });
    });

    it('should not pass async (callback) format validation', function (done) {
        zSchema.validate('yyy', {
            'type': 'string',
            'format': 'xstringAsyncCb'
        }, function (err) {
            assert.instanceOf(err, Error);
            done();
        });
    });
});
