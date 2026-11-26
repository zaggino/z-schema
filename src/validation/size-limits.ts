import type { ErrorCode } from '../errors.js';
import type { JsonSchemaAll, JsonSchemaInternal } from '../json-schema-versions.js';
import type { ValidateOptions } from '../z-schema-base.js';

import { unicodeLength } from '../utils/unicode.js';
import { isObject } from '../utils/what-is.js';
import { isErrorReported } from './shared.js';

/** An upper size limit of a schema node and the keywords that are not run for a value over it. */
export interface SizeLimit {
  /** Position in `SIZE_LIMITS` and in `KeywordPlan.keysOverLimit`. */
  readonly index: number;
  readonly keyword: 'maxLength' | 'maxItems' | 'maxProperties';
  readonly code: ErrorCode;
  /** Keywords of the node that are not run for a value over this limit. */
  readonly gated: ReadonlySet<keyof JsonSchemaAll>;
}

// The item and property traversals (`items` / `prefixItems` and the child validation of properties) are not
// keywords of the keyword loop; `validate()` skips them for a value over the limit.
const STRING_LIMIT: SizeLimit = {
  index: 0,
  keyword: 'maxLength',
  code: 'MAX_LENGTH',
  gated: new Set<keyof JsonSchemaAll>(['pattern', 'format', 'contentEncoding', 'contentMediaType']),
};

const ARRAY_LIMIT: SizeLimit = {
  index: 1,
  keyword: 'maxItems',
  code: 'ARRAY_LENGTH_LONG',
  gated: new Set<keyof JsonSchemaAll>(['uniqueItems', 'contains', 'unevaluatedItems', 'additionalItems']),
};

const OBJECT_LIMIT: SizeLimit = {
  index: 2,
  keyword: 'maxProperties',
  code: 'OBJECT_PROPERTIES_MAXIMUM',
  gated: new Set<keyof JsonSchemaAll>([
    'properties',
    'patternProperties',
    'additionalProperties',
    'propertyNames',
    'unevaluatedProperties',
  ]),
};

/** The size limits: string, array, object, in that order. */
export const SIZE_LIMITS: readonly SizeLimit[] = [STRING_LIMIT, ARRAY_LIMIT, OBJECT_LIMIT];

/** Which size limits of a node can gate other work (see `sizeLimitFlags`). */
export interface SizeLimitFlags {
  readonly string: boolean;
  readonly array: boolean;
  readonly object: boolean;
}

const hasGatedKeyword = (schema: JsonSchemaInternal, limit: SizeLimit): boolean => {
  for (const key of limit.gated) {
    if (schema[key as keyof JsonSchemaInternal] !== undefined) {
      return true;
    }
  }
  return false;
};

/**
 * The size limits of the node that can gate other work, or `undefined` for none: `maxItems` always (its value can
 * also skip the traversal of the items), `maxLength` and `maxProperties` only together with a keyword they stop,
 * since counting code points or keys is not free. Used when a keyword plan is built.
 */
export function sizeLimitFlags(schema: JsonSchemaInternal): SizeLimitFlags | undefined {
  const string = schema.maxLength !== undefined && hasGatedKeyword(schema, STRING_LIMIT);
  const array = schema.maxItems !== undefined;
  const object = schema.maxProperties !== undefined && hasGatedKeyword(schema, OBJECT_LIMIT);
  return string || array || object ? { string, array, object } : undefined;
}

/**
 * The size limit of `schema` that `json` exceeds, or `undefined`. Only the limits set in `flags`
 * (from `sizeLimitFlags`) are compared. Runs on every visit of a node that has flags; only a result other than
 * `undefined` is rare. A limit whose error is not reported (`isErrorReported`) is never exceeded.
 */
export function exceededSizeLimit(
  options: ValidateOptions,
  schema: JsonSchemaInternal,
  json: unknown,
  flags: SizeLimitFlags
): SizeLimit | undefined {
  if (typeof json === 'string') {
    if (!flags.string) {
      return undefined;
    }
    const max = schema.maxLength;
    // code units never fewer than code points: a string that fits in code units fits in code points
    if (
      typeof max === 'number' &&
      json.length > max &&
      isErrorReported(options, STRING_LIMIT.code) &&
      unicodeLength(json) > max
    ) {
      return STRING_LIMIT;
    }
    return undefined;
  }
  if (Array.isArray(json)) {
    if (!flags.array) {
      return undefined;
    }
    const max = schema.maxItems;
    if (typeof max === 'number' && json.length > max && isErrorReported(options, ARRAY_LIMIT.code)) {
      return ARRAY_LIMIT;
    }
    return undefined;
  }
  if (flags.object && isObject(json)) {
    const max = schema.maxProperties;
    if (typeof max !== 'number') {
      return undefined;
    }
    // bounded count of the own enumerable keys: stops at the first one over the limit and allocates nothing
    let count = 0;
    for (const key in json) {
      if (Object.hasOwn(json, key)) {
        count++;
        if (count > max) {
          break;
        }
      }
    }
    if (count > max && isErrorReported(options, OBJECT_LIMIT.code)) {
      return OBJECT_LIMIT;
    }
  }
  return undefined;
}
