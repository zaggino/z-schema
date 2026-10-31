import type { Report } from './report.js';

import { MAX_ASYNC_TIMEOUT } from './utils/constants.js';

export type TaskResult = unknown;
type TaskFn = (...args: unknown[]) => TaskResult;
type TaskFnArgs = Parameters<TaskFn>;
export type TaskProcessFn = (result: ReturnType<TaskFn>) => void;
export type AsyncTask = [TaskFn, TaskFnArgs, TaskProcessFn];

const ASYNC_TIMEOUT_POLL_MS = 10;

// Keeps the user-facing callback asynchronous (macrotask), unlike internal sub-report completion.
export const deferToTimer = (fn: () => void): void => {
  setTimeout(fn, 0);
};

export interface DrainConfig {
  /** Present only for the top-level report: owns the timeout timer, completes via a timer, may finish early under breakOnFirstError. */
  topLevel?: { timeout: number };
  onComplete: () => void;
  onAbort: (error: unknown) => void;
}

/**
 * Drains pending async tasks of `report`, reporting completion or abort separately.
 *
 * - Complete vs abort: `onComplete` is scheduled once all tasks settled (or the top level already has an
 *   error under `breakOnFirstError`) - via a timer when `config.topLevel` is set, otherwise via a microtask.
 *   If a task or its result processing throws, `onAbort` receives the thrown value and `onComplete` is not called.
 * - Timer: only the top level (`config.topLevel`) owns a timer; sub-reports have none, the top-level
 *   timeout bounds the whole validation. The timeout path adds `ASYNC_TIMEOUT` and calls
 *   `onComplete` directly, not through the deferral.
 * - Deferred tasks (`Report.deferredAsyncTasks`) start only after all regular tasks settled, one at a
 *   time, with tasks deferred by a running one going first (nested before outer).
 *
 * @internal
 *
 * @param report - The report whose `asyncTasks` are drained.
 * @param config - `topLevel.timeout` is the timeout in milliseconds (absent: no timer, the caller bounds the work);
 *   `onComplete` is called when all tasks settled, or after an `ASYNC_TIMEOUT` error was added to the report;
 *   `onAbort` is called with the thrown value when a task or its result processing throws.
 */
export function drainTasks(report: Report, config: DrainConfig): void {
  const { topLevel, onComplete, onAbort } = config;
  const defer = topLevel ? deferToTimer : queueMicrotask;
  // The top-level clock starts before the first synchronous pass.
  const startedAt = topLevel === undefined ? 0 : Date.now();
  let tasksCount = report.asyncTasks.length;
  // Deferred tasks not yet started; they run one at a time, see runTasks.
  let deferredQueue: AsyncTask[] = [];
  let timedOut = false;
  let finished = false;
  let running = false;
  let tasksStarted = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const stopTimer = () => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  };

  const finish = () => {
    if (finished) {
      return;
    }
    finished = true;
    stopTimer();
    defer(onComplete);
  };

  const abort = (error: unknown) => {
    if (finished) {
      return;
    }
    finished = true;
    stopTimer();
    onAbort(error);
  };

  const respond = (asyncTaskResultProcessFn: TaskProcessFn) => (asyncTaskResult: TaskResult) => {
    if (timedOut || finished) {
      return;
    }
    try {
      const previousLength = report.asyncTasks.length;
      asyncTaskResultProcessFn(asyncTaskResult);
      tasksCount += report.asyncTasks.length - previousLength - 1;
      runTasks();
    } catch (error) {
      abort(error);
    }
  };

  function runTasks() {
    if (running || finished) {
      return;
    }
    running = true;
    try {
      for (;;) {
        while (tasksStarted < report.asyncTasks.length) {
          if (finished) {
            break;
          }
          const [fn, fnArgs, processFn] = report.asyncTasks[tasksStarted++];
          fn.apply(undefined, fnArgs.concat(respond(processFn)));
        }
        if (finished || tasksCount > 0 || (!report.deferredAsyncTasks?.length && deferredQueue.length === 0)) {
          break;
        }
        // Deferred tasks run one at a time. Tasks deferred while the previous one ran (nested nodes,
        // chained hooks) go ahead of the older ones, so inner work and hooks settle before outer ones.
        // E.g. root [childUneval(D1), rootHook(D2)]: D1 queues regular task T and chained child hook D3.
        // Once T settles the queue is [D3, D2]: the child hook runs, then the root hook sees T's errors.
        const queue = (report.deferredAsyncTasks ?? []).concat(deferredQueue);
        report.deferredAsyncTasks = undefined;
        report.asyncTasks.push(queue[0]);
        tasksCount = 1;
        deferredQueue = queue.slice(1);
      }
    } catch (error) {
      running = false;
      abort(error);
      return;
    }
    running = false;
    if (tasksCount === 0) {
      finish();
    }
  }

  // Finish early only at the top level, once an error exists under breakOnFirstError. Sub-reports
  // must still run their tasks: their errors are just one branch's result and the parent waits on them.
  if (
    (tasksCount === 0 && !report.deferredAsyncTasks?.length) ||
    (topLevel !== undefined && report.errors.length > 0 && report.options.breakOnFirstError)
  ) {
    finish();
    return;
  }

  runTasks();

  if (topLevel === undefined || finished || tasksCount <= 0) {
    return;
  }

  // `processAsyncTasks` owns the default timeout.
  const validationTimeout = Math.min(Math.max(topLevel.timeout, 0), MAX_ASYNC_TIMEOUT);
  const timeoutAt = startedAt + validationTimeout;

  const checkTimeout = () => {
    if (timedOut || finished || tasksCount <= 0) {
      return;
    }
    timer = undefined;
    if (Date.now() >= timeoutAt) {
      timedOut = true;
      report.addError('ASYNC_TIMEOUT', [tasksCount, validationTimeout]);
      onComplete();
      return;
    }
    timer = setTimeout(checkTimeout, ASYNC_TIMEOUT_POLL_MS);
  };
  timer = setTimeout(checkTimeout, ASYNC_TIMEOUT_POLL_MS);
}
