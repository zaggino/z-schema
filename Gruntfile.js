/*global module*/

module.exports = function (grunt) {
    "use strict";

    // Project configuration.
    grunt.initConfig({
        pkg:         grunt.file.readJSON("package.json"),
        concat:      {
            options: {
                separator: "\n"
            },
            dist:    {
                src:  [
                    'src/classes/prefix.js',
                    'src/classes/Utils.js',
                    'src/classes/Report.js',
                    'src/classes/ZSchema.js',
                    'src/classes/SchemaValidators.js',
                    'src/classes/ValidationErrors.js',
                    'src/classes/FormatValidators.js',
                    'src/classes/InstanceValidators.js',
                    'src/classes/Factory.js',
                    'src/classes/suffix.js'
                ],
                dest: 'src/ZSchema.js'
            }
        },
        uglify:      {
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
        jshint:      {
            all:     ["<%= pkg.files[0] %>", "test/*.js"],
            options: {
                jshintrc: ".jshintrc"
            }
        },
        simplemocha: {
            options: {
                reporter: "dot"
            },
            all:     { src: ["test/*.js"] }
        }
    });

    // Load the plugin that provides the "uglify" task.
    grunt.loadNpmTasks("grunt-contrib-uglify");
    grunt.loadNpmTasks("grunt-contrib-jshint");
    grunt.loadNpmTasks("grunt-contrib-concat");
    grunt.loadNpmTasks("grunt-simple-mocha");

    // Default task(s).
    grunt.registerTask("default", ["concat", "jshint", "uglify", "simplemocha"]);
    grunt.registerTask("test", ["concat", "jshint", "simplemocha"]);

};
