import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export type CoverageBadgeStatus = 'high' | 'medium' | 'low';

const STATUS_COLORS: Record<CoverageBadgeStatus, string> = {
  high: 'brightgreen',
  low: 'red',
  medium: 'yellow',
};

export function roundCoveragePercentage(linePct: number): number {
  if (!Number.isFinite(linePct)) {
    throw new Error(`Invalid line coverage percentage: ${linePct}`);
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
  const original = readFileSync(readmePath, 'utf8');
  const updated = updateReadmeCoverageBadge(original, linePct);

  if (updated === original) {
    return false;
  }

  writeFileSync(readmePath, updated, 'utf8');
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
