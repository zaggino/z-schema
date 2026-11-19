import type { JsonSchema, JsonSchemaInternal } from './json-schema-versions.js';
import type { SchemaPosition } from './json-schema.js';
import type { ZSchemaBase } from './z-schema-base.js';
import type { ZSchemaOptions } from './z-schema-options.js';

import { bumpGlobalSchemaStateGeneration } from './compiled-schema-cache.js';
import { AT_SCHEMA, childPosition, cloneInputSchema, findId, getId } from './json-schema.js';
import { Report } from './report.js';
import { deepClone } from './utils/clone.js';
import { decodeJSONPointer, getOwn } from './utils/json.js';
import { createDict } from './utils/properties.js';
import { getQueryPath, getRemotePath, isAbsoluteUri } from './utils/uri.js';
import { normalizeOptions } from './z-schema-options.js';

export type SchemaCacheStorage = Record<string, JsonSchemaInternal>;
export type ReferenceSchemaCacheStorage = Array<[JsonSchemaInternal, JsonSchemaInternal]>;

const getEffectiveId = (schema: JsonSchemaInternal): string | undefined => {
  let id = getId(schema);
  if ((!id || !isAbsoluteUri(id)) && typeof schema.id === 'string' && isAbsoluteUri(schema.id)) {
    ({ id } = schema);
  }
  return id;
};

/**
 * Shared logic for registering a remote reference schema.
 * Used by both the static `ZSchema.setRemoteReference()` (global cache) and
 * the instance `validator.setRemoteReference()` (instance cache).
 */
export function prepareRemoteSchema(
  schema: string | JsonSchema,
  uri: string,
  validationOptions?: ZSchemaOptions,
  maxCloneDepth?: number
): JsonSchemaInternal {
  const _schema = cloneInputSchema(
    typeof schema === 'string' ? (JSON.parse(schema) as JsonSchema) : schema,
    maxCloneDepth
  );

  if (!_schema.id) {
    _schema.id = uri;
  }

  if (validationOptions) {
    _schema.__$validationOptions = normalizeOptions(validationOptions);
  }

  return _schema;
}

export class SchemaCache {
  // Both caches are keyed by schema-supplied URIs and must stay dictionaries without a prototype: that is what
  // makes a key such as `__proto__` or `constructor` an ordinary entry instead of a lookup on Object.prototype.
  static readonly global_cache: SchemaCacheStorage = createDict<JsonSchemaInternal>();
  readonly cache: SchemaCacheStorage = createDict<JsonSchemaInternal>();
  private readonly validator: ZSchemaBase;
  // Registered roots: schemas entered by setRemoteReference(), cloned from the global cache, or loaded by a schema reader.
  private readonly registeredRoots = new WeakSet<JsonSchemaInternal>();
  // Protected paths, each with the registered root that owns the entry (the root itself for its own path,
  // the root that declares the id for a nested one).
  private readonly protectedPaths = new Map<string, JsonSchemaInternal>();
  // Clones handed out for pointer targets outside a schema position, one per target object.
  private readonly targetClones = new WeakMap<object, JsonSchemaInternal>();

  constructor(validator: ZSchemaBase) {
    this.validator = validator;
  }

  static cacheSchemaByUri(uri: string, schema: JsonSchemaInternal) {
    bumpGlobalSchemaStateGeneration();
    const remotePath = getRemotePath(uri);
    if (remotePath) {
      this.global_cache[remotePath] = schema;
    }
  }

  /**
   * Registers `schema` at `uri` on this instance. This is the registration write and the only one that replaces a
   * protected entry; the compiler enters declared ids through {@link SchemaCache.declareId}.
   */
  cacheSchemaByUri(uri: string, schema: JsonSchemaInternal) {
    const remotePath = getRemotePath(uri);
    if (remotePath) {
      const prev = this.cache[remotePath];
      if (prev !== undefined && this.registeredRoots.has(prev)) {
        this.release(prev, remotePath);
      }
      this.registeredRoots.add(schema);
      this.store(remotePath, schema, schema, true);
    }
  }

  /**
   * Whether `schema` is a registered root: it was registered on this instance, cloned from the global cache,
   * or marked with {@link SchemaCache.registerLoaded}.
   */
  isRegisteredRoot(schema: JsonSchemaInternal): boolean {
    return this.registeredRoots.has(schema);
  }

  /**
   * Marks a schema that a schema reader returned as a registered root.
   *
   * @param schema - The schema the schema reader returned.
   */
  registerLoaded(schema: JsonSchemaInternal): void {
    this.registeredRoots.add(schema);
  }

  /**
   * Whether the entry at `remotePath` is one that an id declared by a schema passed to `validate()`, `compile()`
   * or `validateSchema()` must not create, replace or hide: a registered or reader-loaded schema, an id declared
   * inside one, or anything in the global cache.
   */
  isProtected(remotePath: string): boolean {
    return this.protectedPaths.has(remotePath) || SchemaCache.global_cache[remotePath] !== undefined;
  }

  /**
   * Enters an id that a schema declares for itself or for one of its sub-schemas.
   *
   * @param uri - The declared id, already resolved to an absolute or root-relative URI.
   * @param schema - The schema node that carries the id.
   * @param owner - The registered root whose compilation declares the id, or `undefined` for a schema passed to
   * `validate()`, `compile()` or `validateSchema()`. An entry declared by a registered root is protected and
   * belongs to it. A declaration of a protected URI is skipped.
   */
  declareId(uri: string, schema: JsonSchemaInternal, owner: JsonSchemaInternal | undefined): void {
    const remotePath = getRemotePath(uri);
    if (!remotePath) {
      return;
    }
    const prev = this.cache[remotePath];
    if (prev === schema) {
      // Already entered. A registered root declaring it makes the entry its own when nobody owns it yet.
      if (owner !== undefined && !this.isProtected(remotePath)) {
        this.protectedPaths.set(remotePath, owner);
      }
      return;
    }
    if (this.isProtected(remotePath)) {
      return;
    }
    this.store(remotePath, schema, owner, true);
  }

  removeFromCacheByUri(uri: string) {
    const remotePath = getRemotePath(uri);
    if (remotePath) {
      const prev = this.cache[remotePath];
      if (prev !== undefined && this.registeredRoots.has(prev)) {
        this.release(prev, remotePath);
      }
      this.protectedPaths.delete(remotePath);
      if (prev !== undefined) {
        // a removed mapping can change how cached schemas resolve `$ref`
        this.validator.compiledSchemaCache.clear();
      }
      delete this.cache[remotePath];
    }
  }

  // The one place that writes an entry: `owner` protects it; a replaced entry is reported to the compiled-schema cache.
  private store(
    remotePath: string,
    schema: JsonSchemaInternal,
    owner: JsonSchemaInternal | undefined,
    notify: boolean
  ) {
    const prev = this.cache[remotePath];
    this.cache[remotePath] = schema;
    if (owner !== undefined) {
      this.protectedPaths.set(remotePath, owner);
    }
    if (notify) {
      this.validator.compiledSchemaCache.onScacheWrite(remotePath, prev, schema);
    }
  }

  // Removes the entries that `root` owns, except the one at `keep`, which the caller is about to write.
  private release(root: JsonSchemaInternal, keep: string): void {
    let removed = false;
    for (const [path, owner] of this.protectedPaths) {
      if (owner === root && path !== keep) {
        this.protectedPaths.delete(path);
        delete this.cache[path];
        removed = true;
      }
    }
    if (removed) {
      // a removed mapping can change how cached schemas resolve `$ref`
      this.validator.compiledSchemaCache.clear();
    }
  }

  checkCacheForUri(uri: string) {
    const remotePath = getRemotePath(uri);
    return remotePath ? this.cache[remotePath] != null : false;
  }

  getSchema(report: Report, refOrSchema: string): JsonSchemaInternal | undefined;
  getSchema(report: Report, refOrSchema: JsonSchema): JsonSchemaInternal;
  getSchema(report: Report, refOrSchema: JsonSchema[]): JsonSchemaInternal[];
  getSchema(report: Report, refOrSchema: string | JsonSchema | JsonSchema[]) {
    if (Array.isArray(refOrSchema)) {
      return refOrSchema.map((i) => this.getSchema(report, i));
    }
    if (typeof refOrSchema === 'string') {
      // ref input
      return this.getSchemaByUri(report, refOrSchema);
    }
    // no caching done on this: return a clone of the caller's schema (without reserved keys) that the library may mutate
    return cloneInputSchema(refOrSchema, this.validator.options.maxRecursionDepth);
  }

  fromCache(path: string): JsonSchemaInternal | undefined {
    const found = this.cache[path];
    if (found !== undefined && (this.protectedPaths.has(path) || SchemaCache.global_cache[path] === undefined)) {
      return found;
    }
    const registered = SchemaCache.global_cache[path];
    return registered === undefined ? undefined : this.adoptGlobal(path, registered, found);
  }

  // Clones a global-cache entry into the instance cache; `displaced` is the declared entry it takes the place of.
  private adoptGlobal(path: string, registered: JsonSchemaInternal, displaced: JsonSchemaInternal | undefined) {
    // Clone once from global cache into instance cache so subsequent lookups
    // never deep-clone again for the same path on this instance.
    const clone = deepClone(registered, this.validator.options.maxRecursionDepth);
    if (!clone.id || (!isAbsoluteUri(clone.id) && isAbsoluteUri(path))) {
      clone.id = path;
    }
    this.registeredRoots.add(clone);
    // When nothing was at `path` this is a new mapping, so no cached schema can have resolved through it:
    // schemas with unresolved refs are never cached. When a declared id was in the way, schemas compiled
    // against it are stale and the compiled-schema cache is notified.
    this.store(path, clone, clone, displaced !== undefined);
    return clone;
  }

  /**
   * Follows `keys` (own keys or array indexes, already decoded) from the schema `start`. When the walk ends
   * outside a schema position (inside `enum`, `const`, `default` or `examples`, or on a keyword map such as
   * `$defs`), the node found there is not a schema of the library's own: the result is then a clone of it made
   * with `cloneInputSchema`, the same one on every call for that node.
   *
   * @param start - The schema the path starts from.
   * @param keys - The path.
   * @param from - Index of the first key to follow.
   * @returns What the path leads to, or `undefined` when a key is missing.
   */
  getAtPath(start: unknown, keys: ReadonlyArray<string | number>, from = 0): unknown {
    let node = start;
    let position: SchemaPosition = AT_SCHEMA;
    for (let i = from; i < keys.length; i++) {
      const key = keys[i];
      const child = getOwn(node, key);
      if (child === undefined) {
        return undefined;
      }
      if (!Array.isArray(node)) {
        position = childPosition(position, String(key), child);
      }
      node = child;
    }
    if (position === AT_SCHEMA || typeof node !== 'object' || node === null) {
      return node;
    }
    let clone = this.targetClones.get(node);
    if (clone === undefined) {
      clone = cloneInputSchema(node, this.validator.options.maxRecursionDepth);
      this.targetClones.set(node, clone);
    }
    return clone;
  }

  getSchemaByUri(report: Report, uri: string, root?: JsonSchemaInternal) {
    if (root && !isAbsoluteUri(uri)) {
      const rootId = getEffectiveId(root);
      if (rootId && isAbsoluteUri(rootId)) {
        const hashIndex = rootId.indexOf('#');
        const rootBase = hashIndex === -1 ? rootId : rootId.slice(0, hashIndex);
        try {
          uri = new URL(uri, rootBase).toString();
        } catch {
          // keep original uri when URL construction fails
        }
      }
    }

    const remotePath = getRemotePath(uri);
    const queryPath = getQueryPath(uri);
    let result: JsonSchemaInternal | undefined;

    if (root && remotePath) {
      const rootId = getEffectiveId(root);
      const rootRemotePath = rootId ? getRemotePath(rootId) : undefined;
      if (rootRemotePath && rootRemotePath === remotePath) {
        result = root;
      }
    }

    if (!result) {
      result = remotePath ? this.fromCache(remotePath) : root;
    }

    if (result && remotePath && isAbsoluteUri(remotePath) && (!result.id || !isAbsoluteUri(result.id))) {
      result.id = remotePath;
    }

    if (result && remotePath) {
      // A schema that is already being compiled further up is not compiled again. It is recognised by identity:
      // an id is only a name, and several schemas can carry the same one.
      const compileRemote = result !== root && !report.isCompiling(result);
      // now we need to compile and validate resolved schema (in case it's not already)
      if (compileRemote) {
        report.path.push(remotePath);

        // Eager on purpose: these errors are read by content (copied/filtered), so do not use Report.createSubReport.
        const remoteReport = new Report(report);
        const noCache = !(result.id && isAbsoluteUri(result.id));
        if (this.validator.sc.compileSchema(remoteReport, result, { noCache })) {
          const savedOptions = this.validator.options;
          try {
            // If custom validationOptions were provided to setRemoteReference(),
            // use them instead of the default options
            this.validator.options = result.__$validationOptions || this.validator.options;
            const parentSchemaUri = typeof result.$schema === 'string' ? getRemotePath(result.$schema) : undefined;
            const currentSchemaUri = report.getSchemaId();
            const parentSchemaIsCompiling =
              !!parentSchemaUri &&
              parentSchemaUri.length > 0 &&
              (currentSchemaUri === parentSchemaUri || !!report.getAncestor(parentSchemaUri));

            if (!parentSchemaIsCompiling) {
              this.validator.sv.validateSchema(remoteReport, result);
            }
          } finally {
            this.validator.options = savedOptions;
          }
        }
        const remoteReportIsValid = remoteReport.isValid();
        if (!remoteReportIsValid) {
          report.addError('REMOTE_NOT_VALID', [uri], remoteReport);
        }

        report.path.pop();

        if (!remoteReportIsValid) {
          return;
        }
      }
    }

    const resourceRoot = result;

    if (result && queryPath) {
      const parts = queryPath.split('/');
      // the first segment is an id or anchor (empty for a plain JSON pointer, which means the root)
      result = findId(
        result,
        decodeJSONPointer(parts[0]),
        remotePath,
        remotePath,
        this.validator.options.maxRecursionDepth
      );
      // the rest is a path behind it
      if (result && parts.length > 1) {
        const keys: string[] = [];
        for (let idx = 1, lim = parts.length; idx < lim; idx++) {
          keys.push(decodeJSONPointer(parts[idx]));
        }
        result = this.getAtPath(result, keys) as JsonSchemaInternal | undefined;
      }
    }

    if (result && typeof result === 'object' && resourceRoot && typeof resourceRoot === 'object') {
      result.__$resourceRoot = resourceRoot;
    }

    return result;
  }
}
