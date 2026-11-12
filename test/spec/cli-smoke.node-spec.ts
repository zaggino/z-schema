import child from 'child_process';
import path from 'path';

const fixture = (name: string) => `test/fixtures/cli/${name}`;
const run = (...args: string[]) => child.spawnSync(process.execPath, ['bin/z-schema', ...args], { encoding: 'utf-8' });

describe('CLI smoke', () => {
  it('runs `bin/z-schema` against sample fixtures and passes', () => {
    const res = child.spawnSync(
      process.execPath,
      ['bin/z-schema', 'test/fixtures/sample-schema.json', 'test/fixtures/sample-valid.json'],
      { encoding: 'utf-8' }
    );
    expect(res.status).toBe(0);
    expect(res.stdout || res.stderr).toMatch(/validation passed/i);
  });

  it('prints the JSON filename in validation output', () => {
    const res = child.spawnSync(
      process.execPath,
      ['bin/z-schema', 'test/fixtures/sample-schema.json', 'test/fixtures/sample-valid.json'],
      { encoding: 'utf-8' }
    );
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/sample-valid\.json validation passed/);
    expect(res.stdout).not.toMatch(/json #/);
  });

  it('outputs paths relative to the cwd, even for absolute inputs and same-basename files', () => {
    const absoluteValid = path.resolve('test/fixtures/sample-valid.json');
    const nestedValid = 'test/fixtures/nested/sample-valid.json';
    const res = child.spawnSync(
      process.execPath,
      ['bin/z-schema', 'test/fixtures/sample-schema.json', absoluteValid, nestedValid],
      { encoding: 'utf-8' }
    );
    expect(res.status).toBe(0);
    expect(res.stdout).not.toContain(absoluteValid);
    expect(res.stdout).toMatch(/(?:^|\n)test[\\/]fixtures[\\/]sample-valid\.json validation passed/);
    expect(res.stdout).toMatch(/(?:^|\n)test[\\/]fixtures[\\/]nested[\\/]sample-valid\.json validation passed/);
  });

  describe('--draft', () => {
    it('applies draft-04 semantics (boolean exclusiveMinimum)', () => {
      const schema = fixture('draft4-exclusive.schema.json');
      const pass = run('--draft', 'draft-04', schema, fixture('number-6.json'));
      expect(pass.status).toBe(0);
      expect(pass.stdout).toMatch(/number-6\.json validation passed/);

      const fail = run('--draft', 'draft-04', schema, fixture('number-5.json'));
      expect(fail.status).toBe(1);
      expect(fail.stdout).toMatch(/number-5\.json validation failed/);
    });

    it('rejects an unknown draft with the allowed choices', () => {
      const res = run('--draft', 'nope', fixture('own-id.schema.json'), fixture('string-valid.json'));
      expect(res.status).not.toBe(0);
      expect(res.stderr).toMatch(/draft-04/);
      expect(res.stderr).toMatch(/draft2020-12/);
    });
  });

  it('keeps a schema that already declares its own $id', () => {
    const schema = fixture('own-id.schema.json');
    const pass = run(schema, fixture('string-valid.json'));
    expect(pass.status).toBe(0);
    expect(pass.stdout).toMatch(/string-valid\.json validation passed/);

    const fail = run(schema, fixture('string-invalid.json'));
    expect(fail.status).toBe(1);
    expect(fail.stdout).toMatch(/string-invalid\.json validation failed/);
  });

  describe.each([[[]], [['--draft', 'draft-04']]] as Array<[string[]]>)('relative file $ref (%j)', (flags) => {
    it('resolves the reference next to the schema file', () => {
      const pass = run(...flags, fixture('ref-a.json'), fixture('string-valid.json'));
      expect(pass.status).toBe(0);
      expect(pass.stdout).toMatch(/string-valid\.json validation passed/);

      const fail = run(...flags, fixture('ref-a.json'), fixture('string-invalid.json'));
      expect(fail.status).toBe(1);
      expect(fail.stdout).toMatch(/string-invalid\.json validation failed/);
    });
  });

  it('resolves a relative file $ref when run from the schema directory', () => {
    const res = child.spawnSync(process.execPath, [path.resolve('bin/z-schema'), 'ref-a.json', 'string-valid.json'], {
      encoding: 'utf-8',
      cwd: path.resolve('test/fixtures/cli'),
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/string-valid\.json validation passed/);
  });

  it('resolves a relative file $ref that climbs out of the schema directory', () => {
    const pass = run(fixture('nested/ref-up.json'), fixture('string-valid.json'));
    expect(pass.status).toBe(0);
    expect(pass.stdout).toMatch(/string-valid\.json validation passed/);

    const fail = run(fixture('nested/ref-up.json'), fixture('string-invalid.json'));
    expect(fail.status).toBe(1);
  });

  it('refuses remote references to private addresses without any network access', () => {
    const res = run(fixture('private-ref.schema.json'), fixture('string-valid.json'));
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/private\/internal addresses are not allowed/);
  });
});
