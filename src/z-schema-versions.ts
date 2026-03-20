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
// draft-04
import _Draft4Schema from './schemas/draft-04-schema.json' with { type: 'json' };
// draft-06
import _Draft6Schema from './schemas/draft-06-schema.json' with { type: 'json' };
// draft-07
import _Draft7Schema from './schemas/draft-07-schema.json' with { type: 'json' };
// draft2019-09
import _Draft201909MetaApplicator from './schemas/draft-2019-09-meta-applicator.json' with { type: 'json' };
import _Draft201909MetaContent from './schemas/draft-2019-09-meta-content.json' with { type: 'json' };
import _Draft201909MetaCore from './schemas/draft-2019-09-meta-core.json' with { type: 'json' };
import _Draft201909MetaFormat from './schemas/draft-2019-09-meta-format.json' with { type: 'json' };
import _Draft201909MetaMetaData from './schemas/draft-2019-09-meta-meta-data.json' with { type: 'json' };
import _Draft201909MetaValidation from './schemas/draft-2019-09-meta-validation.json' with { type: 'json' };
import _Draft201909Schema from './schemas/draft-2019-09-schema.json' with { type: 'json' };
// draft2020-12
import _Draft202012MetaApplicator from './schemas/draft-2020-12-meta-applicator.json' with { type: 'json' };
import _Draft202012MetaContent from './schemas/draft-2020-12-meta-content.json' with { type: 'json' };
import _Draft202012MetaCore from './schemas/draft-2020-12-meta-core.json' with { type: 'json' };
import _Draft202012MetaFormatAnnotation from './schemas/draft-2020-12-meta-format-annotation.json' with { type: 'json' };
import _Draft202012MetaFormatAssertion from './schemas/draft-2020-12-meta-format-assertion.json' with { type: 'json' };
import _Draft202012MetaMetaData from './schemas/draft-2020-12-meta-meta-data.json' with { type: 'json' };
import _Draft202012MetaUnevaluated from './schemas/draft-2020-12-meta-unevaluated.json' with { type: 'json' };
import _Draft202012MetaValidation from './schemas/draft-2020-12-meta-validation.json' with { type: 'json' };
import _Draft202012Schema from './schemas/draft-2020-12-schema.json' with { type: 'json' };
import { normalizeOptions } from './z-schema-options.js';

// draft-04
const Draft4Schema: JsonSchemaDraft4 = _Draft4Schema;
// draft-06
const Draft6Schema: JsonSchemaDraft6 = _Draft6Schema;
// draft-07
const Draft7Schema: JsonSchemaDraft7 = _Draft7Schema;
// draft2019-09
const Draft201909Schema: JsonSchemaDraft201909 = _Draft201909Schema;
const Draft201909MetaApplicator: JsonSchemaDraft201909 = _Draft201909MetaApplicator;
const Draft201909MetaContent: JsonSchemaDraft201909 = _Draft201909MetaContent;
const Draft201909MetaCore: JsonSchemaDraft201909 = _Draft201909MetaCore;
const Draft201909MetaFormat: JsonSchemaDraft201909 = _Draft201909MetaFormat;
const Draft201909MetaMetaData: JsonSchemaDraft201909 = _Draft201909MetaMetaData;
const Draft201909MetaValidation: JsonSchemaDraft201909 = _Draft201909MetaValidation;
// draft2020-12
const Draft202012Schema: JsonSchemaDraft202012 = _Draft202012Schema;
const Draft202012MetaApplicator: JsonSchemaDraft202012 = _Draft202012MetaApplicator;
const Draft202012MetaContent: JsonSchemaDraft202012 = _Draft202012MetaContent;
const Draft202012MetaCore: JsonSchemaDraft202012 = _Draft202012MetaCore;
const Draft202012MetaFormatAnnotation: JsonSchemaDraft202012 = _Draft202012MetaFormatAnnotation;
const Draft202012MetaFormatAssertion: JsonSchemaDraft202012 = _Draft202012MetaFormatAssertion;
const Draft202012MetaMetaData: JsonSchemaDraft202012 = _Draft202012MetaMetaData;
const Draft202012MetaUnevaluated: JsonSchemaDraft202012 = _Draft202012MetaUnevaluated;
const Draft202012MetaValidation: JsonSchemaDraft202012 = _Draft202012MetaValidation;

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

// draft-04
registerRemoteReference('http://json-schema.org/draft-04/schema', Draft4Schema, { version: 'none' });
// draft-06
registerRemoteReference('http://json-schema.org/draft-06/schema', Draft6Schema, { version: 'none' });
// draft-07
registerRemoteReference('http://json-schema.org/draft-07/schema', Draft7Schema, { version: 'none' });
// draft2019-09
registerRemoteReference('https://json-schema.org/draft/2019-09/schema', Draft201909Schema, { version: 'none' });
registerRemoteReference('https://json-schema.org/draft/2019-09/meta/applicator', Draft201909MetaApplicator, {
  version: 'none',
});
registerRemoteReference('https://json-schema.org/draft/2019-09/meta/content', Draft201909MetaContent, {
  version: 'none',
});
registerRemoteReference('https://json-schema.org/draft/2019-09/meta/core', Draft201909MetaCore, {
  version: 'none',
});
registerRemoteReference('https://json-schema.org/draft/2019-09/meta/format', Draft201909MetaFormat, {
  version: 'none',
});
registerRemoteReference('https://json-schema.org/draft/2019-09/meta/meta-data', Draft201909MetaMetaData, {
  version: 'none',
});
registerRemoteReference('https://json-schema.org/draft/2019-09/meta/validation', Draft201909MetaValidation, {
  version: 'none',
});
// draft2020-12
registerRemoteReference('https://json-schema.org/draft/2020-12/schema', Draft202012Schema, { version: 'none' });
registerRemoteReference('https://json-schema.org/draft/2020-12/meta/applicator', Draft202012MetaApplicator, {
  version: 'none',
});
registerRemoteReference('https://json-schema.org/draft/2020-12/meta/content', Draft202012MetaContent, {
  version: 'none',
});
registerRemoteReference('https://json-schema.org/draft/2020-12/meta/core', Draft202012MetaCore, {
  version: 'none',
});
registerRemoteReference(
  'https://json-schema.org/draft/2020-12/meta/format-annotation',
  Draft202012MetaFormatAnnotation,
  { version: 'none' }
);
registerRemoteReference('https://json-schema.org/draft/2020-12/meta/format-assertion', Draft202012MetaFormatAssertion, {
  version: 'none',
});
registerRemoteReference('https://json-schema.org/draft/2020-12/meta/meta-data', Draft202012MetaMetaData, {
  version: 'none',
});
registerRemoteReference('https://json-schema.org/draft/2020-12/meta/unevaluated', Draft202012MetaUnevaluated, {
  version: 'none',
});
registerRemoteReference('https://json-schema.org/draft/2020-12/meta/validation', Draft202012MetaValidation, {
  version: 'none',
});
