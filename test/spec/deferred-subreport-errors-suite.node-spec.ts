import type { JsonSchema, JsonSchemaVersion } from '../../src/json-schema-versions.ts';

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { ZSchema } from '../../src/z-schema.ts';
import { expectSameThrown, settle, shapeOf, withEagerSubReports } from '../lib/deferred-errors.ts';

const suiteRoot = path.join(import.meta.dirname, '..', 'public', 'json-schema-test-suite');

interface SuiteGroup {
  description: string;
  schema: JsonSchema;
  tests: Array<{ description: string; data: unknown; valid: boolean }>;
}

function listJsonFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...listJsonFiles(full));
    } else if (name.endsWith('.json')) {
      out.push(full);
    }
  }
  return out;
}

const drafts: Array<{ version: JsonSchemaVersion; folder: string; $schema: string }> = [
  { version: 'draft2019-09', folder: 'draft2019-09', $schema: 'https://json-schema.org/draft/2019-09/schema' },
  { version: 'draft2020-12', folder: 'draft2020-12', $schema: 'https://json-schema.org/draft/2020-12/schema' },
  { version: 'draft-07', folder: 'draft7', $schema: 'http://json-schema.org/draft-07/schema#' },
  { version: 'draft-04', folder: 'draft4', $schema: 'http://json-schema.org/draft-04/schema#' },
];

describe('deferred sub-report errors: JSON-Schema-Test-Suite differential', () => {
  const remotesRoot = path.join(suiteRoot, 'remotes');
  for (const file of listJsonFiles(remotesRoot)) {
    const rel = path.relative(remotesRoot, file).split(path.sep).join('/');
    ZSchema.setRemoteReference(`http://localhost:1234/${rel}`, JSON.parse(readFileSync(file, 'utf-8')));
  }

  for (const { version, folder, $schema } of drafts) {
    it(`${version}: every case yields identical error details`, () => {
      let compared = 0;
      let invalidCompared = 0;
      for (const file of listJsonFiles(path.join(suiteRoot, 'tests', folder))) {
        const rel = path.relative(path.join(suiteRoot, 'tests'), file).split(path.sep).join('/');
        if (rel.includes('/optional/format/') || rel.endsWith('float-overflow.json') || rel.includes('cross-draft')) {
          continue;
        }
        const groups = JSON.parse(readFileSync(file, 'utf-8')) as SuiteGroup[];
        for (const group of groups) {
          for (const test of group.tests) {
            const run = () => {
              const schema = structuredClone(group.schema);
              if (typeof schema !== 'boolean' && !schema.$schema) {
                (schema as Record<string, unknown>).$schema = $schema;
              }
              return ZSchema.create({ version }).validateSafe(test.data, schema);
            };
            const deferredOutcome = settle(run);
            const eagerOutcome = settle(() => withEagerSubReports(run));
            const label = `${rel} :: ${group.description} :: ${test.description}`;
            if (expectSameThrown(deferredOutcome, eagerOutcome) && !eagerOutcome.threw) {
              const deferred = deferredOutcome.value;
              const eager = eagerOutcome.value;
              expect({ label, valid: deferred.valid }).toStrictEqual({ label, valid: eager.valid });
              expect(deferred.err?.constructor).toBe(eager.err?.constructor);
              expect(deferred.err?.message).toBe(eager.err?.message);
              if (!eager.valid) {
                invalidCompared++;
                expect({ label, shape: shapeOf(deferred.err?.details) }).toStrictEqual({
                  label,
                  shape: shapeOf(eager.err?.details),
                });
              }
            }
            compared++;
          }
        }
      }
      console.info(`${version}: compared ${compared} cases (${invalidCompared} invalid)`);
      expect(invalidCompared).toBeGreaterThan(100);
      expect(compared).toBeGreaterThan(invalidCompared);
    }, 120_000);
  }
});
