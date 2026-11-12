import { readPublicJson } from '../lib/read-public-json.ts';
import { runTests } from './json-schema-test-suite.common.ts';

await runTests({ reader: readPublicJson });
