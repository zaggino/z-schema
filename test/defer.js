/* global describe, before, it */

var assert = require('chai').assert;
var q = require('q');

describe('Core validations:', function () {

    it('should launch done', function (done) {
        var result = q(2);
        result = result.then(function (num) {
            var r = q.defer();

            setTimeout(function () {
                r.resolve(num - 1);
            }, 1);

            return r.promise;
        });
        result = result.then(function (num) {
            if (num === 1) {
                done();
            }
        });
    });

});