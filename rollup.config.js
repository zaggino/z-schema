import commonjs from "@rollup/plugin-commonjs";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import json from "@rollup/plugin-json";
import { terser } from "rollup-plugin-terser";

export default function () {
    return {
        input: `./src/ZSchema.js`,
        output: [
            {
                file: `./dist/ZSchema.mjs`,
                format: "es"
            },
            {
                file: `./dist/ZSchema.min.mjs`,
                format: "es",
                sourcemap: true,
                plugins: [terser()]
            }
        ],
        plugins: [commonjs(), nodeResolve(), json()]
    };
}
