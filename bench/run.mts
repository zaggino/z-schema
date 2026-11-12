import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { Bench } from 'tinybench';

import { cases } from './cases.mts';

interface ValidateResult {
  valid: boolean;
  err?: { details?: unknown[] };
}

interface SafeValidator {
  compile: (schema: unknown) => (json: unknown) => ValidateResult;
  validate: (json: unknown, schema: unknown) => ValidateResult;
}

interface LibModule {
  default?: { create?: (options: Record<string, unknown>) => SafeValidator };
}

const { values } = parseArgs({
  options: {
    lib: { type: 'string' },
    json: { type: 'string' },
    filter: { type: 'string' },
    time: { type: 'string' },
  },
});

const libPath = values.lib
  ? path.resolve(process.cwd(), values.lib)
  : path.resolve(import.meta.dirname, '../dist/index.js');
if (!existsSync(libPath)) {
  console.error(`Library build not found at ${libPath}. Run "npm run build" first (or pass --lib <path-to-index.js>).`);
  process.exit(1);
}

const time = values.time === undefined ? 500 : Number(values.time);
if (!Number.isFinite(time) || time <= 0) {
  console.error(`Invalid --time value: ${values.time}`);
  process.exit(1);
}

const lib = (await import(pathToFileURL(libPath).href)) as LibModule;
const create = lib.default?.create;
if (typeof create !== 'function') {
  console.error(`${libPath} does not look like a z-schema build: its default export has no create().`);
  process.exit(1);
}
const selected = cases.filter((c) => !values.filter || c.name.includes(values.filter));
if (selected.length === 0) {
  console.error(`No benchmark case matches --filter ${values.filter}`);
  process.exit(1);
}

const bench = new Bench({ time, warmupTime: Math.min(100, time), throws: true });

for (const benchCase of selected) {
  // `safe` comes last so a case cannot switch the validator to a throwing variant.
  const validator = create({ ...benchCase.options, safe: true });
  const { schema, data } = benchCase;
  const run =
    benchCase.mode === 'schema-object'
      ? (json: unknown) => validator.validate(json, schema)
      : validator.compile(schema);
  const expected = benchCase.expectValid ?? true;
  const probe = run(data);
  if (probe.valid !== expected) {
    console.error(`Case "${benchCase.name}": expected valid=${expected} but got valid=${probe.valid}`);
    process.exit(1);
  }
  const errorCount = probe.err?.details?.length ?? 0;
  if (benchCase.expectErrors !== undefined && errorCount !== benchCase.expectErrors) {
    console.error(`Case "${benchCase.name}": expected ${benchCase.expectErrors} errors but got ${errorCount}`);
    process.exit(1);
  }
  bench.add(benchCase.name, () => {
    run(data);
  });
}

await bench.run();

const results: Record<string, { hz: number; mean: number; rme: number; samples: number }> = {};
const rows: string[][] = [['case', 'ops/sec', 'mean (us)', 'rme (%)']];
for (const task of bench.tasks) {
  const { result } = task;
  if (result.state !== 'completed') {
    console.error(`Case "${task.name}" did not complete (state: ${result.state})`);
    process.exit(1);
  }
  const hz = result.throughput.mean;
  const mean = result.latency.mean * 1000;
  // The margin must belong to the reported statistic: ops/sec is the throughput mean.
  const { rme } = result.throughput;
  results[task.name] = { hz, mean, rme, samples: result.latency.samplesCount };
  rows.push([task.name, Math.round(hz).toLocaleString('en-US'), mean.toFixed(2), rme.toFixed(2)]);
}

const widths = rows[0].map((_, col) => Math.max(...rows.map((row) => row[col].length)));
for (const row of rows) {
  console.log(row.map((cell, col) => (col === 0 ? cell.padEnd(widths[col]) : cell.padStart(widths[col]))).join('  '));
}

if (values.json) {
  const out = path.resolve(process.cwd(), values.json);
  writeFileSync(out, `${JSON.stringify({ node: process.version, lib: libPath, results }, null, 2)}\n`);
}
