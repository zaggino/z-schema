import { copyFileSync, mkdirSync, readdirSync, rmSync } from 'fs';
import path from 'node:path';

const { join } = path;

const targetSchemasDir = join(import.meta.dirname, '../src/schemas');

mkdirSync(targetSchemasDir, { recursive: true });

for (const entryName of readdirSync(targetSchemasDir)) {
  if (entryName === '_') {
    continue;
  }

  rmSync(join(targetSchemasDir, entryName), { recursive: true, force: true });
}

// List of files to copy: [source, destination]
const filesToCopy = [
  // draft-04
  [
    join(import.meta.dirname, '../json-schema-spec/draft-04/schema.json'),
    join(import.meta.dirname, '../src/schemas/draft-04-schema.json'),
  ],
  // draft-06
  [
    join(import.meta.dirname, '../json-schema-spec/draft-06/schema.json'),
    join(import.meta.dirname, '../src/schemas/draft-06-schema.json'),
  ],
  // draft-07
  [
    join(import.meta.dirname, '../json-schema-spec/draft-07/schema.json'),
    join(import.meta.dirname, '../src/schemas/draft-07-schema.json'),
  ],
  // draft2019-09
  [
    join(import.meta.dirname, '../json-schema-spec/draft/2019-09/schema.json'),
    join(import.meta.dirname, '../src/schemas/draft-2019-09-schema.json'),
  ],
  [
    join(import.meta.dirname, '../json-schema-spec/draft/2019-09/meta/applicator.json'),
    join(import.meta.dirname, '../src/schemas/draft-2019-09-meta-applicator.json'),
  ],
  [
    join(import.meta.dirname, '../json-schema-spec/draft/2019-09/meta/content.json'),
    join(import.meta.dirname, '../src/schemas/draft-2019-09-meta-content.json'),
  ],
  [
    join(import.meta.dirname, '../json-schema-spec/draft/2019-09/meta/core.json'),
    join(import.meta.dirname, '../src/schemas/draft-2019-09-meta-core.json'),
  ],
  [
    join(import.meta.dirname, '../json-schema-spec/draft/2019-09/meta/format.json'),
    join(import.meta.dirname, '../src/schemas/draft-2019-09-meta-format.json'),
  ],
  [
    join(import.meta.dirname, '../json-schema-spec/draft/2019-09/meta/meta-data.json'),
    join(import.meta.dirname, '../src/schemas/draft-2019-09-meta-meta-data.json'),
  ],
  [
    join(import.meta.dirname, '../json-schema-spec/draft/2019-09/meta/validation.json'),
    join(import.meta.dirname, '../src/schemas/draft-2019-09-meta-validation.json'),
  ],
  // draft2020-12
  [
    join(import.meta.dirname, '../json-schema-spec/draft/2020-12/schema.json'),
    join(import.meta.dirname, '../src/schemas/draft-2020-12-schema.json'),
  ],
  [
    join(import.meta.dirname, '../json-schema-spec/draft/2020-12/meta/applicator.json'),
    join(import.meta.dirname, '../src/schemas/draft-2020-12-meta-applicator.json'),
  ],
  [
    join(import.meta.dirname, '../json-schema-spec/draft/2020-12/meta/content.json'),
    join(import.meta.dirname, '../src/schemas/draft-2020-12-meta-content.json'),
  ],
  [
    join(import.meta.dirname, '../json-schema-spec/draft/2020-12/meta/core.json'),
    join(import.meta.dirname, '../src/schemas/draft-2020-12-meta-core.json'),
  ],
  [
    join(import.meta.dirname, '../json-schema-spec/draft/2020-12/meta/format-annotation.json'),
    join(import.meta.dirname, '../src/schemas/draft-2020-12-meta-format-annotation.json'),
  ],
  [
    join(import.meta.dirname, '../json-schema-spec/draft/2020-12/meta/format-assertion.json'),
    join(import.meta.dirname, '../src/schemas/draft-2020-12-meta-format-assertion.json'),
  ],
  [
    join(import.meta.dirname, '../json-schema-spec/draft/2020-12/meta/meta-data.json'),
    join(import.meta.dirname, '../src/schemas/draft-2020-12-meta-meta-data.json'),
  ],
  [
    join(import.meta.dirname, '../json-schema-spec/draft/2020-12/meta/unevaluated.json'),
    join(import.meta.dirname, '../src/schemas/draft-2020-12-meta-unevaluated.json'),
  ],
  [
    join(import.meta.dirname, '../json-schema-spec/draft/2020-12/meta/validation.json'),
    join(import.meta.dirname, '../src/schemas/draft-2020-12-meta-validation.json'),
  ],
];

filesToCopy.forEach(([src, dest]) => {
  copyFileSync(src, dest);
  console.log(`Copied ${src} -> ${dest}`);
});
