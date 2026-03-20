import fs from 'fs';

describe('Build artifacts', function () {
  it('creates ESM output', function () {
    expect(fs.existsSync('dist/index.mjs')).toBe(true);
    expect(fs.existsSync('dist/index.d.mts')).toBe(true);
  });

  it('creates CJS bundle', function () {
    expect(fs.existsSync('cjs/index.js')).toBe(true);
    expect(fs.existsSync('cjs/index.d.ts')).toBe(true);
  });

  it('creates UMD bundles', function () {
    expect(fs.existsSync('umd/ZSchema.js')).toBe(true);
    expect(fs.existsSync('umd/ZSchema.min.js')).toBe(true);
  });
});
