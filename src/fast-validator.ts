import type { JsonSchemaAll, JsonSchemaInternal } from './json-schema-versions.js';
import type { BuildState, Check, FastValidator, KeywordCompiler } from './validation/fast-shared.js';
import type { ZSchemaBase } from './z-schema-base.js';

import { isInternalKey } from './json-schema.js';
import { isObject } from './utils/what-is.js';
import {
  compileContains,
  compileItemKeywords,
  compileMaxItems,
  compileMinItems,
  compileUniqueItems,
} from './validation/array.js';
import { compileAllOf, compileAnyOf, compileIf, compileNot, compileOneOf } from './validation/combinators.js';
import { ALWAYS_FALSE, ALWAYS_TRUE, unsupported } from './validation/fast-shared.js';
import {
  compileExclusiveMaximum,
  compileExclusiveMinimum,
  compileMaximum,
  compileMinimum,
  compileMultipleOf,
} from './validation/numeric.js';
import { compileObjectKeywords } from './validation/object.js';
import { isModernDraft, isValidationVocabularyEnabled, MAX_LEGACY_REF_HOPS } from './validation/shared.js';
import {
  compileContent,
  compileFormat,
  compileMaxLength,
  compileMinLength,
  compilePattern,
} from './validation/string.js';
import { compileConst, compileEnum, compileType } from './validation/type.js';

export type { FastValidator } from './validation/fast-shared.js';

// ---------------------------------------------------------------------------
// $ref
// ---------------------------------------------------------------------------

// Modern drafts: the target and the node's sibling keywords both apply. Legacy drafts are handled in compileNode.
function compileRef(state: BuildState, node: JsonSchemaInternal, checks: Check[]): void {
  if (!isModernDraft(state.ctx.options.version)) {
    return; // legacy: an empty $ref is inert; a non-empty one never reaches the keyword loop
  }
  const target = node.__$refResolved as unknown;
  if (target === undefined) {
    unsupported();
  }
  const built = state.compileChild(target);
  if (built !== ALWAYS_TRUE) {
    checks.push(built);
  }
}

// ---------------------------------------------------------------------------
// keyword table
// ---------------------------------------------------------------------------

/** Keywords the interpreter treats as no-ops, or that a sibling keyword's compiler already covers. */
const ignored: KeywordCompiler = () => {
  // intentionally empty
};

/** Keywords the builder does not implement: a schema using one has no fast validator. */
const unsupportedKeyword: KeywordCompiler = () => unsupported();

/**
 * Every keyword of the schema type and how the builder treats it; the source of truth for what is supported.
 * Exhaustive on purpose: a keyword added to the schema type must be classified here. Keywords of one group share
 * a compiler, which `compileNode` runs once per node.
 */
const KEYWORD_COMPILERS: Record<keyof JsonSchemaAll, KeywordCompiler> = {
  // identifiers, annotations and containers that are never traversed
  id: ignored,
  $id: ignored,
  $schema: ignored,
  $anchor: ignored,
  $defs: ignored,
  definitions: ignored,
  $vocabulary: ignored,
  $dynamicAnchor: ignored,
  $recursiveAnchor: ignored,
  examples: ignored,
  title: ignored,
  description: ignored,
  default: ignored,
  // covered by their sibling keywords
  minContains: ignored,
  maxContains: ignored,
  then: ignored,
  else: ignored,
  // not implemented
  $dynamicRef: unsupportedKeyword,
  $recursiveRef: unsupportedKeyword,
  unevaluatedItems: unsupportedKeyword,
  unevaluatedProperties: unsupportedKeyword,
  // implemented
  type: compileType,
  enum: compileEnum,
  const: compileConst,
  minimum: compileMinimum,
  maximum: compileMaximum,
  exclusiveMinimum: compileExclusiveMinimum,
  exclusiveMaximum: compileExclusiveMaximum,
  multipleOf: compileMultipleOf,
  minLength: compileMinLength,
  maxLength: compileMaxLength,
  pattern: compilePattern,
  format: compileFormat,
  minItems: compileMinItems,
  maxItems: compileMaxItems,
  uniqueItems: compileUniqueItems,
  items: compileItemKeywords,
  prefixItems: compileItemKeywords,
  additionalItems: compileItemKeywords,
  contains: compileContains,
  properties: compileObjectKeywords,
  patternProperties: compileObjectKeywords,
  additionalProperties: compileObjectKeywords,
  required: compileObjectKeywords,
  minProperties: compileObjectKeywords,
  maxProperties: compileObjectKeywords,
  dependencies: compileObjectKeywords,
  dependentRequired: compileObjectKeywords,
  dependentSchemas: compileObjectKeywords,
  propertyNames: compileObjectKeywords,
  allOf: compileAllOf,
  anyOf: compileAnyOf,
  oneOf: compileOneOf,
  not: compileNot,
  if: compileIf,
  $ref: compileRef,
  contentEncoding: compileContent,
  contentMediaType: compileContent,
};

/**
 * Legacy drafts: follows the `$ref` chain like the interpreter and returns the final target, whose keywords alone
 * apply. `undefined` when the chain is unresolved, self-referential, too long or ends in a non-object.
 */
function followLegacyRef(node: JsonSchemaInternal): JsonSchemaInternal | undefined {
  let current = node;
  let hops = 0;
  while (current.$ref) {
    const next = current.__$refResolved as unknown;
    if (!isObject(next) || next === current || hops + 1 >= MAX_LEGACY_REF_HOPS) {
      return undefined;
    }
    current = next as JsonSchemaInternal;
    hops++;
  }
  return current;
}

function combine(checks: Check[]): FastValidator {
  const count = checks.length;
  if (count === 0) {
    return ALWAYS_TRUE;
  }
  if (count === 1) {
    return checks[0];
  }
  return (json) => {
    for (let i = 0; i < count; i++) {
      if (!checks[i](json)) {
        return false;
      }
    }
    return true;
  };
}

function compileNode(state: BuildState, node: unknown, isRoot: boolean): FastValidator {
  if (node === true) {
    return ALWAYS_TRUE;
  }
  if (node === false) {
    return ALWAYS_FALSE;
  }
  if (typeof node !== 'object' || node === null || Array.isArray(node)) {
    return unsupported();
  }
  const schema = node as JsonSchemaInternal;
  const known = state.memo.get(schema);
  if (known !== undefined) {
    return known;
  }
  // Registered before descending so a recursive reference to this node terminates.
  const slot = { fn: ALWAYS_FALSE };
  state.memo.set(schema, (json) => slot.fn(json));

  // The interpreter evaluates the vocabulary per node against the validation's root schema.
  if (!isRoot && !isValidationVocabularyEnabled(schema, state.root, state.ctx.options.version)) {
    return unsupported();
  }

  if (schema.$ref && !isModernDraft(state.ctx.options.version)) {
    // siblings of a legacy $ref are ignored: only the final target of the chain is validated
    const target = followLegacyRef(schema);
    if (target === undefined) {
      return unsupported();
    }
    const built = state.compileChild(target);
    slot.fn = built;
    state.memo.set(schema, built);
    return built;
  }

  const checks: Check[] = [];
  const compiled: KeywordCompiler[] = [];
  const keys = Object.keys(schema);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (isInternalKey(key) || !Object.hasOwn(KEYWORD_COMPILERS, key)) {
      continue; // internal bookkeeping, or an unknown keyword (ignored by the interpreter too)
    }
    // a non-root node may declare only the root's own dialect (e.g. a remote schema stamped on compile)
    if (key === '$schema' && !isRoot && schema.$schema !== state.root.$schema) {
      return unsupported();
    }
    const compile = KEYWORD_COMPILERS[key as keyof JsonSchemaAll];
    // keywords of one group share a compiler; checks are ANDed and pure, so each runs once, in any order
    if (compile !== ignored && !compiled.includes(compile)) {
      compiled.push(compile);
      compile(state, schema, checks);
    }
  }
  const built = combine(checks);
  slot.fn = built;
  state.memo.set(schema, built);
  return built;
}

/**
 * Builds a boolean validator for a compiled, meta-validated schema, or returns `undefined` when the schema
 * uses anything the builder does not implement. For a schema it accepts, the result agrees with the
 * interpreter's validity for every input; it never produces error details.
 * @param schema - The compiled schema root held by the compiled-schema cache.
 * @param ctx - The validator whose options the schema was compiled under. Options are read at build time,
 * except `assumeAdditional`, which is read on every call.
 */
export function buildFastValidator(schema: JsonSchemaInternal, ctx: ZSchemaBase): FastValidator | undefined {
  if (typeof ctx.options.customValidator === 'function') {
    return undefined;
  }
  if (!isValidationVocabularyEnabled(schema, schema, ctx.options.version)) {
    return undefined;
  }
  const state: BuildState = {
    ctx,
    root: schema,
    memo: new Map<object, FastValidator>(),
    eqOpts: { maxDepth: ctx.options.maxRecursionDepth },
    compileChild: (child) => compileNode(state, child, false),
  };
  try {
    return compileNode(state, schema, true);
  } catch {
    // The sentinel thrown by unsupported(), or anything unexpected (e.g. a stack overflow on a very deep
    // schema): either way there is no fast validator and the interpreter handles the schema.
    return undefined;
  }
}
