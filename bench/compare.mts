import { readFileSync } from 'node:fs';

interface CaseResult {
  hz: number;
  rme: number;
}

interface BenchFile {
  node: string;
  lib: string;
  results: Record<string, CaseResult>;
}

const [basePath, headPath] = process.argv.slice(2);
if (!basePath || !headPath) {
  console.error('Usage: node bench/compare.mts <base.json> <head.json>');
  process.exit(1);
}

const read = (file: string): BenchFile => JSON.parse(readFileSync(file, 'utf-8')) as BenchFile;
const base = read(basePath);
const head = read(headPath);

const formatHz = (result?: CaseResult): string => (result ? Math.round(result.hz).toLocaleString('en-US') : 'n/a');

const names = Object.keys(base.results);
for (const name of Object.keys(head.results)) {
  if (!(name in base.results)) {
    names.push(name);
  }
}

const lines = ['| case | base ops/sec | head ops/sec | delta | combined rme |', '| --- | ---: | ---: | ---: | ---: |'];
for (const name of names) {
  const b = base.results[name] as CaseResult | undefined;
  const h = head.results[name] as CaseResult | undefined;
  let delta = 'n/a';
  let rme = 'n/a';
  if (b && h) {
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
  `Base on Node ${base.node}, head on Node ${head.node}. Shared CI runners are noisy: differences inside the combined rme are not meaningful. This comparison is informational only.`
);
