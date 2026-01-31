import { Report } from './Report.js';
import { getSchemaByUri, checkCacheForUri, cacheSchemaByUri, removeFromCacheByUri } from './SchemaCache.js';
import { isAbsoluteUri, isRelativeUri } from './Utils.js';

const mergeReference = (scope, ref) => {
  if (isAbsoluteUri(ref)) {
    return ref;
  }

  let joinedScope = scope.join('');
  const isScopeAbsolute = isAbsoluteUri(joinedScope);
  const isScopeRelative = isRelativeUri(joinedScope);
  const isRefRelative = isRelativeUri(ref);
  let toRemove;

  if (isScopeAbsolute && isRefRelative) {
    toRemove = joinedScope.match(/\/[^/]*$/);
    if (toRemove) {
      joinedScope = joinedScope.slice(0, toRemove.index + 1);
    }
  } else if (isScopeRelative && isRefRelative) {
    joinedScope = '';
  } else {
    toRemove = joinedScope.match(/[^#/]+$/);
    if (toRemove) {
      joinedScope = joinedScope.slice(0, toRemove.index);
    }
  }

  let res = joinedScope + ref;
  res = res.replace(/##/, '#');
  return res;
};

const collectReferences = (obj, results, scope, path) => {
  results = results || [];
  scope = scope || [];
  path = path || [];

  if (typeof obj !== 'object' || obj === null) {
    return results;
  }

  if (typeof obj.id === 'string') {
    scope.push(obj.id);
  }

  if (typeof obj.$ref === 'string' && typeof obj.__$refResolved === 'undefined') {
    results.push({
      ref: mergeReference(scope, obj.$ref),
      key: '$ref',
      obj: obj,
      path: path.slice(0),
    });
  }
  if (typeof obj.$schema === 'string' && typeof obj.__$schemaResolved === 'undefined') {
    results.push({
      ref: mergeReference(scope, obj.$schema),
      key: '$schema',
      obj: obj,
      path: path.slice(0),
    });
  }

  let idx;
  if (Array.isArray(obj)) {
    idx = obj.length;
    while (idx--) {
      path.push(idx.toString());
      collectReferences(obj[idx], results, scope, path);
      path.pop();
    }
  } else {
    const keys = Object.keys(obj);
    idx = keys.length;
    while (idx--) {
      // do not recurse through resolved references and other z-schema props
      if (keys[idx].indexOf('__$') === 0) {
        continue;
      }
      path.push(keys[idx]);
      collectReferences(obj[keys[idx]], results, scope, path);
      path.pop();
    }
  }

  if (typeof obj.id === 'string') {
    scope.pop();
  }

  return results;
};

const compileArrayOfSchemasLoop = function (mainReport, arr) {
  let idx = arr.length,
    compiledCount = 0;

  while (idx--) {
    // try to compile each schema separately
    const report = new Report(mainReport);
    const isValid = compileSchema.call(this, report, arr[idx]);
    if (isValid) {
      compiledCount++;
    }

    // copy errors to report
    mainReport.errors = mainReport.errors.concat(report.errors);
  }

  return compiledCount;
};

const findId = (arr, id) => {
  let idx = arr.length;
  while (idx--) {
    if (arr[idx].id === id) {
      return arr[idx];
    }
  }
  return null;
};

const compileArrayOfSchemas = function (report, arr) {
  let compiled = 0,
    lastLoopCompiled;

  do {
    // remove all UNRESOLVABLE_REFERENCE errors before compiling array again
    let idx = report.errors.length;
    while (idx--) {
      if (report.errors[idx].code === 'UNRESOLVABLE_REFERENCE') {
        report.errors.splice(idx, 1);
      }
    }

    // remember how many were compiled in the last loop
    lastLoopCompiled = compiled;

    // count how many are compiled now
    compiled = compileArrayOfSchemasLoop.call(this, report, arr);

    // fix __$missingReferences if possible
    idx = arr.length;
    while (idx--) {
      const sch = arr[idx];
      if (sch.__$missingReferences) {
        let idx2 = sch.__$missingReferences.length;
        while (idx2--) {
          const refObj = sch.__$missingReferences[idx2];
          const response = findId(arr, refObj.ref);
          if (response) {
            // this might create circular references
            refObj.obj['__' + refObj.key + 'Resolved'] = response;
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
};

export function compileSchema(report, schema) {
  report.commonErrorMessage = 'SCHEMA_COMPILATION_FAILED';

  // if schema is a string, assume it's a uri
  if (typeof schema === 'string') {
    const loadedSchema = getSchemaByUri.call(this, report, schema);
    if (!loadedSchema) {
      report.addError('SCHEMA_NOT_REACHABLE', [schema]);
      return false;
    }
    schema = loadedSchema;
  }

  // if schema is an array, assume it's an array of schemas
  if (Array.isArray(schema)) {
    return compileArrayOfSchemas.call(this, report, schema);
  }

  // if we have an id than it should be cached already (if this instance has compiled it)
  if (schema.__$compiled && schema.id && checkCacheForUri.call(this, schema.id) === false) {
    schema.__$compiled = undefined;
  }

  // do not re-compile schemas
  if (schema.__$compiled) {
    return true;
  }

  if (schema.id && typeof schema.id === 'string') {
    // add this to our schemaCache (before compilation in case we have references including id)
    cacheSchemaByUri.call(this, schema.id, schema);
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
  const refs = collectReferences.call(this, schema);
  let idx = refs.length;
  while (idx--) {
    // resolve all the collected references into __xxxResolved pointer
    const refObj = refs[idx];
    let response = getSchemaByUri.call(this, report, refObj.ref, schema);

    // we can try to use custom schemaReader if available
    if (!response) {
      const schemaReader = this.getSchemaReader();
      if (schemaReader) {
        // it's supposed to return a valid schema
        const s = schemaReader(refObj.ref);
        if (s) {
          // it needs to have the id
          s.id = refObj.ref;
          // try to compile the schema
          const subreport = new Report(report);
          if (!compileSchema.call(this, subreport, s)) {
            // copy errors to report
            report.errors = report.errors.concat(subreport.errors);
          } else {
            response = getSchemaByUri.call(this, report, refObj.ref, schema);
          }
        }
      }
    }

    if (!response) {
      const hasNotValid = report.hasError('REMOTE_NOT_VALID', [refObj.ref]);
      const isAbsolute = isAbsoluteUri(refObj.ref);
      let isDownloaded = false;
      const ignoreUnresolvableRemotes = this.options.ignoreUnresolvableReferences === true;

      if (isAbsolute) {
        // we shouldn't add UNRESOLVABLE_REFERENCE for schemas we already have downloaded
        // and set through setRemoteReference method
        isDownloaded = checkCacheForUri.call(this, refObj.ref);
      }

      if (hasNotValid) {
        // already has REMOTE_NOT_VALID error for this one
      } else if (ignoreUnresolvableRemotes && isAbsolute) {
        // ignoreUnresolvableRemotes is on and remote isAbsolute
      } else if (isDownloaded) {
        // remote is downloaded, so no UNRESOLVABLE_REFERENCE
      } else {
        Array.prototype.push.apply(report.path, refObj.path);
        report.addError('UNRESOLVABLE_REFERENCE', [refObj.ref]);
        report.path = report.path.slice(0, -refObj.path.length);

        // pusblish unresolved references out
        if (isValidExceptReferences) {
          schema.__$missingReferences = schema.__$missingReferences || [];
          schema.__$missingReferences.push(refObj);
        }
      }
    }
    // this might create circular references
    refObj.obj['__' + refObj.key + 'Resolved'] = response;
  }

  const isValid = report.isValid();
  if (isValid) {
    schema.__$compiled = true;
  } else {
    if (schema.id && typeof schema.id === 'string') {
      // remove this schema from schemaCache because it failed to compile
      removeFromCacheByUri.call(this, schema.id);
    }
  }

  // we don't need the root pointer anymore
  if (isRoot) {
    report.rootSchema = undefined;
  }

  return isValid;
}
