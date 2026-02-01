import isequal from 'lodash.isequal';
import { Report } from './report.js';
import { validateSchema } from './schema-validation.js';
import { deepClone } from './utils/deep-clone.js';
import { JsonSchemaInternal } from './json-schema.js';
import { isObject } from './utils/what-is.js';
import { ZSchema } from './z-schema.js';

export type SchemaCacheStorage = Record<string, JsonSchemaInternal>;

export type ReferenceSchemaCacheStorage = Array<any>;

const decodeJSONPointer = (str: string) => {
  // http://tools.ietf.org/html/draft-ietf-appsawg-json-pointer-07#section-3
  return decodeURIComponent(str).replace(/~[0-1]/g, (x) => (x === '~1' ? '/' : '~'));
};

export const getRemotePath = (uri: string) => {
  const io = uri.indexOf('#');
  return io === -1 ? uri : uri.slice(0, io);
};

const getQueryPath = (uri: string) => {
  const io = uri.indexOf('#');
  const res = io === -1 ? undefined : uri.slice(io + 1);
  // WARN: do not slice slash, #/ means take root and go down from it
  // if (res && res[0] === "/") { res = res.slice(1); }
  return res;
};

const findId = (schema: JsonSchemaInternal, id: string): JsonSchemaInternal | undefined => {
  // process only arrays and objects
  if (typeof schema !== 'object' || schema === null) {
    return;
  }

  // no id means root so return itself
  if (!id) {
    return schema;
  }

  if (schema.id) {
    if (schema.id === id || (schema.id[0] === '#' && schema.id.substring(1) === id)) {
      return schema;
    }
  }

  let idx, result;
  if (Array.isArray(schema)) {
    idx = schema.length;
    while (idx--) {
      result = findId(schema[idx], id);
      if (result) {
        return result;
      }
    }
  }
  if (isObject(schema)) {
    const keys = Object.keys(schema) as Array<keyof JsonSchemaInternal>;
    idx = keys.length;
    while (idx--) {
      const k = keys[idx];
      if (k.indexOf('__$') === 0) {
        continue;
      }
      result = findId(schema[k] as JsonSchemaInternal, id);
      if (result) {
        return result;
      }
    }
  }
};

export function cacheSchemaByUri(cache: SchemaCacheStorage, uri: string, schema: JsonSchemaInternal) {
  const remotePath = getRemotePath(uri);
  if (remotePath) {
    cache[remotePath] = schema;
  }
}

export function removeFromCacheByUri(cache: SchemaCacheStorage, uri: string) {
  const remotePath = getRemotePath(uri);
  if (remotePath) {
    delete cache[remotePath];
  }
}

export function checkCacheForUri(cache: SchemaCacheStorage, uri: string) {
  const remotePath = getRemotePath(uri);
  return remotePath ? cache[remotePath] != null : false;
}

export function getSchema(this: ZSchema, report: Report, refOrSchema: string | JsonSchemaInternal) {
  if (typeof refOrSchema === 'string') {
    // ref input
    refOrSchema = getSchemaByUri.call(this, report, refOrSchema);
  } else if (typeof refOrSchema === 'object') {
    // schema obj input
    refOrSchema = getSchemaByReference(this.referenceCache, report, refOrSchema);
  }
  return refOrSchema;
}

type ReferenceCache = Array<[JsonSchemaInternal, JsonSchemaInternal]>;

function getSchemaByReference(referenceCache: ReferenceCache, report: Report, schema: JsonSchemaInternal) {
  let i = referenceCache.length;
  while (i--) {
    if (isequal(referenceCache[i][0], schema)) {
      return referenceCache[i][1];
    }
  }
  // not found
  const schemaClone = deepClone(schema);
  referenceCache.push([schema, schemaClone]);
  return schemaClone;
}

export function getSchemaByUri(report: Report, uri: string, root?: JsonSchemaInternal) {
  const remotePath = getRemotePath(uri);
  const queryPath = getQueryPath(uri);
  let result = remotePath ? this.cache[remotePath] : root;

  if (result && remotePath) {
    // we need to avoid compiling schemas in a recursive loop
    const compileRemote = result !== root;
    // now we need to compile and validate resolved schema (in case it's not already)
    if (compileRemote) {
      report.path.push(remotePath);

      let remoteReport;

      const anscestorReport = report.getAncestor(result.id);
      if (anscestorReport) {
        remoteReport = anscestorReport;
      } else {
        remoteReport = new Report(report);
        if (this._compileSchema(remoteReport, result)) {
          const savedOptions = this.options;
          try {
            // If custom validationOptions were provided to setRemoteReference(),
            // use them instead of the default options
            this.options = result.__$validationOptions || this.options;
            validateSchema.call(this, remoteReport, result);
          } finally {
            this.options = savedOptions;
          }
        }
      }
      const remoteReportIsValid = remoteReport.isValid();
      if (!remoteReportIsValid) {
        report.addError('REMOTE_NOT_VALID', [uri], remoteReport);
      }

      report.path.pop();

      if (!remoteReportIsValid) {
        return undefined;
      }
    }
  }

  if (result && queryPath) {
    const parts = queryPath.split('/');
    for (let idx = 0, lim = parts.length; result && idx < lim; idx++) {
      const key = decodeJSONPointer(parts[idx]);
      if (idx === 0) {
        // it's an id
        result = findId(result, key);
      } else {
        // it's a path behind id
        result = result[key];
      }
    }
  }

  return result;
}
