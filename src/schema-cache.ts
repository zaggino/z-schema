import type { ZSchema } from './z-schema.js';
import isequal from 'lodash.isequal';
import { Report } from './report.js';
import { findId, JsonSchema, JsonSchemaInternal } from './json-schema.js';
import { getQueryPath, getRemotePath } from './utils/uri.js';
import { deepClone } from './utils/clone.js';
import { decodeJSONPointer } from './utils/json.js';

export type SchemaCacheStorage = Record<string, JsonSchemaInternal>;
export type ReferenceSchemaCacheStorage = Array<[JsonSchemaInternal, JsonSchemaInternal]>;

export class SchemaCache {
  cache: SchemaCacheStorage = {};
  referenceCache: ReferenceSchemaCacheStorage = [];

  constructor(private validator: ZSchema) {}

  cacheSchemaByUri(uri: string, schema: JsonSchemaInternal) {
    const remotePath = getRemotePath(uri);
    if (remotePath) {
      this.cache[remotePath] = schema;
    }
  }

  removeFromCacheByUri(uri: string) {
    const remotePath = getRemotePath(uri);
    if (remotePath) {
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
    if (typeof refOrSchema === 'object') {
      // schema obj input
      return this.getSchemaByReference(report, refOrSchema);
    }
    throw new Error(`unexpected code reached`);
  }

  getSchemaByUri(report: Report, uri: string, root?: JsonSchemaInternal) {
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

        const anscestorReport = result.id ? report.getAncestor(result.id) : undefined;
        if (anscestorReport) {
          remoteReport = anscestorReport;
        } else {
          remoteReport = new Report(report);
          if (this.validator.sc.compileSchema(remoteReport, result)) {
            const savedOptions = this.validator.options;
            try {
              // If custom validationOptions were provided to setRemoteReference(),
              // use them instead of the default options
              this.validator.options = result.__$validationOptions || this.validator.options;
              this.validator.sv.validateSchema(remoteReport, result);
            } finally {
              this.validator.options = savedOptions;
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
          result = result[key as keyof typeof result] as JsonSchemaInternal | undefined;
        }
      }
    }

    return result;
  }

  getSchemaByReference(report: Report, schema: JsonSchemaInternal) {
    let i = this.referenceCache.length;
    while (i--) {
      if (isequal(this.referenceCache[i][0], schema)) {
        return this.referenceCache[i][1];
      }
    }
    // not found
    const schemaClone = deepClone(schema);
    this.referenceCache.push([schema, schemaClone]);
    return schemaClone;
  }
}
