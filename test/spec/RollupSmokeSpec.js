import child from 'child_process';
import path from 'path';

describe('Rollup smoke CLI', function() {
  it('runs CLI against sample fixtures and returns exit code 0', function() {
    return new Promise((done, fail) => {

    const bin = path.resolve(__dirname, '..', '..', 'bin', 'z-schema');
    const schema = path.resolve(__dirname, '..', 'fixtures', 'sample-schema.json');
    const sample = path.resolve(__dirname, '..', 'fixtures', 'sample-valid.json');
    const cp = child.spawn(process.execPath, [bin, schema, sample], { stdio: 'pipe' });
    let out = '';
    cp.stdout.on('data', (c) => { out += c.toString(); });
    cp.stderr.on('data', (c) => { out += c.toString(); });
    cp.on('close', (code) => {
      try {
        expect(code).toBe(0);
        expect(out.toLowerCase()).toContain('pass');
        done();
      } catch (err) {
        fail(err);
      }
    });
    
    });
  }, 20000);
});
describe('Rollup CLI smoke test', function() {
  it('runs `bin/z-schema` against sample fixtures and passes', function() {
    var res = child.spawnSync(process.execPath, ['bin/z-schema', 'test/fixtures/sample-schema.json', 'test/fixtures/sample-valid.json'], { encoding: 'utf8' });
    // Exit code should be 0
    expect(res.status).toBe(0);
    // stdout should indicate validation passed
    expect(res.stdout || res.stderr).toMatch(/validation passed/i);
  });
});
