// Conventions for the keyword compilers (`compileXxx`) that `buildFastValidator` runs at build time:
// - a compiler pushes zero or more checks onto `checks`; they are ANDed, so `ALWAYS_TRUE` results may be elided;
// - a child schema must be compiled even when its check is discarded, so an unsupported child rejects the whole build;
// - `unsupported()` throws and is caught once, in `buildFastValidator`;
// - `deferToInterpreter()` throws at run time: the interpreter must decide this instance; `_fastAccepts` catches it;
// - `disableFastValidator()` throws at run time: the schema must stop using the fast validator; `_fastAccepts` catches it;
// - a compiled check may be evaluated more than once per validation by a collector, so it must be pure: anything
//   that is not must be recorded in `BuildState.notes`;
// - the returned closures run on the validation hot path: indexed loops, no per-call allocation.
// - field types of `JsonSchemaInternal` are nominal: keyword values are not guaranteed to have them, so compilers read
//   them only through `expect*` helpers or a runtime guard, and those guards must not be removed as "redundant".

import type { JsonSchemaInternal } from '../json-schema-versions.js';
import type { ZSchemaBase } from '../z-schema-base.js';

import { isObject } from '../utils/what-is.js';

/** A specialised validity check for one compiled schema. Returns `true` only when `json` is valid. */
export type FastValidator = (json: unknown) => boolean;

export type Check = FastValidator;

export const ALWAYS_TRUE: FastValidator = () => true;
export const ALWAYS_FALSE: FastValidator = () => false;

/** Everything a keyword compiler needs. */
export interface BuildState {
  readonly ctx: ZSchemaBase;
  readonly root: JsonSchemaInternal;
  /** Compiles a child schema; a child that cannot be compiled makes the whole build unsupported. */
  readonly compileChild: (child: unknown) => FastValidator;
  /** Facts about the whole build that decide whether it is safe: impure checks are compiled, and collectors re-run checks. */
  readonly notes: { customFormat: boolean; rechecks: boolean };
}

export type KeywordCompiler = (state: BuildState, node: JsonSchemaInternal, checks: Check[]) => void;

/** Thrown (and caught once, in `buildFastValidator`) when the schema uses anything the builder does not implement. */
const UNSUPPORTED = new Error('unsupported by the fast validator');

/** Thrown by a compiled check when this instance must be decided by the interpreter. */
const DEFER_TO_INTERPRETER = new Error('deferred to the interpreter');

/** Thrown by a compiled check that learns at run time that the fast validator cannot decide this schema. */
const FAST_VALIDATOR_DISABLED = new Error('fast validator disabled for this schema');

export function unsupported(): never {
  throw UNSUPPORTED;
}

/** Run time: this instance must be decided by the interpreter; the fast validator stays in use. */
export function deferToInterpreter(): never {
  throw DEFER_TO_INTERPRETER;
}

/**
 * Run time: this schema must stop using the fast validator (e.g. a custom format validator returned a promise);
 * `_fastAccepts` retires it.
 */
export function disableFastValidator(): never {
  throw FAST_VALIDATOR_DISABLED;
}

/** Whether `error` is the sentinel thrown by {@link disableFastValidator}. */
export function isFastValidatorDisabled(error: unknown): boolean {
  return error === FAST_VALIDATOR_DISABLED;
}

/** A numeric keyword value, or the build is unsupported. */
export function expectNumber(value: unknown): number {
  if (typeof value !== 'number') {
    unsupported();
  }
  return value;
}

/** An array keyword value, or the build is unsupported. */
export function expectArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    unsupported();
  }
  return value;
}

/** An array of strings, or the build is unsupported. */
export function expectStringArray(value: unknown): string[] {
  const items = expectArray(value);
  for (let i = 0; i < items.length; i++) {
    if (typeof items[i] !== 'string') {
      unsupported();
    }
  }
  return items as string[];
}

/** A plain-object keyword value, or the build is unsupported. */
export function expectRecord(value: unknown): Record<string, unknown> {
  if (!isObject(value)) {
    unsupported();
  }
  return value as Record<string, unknown>;
}
