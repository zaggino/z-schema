/*jshint strict:false*/
/*global describe, before, it*/

var ZSchema = require('../src/ZSchema');
var assert = require('chai').assert;

describe('Factory', function () {

    describe('compress test', function () {

        var schema;

        before(function () {
            schema = JSON.parse(JSON.stringify(require('./factory/factorySchema.json')));
            schema = ZSchema.Utils.compressSchema(schema);
          //  console.log('schema: %s', JSON.stringify(schema, true, 4));
        });

        it('should have validator data ', function (done) {
            //  console.log('validated: %s', require('util').inspect(schema, {depth: 6}));
            assert.equal(schema.properties.options.items.properties.name.type, 'string', 'type of name is string');
            done();
        });
    });

    describe('Factory mapper', function () {

        describe('schema to factory', function () {

            var schema, factory, firstItem, secondItem, firstItemAfterReset, secondItemAfterReset;

            before(function () {
                schema = JSON.parse(JSON.stringify(require('./factory/factorySchema.json')));
                schema = ZSchema.Utils.compressSchema(schema);
                factory = new ZSchema.Factory(schema);

                factory.addHandler('name', function () {
                    return 'name_' + this.factory.index();
                }).addHandler('options/items/name', function (path, count) {
                        return 'option_' + count;
                    }).addHandler('options/items/value', 500)
                    .addHandler(/(purchases|shoppingCart)\/items/, function (path, count) {
                    return {
                        cost: this.factory.random(path + '#' + count, 1000000) / 100,
                        name: 'random_product_' + count
                    };
                });

                try {
                    firstItem = factory.create();
                    secondItem = factory.create();

                    factory.reset();

                    firstItemAfterReset = factory.create();
                    secondItemAfterReset = factory.create();
                } catch (err) {
                    console.log('ERROR IN CREATE: %s', require('util').inspect(err));
                }

            });

            it('should have default values', function (done) {
                assert.equal(firstItem.id, 100, 'id set to 100 by default');
                assert.equal(firstItem.name, 'name_0', 'name set to name_0');
                assert.equal(firstItem.options[2].name, 'option_2', 'name set to "option_0"');
                assert.equal(firstItem.options[2].value, 500, 'name set to 500');
                assert.equal(firstItem.options.length, 3, 'length is 3');
                done();
            });

            it('should have different values for name for secondItem', function (done) {
                assert.equal(secondItem.id, 100, 'id set to 100 by default');
                assert.equal(secondItem.name, 'name_1', 'name set to name_0');
                assert.equal(secondItem.options[2].name, 'option_2', 'name set to "option_0"');
                assert.equal(secondItem.options[2].value, 500, 'name set to 500');
                assert.equal(secondItem.options.length, 3, 'length is 3');

                assert.notDeepEqual(firstItem.purchases, secondItem.purchases, 'purchases change for each version');
                done();
            });

            it('should create identical objects after a reset if factory.random is used', function (done) {
                assert.deepEqual(firstItem, firstItemAfterReset, 'first item is same when created after reset');
                assert.deepEqual(secondItem, secondItemAfterReset, 'secondItem item is same when created after reset');
                done();
            });

        });
    });

});