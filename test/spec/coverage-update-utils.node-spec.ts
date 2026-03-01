import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { decideCoverageUpdate, isForkPullRequest } from '../../scripts/coverage-update-utils.mts';

describe('coverage update decision logic', () => {
  it('commits only when pull request is same-repo, non-bot, and tracked files changed', () => {
    const decision = decideCoverageUpdate({
      actor: 'contributor',
      changedFiles: ['docs/test-coverage.md'],
      eventName: 'pull_request',
      isForkPr: false,
    });

    expect(decision).toEqual({ reason: 'changed', shouldCommit: true });
  });

  it('skips on bot actor', () => {
    const decision = decideCoverageUpdate({
      actor: 'github-actions[bot]',
      changedFiles: ['README.md'],
      eventName: 'pull_request',
      isForkPr: false,
    });

    expect(decision).toEqual({ reason: 'bot_actor', shouldCommit: false });
  });

  it('skips on fork pull requests', () => {
    const decision = decideCoverageUpdate({
      actor: 'contributor',
      changedFiles: ['README.md'],
      eventName: 'pull_request',
      isForkPr: true,
    });

    expect(decision).toEqual({ reason: 'fork_pr', shouldCommit: false });
  });

  it('skips when tracked files are unchanged', () => {
    const decision = decideCoverageUpdate({
      actor: 'contributor',
      changedFiles: [],
      eventName: 'pull_request',
      isForkPr: false,
    });

    expect(decision).toEqual({ reason: 'no_changes', shouldCommit: false });
  });
});

describe('fork pull request detection', () => {
  it('returns true when pull request head repo differs from current repository', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'coverage-utils-'));
    const payloadPath = join(tempDir, 'event.json');

    writeFileSync(
      payloadPath,
      JSON.stringify({
        pull_request: {
          head: {
            repo: {
              full_name: 'someone/forked-repo',
            },
          },
        },
      })
    );

    expect(isForkPullRequest(payloadPath, 'zaggino/z-schema')).toBe(true);

    rmSync(tempDir, { force: true, recursive: true });
  });
});
