import { runTests } from './json-schema-test-suite.common.ts';

await runTests({
  reader: async <T>(testFilePath: string): Promise<T> => {
    const fileContent = await fetch(testFilePath);
    return fileContent.json();
  },
});
