import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { runTests } from './json-schema-test-suite.common.ts';

await runTests({
  reader: <T>(testFilePath: string): Promise<T> => {
    const fileContent = readFileSync(join(import.meta.dirname, '..', 'public', testFilePath), 'utf-8');
    return JSON.parse(fileContent);
  },
});
