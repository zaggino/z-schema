import fs from 'fs';

describe('Build artifacts', () => {
  it('creates ESM output', () => {
    expect(fs.existsSync('dist/index.js')).toBe(true);
    expect(fs.existsSync('dist/index.d.ts')).toBe(true);
  });

  it('creates CJS bundle', () => {
    expect(fs.existsSync('cjs/index.cjs')).toBe(true);
    expect(fs.existsSync('cjs/index.d.cts')).toBe(true);
  });

  it('creates UMD bundles', () => {
    expect(fs.existsSync('umd/ZSchema.js')).toBe(true);
    expect(fs.existsSync('umd/ZSchema.min.js')).toBe(true);
  });
});
