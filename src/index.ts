import { ZSchema } from './z-schema.js';

// Export types and interfaces from relevant files
export type { FormatValidatorFn, FormatValidatorsOptions } from './format-validators.js';
export type { ErrorCode, ErrorParam, Errors } from './errors.js';
export type { JsonSchema, JsonSchemaType } from './json-schema.js';
export type { Report, SchemaError, SchemaErrorDetail } from './report.js';
export type { ZSchemaOptions, SchemaReader, ValidateOptions, ValidateCallback } from './z-schema.js';
export {
  getFormatValidators,
  getRegisteredFormats,
  getSupportedFormats,
  isFormatSupported,
  registerFormat,
  unregisterFormat,
} from './format-validators.js';

export default ZSchema;
