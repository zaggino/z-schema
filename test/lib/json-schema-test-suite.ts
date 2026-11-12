/**
 * Helpers for running the official JSON-Schema-Test-Suite in its unified layout
 * (`validation/tests/**.json`), where one file serves every dialect and each test
 * case says which dialects it applies to.
 *
 * No `node:` imports: the browser spec uses this module too.
 */

import type { JsonSchema, JsonSchemaVersion } from '../../src/json-schema-versions.ts';
import type { ZSchemaOptions } from '../../src/z-schema-options.ts';

import { inject } from 'vitest';

import { VERSION_SCHEMA_URL_MAPPING } from '../../src/json-schema-versions.ts';
import { isModernDraft } from '../../src/validation/shared.ts';
import { ZSchema } from '../../src/z-schema.ts';

export interface SuiteTest {
  description: string;
  data: unknown;
  valid: boolean;
}

export interface SuiteCase {
  description: string;
  /** Dialects the case applies to, e.g. `"6"`, `"<=2019"`, `"6,<=2019"`. Absent means all. */
  compatibility?: string;
  /** Behaviors the case depends on. Upstream may add tags this harness does not know. */
  tags?: string[];
  schema: JsonSchema;
  /** Retrieval URI → schema. Not unique across cases, so always registered per validator. */
  externalSchemas?: Record<string, JsonSchema>;
  tests: SuiteTest[];
}

export interface SuiteFile {
  description: string;
  tests: SuiteCase[];
}

/** A suite file with its path relative to the suite's `validation/tests` directory. */
export interface LoadedSuiteFile {
  file: string;
  suiteFile: SuiteFile;
}

interface Draft {
  /** The number the suite's `compatibility` property uses for this dialect. */
  release: number;
  /** Display prefix of a suite file run for this dialect, e.g. `draft4/type.json`. */
  label: string;
}

const DRAFTS: Record<JsonSchemaVersion, Draft> = {
  'draft-04': { release: 4, label: 'draft4' },
  'draft-06': { release: 6, label: 'draft6' },
  'draft-07': { release: 7, label: 'draft7' },
  'draft2019-09': { release: 2019, label: 'draft2019-09' },
  'draft2020-12': { release: 2020, label: 'draft2020-12' },
};

export const TESTED_VERSIONS = Object.keys(DRAFTS) as JsonSchemaVersion[];

/** The suite's test files, by the path `test/public` serves them at. */
const SUITE_TESTS_PATH = '/json-schema-test-suite/validation/tests/';

interface Exclusion {
  /** Path of the suite file, relative to its `validation/tests` directory. */
  file: string;
  reason: string;
  /** Dialects the exclusion applies to. Absent means all. */
  versions?: JsonSchemaVersion[];
  /** Tests to skip, by {@link suiteTestTitle}. Absent means the whole file. */
  tests?: string[];
}

// Known-failing or unsupported tests. `findUnusedExclusions` reports an entry that
// no longer matches anything, e.g. after upstream renames a file or a test.
const EXCLUSIONS: Exclusion[] = [
  {
    file: 'format-unknown.json',
    reason: 'unknown formats are reported as an error by default; the ignoreUnknownFormats option changes this',
    versions: ['draft-04', 'draft-06', 'draft-07'],
  },
  {
    file: 'optional/float-overflow.json',
    reason: "as far as I'm aware, this can't be fixed without custom json parser",
  },
  {
    file: 'optional/zero-terminated-floats.json',
    reason: "as far as I'm aware, this can't be fixed without custom json parser",
    versions: ['draft-04'],
  },
  {
    file: 'optional/cross-draft.json',
    reason: 'decided to not support this for now, using unsupported drafts should fail',
    versions: ['draft-07'],
  },
  {
    file: 'optional/bignum.json',
    reason:
      'these numbers lose their precision in JSON.parse, before the validator sees them; ' +
      'as with float-overflow, that takes a custom json parser',
    tests: [
      'maximum integer comparison just above the maximum is invalid',
      'minimum integer comparison just below the minimum is invalid',
      'float comparison with high precision (boolean) below the exclusive maximum is valid',
      'float comparison with high precision below the exclusive maximum is valid',
      'float comparison with high precision on negative numbers (boolean) above the exclusive minimum is valid',
      'float comparison with high precision on negative numbers above the exclusive minimum is valid',
      'enum comparison with high precision a slightly smaller decimal is invalid',
      'enum comparison with high precision a slightly larger decimal is invalid',
      'const comparison with high precision a slightly smaller decimal is invalid',
      'const comparison with high precision a slightly larger decimal is invalid',
      'uniqueItems comparison with high precision distinct high-precision decimals are unique',
      'uniqueItems comparison with high precision arrays containing distinct decimals are unique',
      'uniqueItems comparison with high precision objects containing distinct decimals are unique',
    ],
  },
  {
    file: 'optional/bignum.json',
    reason: 'the same case as the excluded optional/float-overflow.json',
    tests: [
      'all integers are multiples of 0.5, if overflow is handled valid if optional overflow handling is implemented',
    ],
  },
  {
    file: 'optional/bignum.json',
    reason: 'multipleOf divides and checks the quotient, which rounds to an integer above 2^53; not supported for now',
    tests: ['multipleOf with integers above 2^53 1e20 is not multiple of 3'],
  },
];

/** The name a test runs under: its case's description, then its own. */
export const suiteTestTitle = (suiteCase: SuiteCase, test: SuiteTest): string =>
  `${suiteCase.description} ${test.description}`;

/** The name a suite file runs under for a dialect, e.g. `draft4/optional/bignum.json`. */
export const suiteFileLabel = (file: string, version: JsonSchemaVersion): string => `${DRAFTS[version].label}/${file}`;

/**
 * Every file of the suite, parsed. The file list comes from the global setup
 * (`test/vitest.setup.ts`); `reader` reads one of them in the caller's environment.
 */
export const loadSuiteFiles = async (reader: <T>(publicPath: string) => Promise<T>): Promise<LoadedSuiteFile[]> =>
  await Promise.all(
    inject('publicFiles')
      .filter((publicPath) => publicPath.startsWith(SUITE_TESTS_PATH))
      .map(async (publicPath) => ({
        file: publicPath.slice(SUITE_TESTS_PATH.length),
        suiteFile: await reader<SuiteFile>(publicPath),
      }))
  );

// One comma-separated part of a `compatibility` value: `7`, `<=2019` or `=2020`.
const CONSTRAINT = /^(?<operator><=|=)?(?<release>\d+)$/;

/**
 * Whether a `compatibility` value covers a release. This is the algorithm from the
 * suite's README: each constraint replaces the verdict of the one before it, and
 * the scan stops at the first constraint whose release is not below the tested one.
 */
export const isCompatible = (compatibility: string | undefined, release: number): boolean => {
  if (compatibility === undefined) {
    return true;
  }
  let compatible = true;
  for (const constraint of compatibility.split(',')) {
    const groups = CONSTRAINT.exec(constraint)?.groups;
    if (!groups) {
      throw new Error(`unsupported compatibility constraint: ${compatibility}`);
    }
    const { operator } = groups;
    const constraintRelease = Number(groups.release);
    if (operator === '<=') {
      compatible = release <= constraintRelease;
    } else if (operator === '=') {
      compatible = release === constraintRelease;
    } else {
      compatible = release >= constraintRelease;
    }
    if (release <= constraintRelease) {
      break;
    }
  }
  return compatible;
};

const exclusionsFor = (file: string, version: JsonSchemaVersion): Exclusion[] =>
  EXCLUSIONS.filter(
    (exclusion) => exclusion.file === file && (!exclusion.versions || exclusion.versions.includes(version))
  );

const compatibleCases = (suiteFile: SuiteFile, version: JsonSchemaVersion): SuiteCase[] =>
  suiteFile.tests.filter((suiteCase) => isCompatible(suiteCase.compatibility, DRAFTS[version].release));

/**
 * The test cases of one suite file that run for a dialect: compatible with it and
 * not excluded. `file` is the path relative to the suite's `validation/tests`. An
 * excluded test is dropped from its case; a case left without tests is dropped too.
 */
export const selectCases = (suiteFile: SuiteFile, file: string, version: JsonSchemaVersion): SuiteCase[] => {
  const exclusions = exclusionsFor(file, version);
  if (exclusions.some((exclusion) => !exclusion.tests)) {
    return [];
  }
  const excludedTitles = new Set(exclusions.flatMap((exclusion) => exclusion.tests ?? []));
  const selected: SuiteCase[] = [];
  for (const suiteCase of compatibleCases(suiteFile, version)) {
    const tests = suiteCase.tests.filter((test) => !excludedTitles.has(suiteTestTitle(suiteCase, test)));
    if (tests.length > 0) {
      selected.push(tests.length === suiteCase.tests.length ? suiteCase : { ...suiteCase, tests });
    }
  }
  return selected;
};

/**
 * The exclusions that exclude nothing: the file is gone, holds no case for any of
 * the exclusion's dialects, or lacks one of the named tests. Each is described by
 * its file and what it failed to match.
 */
export const findUnusedExclusions = (suiteFiles: LoadedSuiteFile[]): string[] => {
  const unused: string[] = [];
  for (const exclusion of EXCLUSIONS) {
    const suiteFile = suiteFiles.find((loaded) => loaded.file === exclusion.file)?.suiteFile;
    const titles = new Set<string>();
    if (suiteFile) {
      for (const version of exclusion.versions ?? TESTED_VERSIONS) {
        for (const suiteCase of compatibleCases(suiteFile, version)) {
          for (const test of suiteCase.tests) {
            titles.add(suiteTestTitle(suiteCase, test));
          }
        }
      }
    }
    if (!exclusion.tests) {
      if (titles.size === 0) {
        unused.push(`${exclusion.file}: no test to exclude`);
      }
      continue;
    }
    for (const title of exclusion.tests) {
      if (!titles.has(title)) {
        unused.push(`${exclusion.file}: ${title}`);
      }
    }
  }
  return unused;
};

/** A copy of `schema` that names the dialect in `$schema`, unless it already names one. */
export const withDialect = (schema: JsonSchema, version: JsonSchemaVersion): JsonSchema => {
  const copy = structuredClone(schema);
  if (typeof copy !== 'boolean' && !copy.$schema) {
    copy.$schema = VERSION_SCHEMA_URL_MAPPING[version];
  }
  return copy;
};

/**
 * The options a case's tags call for. A tag says which `format` behavior the case
 * expects. An untagged case gets the dialect's own: from 2019-09 on that is the
 * meta-schema's vocabulary (`formatAssertions: true`), which a case with its own
 * meta-schema relies on; before that, the defaults. An unknown tag throws: it names
 * a behavior this harness has not been taught to provide or to skip.
 */
const tagOptions = (suiteCase: SuiteCase, version: JsonSchemaVersion): ZSchemaOptions => {
  const options: ZSchemaOptions = isModernDraft(version) ? { formatAssertions: true } : {};
  for (const tag of suiteCase.tags ?? []) {
    if (tag === 'format-assertion') {
      // null always asserts, in every dialect
      options.formatAssertions = null;
    } else if (tag === 'format-annotation') {
      // from 2019-09 on, `true` follows the meta-schema's vocabulary, which leaves
      // format an annotation; before that `true` still asserts, so it takes `false`
      options.formatAssertions = isModernDraft(version);
    } else {
      throw new Error(`unsupported tag "${tag}" in test case: ${suiteCase.description}`);
    }
  }
  return options;
};

/**
 * A validator for one test case, with the case's external schemas registered on the
 * instance, so that they never leak into another case.
 */
export const createCaseValidator = (suiteCase: SuiteCase, version: JsonSchemaVersion) => {
  const validator = ZSchema.create({ version, ...tagOptions(suiteCase, version) });
  for (const [uri, schema] of Object.entries(suiteCase.externalSchemas ?? {})) {
    validator.setRemoteReference(uri, withDialect(schema, version));
  }
  return validator;
};
