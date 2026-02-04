import { createManifest } from './lib/create-manifest.ts';

export default async function setup() {
  await createManifest();
}
