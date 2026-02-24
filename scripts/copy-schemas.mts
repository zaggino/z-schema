import { copyFileSync } from 'fs';
import { join } from 'path';

// List of files to copy: [source, destination]
const filesToCopy = [
  // draft-04
  [
    join(import.meta.dirname, '../json-schema-spec/draft-04/schema.json'),
    join(import.meta.dirname, '../src/schemas/draft-04-schema.json'),
  ],
  [
    join(import.meta.dirname, '../json-schema-spec/draft-04/hyper-schema.json'),
    join(import.meta.dirname, '../src/schemas/draft-04-hyper-schema.json'),
  ],
  // draft-06
  [
    join(import.meta.dirname, '../json-schema-spec/draft-06/schema.json'),
    join(import.meta.dirname, '../src/schemas/draft-06-schema.json'),
  ],
  [
    join(import.meta.dirname, '../json-schema-spec/draft-06/hyper-schema.json'),
    join(import.meta.dirname, '../src/schemas/draft-06-hyper-schema.json'),
  ],
  [
    join(import.meta.dirname, '../json-schema-spec/draft-06/links.json'),
    join(import.meta.dirname, '../src/schemas/draft-06-links.json'),
  ],
];

filesToCopy.forEach(([src, dest]) => {
  copyFileSync(src, dest);
  console.log(`Copied ${src} -> ${dest}`);
});
