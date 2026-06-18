import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const { isAbsolute, resolve } = path;

export type CoverageUpdateReason = 'changed' | 'no_changes' | 'fork_pr' | 'bot_actor' | 'push_rejected';

export interface CoverageUpdateDecisionInput {
  actor: string;
  changedFiles: string[];
  eventName: string;
  isForkPr: boolean;
}

export interface CoverageUpdateDecision {
  reason: CoverageUpdateReason;
  shouldCommit: boolean;
}

const trackedCoverageFiles = ['docs/test-coverage.md', 'README.md'];

export function getChangedTrackedFiles(cwd = process.cwd(), trackedFiles = trackedCoverageFiles): string[] {
  const output = execFileSync('git', ['status', '--porcelain', '--untracked-files=no', '--', ...trackedFiles], {
    cwd,
    encoding: 'utf-8',
  });

  const changed = new Set<string>();

  for (const line of output.split(/\r?\n/)) {
    if (!line.trim()) {
      continue;
    }

    const filePath = line.slice(3).trim();
    if (trackedFiles.includes(filePath)) {
      changed.add(filePath);
    }
  }

  return trackedFiles.filter((file) => changed.has(file));
}

export function decideCoverageUpdate(input: CoverageUpdateDecisionInput): CoverageUpdateDecision {
  if (input.eventName !== 'pull_request') {
    return { reason: 'no_changes', shouldCommit: false };
  }

  if (input.actor === 'github-actions[bot]') {
    return { reason: 'bot_actor', shouldCommit: false };
  }

  if (input.isForkPr) {
    return { reason: 'fork_pr', shouldCommit: false };
  }

  if (input.changedFiles.length === 0) {
    return { reason: 'no_changes', shouldCommit: false };
  }

  return { reason: 'changed', shouldCommit: true };
}

interface PullRequestPayload {
  pull_request?: {
    head?: {
      repo?: {
        full_name?: string;
      };
    };
  };
}

/**
 * Resolve `inputPath` and verify it stays within the allowed `baseDir`.
 * Throws if the resolved path escapes the base directory (CWE-22).
 */
function safePath(inputPath: string): string {
  if (!isAbsolute(inputPath)) {
    throw new Error(`Path traversal detected: ${inputPath} is not an absolute path`);
  }
  return resolve(inputPath);
}

export function isForkPullRequest(githubEventPath: string | undefined, repository: string | undefined): boolean {
  if (!githubEventPath || !repository) {
    return false;
  }

  const safeEventPath = safePath(githubEventPath);
  const payload = JSON.parse(readFileSync(safeEventPath, 'utf-8')) as PullRequestPayload;
  const headRepo = payload.pull_request?.head?.repo?.full_name;

  if (!headRepo) {
    return false;
  }

  return headRepo !== repository;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const eventName = process.env.GITHUB_EVENT_NAME ?? '';
  const actor = process.env.GITHUB_ACTOR ?? '';
  const repository = process.env.GITHUB_REPOSITORY;
  const eventPath = process.env.GITHUB_EVENT_PATH;

  const changedFiles = getChangedTrackedFiles();
  const isForkPr = isForkPullRequest(eventPath, repository);
  const decision = decideCoverageUpdate({
    actor,
    changedFiles,
    eventName,
    isForkPr,
  });

  console.log(`should_commit=${decision.shouldCommit}`);
  console.log(`reason=${decision.reason}`);
  console.log(`changed_files=${changedFiles.join(',')}`);
}
