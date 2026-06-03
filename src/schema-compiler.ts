import type { JsonSchemaInternal } from './json-schema-versions.js';
import type { ZSchemaBase } from './z-schema-base.js';

import { getId, isInternalKey, NON_SCHEMA_KEYWORDS_SET } from './json-schema.js';
import { Report } from './report.js';
import { DEFAULT_MAX_RECURSION_DEPTH } from './utils/constants.js';
import { getRemotePath, isAbsoluteUri } from './utils/uri.js';
import { getSchemaReader } from './z-schema-reader.js';

const UNSAFE_TARGETS = new Set<Record<string, unknown>>([
  Object.prototype as unknown as Record<string, unknown>,
  Function.prototype as unknown as Record<string, unknown>,
  Array.prototype as unknown as Record<string, unknown>,
]);

/** Returns true if `obj` is a built-in prototype that must not be mutated. */
function isUnsafeTarget(obj: Record<string, unknown>): boolean {
  return UNSAFE_TARGETS.has(obj);
}

/** Safely assign a property on `obj`, refusing prototype-polluting keys. */
function safeSetProperty(obj: Record<string, unknown>, key: string, value: unknown): void {
  if (isUnsafeTarget(obj)) {
    return;
  }
  /** Reject property names that could pollute Object.prototype (CWE-1321). */
  if (key !== '__proto__' && key !== 'constructor' && key !== 'prototype') {
    obj[key] = value;
  }
}

/** Safely delete a property from `obj`, refusing to mutate built-in prototypes (CWE-1321). */
function safeDeleteProperty(obj: Record<string, unknown>, key: string): void {
  if (isUnsafeTarget(obj)) {
    return;
  }
  if (key !== '__proto__' && key !== 'constructor' && key !== 'prototype') {
    delete obj[key];
  }
}

interface Id {
  id: string;
  type: 'absolute' | 'relative' | 'root';
  obj: object;
  absoluteParent?: Id;
  absoluteUri?: string;
}

const resolveReference = (base: string | undefined, ref: string) => {
  if (isAbsoluteUri(ref)) {
    return ref;
  }

  const baseStr = base ?? '';

  if (ref.startsWith('#')) {
    const hashIndex = baseStr.indexOf('#');
    const baseNoFrag = hashIndex === -1 ? baseStr : baseStr.slice(0, hashIndex);
    return baseNoFrag + ref;
  }

  if (!baseStr) {
    return ref;
  }

  const hashIndex = baseStr.indexOf('#');
  const baseNoFrag = hashIndex === -1 ? baseStr : baseStr.slice(0, hashIndex);

  if (isAbsoluteUri(baseNoFrag)) {
    try {
      return new URL(ref, baseNoFrag).toString();
    } catch {
      // fall back to manual resolution below
    }
  }

  let baseDir = baseNoFrag;
  if (!baseDir.endsWith('/')) {
    const lastSlash = baseDir.lastIndexOf('/');
    baseDir = lastSlash === -1 ? '' : baseDir.slice(0, lastSlash + 1);
  }
  return baseDir + ref;
};

const isSimpleIdentifier = (id: string) =>
  !id.startsWith('#') && !id.includes('/') && !id.includes('.') && !id.includes('#');

const resolveIdScope = (base: string | undefined, id: string) => {
  if (isAbsoluteUri(id)) {
    return id;
  }

  const baseStr = base ?? '';

  // Treat simple identifiers (no '/', '.', or '#') as same-document fragment ids
  if (isSimpleIdentifier(id)) {
    const hashIndex = baseStr.indexOf('#');
    const baseNoFrag = hashIndex === -1 ? baseStr : baseStr.slice(0, hashIndex);
    return `${baseNoFrag}#${id}`;
  }

  return resolveReference(base, id);
};

const resolveSchemaScopeId = (base: string | undefined, schema: JsonSchemaInternal, id: string) => {
  if (typeof schema.$id === 'string') {
    return resolveReference(base, id);
  }
  return resolveIdScope(base, id);
};

export const collectIds = (obj: JsonSchemaInternal, maxDepth = DEFAULT_MAX_RECURSION_DEPTH) => {
  const ids: Id[] = [];
  function walk(node: any, scope: Id[], _depth = 0) {
    if (typeof node !== 'object' || node == null) {
      return;
    }

    if (_depth >= maxDepth) {
      throw new Error(
        `Maximum recursion depth (${maxDepth}) exceeded in collectIds. ` +
          'If your schema is deeply nested and valid, increase the maxRecursionDepth option.'
      );
    }

    let addedScope = false;

    const nodeId = getId(node as JsonSchemaInternal);
    if (typeof nodeId === 'string') {
      let type: Id['type'] = isAbsoluteUri(nodeId) ? 'absolute' : 'relative';
      if (scope.length === 0) {
        type = 'root';
      }
      const id: Id = {
        id: nodeId,
        type,
        obj: node as JsonSchemaInternal,
      };
      if (type === 'absolute' || (type === 'root' && isAbsoluteUri(nodeId))) {
        id.absoluteUri = nodeId;
      } else if (type === 'root' && typeof node.id === 'string' && isAbsoluteUri(node.id) && node.id !== nodeId) {
        id.absoluteUri = resolveSchemaScopeId(node.id, node as JsonSchemaInternal, nodeId);
      } else if (type === 'relative') {
        let absoluteParent: Id | undefined;
        for (let i = scope.length - 1; i >= 0; i--) {
          const sc = scope[i];
          if (sc.type === 'absolute' || (sc.type === 'root' && sc.absoluteUri)) {
            absoluteParent = sc;
            break;
          }
        }
        id.absoluteParent = absoluteParent;
        if (id.absoluteParent) {
          const parentUri = id.absoluteParent.absoluteUri || id.absoluteParent.id;
          id.absoluteUri = resolveSchemaScopeId(parentUri, node as JsonSchemaInternal, id.id);
        }
      }
      ids.push(id);
      scope.push(id);
      addedScope = true;
    }

    if (Array.isArray(node)) {
      for (const item of node) {
        walk(item, scope, _depth + 1);
      }
    } else {
      for (const key of Object.keys(node)) {
        if (isInternalKey(key) || NON_SCHEMA_KEYWORDS_SET.has(key)) {
          continue;
        }
        walk(node[key], scope, _depth + 1);
      }
    }

    if (addedScope) {
      scope.pop();
    }
  }
  walk(obj, []);
  return ids;
};

export interface Reference {
  ref: string;
  key: '$ref' | '$schema' | '$recursiveRef' | '$dynamicRef';
  obj: JsonSchemaInternal;
  path: Array<string | number>;
}

export const collectReferences = (
  obj: JsonSchemaInternal,
  results?: Reference[],
  scope?: string[],
  path?: Reference['path'],
  options?: { useRefObjectScope?: boolean },
  maxDepth = DEFAULT_MAX_RECURSION_DEPTH,
  _depth = 0
) => {
  results ||= [];
  scope ||= [];
  path ||= [];
  options ||= {};

  if (typeof obj !== 'object' || obj === null) {
    return results;
  }

  if (_depth >= maxDepth) {
    throw new Error(
      `Maximum recursion depth (${maxDepth}) exceeded in collectReferences. ` +
        'If your schema is deeply nested and valid, increase the maxRecursionDepth option.'
    );
  }

  const hasRef = typeof obj.$ref === 'string' && obj.__$refResolved === undefined;
  let addedScope = false;
  const isRootScope = scope.length === 0;
  const objId = getId(obj);
  let scopeId = objId;
  if (typeof obj.id === 'string' && isAbsoluteUri(obj.id) && (!scopeId || !isAbsoluteUri(scopeId))) {
    scopeId = obj.id;
  }

  if (typeof scopeId === 'string' && (isRootScope || !hasRef || options.useRefObjectScope === true)) {
    const base = scope.length > 0 ? scope.at(-1) : undefined;
    scope.push(resolveSchemaScopeId(base, obj, scopeId));
    addedScope = true;
  }

  if (hasRef) {
    results.push({
      ref: resolveReference(scope.at(-1), obj.$ref!),
      key: '$ref',
      obj,
      path: path.slice(0),
    });
  }
  if (typeof obj.$recursiveRef === 'string' && obj.__$recursiveRefResolved === undefined) {
    results.push({
      ref: resolveReference(scope.at(-1), obj.$recursiveRef),
      key: '$recursiveRef',
      obj,
      path: path.slice(0),
    });
  }
  if (typeof obj.$dynamicRef === 'string' && obj.__$dynamicRefResolved === undefined) {
    results.push({
      ref: resolveReference(scope.at(-1), obj.$dynamicRef),
      key: '$dynamicRef',
      obj,
      path: path.slice(0),
    });
  }
  if (typeof obj.$schema === 'string' && obj.__$schemaResolved === undefined) {
    results.push({
      ref: resolveReference(scope.at(-1), obj.$schema),
      key: '$schema',
      obj,
      path: path.slice(0),
    });
  }

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      path.push(i);
      collectReferences(obj[i], results, scope, path, options, maxDepth, _depth + 1);
      path.pop();
    }
  } else {
    const keys = Object.keys(obj);
    for (const key of keys) {
      // do not recurse through resolved references and other z-schema props
      if (isInternalKey(key) || NON_SCHEMA_KEYWORDS_SET.has(key)) {
        continue;
      }
      path.push(key);
      collectReferences((obj as any)[key], results, scope, path, options, maxDepth, _depth + 1);
      path.pop();
    }
  }

  if (addedScope) {
    scope.pop();
  }

  return results;
};

export class SchemaCompiler {
  private readonly validator: ZSchemaBase;

  constructor(validator: ZSchemaBase) {
    this.validator = validator;
  }

  collectAndCacheIds(schema: JsonSchemaInternal) {
    const ids = collectIds(schema, this.validator.options.maxRecursionDepth);
    for (const item of ids) {
      if (item.absoluteUri) {
        this.validator.scache.cacheSchemaByUri(item.absoluteUri, item.obj);

        if (item.type === 'relative' && item.absoluteParent && isSimpleIdentifier(item.id)) {
          const parentUri = item.absoluteParent.absoluteUri || item.absoluteParent.id;
          const altAbsoluteUri = resolveReference(parentUri, item.id);
          this.validator.scache.cacheSchemaByUri(altAbsoluteUri, item.obj);
        }
      } else if (item.type === 'root') {
        this.validator.scache.cacheSchemaByUri(item.id, item.obj);
      }
    }
  }

  compileSchema(report: Report, schema: JsonSchemaInternal | JsonSchemaInternal[], options?: { noCache?: boolean }) {
    report.commonErrorMessage = 'SCHEMA_COMPILATION_FAILED';

    // if schema is a string, assume it's a uri
    if (typeof schema === 'string') {
      const loadedSchema = this.validator.scache.getSchemaByUri(report, schema);
      if (loadedSchema === undefined) {
        report.addError('SCHEMA_NOT_REACHABLE', [schema]);
        return false;
      }
      schema = loadedSchema;
    }

    // if schema is an array, assume it's an array of schemas
    if (Array.isArray(schema)) {
      if (!options?.noCache) {
        for (let i = 0; i < schema.length; i++) {
          this.collectAndCacheIds(schema[i]);
        }
      }
      return this.compileArrayOfSchemas(report, schema);
    } else if (typeof schema === 'boolean') {
      return true;
    }
    if (!options?.noCache) {
      this.collectAndCacheIds(schema);
    }

    const canMutateSchemaObject =
      schema !== (Object.prototype as unknown as JsonSchemaInternal) &&
      schema !== (Function.prototype as unknown as JsonSchemaInternal) &&
      schema !== (Array.prototype as unknown as JsonSchemaInternal);

    // if we have an id than it should be cached already (if this instance has compiled it)
    if (
      canMutateSchemaObject &&
      schema.__$compiled &&
      schema.id &&
      !this.validator.scache.checkCacheForUri(schema.id)
    ) {
      schema.__$compiled = undefined;
    }

    // do not re-compile schemas
    if (schema.__$compiled) {
      return true;
    }

    // v8 - if $schema is not present, set $schema to default
    if (canMutateSchemaObject && !schema.$schema && this.validator.options.version !== 'none') {
      schema.$schema = this.validator.getDefaultSchemaId();
    }

    if (schema.id && typeof schema.id === 'string' && !options?.noCache) {
      // add this to our schemaCache (before compilation in case we have references including id)
      this.validator.scache.cacheSchemaByUri(schema.id, schema);
    }

    // this method can be called recursively, so we need to remember our root
    let isRoot = false;
    if (!report.rootSchema) {
      report.rootSchema = schema;
      isRoot = true;
    }

    // delete all __$missingReferences from previous compilation attempts
    const isValidExceptReferences = report.isValid();
    if (canMutateSchemaObject) {
      safeDeleteProperty(schema as unknown as Record<string, unknown>, '__$missingReferences');
    }

    // collect all references that need to be resolved - $ref and $schema
    const useRefObjectScope =
      this.validator.options.version === 'draft2019-09' || this.validator.options.version === 'draft2020-12';
    const refs = collectReferences(
      schema,
      undefined,
      undefined,
      undefined,
      { useRefObjectScope },
      this.validator.options.maxRecursionDepth
    );
    for (const refObj of refs) {
      // resolve all the collected references into __xxxResolved pointer
      let response = this.validator.scache.getSchemaByUri(report, refObj.ref, schema);

      // we can try to use custom schemaReader if available
      if (response === undefined) {
        const schemaReader = getSchemaReader();
        if (schemaReader) {
          const remotePath = getRemotePath(refObj.ref);
          // it's supposed to return a valid schema
          const s = schemaReader(remotePath);
          if (s) {
            // it needs to have the id (cast: schemaReader returns JsonSchema, but
            // at this pre-compilation stage we treat it as an internal object)
            (s as JsonSchemaInternal).id = remotePath;
            // try to compile the schema
            const subreport = new Report(report);
            if (this.compileSchema(subreport, s)) {
              response = this.validator.scache.getSchemaByUri(report, refObj.ref, schema);
            } else {
              // copy errors to report
              for (let i = 0; i < subreport.errors.length; i++) {
                report.errors.push(subreport.errors[i]);
              }
            }
          }
        }
      }

      if (response === undefined) {
        const hasNotValid = report.hasError('REMOTE_NOT_VALID', [refObj.ref]);
        const isAbsolute = isAbsoluteUri(refObj.ref);
        let isDownloaded = false;
        const ignoreUnresolvableRemotes = this.validator.options.ignoreUnresolvableReferences === true;

        if (isAbsolute) {
          // we shouldn't add UNRESOLVABLE_REFERENCE for schemas we already have downloaded
          // and set through setRemoteReference method
          isDownloaded = this.validator.scache.checkCacheForUri(refObj.ref);
        }

        if (hasNotValid) {
          // already has REMOTE_NOT_VALID error for this one
        } else if (ignoreUnresolvableRemotes && isAbsolute) {
          // ignoreUnresolvableRemotes is on and remote isAbsolute
        } else if (isDownloaded) {
          // remote is downloaded, so no UNRESOLVABLE_REFERENCE
        } else {
          const pathLen = refObj.path.length;
          for (let i = 0; i < pathLen; i++) {
            report.path.push(refObj.path[i]);
          }
          report.addError('UNRESOLVABLE_REFERENCE', [refObj.ref]);
          report.path.length -= pathLen;

          // publish unresolved references out
          if (
            isValidExceptReferences &&
            canMutateSchemaObject &&
            !isUnsafeTarget(schema as unknown as Record<string, unknown>)
          ) {
            schema.__$missingReferences ||= [];
            schema.__$missingReferences.push(refObj);
          }
        }
      }
      // this might create circular references
      safeSetProperty(refObj.obj as unknown as Record<string, unknown>, `__${refObj.key}Resolved`, response);
    }

    const isValid = report.isValid();
    if (isValid && canMutateSchemaObject) {
      schema.__$compiled = true;
    }
    // else {
    //   if (schema.id && typeof schema.id === 'string') {
    //     console.log(report.errors);
    //     // remove this schema from schemaCache because it failed to compile
    //     this.validator.scache.removeFromCacheByUri(schema.id);
    //   }
    // }

    // we don't need the root pointer anymore
    if (isRoot) {
      report.rootSchema = undefined;
    }

    return isValid;
  }

  compileArrayOfSchemas(report: Report, arr: JsonSchemaInternal[]) {
    let compiled = 0,
      lastLoopCompiled;

    do {
      // remove all UNRESOLVABLE_REFERENCE errors before compiling array again
      let wi = 0;
      for (let ri = 0; ri < report.errors.length; ri++) {
        if (report.errors[ri].code !== 'UNRESOLVABLE_REFERENCE') {
          report.errors[wi++] = report.errors[ri];
        }
      }
      report.errors.length = wi;

      // remember how many were compiled in the last loop
      lastLoopCompiled = compiled;

      // count how many are compiled now
      compiled = this.compileArrayOfSchemasLoop(report, arr);

      // fix __$missingReferences if possible
      // Keep the FIRST schema per id to match the prior `arr.find(x => x.id === ref)`
      // semantics (first match wins) when an array contains duplicate ids.
      const idMap = new Map<string, JsonSchemaInternal>();
      for (let i = 0; i < arr.length; i++) {
        const schemaId = arr[i].id;
        if (schemaId && !idMap.has(schemaId)) {
          idMap.set(schemaId, arr[i]);
        }
      }
      for (const sch of arr) {
        if (sch.__$missingReferences) {
          for (let idx2 = sch.__$missingReferences.length - 1; idx2 >= 0; idx2--) {
            const refObj = sch.__$missingReferences[idx2];
            const response = idMap.get(refObj.ref);
            if (response) {
              // this might create circular references
              safeSetProperty(refObj.obj as unknown as Record<string, unknown>, `__${refObj.key}Resolved`, response);
              // it's resolved now so delete it
              sch.__$missingReferences.splice(idx2, 1);
            }
          }
          if (sch.__$missingReferences.length === 0) {
            safeDeleteProperty(sch as unknown as Record<string, unknown>, '__$missingReferences');
          }
        }
      }

      // keep repeating if not all compiled and at least one more was compiled in the last loop
    } while (compiled !== arr.length && compiled !== lastLoopCompiled);

    return report.isValid();
  }

  compileArrayOfSchemasLoop(mainReport: Report, arr: JsonSchemaInternal[]) {
    let compiledCount = 0;

    for (const schema of arr) {
      // try to compile each schema separately
      const report = new Report(mainReport);
      const isValid = this.compileSchema(report, schema);
      if (isValid) {
        compiledCount++;
      }

      // copy errors to report
      for (let i = 0; i < report.errors.length; i++) {
        mainReport.errors.push(report.errors[i]);
      }
    }

    return compiledCount;
  }
}
