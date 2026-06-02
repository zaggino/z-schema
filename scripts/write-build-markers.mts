// Post-build step: mark the UMD output directory as CommonJS.
//
// The package root declares `"type": "module"`, so every `.js` file in the
// package is treated as ESM by Node. The `dist/` output is ESM (`.js`) and the
// `cjs/` output uses the self-describing `.cjs` extension, but the UMD bundles
// are emitted as `umd/*.js`. Without an explicit marker, Node would interpret
// them as ESM and `require('z-schema/umd/ZSchema.js')` would break. Writing a
// `umd/package.json` with `{"type":"commonjs"}` keeps the UMD bundles CommonJS
// for Node consumers (browser `<script>` usage is unaffected either way).
//
// This runs after tsdown, which cleans `umd/` on each build.
import { writeFileSync } from 'node:fs';

writeFileSync('umd/package.json', `${JSON.stringify({ type: 'commonjs' }, null, 2)}\n`);
