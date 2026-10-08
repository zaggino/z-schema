import type { SchemaErrorDetail } from '../../src/report.ts';

import { Report } from '../../src/report.ts';
import { jsonSymbol, schemaSymbol } from '../../src/utils/symbols.ts';

/**
 * Runs `fn` with sub-reports forced eager (never deferring), by replacing
 * `Report.createSubReport` with a plain `new Report(parent)`. Works for sync and promise-returning
 * functions; the spy is restored once the result settles.
 */
export function withEagerSubReports<T>(fn: () => T): T {
  const spy = vi.spyOn(Report, 'createSubReport').mockImplementation((parent) => new Report(parent));
  let result: T;
  try {
    result = fn();
  } catch (error) {
    spy.mockRestore();
    throw error;
  }
  if (result instanceof Promise) {
    const pending = result;
    return (async () => {
      try {
        return await pending;
      } finally {
        spy.mockRestore();
      }
    })() as T;
  }
  spy.mockRestore();
  return result;
}

/**
 * Runs `fn` once with deferral (the default) and once forced eager. For async `fn`, `await` the
 * fields of the returned object (the runs are sequential: `deferred` is created first).
 */
export function runBothModes<T>(fn: () => T): { deferred: T; eager: T } {
  const deferred = fn();
  return { deferred, eager: withEagerSubReports(fn) };
}

export type Outcome<T> = { threw: false; value: T } | { threw: true; error: unknown };

/**
 * Captures a thrown exception as data so the two modes can be compared including exceptions.
 */
export function settle<T>(fn: () => T): Outcome<T> {
  try {
    return { threw: false, value: fn() };
  } catch (error) {
    return { threw: true, error };
  }
}

/**
 * Asserts both modes ended alike: both threw the same error constructor and message, or neither
 * threw. Returns true when neither threw (so the caller should compare the values).
 */
export function expectSameThrown<T>(deferred: Outcome<T>, eager: Outcome<T>): deferred is { threw: false; value: T } {
  expect(deferred.threw).toBe(eager.threw);
  if (deferred.threw && eager.threw) {
    const d = deferred.error as Error;
    const e = eager.error as Error;
    expect(d.constructor).toBe(e.constructor);
    expect(d.message).toBe(e.message);
  }
  return !deferred.threw && !eager.threw;
}

/**
 * Reduces a schema reference to comparable data. Deliberately identity-insensitive: the two runs
 * validate separately `structuredClone`d schemas, so reference equality or a deep compare of the
 * whole schema would be meaningless; the key list plus title/description/id catches wrong-schema bugs.
 */
function describeSchemaRef(value: unknown): unknown {
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return { objectKeys: Object.keys(obj), title: obj.title, description: obj.description, id: obj.id ?? obj.$id };
  }
  return value;
}

/**
 * Normalizes error details into plain data that records the own-key insertion order (including
 * symbol keys) at every nesting level, so a plain deep-equal also asserts key order.
 */
export function shapeOf(details: SchemaErrorDetail[] | undefined | null): unknown {
  if (!details) {
    return details;
  }
  return details.map((detail) => {
    const record = detail as unknown as Record<string | symbol, unknown>;
    const keys = Reflect.ownKeys(record);
    const values: Record<string, unknown> = {};
    for (const key of keys) {
      if (typeof key === 'symbol') {
        continue;
      }
      values[key] = key === 'inner' ? shapeOf(record.inner as SchemaErrorDetail[] | undefined) : record[key];
    }
    return {
      keys: keys.map(String),
      values,
      schema: describeSchemaRef(record[schemaSymbol]),
      json: record[jsonSymbol],
    };
  });
}
