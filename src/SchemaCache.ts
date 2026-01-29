import isequal from 'lodash.isequal';
import { Report } from './Report.js';
import { compileSchema } from './SchemaCompilation.js';
import * as SchemaValidation from './SchemaValidation.js';
import * as Utils from './Utils.js';

function decodeJSONPointer(str) {
  // http://tools.ietf.org/html/draft-ietf-appsawg-json-pointer-07#section-3
  return decodeURIComponent(str).replace(/~[0-1]/g, function (x) {
    return x === '~1' ? '/' : '~';
  });
}

export function getRemotePath(uri) {
  const io = uri.indexOf('#');
  return io === -1 ? uri : uri.slice(0, io);
}

function getQueryPath(uri) {
  const io = uri.indexOf('#');
  const res = io === -1 ? undefined : uri.slice(io + 1);
  // WARN: do not slice slash, #/ means take root and go down from it
  // if (res && res[0] === "/") { res = res.slice(1); }
  return res;
}

function findId(schema, id) {
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
  } else {
    const keys = Object.keys(schema);
    idx = keys.length;
    while (idx--) {
      const k = keys[idx];
      if (k.indexOf('__$') === 0) {
        continue;
      }
      result = findId(schema[k], id);
      if (result) {
        return result;
      }
    }
  }
}

/**
 *
 * @param {*} uri
 * @param {*} schema
 *
 * @returns {void}
 */
export function cacheSchemaByUri(uri, schema) {
  const remotePath = getRemotePath(uri);
  if (remotePath) {
    this.cache[remotePath] = schema;
  }
}

/**
 *
 * @param {*} uri
 *
 * @returns {void}
 */
export function removeFromCacheByUri(uri) {
  const remotePath = getRemotePath(uri);
  if (remotePath) {
    delete this.cache[remotePath];
  }
}

/**
 *
 * @param {*} uri
 *
 * @returns {boolean}
 */
export function checkCacheForUri(uri) {
  const remotePath = getRemotePath(uri);
  return remotePath ? this.cache[remotePath] != null : false;
}

export function getSchema(report, schema) {
  if (typeof schema === 'object') {
    schema = getSchemaByReference.call(this, report, schema);
  }
  if (typeof schema === 'string') {
    schema = getSchemaByUri.call(this, report, schema);
  }
  return schema;
}

export function getSchemaByReference(report, key) {
  let i = this.referenceCache.length;
  while (i--) {
    if (isequal(this.referenceCache[i][0], key)) {
      return this.referenceCache[i][1];
    }
  }
  // not found
  const schema = Utils.cloneDeep(key);
  this.referenceCache.push([key, schema]);
  return schema;
}

export function getSchemaByUri(report, uri, root) {
  let remotePath = getRemotePath(uri),
    queryPath = getQueryPath(uri),
    result = remotePath ? this.cache[remotePath] : root;

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
        if (compileSchema.call(this, remoteReport, result)) {
          const savedOptions = this.options;
          try {
            // If custom validationOptions were provided to setRemoteReference(),
            // use them instead of the default options
            this.options = result.__$validationOptions || this.options;
            SchemaValidation.validateSchema.call(this, remoteReport, result);
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
