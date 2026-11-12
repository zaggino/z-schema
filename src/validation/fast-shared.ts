// Conventions for the keyword compilers (`compileXxx`) that `buildFastValidator` runs at build time:
// - a compiler pushes zero or more checks onto `checks`; they are ANDed, so `ALWAYS_TRUE` results may be elided;
// - a child schema must be compiled even when its check is discarded, so an unsupported child rejects the whole build;
// - `unsupported()` throws and is caught once, in `buildFastValidator`;
// - the returned closures run on the validation hot path: indexed loops, no per-call allocation.

import type { JsonSchemaInternal } from '../json-schema-versions.js';
import type { ZSchemaBase } from '../z-schema-base.js';

import { isObject } from '../utils/what-is.js';

/** A specialised validity check for one compiled schema. Returns `true` only when `json` is valid. */
export type FastValidator = (json: unknown) => boolean;

export type Check = FastValidator;

export type RawNode = Record<string, unknown>;

export const ALWAYS_TRUE: FastValidator = () => true;
export const ALWAYS_FALSE: FastValidator = () => false;

/** Everything a keyword compiler needs. */
export interface BuildState {
  readonly ctx: ZSchemaBase;
  readonly root: JsonSchemaInternal;
  /** Compiles a child schema; a child that cannot be compiled makes the whole build unsupported. */
  readonly compileChild: (child: unknown) => FastValidator;
}

export type KeywordCompiler = (state: BuildState, node: JsonSchemaInternal, checks: Check[]) => void;

/** Thrown (and caught once, in `buildFastValidator`) when the schema uses anything the builder does not implement. */
const UNSUPPORTED = new Error('unsupported by the fast validator');

export function unsupported(): never {
  throw UNSUPPORTED;
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
