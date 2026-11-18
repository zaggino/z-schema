import type { ZSchemaOptions } from '../../src/z-schema-options.ts';

import { ValidateError } from '../../src/errors.ts';
import { ZSchema } from '../../src/z-schema.ts';

const isPostalCode = (value: unknown) => typeof value === 'string' && /^\d{5}(?:-\d{4})?$/.test(value);

const postalSchema = { type: 'string', format: 'postal-code' };
const emailSchema = { type: 'string', format: 'email' };

const codesOf = (err: ValidateError | undefined): string[] => (err?.details ?? []).map((detail) => detail.code);

/** Error codes of the `ValidateError` that `run` throws, or `[]` when it does not throw. */
const thrownCodes = (run: () => unknown): string[] => {
  try {
    run();
    return [];
  } catch (error) {
    if (!(error instanceof ValidateError)) {
      throw error;
    }
    return codesOf(error);
  }
};

// draft-07 asserts formats, so a format that is not known is reported as UNKNOWN_FORMAT
const withFormats = (customFormats: ZSchemaOptions['customFormats']): ZSchemaOptions => ({
  version: 'draft-07',
  customFormats,
});

describe('customFormats constructor option', () => {
  it('registers the formats on the created instance', () => {
    // the shape of the example in docs/options.md: no other option, formats passed at creation
    const validator = ZSchema.create({ customFormats: { 'postal-code': isPostalCode } });
    expect(validator.getRegisteredFormats()).toEqual(['postal-code']);
    expect(validator.getSupportedFormats()).toContain('postal-code');
  });

  it('enforces a passed format through validate() and compile()', () => {
    const validator = ZSchema.create(withFormats({ 'postal-code': isPostalCode }));
    expect(validator.validate('12345', postalSchema)).toBe(true);
    expect(thrownCodes(() => validator.validate('nope', postalSchema))).toEqual(['INVALID_FORMAT']);

    const compiled = validator.compile(postalSchema);
    expect(compiled('12345-6789')).toBe(true);
    expect(thrownCodes(() => compiled('nope'))).toEqual(['INVALID_FORMAT']);
  });

  it('enforces a passed format in the safe variant', () => {
    const validator = ZSchema.create({ ...withFormats({ 'postal-code': isPostalCode }), safe: true });
    expect(validator.validate('12345', postalSchema).valid).toBe(true);
    expect(codesOf(validator.validate('nope', postalSchema).err)).toEqual(['INVALID_FORMAT']);
    expect(codesOf(validator.compile(postalSchema)('nope').err)).toEqual(['INVALID_FORMAT']);
  });

  it('enforces a passed format in the async variant, including an async validator', async () => {
    const validator = ZSchema.create({
      ...withFormats({ 'postal-code': (value) => Promise.resolve(isPostalCode(value)) }),
      async: true,
    });
    await expect(validator.validate('12345', postalSchema)).resolves.toBe(true);
    await expect(validator.validate('nope', postalSchema)).rejects.toMatchObject({
      details: [expect.objectContaining({ code: 'INVALID_FORMAT' })],
    });
  });

  it('disables a built-in format with null, on that instance only', () => {
    const validator = ZSchema.create(withFormats({ email: null }));
    expect(validator.getSupportedFormats()).not.toContain('email');
    expect(thrownCodes(() => validator.validate('a@b.co', emailSchema))).toEqual(['UNKNOWN_FORMAT']);

    const other = ZSchema.create({ version: 'draft-07' });
    expect(other.validate('a@b.co', emailSchema)).toBe(true);
    expect(thrownCodes(() => other.validate('nope', emailSchema))).toEqual(['INVALID_FORMAT']);
  });

  it('keeps passed formats away from other instances and the global registry', () => {
    ZSchema.create(withFormats({ 'postal-code': isPostalCode }));
    expect(ZSchema.getRegisteredFormats()).not.toContain('postal-code');

    const other = ZSchema.create({ version: 'draft-07' });
    expect(other.getSupportedFormats()).not.toContain('postal-code');
    expect(thrownCodes(() => other.validate('12345', postalSchema))).toEqual(['UNKNOWN_FORMAT']);
  });

  it('copies the passed map, so instances created from one map do not share formats', () => {
    const shared: NonNullable<ZSchemaOptions['customFormats']> = { 'postal-code': isPostalCode };
    const first = ZSchema.create(withFormats(shared));
    const second = ZSchema.create(withFormats(shared));

    first.registerFormat('email', () => true);
    first.unregisterFormat('postal-code');

    // the caller's map is untouched
    expect(Object.keys(shared)).toEqual(['postal-code']);
    expect(shared['postal-code']).toBe(isPostalCode);
    // the second instance still has what was passed, and nothing the first one registered
    expect(second.getRegisteredFormats()).toEqual(['postal-code']);
    expect(second.validate('12345', postalSchema)).toBe(true);
    expect(thrownCodes(() => second.validate('nope', emailSchema))).toEqual(['INVALID_FORMAT']);
    // the first instance has its own changes
    expect(first.validate('nope', emailSchema)).toBe(true);
    expect(thrownCodes(() => first.validate('12345', postalSchema))).toEqual(['UNKNOWN_FORMAT']);
  });

  it('ignores changes made to the passed map after creation', () => {
    const passed: NonNullable<ZSchemaOptions['customFormats']> = {};
    const validator = ZSchema.create(withFormats(passed));
    passed['postal-code'] = isPostalCode;
    expect(validator.getRegisteredFormats()).toEqual([]);
    expect(thrownCodes(() => validator.validate('12345', postalSchema))).toEqual(['UNKNOWN_FORMAT']);
  });

  it('lets registerFormat and unregisterFormat work on top of the passed formats', () => {
    const validator = ZSchema.create(withFormats({ 'postal-code': isPostalCode }));
    validator.registerFormat('even', (value) => typeof value === 'number' && value % 2 === 0);
    expect(validator.getRegisteredFormats()).toEqual(['even', 'postal-code']);
    expect(validator.validate(4, { format: 'even' })).toBe(true);
    expect(thrownCodes(() => validator.validate(3, { format: 'even' }))).toEqual(['INVALID_FORMAT']);

    validator.unregisterFormat('postal-code');
    expect(validator.getRegisteredFormats()).toEqual(['even']);
    expect(thrownCodes(() => validator.validate('12345', postalSchema))).toEqual(['UNKNOWN_FORMAT']);
  });

  it('is undefined unless passed', () => {
    expect(ZSchema.getDefaultOptions().customFormats).toBeUndefined();
    expect(ZSchema.create().options.customFormats).toBeUndefined();
    expect(ZSchema.create({}).options.customFormats).toBeUndefined();
  });
});
