import { readdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const baseDir = fileURLToPath(new URL('../public', import.meta.url));

const getJsonFiles = async (directory: string, base: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries.map(async (entry: any) => {
      const fullPath = join(directory, entry.name);
      if (entry.isDirectory()) {
        return getJsonFiles(fullPath, base);
      }
      if (entry.isFile() && entry.name.endsWith('.json')) {
        return `/${relative(base, fullPath).replaceAll('\\', '/')}`;
      }
      return [];
    })
  );
  return nestedFiles.flat();
};

export const createManifest = async () => {
  const files = await getJsonFiles(baseDir, baseDir);

  // Remove 'manifest.json' if present
  const manifestIndex = files.indexOf('/manifest.json');
  if (manifestIndex !== -1) {
    files.splice(manifestIndex, 1);
  }

  await writeFile(join(baseDir, 'manifest.json'), JSON.stringify(files, null, 2));
  // console.log(`Wrote manifest.json with ${files.length} entries.`);
};
