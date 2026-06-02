import { defineConfig } from 'tsdown';

export default defineConfig([
  // 1. ESM — unbundled, preserving module structure in dist/
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    outDir: 'dist',
    unbundle: true,
    dts: true,
    clean: true,
    platform: 'neutral',
  },
  // 2. CJS — bundled into cjs/index.cjs + cjs/index.d.cts
  {
    entry: ['src/index.ts'],
    format: ['cjs'],
    outDir: 'cjs',
    dts: true,
    clean: true,
    platform: 'neutral',
    outputOptions: {
      exports: 'named',
    },
  },
  // 3. UMD — unminified (all deps bundled for <script> tag usage)
  {
    entry: { ZSchema: 'src/z-schema.ts' },
    format: ['umd'],
    outDir: 'umd',
    globalName: 'ZSchema',
    deps: { alwaysBundle: [/.*/] },
    dts: false,
    clean: true,
    platform: 'browser',
    outputOptions: {
      entryFileNames: '[name].js',
    },
  },
  // 4. UMD — minified
  {
    entry: { 'ZSchema.min': 'src/z-schema.ts' },
    format: ['umd'],
    outDir: 'umd',
    globalName: 'ZSchema',
    deps: { alwaysBundle: [/.*/] },
    minify: true,
    dts: false,
    clean: false,
    platform: 'browser',
    outputOptions: {
      entryFileNames: '[name].js',
    },
  },
]);
