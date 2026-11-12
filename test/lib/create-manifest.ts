import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { join, relative } = path;

const baseDir = fileURLToPath(new URL('../public', import.meta.url));

const getJsonFiles = async (directory: string, base: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries.map(async (entry: any) => {
      const fullPath = join(directory, entry.name);
      if (entry.isDirectory()) {
        return await getJsonFiles(fullPath, base);
      }
      if (entry.isFile() && entry.name.endsWith('.json')) {
        return `/${relative(base, fullPath).replaceAll('\\', '/')}`;
      }
      return [];
    })
  );
  return nestedFiles.flat();
};

/**
 * The `.json` files under `test/public`, as the paths the browser fetches them by
 * (`/json-schema-test-suite/...`).
 */
export const createManifest = async (): Promise<string[]> => await getJsonFiles(baseDir, baseDir);
