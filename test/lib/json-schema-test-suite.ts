import type { JsonSchema, JsonSchemaVersion } from '../../src/json-schema-versions.ts';
import type { ZSchemaOptions } from '../../src/z-schema-options.ts';

import { ZSchema } from '../../src/z-schema.ts';

/**
 * Helpers for running the official JSON-Schema-Test-Suite in its unified layout
 * (`validation/tests/**.json`), where one file serves every dialect and each test
 * case says which dialects it applies to.
 *
 * No `node:` imports: the browser spec uses this module too.
 */

export interface SuiteTest {
  description: string;
  data: unknown;
  valid: boolean;
}

export interface SuiteCase {
  description: string;
  /** Dialects the case applies to, e.g. `"6"`, `"<=2019"`, `"6,<=2019"`. Absent means all. */
  compatibility?: string;
  tags?: Array<'format-assertion' | 'format-annotation'>;
  schema: JsonSchema;
  /** Retrieval URI → schema. Not unique across cases, so always registered per validator. */
  externalSchemas?: Record<string, JsonSchema>;
  tests: SuiteTest[];
}

export interface SuiteFile {
  description: string;
  tests: SuiteCase[];
}

interface Draft {
  /** The number the suite's `compatibility` property uses for this dialect. */
  release: number;
  /** Prefix of the label a suite file gets for this dialect, e.g. `draft4/type.json`. */
  label: string;
  $schema: string;
}

export const DRAFTS: Partial<Record<JsonSchemaVersion, Draft>> = {
  'draft-04': { release: 4, label: 'draft4', $schema: 'http://json-schema.org/draft-04/schema#' },
  'draft-06': { release: 6, label: 'draft6', $schema: 'http://json-schema.org/draft-06/schema#' },
  'draft-07': { release: 7, label: 'draft7', $schema: 'http://json-schema.org/draft-07/schema#' },
  'draft2019-09': { release: 2019, label: 'draft2019-09', $schema: 'https://json-schema.org/draft/2019-09/schema' },
  'draft2020-12': { release: 2020, label: 'draft2020-12', $schema: 'https://json-schema.org/draft/2020-12/schema' },
};

export const TESTED_VERSIONS = Object.keys(DRAFTS) as JsonSchemaVersion[];

/** Path of the suite's test files, relative to the submodule root. */
export const SUITE_TESTS_DIR = 'validation/tests';

// Directories, relative to SUITE_TESTS_DIR, skipped for every dialect.
const excludedDirs: string[] = [
  // proposals are not part of any released dialect
  'proposals',
];

// Files skipped for one dialect, as `<draft label>/<path relative to SUITE_TESTS_DIR>`.
const excludedFiles = new Set<string>([
  // unknown formats are reported as an error by default
  // there's ignoreUnknownFormats option that can change this
  'draft4/format-unknown.json',
  'draft6/format-unknown.json',
  'draft7/format-unknown.json',
  // as far as I'm aware, this can't be fixed without custom json parser
  'draft4/optional/float-overflow.json',
  'draft6/optional/float-overflow.json',
  'draft7/optional/float-overflow.json',
  'draft2019-09/optional/float-overflow.json',
  'draft2020-12/optional/float-overflow.json',
  'draft4/optional/zero-terminated-floats.json',
  // decided to not support this for now, using unsupported drafts should fail
  'draft7/optional/cross-draft.json',
]);

// Single tests skipped for every dialect, as `<case description> <test description>`.
const excludedTests = new Set<string>([
  // optional/bignum.json: these numbers lose their precision in JSON.parse, before
  // the validator sees them; as with float-overflow, that takes a custom json parser
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
  // optional/bignum.json: the same case as the excluded optional/float-overflow.json
  'all integers are multiples of 0.5, if overflow is handled valid if optional overflow handling is implemented',
  // optional/bignum.json: multipleOf divides and checks the quotient, which rounds
  // to an integer above 2^53; not supported for now
  'multipleOf with integers above 2^53 1e20 is not multiple of 3',
]);

/** The name a test runs under: its case's description, then its own. */
export const suiteTestTitle = (suiteCase: SuiteCase, test: SuiteTest): string =>
  `${suiteCase.description} ${test.description}`;

const getDraft = (version: JsonSchemaVersion): Draft => {
  const draft = DRAFTS[version];
  if (!draft) {
    throw new Error(`JSON-Schema-Test-Suite is not run for version: ${version}`);
  }
  return draft;
};

/** The label a suite file is reported under for a dialect, e.g. `draft4/optional/bignum.json`. */
export const suiteFileLabel = (file: string, version: JsonSchemaVersion): string =>
  `${getDraft(version).label}/${file}`;

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

/**
 * The test cases of one suite file that run for a dialect: compatible with it and
 * not excluded. `file` is the path relative to {@link SUITE_TESTS_DIR}. An excluded
 * test is dropped from its case; a case left without tests is dropped too.
 */
export const selectCases = (suiteFile: SuiteFile, file: string, version: JsonSchemaVersion): SuiteCase[] => {
  if (excludedDirs.some((dir) => file.startsWith(`${dir}/`))) {
    return [];
  }
  if (excludedFiles.has(suiteFileLabel(file, version))) {
    return [];
  }
  const { release } = getDraft(version);
  const selected: SuiteCase[] = [];
  for (const suiteCase of suiteFile.tests) {
    if (!isCompatible(suiteCase.compatibility, release)) {
      continue;
    }
    const tests = suiteCase.tests.filter((test) => !excludedTests.has(suiteTestTitle(suiteCase, test)));
    if (tests.length > 0) {
      selected.push(tests.length === suiteCase.tests.length ? suiteCase : { ...suiteCase, tests });
    }
  }
  return selected;
};

/** A copy of `schema` that names the dialect in `$schema`, unless it already names one. */
export const withDialect = (schema: JsonSchema, version: JsonSchemaVersion): JsonSchema => {
  const copy = structuredClone(schema);
  if (typeof copy !== 'boolean' && !copy.$schema) {
    copy.$schema = getDraft(version).$schema;
  }
  return copy;
};

const isModernDraft = (version: JsonSchemaVersion) => version === 'draft2019-09' || version === 'draft2020-12';

/**
 * `formatAssertions` for a case, undefined when the default applies. Only a tagged
 * case depends on which `format` behavior is in effect.
 */
const formatAssertionsFor = (suiteCase: SuiteCase, version: JsonSchemaVersion): ZSchemaOptions['formatAssertions'] => {
  if (suiteCase.tags?.includes('format-assertion')) {
    return null;
  }
  if (suiteCase.tags?.includes('format-annotation')) {
    // from 2019-09 on, `true` follows the meta-schema's vocabulary, which leaves
    // format an annotation; before that `true` still asserts, so it takes `false`
    return isModernDraft(version);
  }
  return undefined;
};

/**
 * A validator for one test case, with the case's external schemas registered on the
 * instance, so that they never leak into another case.
 */
export const createCaseValidator = (suiteCase: SuiteCase, version: JsonSchemaVersion) => {
  const options: ZSchemaOptions = { version };
  const formatAssertions = formatAssertionsFor(suiteCase, version);
  if (formatAssertions !== undefined) {
    options.formatAssertions = formatAssertions;
  }
  const validator = ZSchema.create(options);
  if (suiteCase.externalSchemas) {
    for (const uri of Object.keys(suiteCase.externalSchemas)) {
      validator.setRemoteReference(uri, withDialect(suiteCase.externalSchemas[uri], version));
    }
  }
  return validator;
};
