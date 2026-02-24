// import schemas so they don't have to be downloaded for validation purposes
import type {
  JsonSchema,
  JsonSchemaDraft4,
  JsonSchemaDraft6,
  JsonSchemaDraft7,
  JsonSchemaInternal,
} from './json-schema-versions.js';
import type { ZSchemaOptions } from './z-schema-options.js';

import { SchemaCache } from './schema-cache.js';
import { normalizeOptions } from './z-schema-options.js';

import _Draft4HyperSchema from './schemas/draft-04-hyper-schema.json' with { type: 'json' };
import _Draft4Schema from './schemas/draft-04-schema.json' with { type: 'json' };
import _Draft6HyperSchema from './schemas/draft-06-hyper-schema.json' with { type: 'json' };
import _Draft6Links from './schemas/draft-06-links.json' with { type: 'json' };
import _Draft6Schema from './schemas/draft-06-schema.json' with { type: 'json' };
import _Draft7HyperSchema from './schemas/draft-07-hyper-schema.json' with { type: 'json' };
import _Draft7Links from './schemas/draft-07-links.json' with { type: 'json' };
import _Draft7Schema from './schemas/draft-07-schema.json' with { type: 'json' };

const Draft4Schema: JsonSchemaDraft4 = _Draft4Schema;
const Draft4HyperSchema: JsonSchemaDraft4 = _Draft4HyperSchema;
const Draft6Schema: JsonSchemaDraft6 = _Draft6Schema;
const Draft6HyperSchema: JsonSchemaDraft6 = _Draft6HyperSchema;
const Draft6Links: JsonSchemaDraft6 = _Draft6Links;
const Draft7Schema: JsonSchemaDraft7 = _Draft7Schema;
const Draft7HyperSchema: JsonSchemaDraft7 = _Draft7HyperSchema;
const Draft7Links: JsonSchemaDraft7 = _Draft7Links;

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
registerRemoteReference('http://json-schema.org/draft-04/hyper-schema', Draft4HyperSchema, { version: 'none' });
registerRemoteReference('http://json-schema.org/draft-06/schema', Draft6Schema, { version: 'none' });
registerRemoteReference('http://json-schema.org/draft-06/hyper-schema', Draft6HyperSchema, { version: 'none' });
registerRemoteReference('http://json-schema.org/draft-06/links', Draft6Links, { version: 'none' });
registerRemoteReference('http://json-schema.org/draft-07/schema', Draft7Schema, { version: 'none' });
registerRemoteReference('http://json-schema.org/draft-07/hyper-schema', Draft7HyperSchema, { version: 'none' });
registerRemoteReference('http://json-schema.org/draft-07/links', Draft7Links, { version: 'none' });
