import { readFileSync } from 'node:fs';
import path from 'node:path';

import { runTests } from './json-schema-test-suite.common.ts';

const { join } = path;

await runTests({
  reader: <T>(testFilePath: string): Promise<T> => {
    const fileContent = readFileSync(join(import.meta.dirname, '..', 'public', testFilePath), 'utf-8');
    return JSON.parse(fileContent);
  },
});
