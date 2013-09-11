/*global module*/

module.exports = function (grunt) {
    "use strict";

    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON("package.json"),
        uglify: {
            options: {
                banner: "/*! <%= pkg.name %> version <%= pkg.version %>, <%= grunt.template.today('yyyy-mm-dd') %> */\n",
                report: "min"
            },
            build: {
                src: "src/zSchema.js",
                dest: "src/zSchema.min.js"
            }
        },
        jshint: {
            all: ["src/zSchema.js"],
            jshintrc: ".jshintrc"
        }
    });

    // Load the plugin that provides the "uglify" task.
    grunt.loadNpmTasks("grunt-contrib-uglify");
    grunt.loadNpmTasks("grunt-contrib-jshint");

    // Default task(s).
    grunt.registerTask("default", ["jshint", "uglify"]);

};
