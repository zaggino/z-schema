/*jshint strict:false, loopfunc:true*/
/*global describe, it*/

// this is to test that schemas from http://json-schema.org/example2.html validate

var ZSchema = require("../src/ZSchema");
var assert = require("chai").assert;

describe("Schemas from http://json-schema.org/example2.html:", function () {

    var sampleObject = {
        "/": {
            "storage": {
                "type": "disk",
                "device": "/dev/sda1"
            },
            "fstype": "btrfs",
            "readonly": true
        },
        "/var": {
            "storage": {
                "type": "disk",
                "label": "8f3ba6f4-5c70-46ec-83af-0d5434953e5f"
            },
            "fstype": "ext4",
            "options": ["nosuid"]
        },
        "/tmp": {
            "storage": {
                "type": "tmpfs",
                "sizeInMB": 64
            }
        },
        "/var/www": {
            "storage": {
                "type": "nfs",
                "server": "my.nfs.server",
                "remotePath": "/exports/mypath"
            }
        }
    };

    var rootSchema = {
        "$schema": "http://json-schema.org/draft-04/schema#",
        "type": "object",
        "properties": {
            "/": {}
        },
        "patternProperties": {
            "^(/[^/]+)+$": {}
        },
        "additionalProperties": false,
        "required": ["/"]
    };

    var keySchema = {
        // "id": "http://some.site.somewhere/entry-schema#", (invalid ID so commented out)
        "$schema": "http://json-schema.org/draft-04/schema#",
        "description": "schema for an fstab entry",
        "type": "object",
        "required": ["storage"],
        "properties": {
            "storage": {
                "type": "object",
                "oneOf": [
                    {
                        "$ref": "#/definitions/diskDevice"
                    },
                    {
                        "$ref": "#/definitions/diskUUID"
                    },
                    {
                        "$ref": "#/definitions/nfs"
                    },
                    {
                        "$ref": "#/definitions/tmpfs"
                    }
                ]
            },
            "fstype": {
                "enum": ["ext3", "ext4", "btrfs"]
            },
            "options": {
                "type": "array",
                "minItems": 1,
                "items": {
                    "type": "string"
                },
                "uniqueItems": true
            },
            "readonly": {
                "type": "boolean"
            }
        },
        "definitions": {
            "diskDevice": {
                "properties": {
                    "type": {
                        "enum": ["disk"]
                    },
                    "device": {
                        "type": "string",
                        "pattern": "^/dev/[^/]+(/[^/]+)*$"
                    }
                },
                "required": ["type", "device"],
                "additionalProperties": false
            },
            "diskUUID": {
                "properties": {
                    "type": {
                        "enum": ["disk"]
                    },
                    "label": {
                        "type": "string",
                        "pattern": "^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$"
                    }
                },
                "required": ["type", "label"],
                "additionalProperties": false
            },
            "nfs": {
                "properties": {
                    "type": {
                        "enum": ["nfs"]
                    },
                    "remotePath": {
                        "type": "string",
                        "pattern": "^(/[^/]+)+$"
                    },
                    "server": {
                        "type": "string",
                        "oneOf": [
                            {
                                "format": "host-name"
                            },
                            {
                                "format": "ipv4"
                            },
                            {
                                "format": "ipv6"
                            }
                        ]
                    }
                },
                "required": ["type", "server", "remotePath"],
                "additionalProperties": false
            },
            "tmpfs": {
                "properties": {
                    "type": {
                        "enum": ["tmpfs"]
                    },
                    "sizeInMB": {
                        "type": "integer",
                        "minimum": 16,
                        "maximum": 512
                    }
                },
                "required": ["type", "sizeInMB"],
                "additionalProperties": false
            }
        }
    };

    it("Validate rootSchema", function (done) {
        var validator = new ZSchema();
        validator.validateSchema(rootSchema).then(function (report) {
            assert.isTrue(report.valid);
            done();
        }).fail(function (err) {
            console.log(err);
            assert.isTrue(false);
            done();
        });
    });

    it("Validate keySchema", function (done) {
        var validator = new ZSchema();
        validator.validateSchema(keySchema).then(function (report) {
            assert.isTrue(report.valid);
            done();
        }).fail(function (err) {
            console.log(err);
            assert.isTrue(false);
            done();
        });
    });

    it("Validate whole sample object against rootSchema", function (done) {
        var validator = new ZSchema();
        validator.validate(sampleObject, rootSchema).then(function () {
            done();
        }).fail(function (err) {
            console.log(err);
        });
    });

    it("Validate every key of sample object against keySchema", function (done) {
        var validator = new ZSchema(),
            total = 0,
            passed = 0,
            key;
        for (key in sampleObject) {
            total++;
        }
        for (key in sampleObject) {
            validator.validate(sampleObject[key], keySchema).then(function () {
                passed++;
                if (passed === total) { done(); }
            }).fail(function (err) {
                console.log(err);
            });
        }
    });

});
