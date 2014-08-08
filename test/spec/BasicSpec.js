"use strict";

var ZSchema = require("../../src/ZSchema");

describe("Basic", function () {

    it("ZSchema should respond 'world' to hello()", function () {

        expect(ZSchema.hello()).toEqual("world");

    });

});
