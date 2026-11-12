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
  readonly memo: Map<object, FastValidator>;
  readonly eqOpts: { maxDepth: number | undefined };
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
export function num(value: unknown): number {
  if (typeof value !== 'number') {
    unsupported();
  }
  return value;
}

/** An array keyword value, or the build is unsupported. */
export function list(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    unsupported();
  }
  return value;
}

/** An array of strings, or the build is unsupported. */
export function stringArray(value: unknown): string[] {
  const items = list(value);
  for (let i = 0; i < items.length; i++) {
    if (typeof items[i] !== 'string') {
      unsupported();
    }
  }
  return items as string[];
}

/** A plain-object keyword value, or the build is unsupported. */
export function record(value: unknown): Record<string, unknown> {
  if (!isObject(value)) {
    unsupported();
  }
  return value as Record<string, unknown>;
}
