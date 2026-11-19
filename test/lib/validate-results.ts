import type { ZSchemaOptions } from '../../src/z-schema-options.ts';

import { expect } from 'vitest';

import { ZSchema } from '../../src/z-schema.ts';
import { codesOf } from './fast-validator.ts';

export { codesOf } from './fast-validator.ts';

export const createSafe = (options: ZSchemaOptions = {}) => ZSchema.create({ ...options, safe: true });

export type Result = ReturnType<ReturnType<typeof createSafe>['validate']>;

export const expectValid = (res: Result) => {
  expect(res.valid).toBe(true);
};

export const expectInvalidType = (res: Result) => {
  expect(res.valid).toBe(false);
  expect(codesOf(res)).toEqual(['INVALID_TYPE']);
};
