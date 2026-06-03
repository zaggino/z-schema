import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Resolve `inputPath` relative to `baseDir` and verify it stays within that directory.
 * Throws if the resolved path escapes the base directory (CWE-22).
 */
function safePath(inputPath: string, baseDir: string): string {
  const resolved = resolve(baseDir, inputPath);
  if (!resolved.startsWith(baseDir)) {
    throw new Error(`Path traversal detected: ${inputPath} resolves outside ${baseDir}`);
  }
  return resolved;
}

export type CoverageBadgeStatus = 'high' | 'medium' | 'low';

const STATUS_COLORS: Record<CoverageBadgeStatus, string> = {
  high: 'brightgreen',
  low: 'red',
  medium: 'yellow',
};

export function roundCoveragePercentage(linePct: number): number {
  if (!Number.isFinite(linePct)) {
    throw new TypeError(`Invalid line coverage percentage: ${linePct}`);
  }

  const clamped = Math.min(100, Math.max(0, linePct));
  return Math.round(clamped);
}

export function getCoverageBadgeStatus(linePct: number): CoverageBadgeStatus {
  const roundedPct = roundCoveragePercentage(linePct);

  if (roundedPct >= 90) {
    return 'high';
  }

  if (roundedPct >= 80) {
    return 'medium';
  }

  return 'low';
}

export function getCoverageBadgeColor(status: CoverageBadgeStatus): string {
  return STATUS_COLORS[status];
}

export function buildCoverageBadgeMarkdown(linePct: number): string {
  const normalizedPct = roundCoveragePercentage(linePct);
  const status = getCoverageBadgeStatus(linePct);
  const color = getCoverageBadgeColor(status);
  const encodedValue = encodeURIComponent(`${normalizedPct}%`);

  return `[![Coverage ${normalizedPct}%](https://img.shields.io/badge/coverage-${encodedValue}-${color})](docs/test-coverage.md)`;
}

export function updateReadmeCoverageBadge(readmeContent: string, linePct: number): string {
  const coverageBadgeLine = buildCoverageBadgeMarkdown(linePct);
  const coverageBadgeRegex = /^\[!\[Coverage[^\]]*\]\([^)]*\)\]\([^)]*\)$/m;

  if (coverageBadgeRegex.test(readmeContent)) {
    return readmeContent.replace(coverageBadgeRegex, coverageBadgeLine);
  }

  const npmBadgeRegex = /^\[!\[NPM[^\]]*\]\([^)]*\)$/m;
  if (npmBadgeRegex.test(readmeContent)) {
    return readmeContent.replace(npmBadgeRegex, `$&\n\n${coverageBadgeLine}`);
  }

  return `${coverageBadgeLine}\n\n${readmeContent}`;
}

export function updateReadmeCoverageBadgeFile(readmePath: string, linePct: number): boolean {
  const safeReadmePath = safePath(readmePath, process.cwd());
  const original = readFileSync(safeReadmePath, 'utf-8');
  const updated = updateReadmeCoverageBadge(original, linePct);

  if (updated === original) {
    return false;
  }

  writeFileSync(safeReadmePath, updated, 'utf-8');
  return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const readmePath = process.argv[2] ?? 'README.md';
  const linePctRaw = process.argv[3];

  if (!linePctRaw) {
    console.error('Usage: node ./scripts/update-readme-coverage-badge.mts <readmePath> <linePct>');
    process.exit(1);
  }

  const linePct = Number(linePctRaw);
  const changed = updateReadmeCoverageBadgeFile(readmePath, linePct);
  console.log(`README badge ${changed ? 'updated' : 'unchanged'} at ${readmePath}`);
}
