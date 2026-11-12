import type { TestProject } from 'vitest/node';

import { createManifest } from './lib/create-manifest.ts';

declare module 'vitest' {
  export interface ProvidedContext {
    /** The `.json` files under `test/public`, by the path they are served at. */
    publicFiles: string[];
  }
}

// The list goes to the tests through provide/inject, not through a generated file
// in `test/public`: the browser's dev server does not reliably serve a public file
// that is created after it has started.
export default async function setup(project: TestProject) {
  project.provide('publicFiles', await createManifest());
}
