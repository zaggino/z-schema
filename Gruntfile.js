/*global module*/

module.exports = function (grunt) {
    "use strict";

    // Project configuration.
    grunt.initConfig({
            pkg:            grunt.file.readJSON("package.json"),
            concat:         {
                options: {
                    separator: "\n"
                },
                dist:    {
                    src:  [
                        "src/classes/prefix.js",
                        "src/classes/Utils.js",
                        "src/classes/Report.js",
                        "src/classes/ZSchema.js",
                        "src/classes/SchemaValidators.js",
                        "src/classes/ValidationErrors.js",
                        "src/classes/FormatValidators.js",
                        "src/classes/InstanceValidators.js",
                        "src/classes/Factory.js",
                        "src/classes/suffix.js"
                    ],
                    dest: "build/ZSchema.core.js"
                }
            },
            uglify:         {
                options: {
                    banner: "/*! <%= pkg.name %> version <%= pkg.version %> */\n",
                    report: "min",
                    mangle: false
                },
                build:   {
                    src:  "<%= pkg.files[0] %>",
                    dest: "<%= pkg.files[1] %>"
                }
            },
            jshint:         {
                all:     ["<%= pkg.files[0] %>", "test/*.js"],
                options: {
                    jshintrc: ".jshintrc"
                }
            },
            simplemocha:    {
                options: {
                    reporter: "dot"
                },
                all:     { src: ["test/*.js"] }
            },
            clean:          ["build/*"],
            umd:            {
                all: {
                    src:            "build/ZSchema.core.js",
                    dest:           "build/ZSchema.js", // optional, if missing the src will be used
                    template:       "src/umd_templates/umd.hbs", // if missing the templates/umd.hbs file will be used
                    objectToExport: "ZSchema", // optional, internal object that will be exported
                    amdModuleId:    "exports", // optional, if missing the AMD module will be anonymous
                    //  globalAlias:    "alias", // optional, changes the name of the global variable
                    indent:         "  ", // optional, indent source code
                    deps:           { // optional
                        "default": ["Promise", "request"],
                        amd:       ["bluebird", "request"],
                        cjs:       ["bluebird", "request"],
                        global:    ["Promise", "request"]
                    }
                }
            },
            "jsbeautifier": {
                files:   ["build/ZSchema.js"],
                options: {
                    dest: "build/beautified",
                    //  config: "path/to/configFile",
                    js: {
                        braceStyle:              "collapse",
                        breakChainedMethods:     false,
                        e4x:                     false,
                        evalCode:                false,
                        indentChar:              " ",
                        indentLevel:             0,
                        indentSize:              4,
                        indentWithTabs:          false,
                        jslintHappy:             true,
                        keepArrayIndentation:    false,
                        keepFunctionIndentation: false,
                        maxPreserveNewlines:     10,
                        preserveNewlines:        true,
                        spaceBeforeConditional:  true,
                        spaceInParen:            false,
                        unescapeStrings:         false,
                        wrapLineLength:          0
                    }
                }
            },
            "copy": {
                    "main": {
                            "files": [
                                {src: "build/beautified/build/ZSchema.js", dest: "src/ZSchema.js", flatten: true}
                            ]
                    }
            }
        }

    );

    // Load the plugin that provides the "uglify" task.
    grunt.loadNpmTasks("grunt-contrib-uglify");
    grunt.loadNpmTasks("grunt-contrib-jshint");
    grunt.loadNpmTasks("grunt-contrib-concat");
    grunt.loadNpmTasks("grunt-simple-mocha");
    grunt.loadNpmTasks("grunt-umd");
    grunt.loadNpmTasks("grunt-contrib-clean");
    grunt.loadNpmTasks("grunt-jsbeautifier");
    grunt.loadNpmTasks('grunt-contrib-copy');

    // Default task(s).
    var buildTasks = ["clean", "concat", "umd:all", "jsbeautifier", "copy:main", "jshint", "uglify"];
    grunt.registerTask("build", buildTasks);
    grunt.registerTask("default", buildTasks.concat(["simplemocha"]));
    grunt.registerTask("test",  buildTasks.concat(["simplemocha"])); // @TODO: a more direct path for testing

};
