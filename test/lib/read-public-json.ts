import { readFile } from 'node:fs/promises';
import path from 'node:path';

const publicDir = path.join(import.meta.dirname, '..', 'public');

/** Reads a JSON file under `test/public` by the path the browser would fetch it at. Node only. */
export const readPublicJson = async <T>(publicPath: string): Promise<T> =>
  JSON.parse(await readFile(path.join(publicDir, publicPath), 'utf-8')) as T;
