import type { ValidateError } from '../../src/errors.ts';
import type { ZSchemaOptions } from '../../src/z-schema-options.ts';

import { getFormatValidators, isFormatSupported } from '../../src/format-validators.ts';
import { ZSchema } from '../../src/z-schema.ts';

// Every name a plain object inherits: `constructor`, `toString`, `__proto__`, `__defineGetter__`, ...
// A format lookup must not find any of them on Object.prototype.
const inheritedNames = Object.getOwnPropertyNames(Object.prototype);
const madeUpName = 'no-such-format';

interface Outcome {
  valid: boolean;
  codes: string[];
}

const PASSED: Outcome = { valid: true, codes: [] };

const codesOf = (err: ValidateError | undefined): string[] => (err?.details ?? []).map((detail) => detail.code);

const schemaFor = (format: string) => ({ $schema: 'http://json-schema.org/draft-07/schema#', format });

// draft-07 asserts formats, so an unknown format is an error unless `extra` says otherwise
const create = (extra?: ZSchemaOptions) => ZSchema.create({ version: 'draft-07', ...extra });

const validateOutcome = (format: string, data: unknown, extra?: ZSchemaOptions): Outcome => {
  const result = create(extra).validateSafe(data, schemaFor(format));
  return { valid: result.valid, codes: codesOf(result.err) };
};

/** Same as `validateOutcome`, through `compile()`, which throws both for a bad schema and for bad data. */
const compileOutcome = (format: string, data: unknown, extra?: ZSchemaOptions): Outcome => {
  try {
    create(extra).compile(schemaFor(format))(data);
    return PASSED;
  } catch (error) {
    return { valid: false, codes: codesOf(error as ValidateError) };
  }
};

describe.each(inheritedNames)('Format named %s (inherited from Object.prototype)', (name) => {
  it('is not a supported format', () => {
    expect(isFormatSupported(name)).toBe(false);
    expect(isFormatSupported(name, {})).toBe(false);
    expect(getFormatValidators()[name]).toBeUndefined();
    expect(create().getSupportedFormats()).not.toContain(name);
    expect(ZSchema.getRegisteredFormats()).not.toContain(name);
  });

  it('is reported as an unknown format where formats are asserted', () => {
    const unknown: Outcome = { valid: false, codes: ['UNKNOWN_FORMAT'] };
    expect(validateOutcome(madeUpName, 'x')).toEqual(unknown);
    expect(validateOutcome(name, 'x')).toEqual(unknown);
    expect(compileOutcome(madeUpName, 'x')).toEqual(unknown);
    expect(compileOutcome(name, 'x')).toEqual(unknown);
  });

  it('is ignored like any unknown format with ignoreUnknownFormats', () => {
    expect(validateOutcome(name, 'x', { ignoreUnknownFormats: true })).toEqual(PASSED);
    expect(compileOutcome(name, 'x', { ignoreUnknownFormats: true })).toEqual(PASSED);
  });

  it('can be registered globally as a real format', () => {
    ZSchema.registerFormat(name, (value) => value === 'ok');
    try {
      expect(isFormatSupported(name)).toBe(true);
      expect(ZSchema.getRegisteredFormats()).toContain(name);
      expect(getFormatValidators()[name]).toBeTypeOf('function');
      expect(validateOutcome(name, 'ok')).toEqual(PASSED);
      expect(validateOutcome(name, 'x').codes).toEqual(['INVALID_FORMAT']);
      expect(compileOutcome(name, 'x').codes).toEqual(['INVALID_FORMAT']);
    } finally {
      ZSchema.unregisterFormat(name);
    }
    expect(isFormatSupported(name)).toBe(false);
    expect(validateOutcome(name, 'ok').codes).toEqual(['UNKNOWN_FORMAT']);
  });

  it('can be registered on one instance as a real format', () => {
    const validator = create();
    validator.registerFormat(name, (value) => value === 'ok');
    expect(validator.getRegisteredFormats()).toContain(name);
    expect(validator.getSupportedFormats()).toContain(name);
    expect(validator.validateSafe('ok', schemaFor(name)).valid).toBe(true);
    expect(codesOf(validator.validateSafe('x', schemaFor(name)).err)).toEqual(['INVALID_FORMAT']);

    validator.unregisterFormat(name);
    expect(validator.getSupportedFormats()).not.toContain(name);
    expect(codesOf(validator.validateSafe('ok', schemaFor(name)).err)).toEqual(['UNKNOWN_FORMAT']);
    // other instances never saw it
    expect(validateOutcome(name, 'ok').codes).toEqual(['UNKNOWN_FORMAT']);
  });

  it('can be registered on an instance whose format map is a plain object of the caller', () => {
    const validator = create();
    const callerMap: NonNullable<ZSchemaOptions['customFormats']> = { existing: () => true };
    validator.options.customFormats = callerMap;

    validator.registerFormat(name, (value) => value === 'ok');
    expect(Object.getPrototypeOf(callerMap)).toBe(Object.prototype);
    expect(Object.hasOwn(callerMap, name)).toBe(true);
    expect(validator.getSupportedFormats()).toContain(name);
    expect(validator.validateSafe('ok', schemaFor(name)).valid).toBe(true);
    expect(codesOf(validator.validateSafe('x', schemaFor(name)).err)).toEqual(['INVALID_FORMAT']);

    validator.unregisterFormat(name);
    expect(Object.getPrototypeOf(callerMap)).toBe(Object.prototype);
    expect(validator.getSupportedFormats()).not.toContain(name);
    expect(codesOf(validator.validateSafe('ok', schemaFor(name)).err)).toEqual(['UNKNOWN_FORMAT']);
  });
});

describe('Format lookup', () => {
  it('returns format validators in an object without a prototype', () => {
    const validators = getFormatValidators();
    expect(Object.getPrototypeOf(validators)).toBeNull();
    expect(validators.email).toBeTypeOf('function');
  });

  it('gives the same answer at schema validation and at data validation', () => {
    // an instance entry that is not a function is not a format on either path
    const validator = create();
    validator.options.customFormats = { broken: undefined as unknown as null, email: 'nope' as unknown as null };
    expect(isFormatSupported('broken', validator.options.customFormats)).toBe(false);
    expect(isFormatSupported('email', validator.options.customFormats)).toBe(false);
    expect(codesOf(validator.validateSafe('a@b.co', schemaFor('email')).err)).toEqual(['UNKNOWN_FORMAT']);
  });

  it('lets an instance unregister a built-in format without affecting other instances', () => {
    const validator = create();
    validator.unregisterFormat('email');
    expect(codesOf(validator.validateSafe('a@b.co', schemaFor('email')).err)).toEqual(['UNKNOWN_FORMAT']);
    expect(validateOutcome('email', 'a@b.co')).toEqual(PASSED);
  });
});
