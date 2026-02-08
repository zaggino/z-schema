import { ZSchema } from './z-schema.js';

// Export types and interfaces from relevant files
export type { FormatValidatorFn, FormatValidatorsOptions } from './format-validators.js';
export type { ErrorCode, ErrorParam, Errors } from './errors.js';
export type { JsonSchema, JsonSchemaType } from './json-schema.js';
export type { Report, SchemaErrorDetail } from './report.js';
export type {
  ZSchema,
  ZSchemaSafe,
  ZSchemaAsync,
  ZSchemaAsyncSafe,
  ZSchemaOptions,
  ValidateOptions,
  ValidateResponse,
  SchemaReader,
} from './z-schema.js';
export {
  getFormatValidators,
  getRegisteredFormats,
  getSupportedFormats,
  isFormatSupported,
  registerFormat,
  unregisterFormat,
} from './format-validators.js';

export { ValidateError } from './errors.js';

export default ZSchema;
