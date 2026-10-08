import type { SchemaErrorDetail } from '../../src/report.ts';

import { setSubReportErrorDeferral } from '../../src/report.ts';
import { jsonSymbol, schemaSymbol } from '../../src/utils/symbols.ts';

/**
 * Runs `fn` once with sub-report error deferral enabled and once with it disabled.
 */
export function runBothModes<T>(fn: () => T): { deferred: T; eager: T } {
  setSubReportErrorDeferral(true);
  const deferred = fn();
  setSubReportErrorDeferral(false);
  try {
    const eager = fn();
    return { deferred, eager };
  } finally {
    setSubReportErrorDeferral(true);
  }
}

/**
 * Async variant of {@link runBothModes}. Runs the modes sequentially.
 */
export async function runBothModesAsync<T>(fn: () => Promise<T>): Promise<{ deferred: T; eager: T }> {
  setSubReportErrorDeferral(true);
  const deferred = await fn();
  setSubReportErrorDeferral(false);
  try {
    const eager = await fn();
    return { deferred, eager };
  } finally {
    setSubReportErrorDeferral(true);
  }
}

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
