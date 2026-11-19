import type { JsonSchema, JsonSchemaInternal } from './json-schema-versions.js';
import type { ZSchemaBase } from './z-schema-base.js';
import type { ZSchemaOptions } from './z-schema-options.js';

import { bumpGlobalSchemaStateGeneration } from './compiled-schema-cache.js';
import { findId, getId } from './json-schema.js';
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
  const _schema = (
    typeof schema === 'string' ? JSON.parse(schema) : deepClone(schema, maxCloneDepth)
  ) as JsonSchemaInternal;

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
  // URIs whose entry was registered, loaded by a schema reader, or declared inside such a schema.
  private readonly protectedPaths = new Set<string>();

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
   * Registers `schema` at `uri` on this instance. An explicit registration replaces whatever is there.
   */
  cacheSchemaByUri(uri: string, schema: JsonSchemaInternal) {
    const remotePath = getRemotePath(uri);
    if (remotePath) {
      const prev = this.cache[remotePath];
      this.cache[remotePath] = schema;
      this.protectedPaths.add(remotePath);
      this.validator.compiledSchemaCache.onScacheWrite(remotePath, prev, schema);
    }
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
   * @param trusted - `true` when the declaring schema is registered, was loaded by a schema reader, or is
   * reached through a protected entry. Its ids are then protected too. Otherwise the declaration is skipped
   * when the URI is protected.
   */
  declareId(uri: string, schema: JsonSchemaInternal, trusted: boolean): void {
    const remotePath = getRemotePath(uri);
    if (!remotePath) {
      return;
    }
    const prev = this.cache[remotePath];
    if (prev === schema) {
      return;
    }
    if (!trusted && this.isProtected(remotePath)) {
      return;
    }
    this.cache[remotePath] = schema;
    if (trusted) {
      this.protectedPaths.add(remotePath);
    }
    this.validator.compiledSchemaCache.onScacheWrite(remotePath, prev, schema);
  }

  removeFromCacheByUri(uri: string) {
    const remotePath = getRemotePath(uri);
    if (remotePath) {
      this.protectedPaths.delete(remotePath);
      if (this.cache[remotePath] !== undefined) {
        // a removed mapping can change how cached schemas resolve `$ref`
        this.validator.compiledSchemaCache.clear();
      }
      delete this.cache[remotePath];
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
    // no caching done on this, but we need to return a clone so we can mutate it
    return deepClone(refOrSchema, this.validator.options.maxRecursionDepth);
  }

  fromCache(path: string): JsonSchemaInternal | undefined {
    const found = this.cache[path];
    if (found && (this.protectedPaths.has(path) || SchemaCache.global_cache[path] === undefined)) {
      return found;
    }
    const registered = SchemaCache.global_cache[path];
    if (registered) {
      // Clone once from global cache into instance cache so subsequent lookups
      // never deep-clone again for the same path on this instance.
      const clone = deepClone(registered, this.validator.options.maxRecursionDepth);
      if (!clone.id || (!isAbsoluteUri(clone.id) && isAbsoluteUri(path))) {
        clone.id = path;
      }
      // When nothing was at `path` this is a new mapping, so no cached schema can have resolved through it:
      // schemas with unresolved refs are never cached. No compiled-schema-cache notification is needed.
      this.cache[path] = clone;
      this.protectedPaths.add(path);
      if (found) {
        // A declared id was in the way: schemas compiled against it are stale.
        this.validator.compiledSchemaCache.onScacheWrite(path, found, clone);
      }
      return clone;
    }
    return undefined;
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
        if (this.validator.sc.compileSchema(remoteReport, result, { noCache, trusted: this.isProtected(remotePath) })) {
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
      for (let idx = 1, lim = parts.length; result && idx < lim; idx++) {
        result = getOwn(result, decodeJSONPointer(parts[idx])) as JsonSchemaInternal | undefined;
      }
    }

    if (result && typeof result === 'object' && resourceRoot && typeof resourceRoot === 'object') {
      result.__$resourceRoot = resourceRoot;
    }

    return result;
  }
}
