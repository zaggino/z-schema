import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import { dts } from 'rollup-plugin-dts';

export default [
  {
    input: 'src/index.ts',
    plugins: [
      resolve(),
      json(),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        outDir: './cjs',
        declaration: false,
        declarationDir: null,
      }),
    ],
    output: {
      file: 'cjs/index.js',
      format: 'cjs',
      exports: 'named',
    },
  },
  {
    input: 'dist/types/index.d.ts',
    output: {
      file: 'cjs/index.d.ts',
      format: 'es',
    },
    plugins: [dts()],
  },
  {
    input: 'src/z-schema.ts',
    plugins: [
      resolve(),
      json(),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        outDir: './umd',
        declaration: false,
        declarationDir: null,
      }),
    ],
    output: {
      file: 'umd/ZSchema.js',
      format: 'umd',
      name: 'ZSchema',
    },
  },
  {
    input: 'src/z-schema.ts',
    plugins: [
      resolve(),
      json(),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        outDir: './umd',
        declaration: false,
        declarationDir: null,
      }),
      terser(),
    ],
    output: {
      file: 'umd/ZSchema.min.js',
      format: 'umd',
      name: 'ZSchema',
    },
  },
];
