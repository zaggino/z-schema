import type { JsonSchemaInternal } from './json-schema-versions.js';
import type { Report } from './report.js';
import type { ZSchemaBase } from './z-schema-base.js';

import { isInbuiltFormatValidator, resolveFormatValidator } from './format-validators.js';
import { isInternalKey } from './json-schema.js';
import { JsonValidators } from './json-validation.js';
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

/** Keywords the interpreter treats as no-ops (annotations, identifiers, containers that are never traversed). */
const IGNORABLE_KEYWORDS = new Set<string>([
  'id',
  '$id',
  '$schema',
  '$anchor',
  '$defs',
  'definitions',
  '$vocabulary',
  '$dynamicAnchor',
  'examples',
  'title',
  'description',
  'default',
  '$recursiveAnchor',
]);

const ALWAYS_TRUE: FastValidator = () => true;
const ALWAYS_FALSE: FastValidator = () => false;

/** Everything a keyword compiler needs; `ok` flips to false when a node uses something unsupported. */
interface BuildState {
  readonly ctx: ZSchemaBase;
  readonly root: JsonSchemaInternal;
  readonly memo: Map<object, FastValidator>;
  readonly eqOpts: { maxDepth: number | undefined };
  ok: boolean;
}

type KeywordCompiler = (state: BuildState, node: JsonSchemaInternal, checks: Check[]) => void;

function unsupported(state: BuildState): void {
  state.ok = false;
}

// ---------------------------------------------------------------------------
// type / enum / const
// ---------------------------------------------------------------------------

function compileType(state: BuildState, node: JsonSchemaInternal, checks: Check[]): void {
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
    unsupported(state);
  }
}

function compileEnum(state: BuildState, node: JsonSchemaInternal, checks: Check[]): void {
  const values = node.enum as unknown;
  if (!Array.isArray(values)) {
    unsupported(state);
    return;
  }
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

function compileMinimum(state: BuildState, node: JsonSchemaInternal, checks: Check[]): void {
  const { minimum } = node;
  if (typeof minimum !== 'number') {
    unsupported(state);
    return;
  }
  // Negated comparisons, exactly as the interpreter's error conditions, so NaN passes in both.
  if (node.exclusiveMinimum === true) {
    checks.push((json) => typeof json !== 'number' || !(json <= minimum));
  } else {
    checks.push((json) => typeof json !== 'number' || !(json < minimum));
  }
}

function compileMaximum(state: BuildState, node: JsonSchemaInternal, checks: Check[]): void {
  const { maximum } = node;
  if (typeof maximum !== 'number') {
    unsupported(state);
    return;
  }
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

function compileMultipleOf(state: BuildState, node: JsonSchemaInternal, checks: Check[]): void {
  const { multipleOf } = node;
  if (typeof multipleOf !== 'number') {
    unsupported(state);
    return;
  }
  checks.push((json) => typeof json !== 'number' || isMultipleOf(json, multipleOf));
}

// ---------------------------------------------------------------------------
// string
// ---------------------------------------------------------------------------

function compileMinLength(state: BuildState, node: JsonSchemaInternal, checks: Check[]): void {
  const { minLength } = node;
  if (typeof minLength !== 'number') {
    unsupported(state);
    return;
  }
  checks.push((json) => typeof json !== 'string' || !(unicodeLength(json) < minLength));
}

function compileMaxLength(state: BuildState, node: JsonSchemaInternal, checks: Check[]): void {
  const { maxLength } = node;
  if (typeof maxLength !== 'number') {
    unsupported(state);
    return;
  }
  checks.push((json) => typeof json !== 'string' || !(unicodeLength(json) > maxLength));
}

function compilePattern(state: BuildState, node: JsonSchemaInternal, checks: Check[]): void {
  const { pattern } = node;
  if (typeof pattern !== 'string') {
    unsupported(state);
    return;
  }
  const result = compileSchemaRegex(pattern);
  if (!result.ok) {
    unsupported(state);
    return;
  }
  const re = result.value;
  checks.push((json) => typeof json !== 'string' || re.test(json));
}

function compileFormat(state: BuildState, node: JsonSchemaInternal, checks: Check[]): void {
  const { ctx, root } = state;
  const { options } = ctx;
  const { format } = node;
  if (typeof format !== 'string') {
    unsupported(state);
    return;
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
    if (!isInbuiltFormatValidator(fn)) {
      unsupported(state);
      return;
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
function compileChild(state: BuildState, child: unknown): FastValidator | undefined {
  const built = compileNode(state, child, false);
  if (built === undefined) {
    state.ok = false;
  }
  return built;
}

/** Keywords that are no-ops on their own because a sibling keyword's compiler already covers them. */
function compileHandled(): void {
  // intentionally empty
}

/** True when `key` is the first key of `node` that belongs to `group`, so a group compiles once per node. */
function isFirstOfGroup(node: JsonSchemaInternal, group: ReadonlySet<string>, key: string): boolean {
  const keys = Object.keys(node);
  for (let i = 0; i < keys.length; i++) {
    if (group.has(keys[i])) {
      return keys[i] === key;
    }
  }
  return false;
}

function once(group: ReadonlySet<string>, key: string, compile: KeywordCompiler): KeywordCompiler {
  return (state, node, checks) => {
    if (isFirstOfGroup(node, group, key)) {
      compile(state, node, checks);
    }
  };
}

// ---------------------------------------------------------------------------
// arrays
// ---------------------------------------------------------------------------

const DRAFT_2020_12_SCHEMA_URI = 'https://json-schema.org/draft/2020-12/schema';
const ARRAY_ITEM_KEYS: ReadonlySet<string> = new Set(['items', 'prefixItems', 'additionalItems']);

function compileMinItems(state: BuildState, node: JsonSchemaInternal, checks: Check[]): void {
  const { minItems } = node;
  if (typeof minItems !== 'number') {
    unsupported(state);
    return;
  }
  checks.push((json) => !Array.isArray(json) || !(json.length < minItems));
}

function compileMaxItems(state: BuildState, node: JsonSchemaInternal, checks: Check[]): void {
  const { maxItems } = node;
  if (typeof maxItems !== 'number') {
    unsupported(state);
    return;
  }
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
      const built = compileChild(state, head[i]);
      if (built === undefined) {
        return;
      }
      headChecks.push(built);
    }
  }
  let tailCheck: Check | undefined;
  if (tail !== undefined) {
    tailCheck = compileChild(state, tail);
    if (tailCheck === undefined) {
      return;
    }
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
  if (each === undefined) {
    return;
  }
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

const OBJECT_KEYS: ReadonlySet<string> = new Set([
  'properties',
  'patternProperties',
  'additionalProperties',
  'required',
  'minProperties',
  'maxProperties',
  'dependencies',
  'dependentRequired',
  'dependentSchemas',
  'propertyNames',
]);

function compileRequiredCheck(state: BuildState, node: RawNode, plain: Check[]): void {
  const { required } = node;
  if (required === undefined) {
    return;
  }
  if (!Array.isArray(required)) {
    unsupported(state);
    return;
  }
  const names = required as string[];
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

function compilePropertyCounts(state: BuildState, node: RawNode, withKeys: KeysCheck[]): void {
  const { minProperties, maxProperties } = node;
  if (minProperties !== undefined) {
    if (typeof minProperties !== 'number') {
      unsupported(state);
      return;
    }
    withKeys.push((_json, keys) => !(keys.length < minProperties));
  }
  if (maxProperties !== undefined) {
    if (typeof maxProperties !== 'number') {
      unsupported(state);
      return;
    }
    withKeys.push((_json, keys) => !(keys.length > maxProperties));
  }
}

// properties / patternProperties / additionalProperties: child traversal and the additionalProperties false rule
function compilePropertyTraversal(state: BuildState, node: RawNode, withKeys: KeysCheck[]): void {
  const { properties, patternProperties, additionalProperties } = node;
  const forbidAdditional = additionalProperties === false;
  let additional: Check | undefined;
  if (additionalProperties !== undefined && additionalProperties !== true && additionalProperties !== false) {
    additional = compileChild(state, additionalProperties);
    if (additional === undefined) {
      return;
    }
    if (additional === ALWAYS_TRUE) {
      additional = undefined;
    }
  }
  // a key matched by nothing only matters when something reacts to it
  const needsUnmatched = forbidAdditional || additional !== undefined;

  let propertyChecks: Map<string, Check> | undefined;
  if (properties !== undefined) {
    if (!isObject(properties)) {
      unsupported(state);
      return;
    }
    const names = Object.keys(properties);
    for (let i = 0; i < names.length; i++) {
      const built = compileChild(state, properties[names[i]]);
      if (built === undefined) {
        return;
      }
      if (built !== ALWAYS_TRUE || needsUnmatched) {
        propertyChecks ??= new Map<string, Check>();
        propertyChecks.set(names[i], built);
      }
    }
  }

  const patterns: RegExp[] = [];
  const patternChecks: Check[] = [];
  if (patternProperties !== undefined) {
    if (!isObject(patternProperties)) {
      unsupported(state);
      return;
    }
    const sources = Object.keys(patternProperties);
    for (let i = 0; i < sources.length; i++) {
      const compiled = compileSchemaRegex(sources[i]);
      if (!compiled.ok) {
        continue; // skipped by the interpreter too
      }
      const built = compileChild(state, patternProperties[sources[i]]);
      if (built === undefined) {
        return;
      }
      if (built !== ALWAYS_TRUE || needsUnmatched) {
        patterns.push(compiled.value);
        patternChecks.push(built);
      }
    }
  }

  const { assumeAdditional } = state.ctx.options;
  const assumed =
    forbidAdditional && Array.isArray(assumeAdditional) && assumeAdditional.length > 0
      ? new Set<unknown>(assumeAdditional)
      : undefined;
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
        } else if (forbidAdditional && (assumed === undefined || !assumed.has(key))) {
          return false;
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
  if (!isObject(dependencies)) {
    unsupported(state);
    return;
  }
  const names = Object.keys(dependencies);
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    const definition = dependencies[name] as unknown;
    if (Array.isArray(definition)) {
      const required = definition as string[];
      plain.push((json) => {
        if (!Object.hasOwn(json as object, name)) {
          return true;
        }
        for (let j = 0; j < required.length; j++) {
          if (!Object.hasOwn(json as object, required[j])) {
            return false;
          }
        }
        return true;
      });
    } else {
      const built = compileChild(state, definition);
      if (built === undefined) {
        return;
      }
      plain.push((json) => !Object.hasOwn(json as object, name) || built(json));
    }
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
      const name = names[i];
      const required = dependentRequired[name] as unknown;
      if (!Array.isArray(required)) {
        continue;
      }
      const list = required as string[];
      plain.push((json) => {
        if (!Object.hasOwn(json as object, name)) {
          return true;
        }
        for (let j = 0; j < list.length; j++) {
          if (!Object.hasOwn(json as object, list[j])) {
            return false;
          }
        }
        return true;
      });
    }
  }
  if (isObject(dependentSchemas)) {
    const names = Object.keys(dependentSchemas);
    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      const built = compileChild(state, dependentSchemas[name]);
      if (built === undefined) {
        return;
      }
      plain.push((json) => !Object.hasOwn(json as object, name) || built(json));
    }
  }
}

function compilePropertyNames(state: BuildState, node: RawNode, withKeys: KeysCheck[]): void {
  if (node.propertyNames === undefined) {
    return;
  }
  const each = compileChild(state, node.propertyNames);
  if (each === undefined || each === ALWAYS_TRUE) {
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
  compileRequiredCheck(state, raw, plain);
  compileDependencies(state, raw, plain);
  compileDependentKeywords(state, raw, plain);
  compilePropertyCounts(state, raw, withKeys);
  compilePropertyTraversal(state, raw, withKeys);
  compilePropertyNames(state, raw, withKeys);
  if (!state.ok) {
    return;
  }
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

/** Compiles every member of a combinator array; `undefined` when it is not an array or a member is unsupported. */
function compileMembers(state: BuildState, list: unknown): Check[] | undefined {
  if (!Array.isArray(list)) {
    unsupported(state);
    return undefined;
  }
  const members: Check[] = [];
  for (let i = 0; i < list.length; i++) {
    const built = compileChild(state, list[i]);
    if (built === undefined) {
      return undefined;
    }
    members.push(built);
  }
  return members;
}

function compileAllOf(state: BuildState, node: JsonSchemaInternal, checks: Check[]): void {
  const members = compileMembers(state, node.allOf);
  if (members === undefined) {
    return;
  }
  for (let i = 0; i < members.length; i++) {
    if (members[i] !== ALWAYS_TRUE) {
      checks.push(members[i]);
    }
  }
}

function compileAnyOf(state: BuildState, node: JsonSchemaInternal, checks: Check[]): void {
  const members = compileMembers(state, node.anyOf);
  if (members === undefined) {
    return;
  }
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
  if (members === undefined) {
    return;
  }
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
  if (inner === undefined) {
    return;
  }
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
  if (condition === undefined) {
    return;
  }
  const onThen = thenSchema === undefined ? ALWAYS_TRUE : compileChild(state, thenSchema);
  const onElse = elseSchema === undefined ? ALWAYS_TRUE : compileChild(state, elseSchema);
  if (onThen === undefined || onElse === undefined) {
    return;
  }
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
    unsupported(state);
    return;
  }
  const built = compileChild(state, target);
  if (built !== undefined && built !== ALWAYS_TRUE) {
    checks.push(built);
  }
}

// contentEncoding / contentMediaType only assert on draft-07
function compileContent(state: BuildState): void {
  if (state.ctx.options.version === 'draft-07') {
    unsupported(state);
  }
}

// ---------------------------------------------------------------------------
// keyword table
// ---------------------------------------------------------------------------

/** Keywords this builder implements. Any other validator-bearing keyword makes the whole schema unsupported. */
const KEYWORD_COMPILERS: Record<string, KeywordCompiler> = {
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
  items: once(ARRAY_ITEM_KEYS, 'items', compileItemKeywords),
  prefixItems: once(ARRAY_ITEM_KEYS, 'prefixItems', compileItemKeywords),
  additionalItems: once(ARRAY_ITEM_KEYS, 'additionalItems', compileItemKeywords),
  contains: compileContains,
  minContains: compileHandled,
  maxContains: compileHandled,
  properties: once(OBJECT_KEYS, 'properties', compileObjectKeywords),
  patternProperties: once(OBJECT_KEYS, 'patternProperties', compileObjectKeywords),
  additionalProperties: once(OBJECT_KEYS, 'additionalProperties', compileObjectKeywords),
  required: once(OBJECT_KEYS, 'required', compileObjectKeywords),
  minProperties: once(OBJECT_KEYS, 'minProperties', compileObjectKeywords),
  maxProperties: once(OBJECT_KEYS, 'maxProperties', compileObjectKeywords),
  dependencies: once(OBJECT_KEYS, 'dependencies', compileObjectKeywords),
  dependentRequired: once(OBJECT_KEYS, 'dependentRequired', compileObjectKeywords),
  dependentSchemas: once(OBJECT_KEYS, 'dependentSchemas', compileObjectKeywords),
  propertyNames: once(OBJECT_KEYS, 'propertyNames', compileObjectKeywords),
  allOf: compileAllOf,
  anyOf: compileAnyOf,
  oneOf: compileOneOf,
  not: compileNot,
  if: compileIf,
  then: compileHandled,
  else: compileHandled,
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

function compileNode(state: BuildState, node: unknown, isRoot: boolean): FastValidator | undefined {
  if (node === true) {
    return ALWAYS_TRUE;
  }
  if (node === false) {
    return ALWAYS_FALSE;
  }
  if (typeof node !== 'object' || node === null || Array.isArray(node)) {
    return undefined;
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
  if (
    !isRoot &&
    !isValidationVocabularyEnabled(schema, { rootSchema: state.root } as Report, state.ctx.options.version)
  ) {
    state.ok = false;
    return undefined;
  }

  if (schema.$ref && !isModernDraft(state.ctx.options.version)) {
    // siblings of a legacy $ref are ignored: only the final target of the chain is validated
    const target = followLegacyRef(schema);
    const built = target === undefined ? undefined : compileChild(state, target);
    if (built === undefined) {
      state.ok = false;
      return undefined;
    }
    slot.fn = built;
    state.memo.set(schema, built);
    return built;
  }

  const checks: Check[] = [];
  const keys = Object.keys(schema);
  for (let i = 0; i < keys.length && state.ok; i++) {
    const key = keys[i];
    if (isInternalKey(key) || !Object.hasOwn(JsonValidators, key)) {
      continue; // internal bookkeeping, or an unknown keyword (ignored by the interpreter too)
    }
    // a non-root node may declare only the root's own dialect (e.g. a remote schema stamped on compile)
    if (key === '$schema' && !isRoot && schema.$schema !== state.root.$schema) {
      state.ok = false;
    } else if (IGNORABLE_KEYWORDS.has(key)) {
      continue;
    } else if (Object.hasOwn(KEYWORD_COMPILERS, key)) {
      KEYWORD_COMPILERS[key](state, schema, checks);
    } else {
      state.ok = false;
    }
  }
  if (!state.ok) {
    return undefined;
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
 * @param ctx - The validator whose options (read at build time only) the schema was compiled under.
 */
export function buildFastValidator(schema: JsonSchemaInternal, ctx: ZSchemaBase): FastValidator | undefined {
  if (typeof ctx.options.customValidator === 'function') {
    return undefined;
  }
  if (!isValidationVocabularyEnabled(schema, { rootSchema: schema } as Report, ctx.options.version)) {
    return undefined;
  }
  const state: BuildState = {
    ctx,
    root: schema,
    memo: new Map<object, FastValidator>(),
    eqOpts: { maxDepth: ctx.options.maxRecursionDepth },
    ok: true,
  };
  return compileNode(state, schema, true);
}
