import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  getCoverageBadgeStatus,
  roundCoveragePercentage,
  updateReadmeCoverageBadgeFile,
} from './update-readme-coverage-badge.mts';

export interface CoverageNumbers {
  branchPct: number;
  functionPct: number;
  linePct: number;
  statementPct: number;
}

export interface CoverageFileSummary extends CoverageNumbers {
  path: string;
}

export interface ParsedCoverageSummary {
  files: CoverageFileSummary[];
  totals: CoverageNumbers;
}

interface CoverageSummaryFile {
  total?: {
    branches?: { pct?: number };
    functions?: { pct?: number };
    lines?: { pct?: number };
    statements?: { pct?: number };
  };
  [filePath: string]:
    | {
        branches?: { pct?: number };
        functions?: { pct?: number };
        lines?: { pct?: number };
        statements?: { pct?: number };
      }
    | undefined;
}

function toFinitePercent(value: unknown, metric: string): number {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    throw new Error(`Missing or invalid coverage value for ${metric}`);
  }

  return numberValue;
}

function parseCoverageMetrics(metrics: CoverageSummaryFile['total']): CoverageNumbers {
  const values = metrics ?? {};
  const linePct = toFinitePercent(values.lines?.pct, 'lines');

  return {
    branchPct: toFinitePercent(values.branches?.pct, 'branches'),
    functionPct: toFinitePercent(values.functions?.pct, 'functions'),
    linePct,
    statementPct: toFinitePercent(values.statements?.pct, 'statements'),
  };
}

function normalizeCoveragePath(filePath: string, repoRoot: string): string {
  const normalizedInput = filePath.replace(/\\/g, '/');
  const relativePath = relative(repoRoot, filePath).replace(/\\/g, '/');

  if (relativePath && !relativePath.startsWith('..') && !isAbsolute(relativePath)) {
    return relativePath;
  }

  const normalizedRoot = repoRoot.replace(/\\/g, '/').replace(/\/$/, '');
  const prefix = `${normalizedRoot}/`;

  if (normalizedInput.startsWith(prefix)) {
    return normalizedInput.slice(prefix.length);
  }

  return normalizedInput;
}

export function parseCoverageSummary(summary: CoverageSummaryFile, repoRoot = process.cwd()): ParsedCoverageSummary {
  const total = summary.total ?? {};
  const totals = parseCoverageMetrics(total);

  const files = Object.entries(summary)
    .filter(([filePath]) => filePath !== 'total')
    .map(([filePath, metrics]) => {
      return {
        ...parseCoverageMetrics(metrics),
        path: normalizeCoveragePath(filePath, repoRoot),
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path));

  return {
    files,
    totals,
  };
}

export function readCoverageSummary(coverageDir = 'coverage', repoRoot = process.cwd()): ParsedCoverageSummary {
  const coverageSummaryPath = join(coverageDir, 'coverage-summary.json');
  const raw = readFileSync(coverageSummaryPath, 'utf8');
  const parsed = JSON.parse(raw) as CoverageSummaryFile;

  return parseCoverageSummary(parsed, repoRoot);
}

function formatPercent(value: number): string {
  return `${roundCoveragePercentage(value)}%`;
}

export function renderCoverageReportMarkdown(summary: ParsedCoverageSummary): string {
  const roundedLinePct = roundCoveragePercentage(summary.totals.linePct);
  const badgeStatus = getCoverageBadgeStatus(roundedLinePct);

  const fileRows = summary.files.map((fileCoverage) => {
    return `| ${fileCoverage.path} | ${formatPercent(fileCoverage.linePct)} | ${formatPercent(fileCoverage.statementPct)} | ${formatPercent(fileCoverage.functionPct)} | ${formatPercent(fileCoverage.branchPct)} |`;
  });

  return [
    '# Test Coverage',
    '',
    'This file is generated from `npm run test:coverage` and committed by CI when coverage artifacts change.',
    '',
    `Line coverage status: **${badgeStatus}**`,
    '',
    '| File | Line % | Statement % | Function % | Branch % |',
    '| --- | ---: | ---: | ---: | ---: |',
    ...fileRows,
    `| **Total** | **${formatPercent(roundedLinePct)}** | **${formatPercent(summary.totals.statementPct)}** | **${formatPercent(summary.totals.functionPct)}** | **${formatPercent(summary.totals.branchPct)}** |`,
    '',
  ].join('\n');
}

function writeFileIfChanged(filePath: string, content: string): boolean {
  let original = '';

  try {
    original = readFileSync(filePath, 'utf8');
  } catch {
    original = '';
  }

  if (original === content) {
    return false;
  }

  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf8');
  return true;
}

export interface CoverageGenerationResult {
  badgeStatus: string;
  coverage: CoverageNumbers;
  readmeChanged: boolean;
  reportChanged: boolean;
}

export function generateCoverageArtifacts(options?: {
  coverageDir?: string;
  repoRoot?: string;
  readmePath?: string;
  reportPath?: string;
}): CoverageGenerationResult {
  const coverageDir = options?.coverageDir ?? 'coverage';
  const repoRoot = options?.repoRoot ?? process.cwd();
  const reportPath = options?.reportPath ?? 'docs/test-coverage.md';
  const readmePath = options?.readmePath ?? 'README.md';

  const summary = readCoverageSummary(coverageDir, repoRoot);
  const reportContent = renderCoverageReportMarkdown(summary);
  const reportChanged = writeFileIfChanged(reportPath, reportContent);
  const roundedCoverage = {
    branchPct: roundCoveragePercentage(summary.totals.branchPct),
    functionPct: roundCoveragePercentage(summary.totals.functionPct),
    linePct: roundCoveragePercentage(summary.totals.linePct),
    statementPct: roundCoveragePercentage(summary.totals.statementPct),
  };
  const readmeChanged = updateReadmeCoverageBadgeFile(readmePath, roundedCoverage.linePct);
  const badgeStatus = getCoverageBadgeStatus(roundedCoverage.linePct);

  return {
    badgeStatus,
    coverage: roundedCoverage,
    readmeChanged,
    reportChanged,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = generateCoverageArtifacts();
    console.log(`coverage_line_pct=${result.coverage.linePct}`);
    console.log(`coverage_badge_status=${result.badgeStatus}`);
    console.log(`report_changed=${result.reportChanged}`);
    console.log(`readme_changed=${result.readmeChanged}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
