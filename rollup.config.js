import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import { terser } from 'rollup-plugin-terser';

export default [
  {
    input: 'src/ZSchema.js',
    plugins: [resolve(), json(), commonjs()],
    output: {
      file: 'dist/ZSchema-browser.js',
      format: 'umd',
      name: 'ZSchema'
    }
  },
  {
    input: 'src/ZSchema.js',
    plugins: [resolve(), json(), commonjs(), terser()],
    output: {
      file: 'dist/ZSchema-browser-min.js',
      format: 'umd',
      name: 'ZSchema'
    }
  }
];
