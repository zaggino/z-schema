export interface JsonSchema {
  $ref?: string;
  id?: string;
  $schema?: string;
  title?: string;
  description?: string;
  default?: unknown;
  definitions?: Record<string, JsonSchema>;
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  patternProperties?: Record<string, JsonSchema>;
  dependencies?: Record<string, string[]>;
  // properties
  multipleOf?: number;
  minimum?: number;
  exclusiveMinimum?: boolean;
  maximum?: number;
  exclusiveMaximum?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  additionalItems?: boolean | JsonSchema;
  items?: JsonSchema | JsonSchema[];
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  minProperties?: number;
  maxProperties?: number;
  required?: string[];
  additionalProperties?: boolean | JsonSchema;
  enum?: Array<unknown>;
  format?: string;
  allOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  not?: JsonSchema;
}

export type JsonSchemaType = 'array' | 'boolean' | 'integer' | 'null' | 'number' | 'object' | 'string';

export interface ZSchemaInternalProperties {
  __$compiled?: unknown;
  __$missingReferences?: unknown[];
  __$refResolved?: JsonSchema;
  __$schemaResolved?: unknown;
  __$validated?: boolean;
  __$validationOptions?: unknown;
  __$visited?: boolean;
}

export interface JsonSchemaInternal extends JsonSchema, ZSchemaInternalProperties {}
