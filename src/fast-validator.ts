import type { JsonSchemaAll, JsonSchemaInternal } from './json-schema-versions.js';
import type { ZSchemaBase } from './z-schema-base.js';

import { isSyncBuiltInFormatValidator, resolveFormatValidator } from './format-validators.js';
import { isInternalKey } from './json-schema.js';
import { isUniqueArray } from './utils/array.js';
import { areEqual } from './utils/json.js';
import { compileSchemaRegex } from './utils/schema-regex.js';
import { unicodeLength } from './utils/unicode.js';
import { isObject, whatIs } from './utils/what-is.js';
import { isMultipleOf } from './validation/numeric.js';
import {
  isFormatAssertionVocabEnabled,
  isModernDraft,
  isValidationVocabularyEnabled,
  supportsDependentKeywords,
} from './validation/shared.js';

/** A specialised validity check for one compiled schema. Returns `true` only when `json` is valid. */
export type FastValidator = (json: unknown) => boolean;

type Check = FastValidator;

const ALWAYS_TRUE: FastValidator = () => true;
const ALWAYS_FALSE: FastValidator = () => false;

/** Everything a keyword compiler needs. */
interface BuildState {
  readonly ctx: ZSchemaBase;
  readonly root: JsonSchemaInternal;
  readonly memo: Map<object, FastValidator>;
  readonly eqOpts: { maxDepth: number | undefined };
}

type KeywordCompiler = (state: BuildState, node: JsonSchemaInternal, checks: Check[]) => void;

/** Thrown (and caught once, in `buildFastValidator`) when the schema uses anything the builder does not implement. */
const UNSUPPORTED = new Error('unsupported by the fast validator');

function unsupported(): never {
  throw UNSUPPORTED;
}

/** A numeric keyword value, or the build is unsupported. */
function num(value: unknown): number {
  if (typeof value !== 'number') {
    unsupported();
  }
  return value;
}

/** An array keyword value, or the build is unsupported. */
function list(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    unsupported();
  }
  return value;
}

/** An array of strings, or the build is unsupported. */
function stringArray(value: unknown): string[] {
  const items = list(value);
  for (let i = 0; i < items.length; i++) {
    if (typeof items[i] !== 'string') {
      unsupported();
    }
  }
  return items as string[];
}

/** A plain-object keyword value, or the build is unsupported. */
function record(value: unknown): Record<string, unknown> {
  if (!isObject(value)) {
    unsupported();
  }
  return value as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// type / enum / const
// ---------------------------------------------------------------------------

function compileType(_state: BuildState, node: JsonSchemaInternal, checks: Check[]): void {
  const { type } = node;
  if (typeof type === 'string') {
    if (type === 'number') {
      // an integer is also a number
      checks.push((json) => {
        const jsonType = whatIs(json);
        return jsonType === 'number' || jsonType === 'integer';
      });
    } else {
      checks.push((json) => whatIs(json) === type);
    }
  } else if (Array.isArray(type)) {
    const types = type as unknown[];
    const allowsNumber = types.includes('number');
    checks.push((json) => {
      const jsonType = whatIs(json);
      return types.includes(jsonType) || (jsonType === 'integer' && allowsNumber);
    });
  } else {
    unsupported();
  }
}

function compileEnum(state: BuildState, node: JsonSchemaInternal, checks: Check[]): void {
  const values = list(node.enum);
  const { eqOpts } = state;
  checks.push((json) => {
    for (let i = 0; i < values.length; i++) {
      if (areEqual(json, values[i], eqOpts)) {
        return true;
      }
    }
    return false;
  });
}

function compileConst(state: BuildState, node: JsonSchemaInternal, checks: Check[]): void {
  const constValue = node.const;
  const { eqOpts } = state;
  checks.push((json) => areEqual(json, constValue, eqOpts));
}

// ---------------------------------------------------------------------------
// numeric
// ---------------------------------------------------------------------------

function compileMinimum(_state: BuildState, node: JsonSchemaInternal, checks: Check[]): void {
  const minimum = num(node.minimum);
  // Negated comparisons, exactly as the interpreter's error conditions, so NaN passes in both.
  if (node.exclusiveMinimum === true) {
    checks.push((json) => typeof json !== 'number' || !(json <= minimum));
  } else {
    checks.push((json) => typeof json !== 'number' || !(json < minimum));
  }
}

function compileMaximum(_state: BuildState, node: JsonSchemaInternal, checks: Check[]): void {
  const maximum = num(node.maximum);
  if (node.exclusiveMaximum === true) {
    checks.push((json) => typeof json !== 'number' || !(json >= maximum));
  } else {
    checks.push((json) => typeof json !== 'number' || !(json > maximum));
  }
}

// draft-06+ standalone numeric form; the draft-04 boolean form is handled by minimum/maximum
function compileExclusiveMinimum(_state: BuildState, node: JsonSchemaInternal, checks: Check[]): void {
  const bound = node.exclusiveMinimum;
  if (typeof bound === 'number') {
    checks.push((json) => typeof json !== 'number' || !(json <= bound));
  }
}

function compileExclusiveMaximum(_state: BuildState, node: JsonSchemaInternal, checks: Check[]): void {
  const bound = node.exclusiveMaximum;
  if (typeof bound === 'number') {
    checks.push((json) => typeof json !== 'number' || !(json >= bound));
  }
}

function compileMultipleOf(_state: BuildState, node: JsonSchemaInternal, checks: Check[]): void {
  const multipleOf = num(node.multipleOf);
  checks.push((json) => typeof json !== 'number' || isMultipleOf(json, multipleOf));
}

// ---------------------------------------------------------------------------
// string
// ---------------------------------------------------------------------------

function compileMinLength(_state: BuildState, node: JsonSchemaInternal, checks: Check[]): void {
  const minLength = num(node.minLength);
  checks.push((json) => typeof json !== 'string' || !(unicodeLength(json) < minLength));
}

function compileMaxLength(_state: BuildState, node: JsonSchemaInternal, checks: Check[]): void {
  const maxLength = num(node.maxLength);
  checks.push((json) => typeof json !== 'string' || !(unicodeLength(json) > maxLength));
}

function compilePattern(_state: BuildState, node: JsonSchemaInternal, checks: Check[]): void {
  const { pattern } = node;
  if (typeof pattern !== 'string') {
    unsupported();
  }
  const result = compileSchemaRegex(pattern);
  if (!result.ok) {
    unsupported();
  }
  const re = result.value;
  checks.push((json) => typeof json !== 'string' || re.test(json));
}

function compileFormat(state: BuildState, node: JsonSchemaInternal, checks: Check[]): void {
  const { ctx, root } = state;
  const { options } = ctx;
  const { format } = node;
  if (typeof format !== 'string') {
    unsupported();
  }
  if (options.formatAssertions === false) {
    return;
  }
  if (options.formatAssertions === true && !isFormatAssertionVocabEnabled(node, root, options.version)) {
    return;
  }
  const fn = resolveFormatValidator(format, options);
  if (typeof fn === 'function') {
    // A custom validator may be async (callback or promise based): only built-ins are known sync.
    if (!isSyncBuiltInFormatValidator(fn)) {
      unsupported();
    }
    checks.push((json) => !!fn.call(ctx, json));
    return;
  }
  if (options.ignoreUnknownFormats !== true && (options.formatAssertions === true || !isModernDraft(options.version))) {
    checks.push(ALWAYS_FALSE);
  }
}

// ---------------------------------------------------------------------------
// shared helpers for applicators
// ---------------------------------------------------------------------------

type RawNode = Record<string, unknown>;

/** Compiles a child schema; a child that cannot be compiled makes the whole build unsupported. */
function compileChild(state: BuildState, child: unknown): FastValidator {
  return compileNode(state, child, false);
}

// ---------------------------------------------------------------------------
// arrays
// ---------------------------------------------------------------------------

const DRAFT_2020_12_SCHEMA_URI = 'https://json-schema.org/draft/2020-12/schema';

function compileMinItems(_state: BuildState, node: JsonSchemaInternal, checks: Check[]): void {
  const minItems = num(node.minItems);
  checks.push((json) => !Array.isArray(json) || !(json.length < minItems));
}

function compileMaxItems(_state: BuildState, node: JsonSchemaInternal, checks: Check[]): void {
  const maxItems = num(node.maxItems);
  checks.push((json) => !Array.isArray(json) || !(json.length > maxItems));
}

function compileUniqueItems(state: BuildState, node: JsonSchemaInternal, checks: Check[]): void {
  if (node.uniqueItems !== true) {
    return;
  }
  const maxDepth = state.ctx.options.maxRecursionDepth;
  checks.push((json) => !Array.isArray(json) || isUniqueArray(json, undefined, maxDepth));
}

// items / prefixItems / additionalItems, compiled together: they select the child schema per index
function compileItemKeywords(state: BuildState, node: JsonSchemaInternal, checks: Check[]): void {
  const raw = node as unknown as RawNode;
  const { items, additionalItems } = raw;

  if (additionalItems === false && Array.isArray(items)) {
    const tupleLength = items.length;
    checks.push((json) => !Array.isArray(json) || !(json.length > tupleLength));
  }

  const schemaUri = typeof raw.$schema === 'string' ? raw.$schema : undefined;
  const usesPrefixItems =
    (schemaUri === DRAFT_2020_12_SCHEMA_URI || (!schemaUri && state.ctx.options.version === 'draft2020-12')) &&
    Array.isArray(raw.prefixItems);

  let head: unknown[] | undefined;
  let tail: unknown;
  if (usesPrefixItems) {
    head = raw.prefixItems as unknown[];
    if (items !== undefined && !Array.isArray(items)) {
      tail = items;
    }
  } else if (Array.isArray(items)) {
    head = items;
    if (typeof additionalItems === 'object') {
      tail = additionalItems;
    }
  } else if (typeof items === 'object' || typeof items === 'boolean') {
    tail = items;
  }

  const headChecks: Check[] = [];
  if (head !== undefined) {
    for (let i = 0; i < head.length; i++) {
      headChecks.push(compileChild(state, head[i]));
    }
  }
  let tailCheck: Check | undefined;
  if (tail !== undefined) {
    tailCheck = compileChild(state, tail);
    if (tailCheck === ALWAYS_TRUE) {
      tailCheck = undefined;
    }
  }

  const headCount = headChecks.length;
  if (headCount === 0) {
    if (tailCheck === undefined) {
      return;
    }
    const each = tailCheck;
    checks.push((json) => {
      if (!Array.isArray(json)) {
        return true;
      }
      for (let i = 0; i < json.length; i++) {
        if (!each(json[i])) {
          return false;
        }
      }
      return true;
    });
    return;
  }
  const rest = tailCheck;
  checks.push((json) => {
    if (!Array.isArray(json)) {
      return true;
    }
    const { length } = json;
    const headEnd = length < headCount ? length : headCount;
    for (let i = 0; i < headEnd; i++) {
      if (!headChecks[i](json[i])) {
        return false;
      }
    }
    if (rest !== undefined) {
      for (let i = headEnd; i < length; i++) {
        if (!rest(json[i])) {
          return false;
        }
      }
    }
    return true;
  });
}

// contains, with minContains / maxContains (honoured on 2019-09 and later only)
function compileContains(state: BuildState, node: JsonSchemaInternal, checks: Check[]): void {
  const raw = node as unknown as RawNode;
  if (raw.contains === undefined) {
    return;
  }
  const each = compileChild(state, raw.contains);
  const { version } = state.ctx.options;
  const supportsBounds = version === 'draft2019-09' || version === 'draft2020-12';
  const min = supportsBounds && typeof raw.minContains === 'number' ? raw.minContains : 1;
  const max = supportsBounds && typeof raw.maxContains === 'number' ? raw.maxContains : undefined;

  if (max === undefined) {
    if (min <= 0) {
      // always satisfied; the sub-schema was still compiled so an unsupported one rejects the build
      return;
    }
    checks.push((json) => {
      if (!Array.isArray(json)) {
        return true;
      }
      let matches = 0;
      for (let i = 0; i < json.length; i++) {
        if (each(json[i]) && ++matches >= min) {
          return true;
        }
      }
      return false;
    });
    return;
  }
  checks.push((json) => {
    if (!Array.isArray(json)) {
      return true;
    }
    let matches = 0;
    for (let i = 0; i < json.length; i++) {
      if (each(json[i])) {
        matches++;
        if (matches > max) {
          return false;
        }
      }
    }
    return matches >= min;
  });
}

// ---------------------------------------------------------------------------
// objects
// ---------------------------------------------------------------------------

type ObjectInstance = Record<string, unknown>;
/** A check on an object instance that also receives its `Object.keys`, computed once per node visit. */
type KeysCheck = (json: ObjectInstance, keys: string[]) => boolean;

// Object checks receive `json` only after the caller has established it is a non-null, non-array object.

/** If `name` is present, every name in `names` must be present. */
function requiresAll(name: string, names: string[]): Check {
  return (json) => {
    if (!Object.hasOwn(json as object, name)) {
      return true;
    }
    for (let i = 0; i < names.length; i++) {
      if (!Object.hasOwn(json as object, names[i])) {
        return false;
      }
    }
    return true;
  };
}

/** If `name` is present, `check` must pass on the whole object. */
function whenPresent(name: string, check: Check): Check {
  return (json) => !Object.hasOwn(json as object, name) || check(json);
}

function compileRequiredCheck(node: RawNode, plain: Check[]): void {
  const { required } = node;
  if (required === undefined) {
    return;
  }
  const names = stringArray(required);
  const count = names.length;
  if (count === 0) {
    return;
  }
  plain.push((json) => {
    for (let i = 0; i < count; i++) {
      if (!Object.hasOwn(json as object, names[i])) {
        return false;
      }
    }
    return true;
  });
}

function compilePropertyCounts(node: RawNode, withKeys: KeysCheck[]): void {
  if (node.minProperties !== undefined) {
    const min = num(node.minProperties);
    withKeys.push((_json, keys) => !(keys.length < min));
  }
  if (node.maxProperties !== undefined) {
    const max = num(node.maxProperties);
    withKeys.push((_json, keys) => !(keys.length > max));
  }
}

// properties / patternProperties / additionalProperties: child traversal and the additionalProperties false rule
function compilePropertyTraversal(state: BuildState, node: RawNode, withKeys: KeysCheck[]): void {
  const { properties, patternProperties, additionalProperties } = node;
  const forbidAdditional = additionalProperties === false;
  let additional: Check | undefined;
  if (additionalProperties !== undefined && additionalProperties !== true && additionalProperties !== false) {
    additional = compileChild(state, additionalProperties);
    if (additional === ALWAYS_TRUE) {
      additional = undefined;
    }
  }
  // a key matched by nothing only matters when something reacts to it
  const needsUnmatched = forbidAdditional || additional !== undefined;

  let propertyChecks: Map<string, Check> | undefined;
  if (properties !== undefined) {
    const props = record(properties);
    const names = Object.keys(props);
    for (let i = 0; i < names.length; i++) {
      const built = compileChild(state, props[names[i]]);
      if (built !== ALWAYS_TRUE || needsUnmatched) {
        propertyChecks ??= new Map<string, Check>();
        propertyChecks.set(names[i], built);
      }
    }
  }

  const patterns: RegExp[] = [];
  const patternChecks: Check[] = [];
  if (patternProperties !== undefined) {
    const patternSchemas = record(patternProperties);
    const sources = Object.keys(patternSchemas);
    for (let i = 0; i < sources.length; i++) {
      const compiled = compileSchemaRegex(sources[i]);
      if (!compiled.ok) {
        continue; // skipped by the interpreter too
      }
      const built = compileChild(state, patternSchemas[sources[i]]);
      if (built !== ALWAYS_TRUE || needsUnmatched) {
        patterns.push(compiled.value);
        patternChecks.push(built);
      }
    }
  }

  // The options object is read at call time, like the interpreter does, so in-place edits of the array are honoured.
  const { options } = state.ctx;
  const patternCount = patterns.length;
  if (propertyChecks === undefined && patternCount === 0 && !needsUnmatched) {
    return;
  }
  withKeys.push((json, keys) => {
    for (let k = 0; k < keys.length; k++) {
      const key = keys[k];
      const value = json[key];
      let matched = false;
      if (propertyChecks !== undefined) {
        const check = propertyChecks.get(key);
        if (check !== undefined) {
          matched = true;
          if (!check(value)) {
            return false;
          }
        }
      }
      for (let i = 0; i < patternCount; i++) {
        if (patterns[i].test(key)) {
          matched = true;
          if (!patternChecks[i](value)) {
            return false;
          }
        }
      }
      if (!matched) {
        if (additional !== undefined) {
          if (!additional(value)) {
            return false;
          }
        } else if (forbidAdditional) {
          const assumed = options.assumeAdditional;
          if (!Array.isArray(assumed) || !assumed.includes(key)) {
            return false;
          }
        }
      }
    }
    return true;
  });
}

function compileDependencies(state: BuildState, node: RawNode, plain: Check[]): void {
  const { dependencies } = node;
  if (dependencies === undefined) {
    return;
  }
  const definitions = record(dependencies);
  const names = Object.keys(definitions);
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    const definition = definitions[name];
    plain.push(
      Array.isArray(definition)
        ? requiresAll(name, stringArray(definition))
        : whenPresent(name, compileChild(state, definition))
    );
  }
}

function compileDependentKeywords(state: BuildState, node: RawNode, plain: Check[]): void {
  if (!supportsDependentKeywords(node, state.ctx.options.version)) {
    return;
  }
  const { dependentRequired, dependentSchemas } = node;
  if (isObject(dependentRequired)) {
    const names = Object.keys(dependentRequired);
    for (let i = 0; i < names.length; i++) {
      const required = dependentRequired[names[i]] as unknown;
      // like the interpreter, a value that is not an array is skipped
      if (Array.isArray(required)) {
        plain.push(requiresAll(names[i], stringArray(required)));
      }
    }
  }
  if (isObject(dependentSchemas)) {
    const names = Object.keys(dependentSchemas);
    for (let i = 0; i < names.length; i++) {
      plain.push(whenPresent(names[i], compileChild(state, dependentSchemas[names[i]])));
    }
  }
}

function compilePropertyNames(state: BuildState, node: RawNode, withKeys: KeysCheck[]): void {
  if (node.propertyNames === undefined) {
    return;
  }
  const each = compileChild(state, node.propertyNames);
  if (each === ALWAYS_TRUE) {
    return;
  }
  withKeys.push((_json, keys) => {
    for (let i = 0; i < keys.length; i++) {
      if (!each(keys[i])) {
        return false;
      }
    }
    return true;
  });
}

// Every object keyword of a node, folded into one check so `Object.keys(json)` is computed once.
function compileObjectKeywords(state: BuildState, node: JsonSchemaInternal, checks: Check[]): void {
  const raw = node as unknown as RawNode;
  const plain: Check[] = [];
  const withKeys: KeysCheck[] = [];
  compileRequiredCheck(raw, plain);
  compileDependencies(state, raw, plain);
  compileDependentKeywords(state, raw, plain);
  compilePropertyCounts(raw, withKeys);
  compilePropertyTraversal(state, raw, withKeys);
  compilePropertyNames(state, raw, withKeys);
  const plainCount = plain.length;
  const keyedCount = withKeys.length;
  if (plainCount === 0 && keyedCount === 0) {
    return;
  }
  if (keyedCount === 0) {
    checks.push((json) => {
      if (!isObject(json)) {
        return true;
      }
      for (let i = 0; i < plainCount; i++) {
        if (!plain[i](json)) {
          return false;
        }
      }
      return true;
    });
    return;
  }
  checks.push((json) => {
    if (!isObject(json)) {
      return true;
    }
    for (let i = 0; i < plainCount; i++) {
      if (!plain[i](json)) {
        return false;
      }
    }
    const keys = Object.keys(json);
    for (let i = 0; i < keyedCount; i++) {
      if (!withKeys[i](json, keys)) {
        return false;
      }
    }
    return true;
  });
}

// ---------------------------------------------------------------------------
// combinators
// ---------------------------------------------------------------------------

/** Compiles every member of a combinator array; the build is unsupported when the value is not an array. */
function compileMembers(state: BuildState, value: unknown): Check[] {
  const schemas = list(value);
  const members: Check[] = [];
  for (let i = 0; i < schemas.length; i++) {
    members.push(compileChild(state, schemas[i]));
  }
  return members;
}

function compileAllOf(state: BuildState, node: JsonSchemaInternal, checks: Check[]): void {
  const members = compileMembers(state, node.allOf);
  for (let i = 0; i < members.length; i++) {
    if (members[i] !== ALWAYS_TRUE) {
      checks.push(members[i]);
    }
  }
}

function compileAnyOf(state: BuildState, node: JsonSchemaInternal, checks: Check[]): void {
  const members = compileMembers(state, node.anyOf);
  const count = members.length;
  if (count === 0) {
    checks.push(ALWAYS_FALSE);
    return;
  }
  for (let i = 0; i < count; i++) {
    if (members[i] === ALWAYS_TRUE) {
      return;
    }
  }
  if (count === 1) {
    checks.push(members[0]);
    return;
  }
  checks.push((json) => {
    for (let i = 0; i < count; i++) {
      if (members[i](json)) {
        return true;
      }
    }
    return false;
  });
}

function compileOneOf(state: BuildState, node: JsonSchemaInternal, checks: Check[]): void {
  const members = compileMembers(state, node.oneOf);
  const count = members.length;
  if (count === 0) {
    checks.push(ALWAYS_FALSE);
    return;
  }
  if (count === 1) {
    checks.push(members[0]);
    return;
  }
  checks.push((json) => {
    let passes = 0;
    for (let i = 0; i < count; i++) {
      if (members[i](json) && ++passes > 1) {
        return false;
      }
    }
    return passes === 1;
  });
}

function compileNot(state: BuildState, node: JsonSchemaInternal, checks: Check[]): void {
  const inner = compileChild(state, node.not);
  checks.push((json) => !inner(json));
}

function compileIf(state: BuildState, node: JsonSchemaInternal, checks: Check[]): void {
  const { version } = state.ctx.options;
  if (version === 'draft-04' || version === 'draft-06') {
    return;
  }
  const raw = node as unknown as RawNode;
  const { then: thenSchema, else: elseSchema } = raw;
  if (raw.if === undefined || (thenSchema === undefined && elseSchema === undefined)) {
    return;
  }
  const condition = compileChild(state, raw.if);
  const onThen = thenSchema === undefined ? ALWAYS_TRUE : compileChild(state, thenSchema);
  const onElse = elseSchema === undefined ? ALWAYS_TRUE : compileChild(state, elseSchema);
  checks.push((json) => (condition(json) ? onThen(json) : onElse(json)));
}

// ---------------------------------------------------------------------------
// $ref and content keywords
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
  const built = compileChild(state, target);
  if (built !== ALWAYS_TRUE) {
    checks.push(built);
  }
}

// contentEncoding / contentMediaType only assert on draft-07
function compileContent(state: BuildState): void {
  if (state.ctx.options.version === 'draft-07') {
    unsupported();
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

const MAX_LEGACY_REF_HOPS = 99;

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
    const built = compileChild(state, target);
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
  };
  try {
    return compileNode(state, schema, true);
  } catch {
    // The sentinel thrown by unsupported(), or anything unexpected (e.g. a stack overflow on a very deep
    // schema): either way there is no fast validator and the interpreter handles the schema.
    return undefined;
  }
}
