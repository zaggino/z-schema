import child from 'child_process';

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
});
