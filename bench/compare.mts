import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

interface CaseResult {
  hz: number;
  rme: number;
}

interface BenchFile {
  node: string;
  results: Partial<Record<string, CaseResult>>;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const isCaseResult = (value: unknown): value is CaseResult =>
  isRecord(value) && typeof value.hz === 'number' && typeof value.rme === 'number';

const isBenchFile = (value: unknown): value is BenchFile =>
  isRecord(value) &&
  typeof value.node === 'string' &&
  isRecord(value.results) &&
  Object.values(value.results).every(isCaseResult);

const read = (file: string): BenchFile => {
  const parsed: unknown = JSON.parse(readFileSync(file, 'utf-8'));
  if (!isBenchFile(parsed)) {
    console.error(`${file} is not a result file written by "npm run bench -- --json <file>".`);
    process.exit(1);
  }
  return parsed;
};

const { positionals } = parseArgs({ allowPositionals: true });
const [basePath, headPath] = positionals;
if (!basePath || !headPath) {
  console.error('Usage: node bench/compare.mts <base.json> <head.json>');
  process.exit(1);
}

const base = read(basePath);
const head = read(headPath);

const formatHz = (result?: CaseResult): string => (result ? Math.round(result.hz).toLocaleString('en-US') : 'n/a');

const names = Object.keys(base.results);
for (const name of Object.keys(head.results)) {
  if (!Object.hasOwn(base.results, name)) {
    names.push(name);
  }
}

const lines = ['| case | base ops/sec | head ops/sec | delta | combined rme |', '| --- | ---: | ---: | ---: | ---: |'];
for (const name of names) {
  const b = base.results[name];
  const h = head.results[name];
  let delta = 'n/a';
  let rme = 'n/a';
  if (b && h && b.hz > 0) {
    const pct = ((h.hz - b.hz) / b.hz) * 100;
    delta = `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
    rme = `±${(b.rme + h.rme).toFixed(1)}%`;
  }
  lines.push(`| ${name} | ${formatHz(b)} | ${formatHz(h)} | ${delta} | ${rme} |`);
}

console.log('### Benchmark: base vs head');
console.log('');
console.log(lines.join('\n'));
console.log('');
console.log(
  `Base on Node ${base.node}, head on Node ${head.node}. Each build is measured once, one after the other, so runner drift lands on one side: differences inside the combined rme are not meaningful, and small ones outside it need a local re-run. This comparison is informational only.`
);
