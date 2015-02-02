/*global require,module*/

var remapify = require("remapify");

module.exports = function (grunt) {

    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON("package.json"),
        lineending: {
            dist: {
                options: {
                    eol: "lf",
                    overwrite: true
                },
                files: {
                    "": [
                        "Gruntfile.js",
                        "bin/**/*",
                        "src/**/*.js",
                        "test/**/*.js"
                    ]
                }
            }
        },
        jshint: {
            all: ["*.js", "bin/**/*", "src/**/*.js", "test/spec/**/*.js"],
            options: {
                jshintrc: ".jshintrc"
            }
        },
        jscs: {
            src: ["*.js", "src/**/*.js", "test/spec/**/*.js"],
            options: {
                config: ".jscs.json"
            }
        },
        "jasmine_node": {
            projectRoot: "test/spec/"
        },
        browserify: {
            src: {
                src: ["src/**/*.js"],
                dest: "dist/ZSchema-browser.js",
                options: {
                    preBundleCB: function (b) {
                        b.plugin(remapify, [
                            {
                                src: "src/ZSchema.js",
                                expose: "ZSchema"
                            }
                        ]);
                    },
                    browserifyOptions: {
                        standalone: "ZSchema"
                    }
                }
            },
            test: {
                src: ["test/spec/**/*.js"],
                dest: "dist/ZSchema-browser-test.js"
            }
        },
        jasmine: {
            src: "dist/ZSchema-browser.js",
            options: {
                specs: "dist/ZSchema-browser-test.js"
            }
        },
        uglify: {
            src: {
                files: {
                    "dist/ZSchema-browser-min.js": ["dist/ZSchema-browser.js"]
                },
                options: {
                    sourceMap: true
                }
            }
        }
    });

    // Load the plugin that provides the "uglify" task.
    grunt.loadNpmTasks("grunt-lineending");
    grunt.loadNpmTasks("grunt-contrib-jshint");
    grunt.loadNpmTasks("grunt-jscs");
    grunt.loadNpmTasks("grunt-jasmine-node");
    grunt.loadNpmTasks("grunt-browserify");
    grunt.loadNpmTasks("grunt-contrib-jasmine");
    grunt.loadNpmTasks("grunt-contrib-uglify");

    // Default task(s).
    grunt.registerTask("default", ["lineending", "jshint", "jscs", "jasmine_node", "browserify", "jasmine", "uglify"]);
    grunt.registerTask("test", ["jasmine_node"]);

};
