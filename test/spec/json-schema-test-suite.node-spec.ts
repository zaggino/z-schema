import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { runTests } from './json-schema-test-suite.common.ts';

await runTests({
  reader: <T>(testFilePath: string): Promise<T> => {
    const fileContent = readFileSync(join(__dirname, '..', 'public', testFilePath), 'utf-8');
    return JSON.parse(fileContent);
  },
});
