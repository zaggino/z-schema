import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import ZSchema, { JsonSchema } from '../../src/index.ts';

type JsonSchemaTestSuiteFile = Array<{
  description: string;
  schema: JsonSchema;
  tests: Array<{
    description: string;
    data: unknown;
    valid: boolean;
  }>;
}>;

const draft4Dir = fileURLToPath(new URL('../jsonSchemaTestSuite/tests/draft4/', import.meta.url));
const excludedDirs: Set<string> = new Set(['optional']);
const excludedFiles: Set<string> = new Set([]);
const excludedTests: string[] = ['an invalid URI', 'an invalid URI though valid URI reference'];

const getJsonFiles = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries.map(async (entry: any) => {
      const fullPath = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (excludedDirs.has(entry.name)) {
          return [];
        }
        return getJsonFiles(fullPath);
      }
      if (entry.isFile() && entry.name.endsWith('.json') && !excludedFiles.has(entry.name)) {
        return [fullPath];
      }
      return [];
    })
  );
  return nestedFiles.flat();
};

const jsonSchemaTestSuiteFiles = (await Promise.all(
  (await getJsonFiles(draft4Dir))
    .sort((a, b) => a.localeCompare(b))
    .map(async (filePath) => {
      let content = await import(pathToFileURL(filePath).href);
      content = content.default ?? content;

      // attach filenames for easier debugging
      if (Array.isArray(content)) {
        content.forEach((c) => {
          const rel = filePath.startsWith(draft4Dir) ? filePath.slice(draft4Dir.length) : filePath;
          c.description = `[${rel}] ${c.description}`;
        });
      }

      return content;
    })
)) as JsonSchemaTestSuiteFile[];

describe('JsonSchemaTestSuite', function () {
  it('should contain draft4 json files', function () {
    expect(jsonSchemaTestSuiteFiles.length).toBeGreaterThan(0);
  });
  jsonSchemaTestSuiteFiles.forEach(function (testDefinitions, fileIndex) {
    testDefinitions.forEach(function (testDefinition) {
      testDefinition.tests.forEach(function (test) {
        if (excludedTests.indexOf(test.description) !== -1) {
          return;
        }
        it(
          '[' +
            fileIndex +
            ']' +
            testDefinition.description +
            ' - ' +
            test.description +
            ': ' +
            JSON.stringify(test.data),
          function () {
            const validator = new ZSchema();
            const valid = validator.validate(test.data, testDefinition.schema);
            expect(valid).toBe(test.valid);
            if (valid !== test.valid) {
              if (!valid) {
                const errors = validator.getLastErrors();
                expect(errors).toBe(null);
              }
            }
          }
        );
      });
    });
  });
});
