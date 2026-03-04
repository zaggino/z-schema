import type { JsonSchema, JsonSchemaInternal } from './json-schema-versions.js';
import type { ZSchemaBase } from './z-schema-base.js';
import type { ZSchemaOptions } from './z-schema-options.js';

import { findId, getId } from './json-schema.js';
import { Report } from './report.js';
import { deepClone } from './utils/clone.js';
import { decodeJSONPointer } from './utils/json.js';
import { getQueryPath, getRemotePath, isAbsoluteUri } from './utils/uri.js';
import { normalizeOptions } from './z-schema-options.js';

export type SchemaCacheStorage = Record<string, JsonSchemaInternal>;
export type ReferenceSchemaCacheStorage = Array<[JsonSchemaInternal, JsonSchemaInternal]>;

// Normalize a URI into a cache key, rejecting keys that could pollute Object.prototype.
function getSafeRemotePath(uri: string): string | undefined {
  const remotePath = getRemotePath(uri);
  if (!remotePath) {
    return undefined;
  }
  if (remotePath === '__proto__' || remotePath === 'constructor' || remotePath === 'prototype') {
    return undefined;
  }
  return remotePath;
}

const getEffectiveId = (schema: JsonSchemaInternal): string | undefined => {
  let id = getId(schema);
  if ((!id || !isAbsoluteUri(id)) && typeof schema.id === 'string' && isAbsoluteUri(schema.id)) {
    id = schema.id;
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
  let _schema: JsonSchemaInternal;

  if (typeof schema === 'string') {
    _schema = JSON.parse(schema);
  } else {
    _schema = deepClone(schema, maxCloneDepth);
  }

  if (!_schema.id) {
    _schema.id = uri;
  }

  if (validationOptions) {
    _schema.__$validationOptions = normalizeOptions(validationOptions);
  }

  return _schema;
}

export class SchemaCache {
  static global_cache: SchemaCacheStorage = Object.create(null);
  cache: SchemaCacheStorage = Object.create(null);

  constructor(private validator: ZSchemaBase) {}

  static cacheSchemaByUri(uri: string, schema: JsonSchemaInternal) {
    const remotePath = getSafeRemotePath(uri);
    if (remotePath) {
      this.global_cache[remotePath] = schema;
    }
  }

  cacheSchemaByUri(uri: string, schema: JsonSchemaInternal) {
    const remotePath = getSafeRemotePath(uri);
    if (remotePath) {
      this.cache[remotePath] = schema;
    }
  }

  removeFromCacheByUri(uri: string) {
    const remotePath = getSafeRemotePath(uri);
    if (remotePath) {
      delete this.cache[remotePath];
    }
  }

  checkCacheForUri(uri: string) {
    const remotePath = getSafeRemotePath(uri);
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
    if (path === '__proto__' || path === 'constructor' || path === 'prototype') {
      return undefined;
    }
    let found = this.cache[path];
    if (found) {
      return found;
    }
    found = SchemaCache.global_cache[path];
    if (found) {
      // Clone once from global cache into instance cache so subsequent lookups
      // never deep-clone again for the same path on this instance.
      const clone = deepClone(found, this.validator.options.maxRecursionDepth);
      if (!clone.id || (!isAbsoluteUri(clone.id) && isAbsoluteUri(path))) {
        clone.id = path;
      }
      this.cache[path] = clone;
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

    const remotePath = getSafeRemotePath(uri);
    const queryPath = getQueryPath(uri);
    let result: JsonSchemaInternal | undefined;
    let resolvedFromAncestor = false;

    if (remotePath) {
      const ancestorReport = report.getAncestor(remotePath);
      if (ancestorReport?.rootSchema) {
        result = ancestorReport.rootSchema;
        resolvedFromAncestor = true;
      }
    }

    if (!result && root && remotePath) {
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
      // we need to avoid compiling schemas in a recursive loop
      const compileRemote = result !== root && !resolvedFromAncestor;
      // now we need to compile and validate resolved schema (in case it's not already)
      if (compileRemote) {
        report.path.push(remotePath);

        let remoteReport;
        let usesAncestorReport = false;

        const anscestorReport = result.id ? report.getAncestor(result.id) : undefined;
        if (anscestorReport) {
          remoteReport = anscestorReport;
          usesAncestorReport = true;
        } else {
          remoteReport = new Report(report);
          const noCache = result.id && isAbsoluteUri(result.id) ? false : true;
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
        }
        const remoteReportIsValid = usesAncestorReport ? true : remoteReport.isValid();
        if (!remoteReportIsValid) {
          report.addError('REMOTE_NOT_VALID', [uri], remoteReport);
        }

        report.path.pop();

        if (!remoteReportIsValid) {
          return undefined;
        }
      }
    }

    const resourceRoot = result;

    if (result && queryPath) {
      const parts = queryPath.split('/');
      for (let idx = 0, lim = parts.length; result && idx < lim; idx++) {
        const key = decodeJSONPointer(parts[idx]);
        if (idx === 0) {
          // it's an id
          result = findId(result, key, remotePath, remotePath, this.validator.options.maxRecursionDepth);
        } else {
          // it's a path behind id
          result = result[key as keyof typeof result] as JsonSchemaInternal | undefined;
        }
      }
    }

    if (result && typeof result === 'object' && resourceRoot && typeof resourceRoot === 'object') {
      result.__$resourceRoot = resourceRoot;
    }

    return result;
  }
}
