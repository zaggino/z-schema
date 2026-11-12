import { buildFastFor } from '../lib/fast-validator.ts';
import { loadSuiteFiles, suiteRuns, TESTED_VERSIONS } from '../lib/json-schema-test-suite.ts';
import { readPublicJson } from '../lib/read-public-json.ts';

// Differential run: wherever the fast validator can be built for an official-suite schema, it must
// agree with the interpreter on every test of that schema.
const suiteFiles = await loadSuiteFiles(readPublicJson);

// Suite files that contain at least one schema the builder rejects. Every other file must be fully built, so a
// keyword silently dropping out of the builder fails the file that exercises it.
const PARTIALLY_BUILT: Record<string, readonly string[]> = {
  'draft-06': ['draft6/ref-legacy.json'],
  'draft-07': ['draft7/ref-legacy.json'],
  'draft2019-09': [
    'draft2019-09/enum.json',
    'draft2019-09/optional/cross-draft.json',
    'draft2019-09/recursiveRef.json',
    'draft2019-09/unevaluatedItems.json',
    'draft2019-09/unevaluatedProperties.json',
    'draft2019-09/vocabulary.json',
  ],
  'draft2020-12': [
    'draft2020-12/dynamicRef.json',
    'draft2020-12/enum.json',
    'draft2020-12/optional/cross-draft.json',
    'draft2020-12/optional/dynamicRef.json',
    'draft2020-12/optional/format-assertion.json',
    'draft2020-12/unevaluatedItems.json',
    'draft2020-12/unevaluatedProperties.json',
    'draft2020-12/vocabulary.json',
  ],
};

for (const version of TESTED_VERSIONS) {
  describe(`fast validator vs interpreter: ${version}`, () => {
    for (const { label, cases } of suiteRuns(suiteFiles, version)) {
      it(label, () => {
        const mismatches: string[] = [];
        let built = 0;
        let unbuilt = 0;
        for (const { schema, tests, createValidator } of cases) {
          if (typeof schema === 'boolean') {
            continue;
          }
          let caseBuilt = false;
          for (const test of tests) {
            const validator = createValidator();
            const expected = validator.validateSafe(test.data, schema).valid;
            const fast = buildFastFor(validator, schema);
            if (fast) {
              caseBuilt = true;
              const actual = fast(test.data);
              if (actual !== expected) {
                mismatches.push(`${test.title}: fast=${actual} interpreter=${expected}`);
              }
            }
          }
          if (caseBuilt) {
            built++;
          } else {
            unbuilt++;
          }
        }
        expect(mismatches).toEqual([]);
        // files expected to hold unsupported schemas must still hold one, so the list cannot go stale
        const expectPartial = (PARTIALLY_BUILT[version] ?? []).includes(label);
        expect({ label, built, hasUnbuilt: unbuilt > 0 }).toEqual({ label, built, hasUnbuilt: expectPartial });
      });
    }
  });
}
