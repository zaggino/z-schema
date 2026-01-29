import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import terser from "@rollup/plugin-terser";
import typescript from '@rollup/plugin-typescript';

export default [
  {
    input: 'src/ZSchema.ts',
    plugins: [resolve(), json(), commonjs(), typescript()],
    output: {
      file: 'dist/ZSchema-browser.js',
      format: 'umd',
      name: 'ZSchema'
    }
  },
  {
    input: 'src/ZSchema.ts',
    plugins: [resolve(), json(), commonjs(), typescript(), terser()],
    output: {
      file: 'dist/ZSchema-browser-min.js',
      format: 'umd',
      name: 'ZSchema'
    }
  }
];
