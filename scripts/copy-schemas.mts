import { copyFileSync } from 'fs';
import { join } from 'path';

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
  // draft2020-12
  [
    join(import.meta.dirname, '../json-schema-spec/draft/2020-12/schema.json'),
    join(import.meta.dirname, '../src/schemas/draft-2020-12-schema.json'),
  ],
];

filesToCopy.forEach(([src, dest]) => {
  copyFileSync(src, dest);
  console.log(`Copied ${src} -> ${dest}`);
});
