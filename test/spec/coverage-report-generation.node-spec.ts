import { describe, expect, it } from 'vitest';

import { parseCoverageSummary, renderCoverageReportMarkdown } from '../../scripts/generate-test-coverage-report.mts';

describe('coverage report generation', () => {
  it('parses totals and per-file line, statement, function, and branch metrics', () => {
    const parsed = parseCoverageSummary(
      {
        'C:/repo/src/a.ts': {
          branches: { pct: 82.4 },
          functions: { pct: 95 },
          lines: { pct: 90.2 },
          statements: { pct: 91 },
        },
        total: {
          branches: { pct: 83.2 },
          functions: { pct: 94.8 },
          lines: { pct: 91.11 },
          statements: { pct: 92 },
        },
      },
      'C:/repo'
    );

    expect(parsed).toEqual({
      files: [
        {
          branchPct: 82.4,
          functionPct: 95,
          linePct: 90.2,
          path: 'src/a.ts',
          statementPct: 91,
        },
      ],
      totals: {
        branchPct: 83.2,
        functionPct: 94.8,
        linePct: 91.11,
        statementPct: 92,
      },
    });
  });

  it('renders deterministic per-file markdown table and totals row without volatile metadata', () => {
    const markdownA = renderCoverageReportMarkdown({
      files: [
        {
          branchPct: 87.6,
          functionPct: 91.51,
          linePct: 90.49,
          path: 'src/a.ts',
          statementPct: 90.5,
        },
      ],
      totals: {
        branchPct: 88.4,
        functionPct: 91.51,
        linePct: 90.49,
        statementPct: 90.5,
      },
    });

    const markdownB = renderCoverageReportMarkdown({
      files: [
        {
          branchPct: 87.6,
          functionPct: 91.51,
          linePct: 90.49,
          path: 'src/a.ts',
          statementPct: 90.5,
        },
      ],
      totals: {
        branchPct: 88.4,
        functionPct: 91.51,
        linePct: 90.49,
        statementPct: 90.5,
      },
    });

    expect(markdownA).toBe(markdownB);
    expect(markdownA).not.toContain('generatedAt');
    expect(markdownA).not.toContain('run id');
    expect(markdownA).toContain('| File | Line % | Statement % | Function % | Branch % |');
    expect(markdownA).toContain('| src/a.ts | 90% | 91% | 92% | 88% |');
    expect(markdownA).toContain('| **Total** | **90%** | **91%** | **92%** | **88%** |');
  });

  it('throws when required total line percentage is missing', () => {
    expect(() => parseCoverageSummary({ total: {} })).toThrow(/lines/);
  });
});
