import type { JsonSchemaInternal } from '../json-schema-versions.js';

import { findId, getId } from '../json-schema.js';
import { getRemotePath } from '../utils/uri.js';

// ---------------------------------------------------------------------------
// $dynamicRef helpers
// ---------------------------------------------------------------------------

export const getDynamicRefAnchorName = (dynamicRef: string) => {
  const hashIdx = dynamicRef.indexOf('#');
  if (hashIdx === -1) {
    return undefined;
  }
  const fragment = dynamicRef.slice(hashIdx + 1);
  if (!fragment || fragment[0] === '/') {
    return undefined;
  }
  return fragment;
};

export const findDynamicAnchorInScope = (scopeSchema: JsonSchemaInternal, anchorName: string) => {
  const scopeId = getId(scopeSchema);
  const scopeBaseUri = scopeId ? getRemotePath(scopeId) : undefined;
  const found = findId(scopeSchema, anchorName, scopeBaseUri, scopeBaseUri);
  if (found && found.$dynamicAnchor === anchorName) {
    return found;
  }
  return undefined;
};

// ---------------------------------------------------------------------------
// $recursiveRef resolution
// ---------------------------------------------------------------------------

/**
 * Resolves the effective target for a $recursiveRef, walking the recursive anchor stack.
 */
export const resolveRecursiveRef = (
  schema: JsonSchemaInternal,
  recursiveAnchorStack: JsonSchemaInternal[]
): JsonSchemaInternal | undefined => {
  const resolved = schema.__$recursiveRefResolved as JsonSchemaInternal | undefined;
  if (!resolved) {
    return undefined;
  }
  let target = resolved;
  if (typeof target === 'object' && target.$recursiveAnchor === true) {
    const dynamicTarget = recursiveAnchorStack[0];
    if (dynamicTarget) {
      target = dynamicTarget;
    }
  }
  return target;
};

// ---------------------------------------------------------------------------
// $dynamicRef resolution
// ---------------------------------------------------------------------------

/**
 * Resolves the effective target for a $dynamicRef, walking the dynamic scope stack.
 */
export const resolveDynamicRef = (
  schema: JsonSchemaInternal,
  dynamicScopeStack: JsonSchemaInternal[]
): JsonSchemaInternal | boolean | undefined => {
  const resolved = schema.__$dynamicRefResolved as JsonSchemaInternal | boolean | undefined;
  if (typeof resolved === 'undefined' || !schema.$dynamicRef) {
    return resolved;
  }
  let target = resolved;
  const anchorName = getDynamicRefAnchorName(schema.$dynamicRef);
  if (anchorName && typeof target === 'object' && target.$dynamicAnchor === anchorName) {
    for (let scopeIdx = 0; scopeIdx < dynamicScopeStack.length; scopeIdx++) {
      const scopeSchema = dynamicScopeStack[scopeIdx];
      const scopedTarget = findDynamicAnchorInScope(scopeSchema, anchorName);
      if (scopedTarget) {
        target = scopedTarget;
        break;
      }
    }
  }
  return target;
};
