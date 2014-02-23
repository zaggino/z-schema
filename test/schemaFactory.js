/*jshint strict:false*/
/*global describe, before, it*/

var ZSchema = require('../src/ZSchema');
var assert = require('chai').assert;

describe('Factory', function () {

    describe('compress test', function () {

        var schema;

        before(function () {
            schema = require('./factory/compress_test.json');
            schema = ZSchema.Utils.compressSchema(schema);
        });

        it('should have validator data ', function (done) {
            //console.log('validated: %s', require('util').inspect(schema, {depth: 6}));
            assert.equal(schema.properties.options.items.properties.name.type, 'string', 'type of name is string');
            done();
        });
    });

    describe('Factory mapper', function(){

        var schema;

        before(function () {
            schema = require('./factory/compress_test.json');
            schema = ZSchema.Utils.compressSchema(schema);
        });

    })

});