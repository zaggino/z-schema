// import schemas so they don't have to be downloaded for validation purposes
import type {
  JsonSchema,
  JsonSchemaDraft4,
  JsonSchemaDraft6,
  JsonSchemaDraft7,
  JsonSchemaDraft201909,
  JsonSchemaDraft202012,
  JsonSchemaInternal,
} from './json-schema-versions.js';
import type { ZSchemaOptions } from './z-schema-options.js';

import { SchemaCache } from './schema-cache.js';
import { normalizeOptions } from './z-schema-options.js';

import _Draft4Schema from './schemas/draft-04-schema.json' with { type: 'json' };
import _Draft6Schema from './schemas/draft-06-schema.json' with { type: 'json' };
import _Draft7Schema from './schemas/draft-07-schema.json' with { type: 'json' };
import _Draft201909Schema from './schemas/draft-2019-09-schema.json' with { type: 'json' };
import _Draft202012Schema from './schemas/draft-2020-12-schema.json' with { type: 'json' };

const Draft4Schema: JsonSchemaDraft4 = _Draft4Schema;
const Draft6Schema: JsonSchemaDraft6 = _Draft6Schema;
const Draft7Schema: JsonSchemaDraft7 = _Draft7Schema;
const Draft201909Schema: JsonSchemaDraft201909 = _Draft201909Schema;
const Draft202012Schema: JsonSchemaDraft202012 = _Draft202012Schema;

const registerRemoteReference = (uri: string, schema: JsonSchema, validationOptions?: ZSchemaOptions) => {
  const preparedSchema = schema as JsonSchemaInternal;

  if (!preparedSchema.id) {
    preparedSchema.id = uri;
  }

  if (validationOptions) {
    preparedSchema.__$validationOptions = normalizeOptions(validationOptions);
  }

  SchemaCache.cacheSchemaByUri(uri, preparedSchema);
};

registerRemoteReference('http://json-schema.org/draft-04/schema', Draft4Schema, { version: 'none' });
registerRemoteReference('http://json-schema.org/draft-06/schema', Draft6Schema, { version: 'none' });
registerRemoteReference('http://json-schema.org/draft-07/schema', Draft7Schema, { version: 'none' });
registerRemoteReference('https://json-schema.org/draft/2019-09/schema', Draft201909Schema, { version: 'none' });
registerRemoteReference('https://json-schema.org/draft/2020-12/schema', Draft202012Schema, { version: 'none' });
