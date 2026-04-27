import child from 'child_process';
import path from 'path';

describe('CLI smoke', function () {
  it('runs `bin/z-schema` against sample fixtures and passes', function () {
    const res = child.spawnSync(
      process.execPath,
      ['bin/z-schema', 'test/fixtures/sample-schema.json', 'test/fixtures/sample-valid.json'],
      { encoding: 'utf8' }
    );
    expect(res.status).toBe(0);
    expect(res.stdout || res.stderr).toMatch(/validation passed/i);
  });

  it('prints the JSON filename in validation output', function () {
    const res = child.spawnSync(
      process.execPath,
      ['bin/z-schema', 'test/fixtures/sample-schema.json', 'test/fixtures/sample-valid.json'],
      { encoding: 'utf8' }
    );
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/sample-valid\.json validation passed/);
    expect(res.stdout).not.toMatch(/json #/);
  });

  it('outputs paths relative to the cwd, even for absolute inputs and same-basename files', function () {
    const absoluteValid = path.resolve('test/fixtures/sample-valid.json');
    const nestedValid = 'test/fixtures/nested/sample-valid.json';
    const res = child.spawnSync(
      process.execPath,
      ['bin/z-schema', 'test/fixtures/sample-schema.json', absoluteValid, nestedValid],
      { encoding: 'utf8' }
    );
    expect(res.status).toBe(0);
    expect(res.stdout).not.toContain(absoluteValid);
    expect(res.stdout).toMatch(/(?:^|\n)test[\\/]fixtures[\\/]sample-valid\.json validation passed/);
    expect(res.stdout).toMatch(/(?:^|\n)test[\\/]fixtures[\\/]nested[\\/]sample-valid\.json validation passed/);
  });
});
