import { copyFileSync } from 'fs';
import { join } from 'path';

// List of files to copy: [source, destination]
const filesToCopy = [
  [
    join(import.meta.dirname, '../json-schema-spec/draft-04/schema.json'),
    join(import.meta.dirname, '../src/schemas/draft-04-schema.json'),
  ],
  [
    join(import.meta.dirname, '../json-schema-spec/draft-04/hyper-schema.json'),
    join(import.meta.dirname, '../src/schemas/draft-04-hyper-schema.json'),
  ],
];

filesToCopy.forEach(([src, dest]) => {
  copyFileSync(src, dest);
  console.log(`Copied ${src} -> ${dest}`);
});
