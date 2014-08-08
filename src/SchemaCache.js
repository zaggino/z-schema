"use strict";

var SchemaCompilation   = require("./SchemaCompilation");
var SchemaValidation    = require("./SchemaValidation");

var cache = {};

function decodeJSONPointer(str) {
    // http://tools.ietf.org/html/draft-ietf-appsawg-json-pointer-07#section-3
    return decodeURIComponent(str).replace(/~[0-1]/g, function (x) {
        return x === "~1" ? "/" : "~";
    });
}

function getRemotePath(uri) {
    var io = uri.indexOf("#");
    return io === -1 ? uri : uri.slice(0, io);
}

function getQueryPath(uri) {
    var io = uri.indexOf("#");
    var res = io === -1 ? undefined : uri.slice(io + 1);
    if (res && res[0] === "/") { res = res.slice(1); }
    return res;
}

exports.cacheSchemaByUri = function (uri, schema) {
    var remotePath = getRemotePath(uri);
    cache[remotePath] = schema;
};

exports.getSchemaByUri = function (report, uri, root) {
    var remotePath = getRemotePath(uri),
        queryPath = getQueryPath(uri),
        result = remotePath ? cache[remotePath] : root;

    if (result && remotePath) {
        // we need to avoid compiling schemas in a recursive loop
        var compileRemote = result !== root;
        // now we need to compile and validate resolved schema (in case it's not already)
        if (compileRemote) {
            report.path.push(remotePath);
            var ok = SchemaCompilation.compileSchema.call(this, report, result);
            if (ok) { ok = SchemaValidation.validateSchema.call(this, report, result); }
            report.path.pop();
            if (!ok) { return undefined; }
        }
    }

    if (result && queryPath) {
        var parts = queryPath.split("/");
        while (parts.length > 0) {
            var key = decodeJSONPointer(parts.shift());
            result = result[key];
        }
    }

    return result;
};
