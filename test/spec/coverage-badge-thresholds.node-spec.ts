import { describe, expect, it } from 'vitest';

import {
  buildCoverageBadgeMarkdown,
  getCoverageBadgeColor,
  getCoverageBadgeStatus,
  updateReadmeCoverageBadge,
} from '../../scripts/update-readme-coverage-badge.mts';

describe('coverage badge thresholds and colors', () => {
  it('maps >= 90 to high/brightgreen', () => {
    expect(getCoverageBadgeStatus(90)).toBe('high');
    expect(getCoverageBadgeColor('high')).toBe('brightgreen');
  });

  it('maps rounded values >= 80 and < 90 to medium/yellow', () => {
    expect(getCoverageBadgeStatus(80)).toBe('medium');
    expect(getCoverageBadgeStatus(89.49)).toBe('medium');
    expect(getCoverageBadgeColor('medium')).toBe('yellow');
  });

  it('maps rounded values < 80 to low/red', () => {
    expect(getCoverageBadgeStatus(79.49)).toBe('low');
    expect(getCoverageBadgeColor('low')).toBe('red');
  });

  it('builds shields badge with rounded encoded percent and local report link', () => {
    const badge = buildCoverageBadgeMarkdown(91.23);

    expect(badge).toContain('https://img.shields.io/badge/coverage-91%25-brightgreen');
    expect(badge).toContain('](docs/test-coverage.md)');
  });

  it('applies rounded threshold boundaries around 80 and 90', () => {
    expect(getCoverageBadgeStatus(79.5)).toBe('medium');
    expect(getCoverageBadgeStatus(89.5)).toBe('high');
  });

  it('replaces existing coverage badge line in README content', () => {
    const readme = [
      '# z-schema',
      '',
      '[![Coverage Status](https://coveralls.io/example)](https://coveralls.io/example)',
    ].join('\n');
    const updated = updateReadmeCoverageBadge(readme, 88);

    expect(updated).not.toContain('coveralls.io');
    expect(updated).toContain('coverage-88%25-yellow');
  });
});
