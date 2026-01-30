import fs from 'fs';

describe('Rollup build artifacts', function () {
  it('creates legacy bundles in dist/', function () {
    expect(fs.existsSync('cjs/index.js')).toBe(true);
    expect(fs.existsSync('cjs/index.d.ts')).toBe(true);
    expect(fs.existsSync('umd/ZSchema.js')).toBe(true);
    expect(fs.existsSync('umd/ZSchema.min.js')).toBe(true);
  });
});
