import child from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';

const fixture = (name: string) => `test/fixtures/cli/${name}`;
// A hung CLI (for example one that tried to reach the network) must fail the test, not stall the suite.
const SPAWN_TIMEOUT_MS = 30_000;
const run = (...args: string[]) =>
  child.spawnSync(process.execPath, ['bin/z-schema', ...args], { encoding: 'utf-8', timeout: SPAWN_TIMEOUT_MS });
const withTempDir = (body: (dir: string) => void) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'z-schema-cli-'));
  try {
    body(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

const draftFlagSets: Array<[string[]]> = [[[]], [['--draft', 'draft-04']]];

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
      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/draft-04/);
      expect(res.stderr).toMatch(/draft2020-12/);
    });
  });

  it('keeps a schema that already declares its own absolute $id', () => {
    const schema = fixture('own-id.schema.json');
    const pass = run(schema, fixture('string-valid.json'));
    expect(pass.status).toBe(0);
    expect(pass.stdout).toMatch(/string-valid\.json validation passed/);

    const fail = run(schema, fixture('string-invalid.json'));
    expect(fail.status).toBe(1);
    expect(fail.stdout).toMatch(/string-invalid\.json validation failed/);
  });

  describe.each(draftFlagSets)('relative file $ref (%j)', (flags) => {
    it('resolves the reference next to the schema file', () => {
      const pass = run(...flags, fixture('ref-a.json'), fixture('string-valid.json'));
      expect(pass.status).toBe(0);
      expect(pass.stdout).toMatch(/string-valid\.json validation passed/);

      const fail = run(...flags, fixture('ref-a.json'), fixture('string-invalid.json'));
      expect(fail.status).toBe(1);
      expect(fail.stdout).toMatch(/string-invalid\.json validation failed/);
    });

    it('resolves a relative id the schema declares against the schema file', () => {
      const schema = fixture('own-relative-id.schema.json');
      const pass = run(...flags, schema, fixture('string-valid.json'));
      expect(pass.status).toBe(0);
      expect(pass.stdout).toMatch(/string-valid\.json validation passed/);

      const fail = run(...flags, schema, fixture('string-invalid.json'));
      expect(fail.status).toBe(1);
      expect(fail.stdout).toMatch(/string-invalid\.json validation failed/);
    });
  });

  it('resolves a relative file $ref when run from the schema directory', () => {
    const res = child.spawnSync(process.execPath, [path.resolve('bin/z-schema'), 'ref-a.json', 'string-valid.json'], {
      encoding: 'utf-8',
      cwd: path.resolve('test/fixtures/cli'),
      timeout: SPAWN_TIMEOUT_MS,
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/string-valid\.json validation passed/);
  });

  describe('file $ref and the reference root', () => {
    it('refuses a reference outside the schema directory by default', () => {
      const res = run(fixture('nested/ref-up.json'), fixture('string-valid.json'));
      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/outside the reference root/);
      expect(res.stderr).toMatch(/--refRoot/);
    });

    it('reads it when --refRoot contains it', () => {
      const pass = run('--refRoot', 'test/fixtures/cli', fixture('nested/ref-up.json'), fixture('string-valid.json'));
      expect(pass.status).toBe(0);
      expect(pass.stdout).toMatch(/string-valid\.json validation passed/);

      const fail = run('--refRoot', 'test/fixtures/cli', fixture('nested/ref-up.json'), fixture('string-invalid.json'));
      expect(fail.status).toBe(1);
      expect(fail.stdout).toMatch(/validation failed/);
    });

    it('rejects a --refRoot that is not a directory', () => {
      const res = run('--refRoot', 'test/fixtures/cli/ref-a.json', fixture('ref-a.json'), fixture('string-valid.json'));
      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/--refRoot is not a directory/);
    });

    it.each(['host-ref.schema.json', 'network-path-ref.schema.json'])(
      'refuses a file reference on another host in %s',
      (name) => {
        const res = run(fixture(name), fixture('string-valid.json'));
        expect(res.status).toBe(1);
        expect(res.stderr).toMatch(/another host/);
      }
    );

    it('refuses an absolute file reference outside the root', () => {
      withTempDir((dir) => {
        const schemaPath = path.join(dir, 'schema.json');
        fs.writeFileSync(schemaPath, JSON.stringify({ $ref: pathToFileURL(path.resolve(fixture('ref-b.json'))).href }));
        const res = run(schemaPath, fixture('string-valid.json'));
        expect(res.status).toBe(1);
        expect(res.stderr).toMatch(/outside the reference root/);
      });
    });

    it('refuses a link that leads outside the root', (ctx) => {
      withTempDir((dir) => {
        const outsideDir = path.join(dir, 'outside');
        const rootDir = path.join(dir, 'root');
        fs.mkdirSync(outsideDir);
        fs.mkdirSync(rootDir);
        fs.writeFileSync(path.join(outsideDir, 'target.json'), JSON.stringify({ type: 'string' }));
        const schemaPath = path.join(rootDir, 'schema.json');
        fs.writeFileSync(schemaPath, JSON.stringify({ $ref: 'link/target.json' }));
        try {
          fs.symlinkSync(outsideDir, path.join(rootDir, 'link'), 'junction');
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === 'EPERM') {
            ctx.skip();
          }
          throw error;
        }

        const refused = run(schemaPath, fixture('string-valid.json'));
        expect(refused.status).toBe(1);
        expect(refused.stderr).toMatch(/outside the reference root/);

        const allowed = run('--refRoot', dir, schemaPath, fixture('string-valid.json'));
        expect(allowed.status).toBe(0);
        expect(allowed.stdout).toMatch(/string-valid\.json validation passed/);
      });
    });

    it('prints a fixed message for a referenced file that is not JSON', () => {
      const res = run(fixture('not-json-ref.schema.json'), fixture('string-valid.json'));
      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/not valid JSON/);
      expect(res.stdout).not.toContain('marker-content-line');
      expect(res.stderr).not.toContain('marker-content-line');
    });

    it('prints no description for a reference that ends on a string', () => {
      const res = run(fixture('string-node-ref.schema.json'), fixture('string-valid.json'));
      expect(res.status).toBe(1);
      expect(res.stdout).toContain('SCHEMA_NOT_AN_OBJECT');
      expect(res.stdout).not.toContain('marker-note-text');
      expect(res.stderr).not.toContain('marker-note-text');
    });
  });

  it('accepts a schema path that is absolute or contains a space', () => {
    const absolute = run(path.resolve(fixture('ref-a.json')), fixture('string-valid.json'));
    expect(absolute.status).toBe(0);
    expect(absolute.stdout).toMatch(/string-valid\.json validation passed/);

    const spaced = run('--refRoot', fixture(''), fixture('with space/ref-space.json'), fixture('string-valid.json'));
    expect(spaced.status).toBe(0);
    expect(spaced.stdout).toMatch(/string-valid\.json validation passed/);

    const spacedFail = run(
      '--refRoot',
      fixture(''),
      fixture('with space/ref-space.json'),
      fixture('string-invalid.json')
    );
    expect(spacedFail.status).toBe(1);
    expect(spacedFail.stdout).toMatch(/string-invalid\.json validation failed/);
  });

  it.runIf(process.platform === 'win32')('accepts a schema path written with backslashes', () => {
    const relative = run(fixture('ref-a.json').replaceAll('/', '\\'), fixture('string-valid.json'));
    expect(relative.status).toBe(0);
    expect(relative.stdout).toMatch(/string-valid\.json validation passed/);

    // no $ref at all: the id derived from the path must still be a valid URI reference
    const plain = run(fixture('ref-b.json').replaceAll('/', '\\'), fixture('string-valid.json'));
    expect(plain.status).toBe(0);
    expect(plain.stdout).toMatch(/string-valid\.json validation passed/);
  });

  it.each([
    'private-ref.schema.json',
    'private-ref-ula.schema.json',
    'private-ref-mapped.schema.json',
    'private-ref-nat64.schema.json',
    'private-ref-nat64-local.schema.json',
  ])('refuses the remote reference in %s without any network access', (name) => {
    const res = run(fixture(name), fixture('string-valid.json'));
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/private\/internal addresses are not allowed/);
  });
});
