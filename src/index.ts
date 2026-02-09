import { ZSchema } from './z-schema.js';

// Export types and interfaces from relevant files
export type { ErrorCode, ErrorParam, Errors } from './errors.js';
export { ValidateError } from './errors.js';
export type { FormatValidatorFn, FormatValidatorsOptions } from './format-validators.js';
export {
  getFormatValidators,
  getRegisteredFormats,
  getSupportedFormats,
  isFormatSupported,
  registerFormat,
  unregisterFormat,
} from './format-validators.js';
export type { JsonSchema, JsonSchemaType } from './json-schema.js';
export type { Report, SchemaErrorDetail } from './report.js';
export type {
  SchemaReader,
  ValidateOptions,
  ValidateResponse,
  ZSchema,
  ZSchemaAsync,
  ZSchemaAsyncSafe,
  ZSchemaOptions,
  ZSchemaSafe,
} from './z-schema.js';

export default ZSchema;
