import type { JsonSchemaVersion } from '../../src/json-schema-versions.ts';

import {
  findUnusedExclusions,
  isCompatible,
  loadSuiteFiles,
  selectCases,
  TESTED_VERSIONS,
} from '../lib/json-schema-test-suite.ts';
import { readPublicJson } from '../lib/read-public-json.ts';

const suiteFiles = await loadSuiteFiles(readPublicJson);

const RELEASES = [3, 4, 6, 7, 2019, 2020, 9999];

describe('JSON-Schema-Test-Suite case selection', () => {
  // the examples of the suite's README, "Test Case Compatibility"
  it.each([
    [undefined, RELEASES],
    ['7', [7, 2019, 2020, 9999]],
    ['<=2019', [3, 4, 6, 7, 2019]],
    ['6,<=2019', [6, 7, 2019]],
    ['=2020', [2020]],
    ['=3,7,<=2020', [3, 7, 2019, 2020]],
    ['<=3,7', [3, 7, 2019, 2020, 9999]],
    ['9999', [9999]],
  ])('compatibility %s covers releases %j', (compatibility, expected) => {
    expect(RELEASES.filter((release) => isCompatible(compatibility, release))).toStrictEqual(expected);
  });

  it('rejects a compatibility value it cannot parse', () => {
    expect(() => isCompatible('>=7', 7)).toThrow('unsupported compatibility constraint');
  });

  // A floor a little under what each dialect runs today. Upstream adds tests far
  // more often than it removes them, so a count below the floor means the
  // selection is dropping cases; raise the floors when the suite grows a lot.
  it.each<[JsonSchemaVersion, number]>([
    ['draft-04', 950],
    ['draft-06', 1250],
    ['draft-07', 1700],
    ['draft2019-09', 2100],
    ['draft2020-12', 2150],
  ])('%s runs at least %d tests', (version, floor) => {
    let count = 0;
    for (const { file, suiteFile } of suiteFiles) {
      for (const suiteCase of selectCases(suiteFile, file, version)) {
        count += suiteCase.tests.length;
      }
    }
    expect(count).toBeGreaterThanOrEqual(floor);
  });

  it('has a floor for every tested dialect', () => {
    expect(TESTED_VERSIONS).toStrictEqual(['draft-04', 'draft-06', 'draft-07', 'draft2019-09', 'draft2020-12']);
  });

  it('has no exclusion that excludes nothing', () => {
    expect(findUnusedExclusions(suiteFiles)).toStrictEqual([]);
  });
});
