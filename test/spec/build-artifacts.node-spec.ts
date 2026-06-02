import fs from 'fs';

describe('Build artifacts', function () {
  it('creates ESM output', function () {
    expect(fs.existsSync('dist/index.js')).toBe(true);
    expect(fs.existsSync('dist/index.d.ts')).toBe(true);
  });

  it('creates CJS bundle', function () {
    expect(fs.existsSync('cjs/index.cjs')).toBe(true);
    expect(fs.existsSync('cjs/index.d.cts')).toBe(true);
  });

  it('creates UMD bundles', function () {
    expect(fs.existsSync('umd/ZSchema.js')).toBe(true);
    expect(fs.existsSync('umd/ZSchema.min.js')).toBe(true);
  });
});
