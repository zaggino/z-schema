"use strict";
var ref1 = "http://www.example.org/schema1/#";
var ref2 = "http://www.example.org/schema2/#";

var schema1 = {
  "$schema": "http://json-schema.org/draft-04/schema#",
  "id": ref1,
  "properties": {
    "prop1": {
      "$ref": ref2
    }
  }
};

var schema2 = {
  "$schema": "http://json-schema.org/draft-04/schema#",
  "id": ref2,
  "properties": {
    "prop1": {
      "$ref": ref1
    }
  }
};

module.exports = {
  description: "Issue #47 - references to draft4 subschema are not working",
  setup: function (validator) {
    validator.setRemoteReference(ref1, schema1);
    validator.setRemoteReference(ref2, schema2);
  },
  tests: [
    {
      description: "should pass validation #1",
      schema: schema1,
      data: {},
      valid: true
    }
  ]
};