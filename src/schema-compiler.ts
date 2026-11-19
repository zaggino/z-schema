import type { JsonSchemaInternal } from './json-schema-versions.js';
import type { SchemaPosition } from './json-schema.js';
import type { ZSchemaBase } from './z-schema-base.js';

import { AT_DATA, AT_SCHEMA, cloneInputSchema, getId, walkPosition } from './json-schema.js';
import { Report } from './report.js';
import { DEFAULT_MAX_RECURSION_DEPTH } from './utils/constants.js';
import { getRemotePath, isAbsoluteUri } from './utils/uri.js';
import { getSchemaReader } from './z-schema-reader.js';

/**
 * True if `obj` is a built-in prototype, which the compiler never writes its internal state to (CWE-1321).
 *
 * Defence in depth, not the rule that keeps schemas off the prototypes: that is `getOwn()` (utils/json), which
 * every walk driven by a schema- or caller-supplied key steps through. No schema can make this return true. It can
 * only do so when calling code hands the compiler a built-in prototype as a schema, and the three-member set is the
 * shape CodeQL's `js/prototype-polluting-assignment` recognises.
 */
function isBuiltinPrototype(obj: unknown): boolean {
  return obj === Object.prototype || obj === Function.prototype || obj === Array.prototype;
}

/**
 * Stores the schema a reference resolved to on the node that holds the reference.
 * This is the compiler's only write under a computed key, so it carries the prototype check itself.
 */
function setResolved(refObj: Reference, response: JsonSchemaInternal | undefined): void {
  if (!isBuiltinPrototype(refObj.obj)) {
    refObj.obj[`__${refObj.key}Resolved` as const] = response;
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
  function walk(node: any, scope: Id[], position: SchemaPosition, _depth = 0) {
    if (typeof node !== 'object' || node == null) {
      return;
    }

    const schemaNode = node as JsonSchemaInternal;

    if (_depth >= maxDepth) {
      throw new Error(
        `Maximum recursion depth (${maxDepth}) exceeded in collectIds. ` +
          'If your schema is deeply nested and valid, increase the maxRecursionDepth option.'
      );
    }

    let addedScope = false;

    const nodeId = position === AT_SCHEMA ? getId(schemaNode) : undefined;
    if (typeof nodeId === 'string') {
      let type: Id['type'] = isAbsoluteUri(nodeId) ? 'absolute' : 'relative';
      if (scope.length === 0) {
        type = 'root';
      }
      const id: Id = {
        id: nodeId,
        type,
        obj: schemaNode,
      };
      if (type === 'absolute' || (type === 'root' && isAbsoluteUri(nodeId))) {
        id.absoluteUri = nodeId;
      } else if (
        type === 'root' &&
        typeof schemaNode.id === 'string' &&
        isAbsoluteUri(schemaNode.id) &&
        schemaNode.id !== nodeId
      ) {
        id.absoluteUri = resolveSchemaScopeId(schemaNode.id, schemaNode, nodeId);
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
          id.absoluteUri = resolveSchemaScopeId(parentUri, schemaNode, id.id);
        }
      }
      ids.push(id);
      scope.push(id);
      addedScope = true;
    }

    if (Array.isArray(node)) {
      for (const item of node) {
        walk(item, scope, position, _depth + 1);
      }
    } else {
      for (const key of Object.keys(schemaNode)) {
        const value = (schemaNode as Record<string, unknown>)[key];
        const child = walkPosition(position, key, value);
        if (child === AT_DATA) {
          continue;
        }
        walk(value, scope, child, _depth + 1);
      }
    }

    if (addedScope) {
      scope.pop();
    }
  }
  walk(obj, [], AT_SCHEMA);
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
  _depth = 0,
  position: SchemaPosition = AT_SCHEMA
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

  // a map of names to schemas has no keywords of its own
  const isSchema = position === AT_SCHEMA;
  const hasRef = isSchema && typeof obj.$ref === 'string' && obj.__$refResolved === undefined;
  let addedScope = false;
  const isRootScope = scope.length === 0;
  const objId = isSchema ? getId(obj) : undefined;
  let scopeId = objId;
  if (isSchema && typeof obj.id === 'string' && isAbsoluteUri(obj.id) && (!scopeId || !isAbsoluteUri(scopeId))) {
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
  if (isSchema && typeof obj.$recursiveRef === 'string' && obj.__$recursiveRefResolved === undefined) {
    results.push({
      ref: resolveReference(scope.at(-1), obj.$recursiveRef),
      key: '$recursiveRef',
      obj,
      path: path.slice(0),
    });
  }
  if (isSchema && typeof obj.$dynamicRef === 'string' && obj.__$dynamicRefResolved === undefined) {
    results.push({
      ref: resolveReference(scope.at(-1), obj.$dynamicRef),
      key: '$dynamicRef',
      obj,
      path: path.slice(0),
    });
  }
  if (isSchema && typeof obj.$schema === 'string' && obj.__$schemaResolved === undefined) {
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
      collectReferences(obj[i] as JsonSchemaInternal, results, scope, path, options, maxDepth, _depth + 1, position);
      path.pop();
    }
  } else {
    const keys = Object.keys(obj);
    for (const key of keys) {
      // do not recurse through resolved references, other z-schema props, or keyword data
      const value = (obj as Record<string, JsonSchemaInternal>)[key];
      const child = walkPosition(position, key, value);
      if (child === AT_DATA) {
        continue;
      }
      path.push(key);
      collectReferences(value, results, scope, path, options, maxDepth, _depth + 1, child);
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

  collectAndCacheIds(schema: JsonSchemaInternal, owner: JsonSchemaInternal | undefined) {
    const ids = collectIds(schema, this.validator.options.maxRecursionDepth);
    for (const item of ids) {
      if (item.absoluteUri) {
        this.validator.scache.declareId(item.absoluteUri, item.obj, owner);

        if (item.type === 'relative' && item.absoluteParent && isSimpleIdentifier(item.id)) {
          const parentUri = item.absoluteParent.absoluteUri || item.absoluteParent.id;
          const altAbsoluteUri = resolveReference(parentUri, item.id);
          this.validator.scache.declareId(altAbsoluteUri, item.obj, owner);
        }
      } else if (item.type === 'root') {
        this.validator.scache.declareId(item.id, item.obj, owner);
      }
    }
  }

  /**
   * Compiles `schema`: enters the ids it declares and resolves its references.
   *
   * @param report - The report that collects compilation errors.
   * @param schema - The schema, or an array of schemas, to compile.
   * @param options - `noCache` skips entering declared ids. The ids of a registered root are protected and belong
   * to it; otherwise a declaration of a protected URI is skipped.
   */
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
          const element = schema[i];
          this.collectAndCacheIds(element, this.validator.scache.isRegisteredRoot(element) ? element : undefined);
        }
      }
      return this.compileArrayOfSchemas(report, schema);
    } else if (typeof schema === 'boolean') {
      return true;
    }
    const owner = this.validator.scache.isRegisteredRoot(schema) ? schema : undefined;
    if (!options?.noCache) {
      this.collectAndCacheIds(schema, owner);
    }

    // a built-in prototype has nothing to compile and is never written to
    if (isBuiltinPrototype(schema)) {
      return report.isValid();
    }

    // if we have an id than it should be cached already (if this instance has compiled it)
    if (schema.__$compiled && schema.id && !this.validator.scache.checkCacheForUri(schema.id)) {
      schema.__$compiled = undefined;
    }

    // do not re-compile schemas
    if (schema.__$compiled) {
      return true;
    }

    // v8 - if $schema is not present, set $schema to default
    if (!schema.$schema && this.validator.options.version !== 'none') {
      schema.$schema = this.validator.getDefaultSchemaId();
    }

    if (schema.id && typeof schema.id === 'string' && !options?.noCache) {
      // add this to our schemaCache (before compilation in case we have references including id)
      this.validator.scache.declareId(schema.id, schema, owner);
    }

    // this method can be called recursively, so we need to remember our root
    let isRoot = false;
    if (!report.rootSchema) {
      report.rootSchema = schema;
      isRoot = true;
    }

    // delete all __$missingReferences from previous compilation attempts
    const isValidExceptReferences = report.isValid();
    delete schema.__$missingReferences;

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
          const loaded = schemaReader(remotePath);
          if (loaded) {
            // The reader's object belongs to the caller: compile a clone of it. The clone needs the id.
            const remoteSchema = cloneInputSchema(loaded, this.validator.options.maxRecursionDepth);
            remoteSchema.id = remotePath;
            this.validator.scache.registerLoaded(remoteSchema);
            // try to compile the schema
            // Eager on purpose: these errors are read by content (copied/filtered), so do not use Report.createSubReport.
            const subreport = new Report(report);
            if (this.compileSchema(subreport, remoteSchema)) {
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
          if (isValidExceptReferences) {
            schema.__$missingReferences ||= [];
            schema.__$missingReferences.push(refObj);
          }
        }
      }
      // this might create circular references
      setResolved(refObj, response);
    }

    const isValid = report.isValid();
    if (isValid) {
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
    let compiled = 0;
    let lastLoopCompiled;

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
              setResolved(refObj, response);
              // it's resolved now so delete it
              sch.__$missingReferences.splice(idx2, 1);
            }
          }
          if (sch.__$missingReferences.length === 0) {
            delete sch.__$missingReferences;
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
      // Eager on purpose: these errors are read by content (copied/filtered), so do not use Report.createSubReport.
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
