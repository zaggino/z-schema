import fs from 'fs';

describe('Rollup build artifacts', function () {
  it('creates legacy bundles in dist/', function () {
    expect(fs.existsSync('dist/ZSchema.cjs')).toBe(true);
    expect(fs.existsSync('dist/ZSchema-umd.js')).toBe(true);
    expect(fs.existsSync('dist/ZSchema-umd-min.js')).toBe(true);
  });
});
