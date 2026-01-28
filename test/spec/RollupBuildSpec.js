import fs from 'fs';
import path from 'path';

describe('Rollup build artifacts', function() {
  it('produces dist/ZSchema-browser.js and dist/ZSchema-browser-min.js', function() {
    const base = path.resolve(__dirname, '..', '..');
    const a = path.join(base, 'dist', 'ZSchema-browser.js');
    const b = path.join(base, 'dist', 'ZSchema-browser-min.js');
    expect(fs.existsSync(a)).toBe(true);
    expect(fs.existsSync(b)).toBe(true);
  });
});
describe('Rollup build artifacts', function() {
  it('creates browser bundles in dist/', function() {
    var fs = require('fs');
    expect(fs.existsSync('dist/ZSchema-browser.js')).toBe(true);
    expect(fs.existsSync('dist/ZSchema-browser-min.js')).toBe(true);
  });
});
