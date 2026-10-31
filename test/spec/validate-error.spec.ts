import type { JsonSchema } from '../../src/json-schema-versions.ts';
import type { ValidateOptions } from '../../src/z-schema-base.ts';
import type { ZSchemaOptions } from '../../src/z-schema-options.ts';

import { toValidateError } from '../../src/errors.ts';
import { ValidateError } from '../../src/index.ts';
import { ZSchema } from '../../src/z-schema.ts';

type Variant = 'sync' | 'safe' | 'async' | 'asyncSafe';

const variants: Variant[] = ['sync', 'safe', 'async', 'asyncSafe'];

/** Runs one validation in the given variant and returns what it surfaced as the error (thrown, rejected or `err`). */
const failureOf = async (
  variant: Variant,
  options: ZSchemaOptions,
  json: unknown,
  schema: JsonSchema | string,
  validateOptions?: ValidateOptions
): Promise<unknown> => {
  if (variant === 'sync') {
    try {
      ZSchema.create(options).validate(json, schema, validateOptions);
      return null;
    } catch (error) {
      return error;
    }
  }
  if (variant === 'safe') {
    return ZSchema.create({ ...options, safe: true }).validate(json, schema, validateOptions).err;
  }
  if (variant === 'async') {
    try {
      await ZSchema.create({ ...options, async: true }).validate(json, schema, validateOptions);
      return null;
    } catch (error) {
      return error;
    }
  }
  const result = await ZSchema.create({ ...options, async: true, safe: true }).validate(json, schema, validateOptions);
  return result.err;
};

/** Like {@link failureOf}, but through a `compile()`d validator; the hook throws only for `data`, not at compile time. */
const compiledFailureOf = async (variant: Variant, thrown: unknown): Promise<unknown> => {
  const data = { marker: true };
  const options: ZSchemaOptions = {
    customValidator: (_report, _schema, json) => {
      if (json === data) {
        throw thrown;
      }
    },
  };
  const schema: JsonSchema = { type: 'object' };
  if (variant === 'sync') {
    try {
      ZSchema.create(options).compile(schema)(data);
      return null;
    } catch (error) {
      return error;
    }
  }
  if (variant === 'safe') {
    return ZSchema.create({ ...options, safe: true }).compile(schema)(data).err;
  }
  if (variant === 'async') {
    try {
      await ZSchema.create({ ...options, async: true }).compile(schema)(data);
      return null;
    } catch (error) {
      return error;
    }
  }
  const result = await ZSchema.create({ ...options, async: true, safe: true }).compile(schema)(data);
  return result.err;
};

const throwingValidator = (thrown: unknown): ZSchemaOptions => ({
  customValidator: () => {
    throw thrown;
  },
});

describe('every validation failure surfaces as ValidateError', () => {
  describe.each(variants)('%s variant', (variant) => {
    it('wraps an Error thrown by a customValidator, keeping the message and the original as cause', async () => {
      const thrown = new TypeError('hook failed');
      const err = await failureOf(variant, throwingValidator(thrown), {}, { type: 'object' });
      expect(err).toBeInstanceOf(ValidateError);
      expect((err as ValidateError).message).toBe('hook failed');
      expect((err as ValidateError).cause).toBe(thrown);
      expect((err as ValidateError).details).toBeUndefined();
    });

    it.each([['boom'], [undefined], [42]])('wraps a non-Error throw (%s) with the value as cause', async (thrown) => {
      const err = await failureOf(variant, throwingValidator(thrown), {}, { type: 'object' });
      expect(err).toBeInstanceOf(ValidateError);
      expect((err as ValidateError).cause).toBe(thrown);
    });

    it('reports an unknown schema id as ValidateError', async () => {
      const err = await failureOf(variant, {}, {}, 'http://example.com/missing');
      expect(err).toBeInstanceOf(ValidateError);
      expect((err as ValidateError).message).toBe(
        "Schema with id 'http://example.com/missing' wasn't found in the validator cache!"
      );
    });

    it('reports an invalid schema argument as ValidateError', async () => {
      const err = await failureOf(variant, {}, {}, 42 as never);
      expect(err).toBeInstanceOf(ValidateError);
      expect((err as ValidateError).message).toBe(
        'Invalid .validate call - schema must be a string or object but integer was passed!'
      );
    });

    it('reports a missing schemaPath as ValidateError', async () => {
      const err = await failureOf(variant, {}, {}, { type: 'object' }, { schemaPath: 'nope' });
      expect(err).toBeInstanceOf(ValidateError);
      expect((err as ValidateError).message).toBe("Schema path 'nope' wasn't found in the schema!");
    });

    it('compiled validator wraps a customValidator throw', async () => {
      const thrown = new RangeError('compiled hook');
      const err = await compiledFailureOf(variant, thrown);
      expect(err).toBeInstanceOf(ValidateError);
      expect((err as ValidateError).cause).toBe(thrown);
    });

    it('still reports schema violations as ValidateError with details', async () => {
      const err = await failureOf(variant, {}, 'x', { type: 'number' });
      expect(err).toBeInstanceOf(ValidateError);
      expect((err as ValidateError).details?.[0].code).toBe('INVALID_TYPE');
    });
  });

  it('sync mode reports pending async tasks as ValidateError', () => {
    const validator = ZSchema.create();
    validator.registerFormat('later', () => Promise.resolve(true));
    expect(() => validator.validate('x', { format: 'later' })).toThrow(ValidateError);
  });

  it.each([
    ['sync', ZSchema.create()],
    ['async', ZSchema.create({ async: true })],
  ] as const)('%s validateSchema([]) throws ValidateError', (_name, validator) => {
    expect(() => validator.validateSchema([])).toThrow(ValidateError);
  });

  it('compile() wraps a non-ValidateError thrown while compiling', () => {
    const cyclic: Record<string, unknown> = { type: 'object' };
    cyclic.properties = { self: cyclic };
    let caught: unknown;
    try {
      ZSchema.create().compile(cyclic);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ValidateError);
    expect((caught as ValidateError).cause).toBeInstanceOf(Error);
    expect((caught as ValidateError).cause).not.toBeInstanceOf(ValidateError);
  });

  it('API misuse outside validation keeps throwing a plain Error', () => {
    expect(() => ZSchema.create({ bogus: 1 } as never)).toThrow(Error);
    expect(() => ZSchema.create({ bogus: 1 } as never)).not.toThrow(ValidateError);
  });

  it('validateSchema wraps a customValidator throw in the throwing variants', () => {
    const thrown = new TypeError('schema hook');
    for (const validator of [
      ZSchema.create(throwingValidator(thrown)),
      ZSchema.create({ ...throwingValidator(thrown), async: true }),
    ]) {
      let caught: unknown;
      try {
        validator.validateSchema({ type: 'object' });
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(ValidateError);
      expect((caught as ValidateError).cause).toBe(thrown);
    }
  });

  it('validateSchema returns a wrapped customValidator throw in the safe variants', () => {
    const thrown = new TypeError('schema hook');
    const errs = [
      ZSchema.create({ ...throwingValidator(thrown), safe: true }).validateSchema({ type: 'object' }).err,
      ZSchema.create({ ...throwingValidator(thrown), async: true, safe: true }).validateSchema({ type: 'object' }).err,
      ZSchema.create(throwingValidator(thrown)).validateSchemaSafe({ type: 'object' }).err,
    ];
    for (const err of errs) {
      expect(err).toBeInstanceOf(ValidateError);
      expect(err?.cause).toBe(thrown);
    }
  });

  it('_validate in callback mode passes a synchronous throw to the callback', async () => {
    const thrown = new TypeError('hook failed');
    const validator = ZSchema.create(throwingValidator(thrown));
    const err = await new Promise<unknown>((resolve) => {
      validator._validate({}, { type: 'object' }, (error) => {
        resolve(error);
      });
    });
    expect(err).toBeInstanceOf(ValidateError);
    expect((err as ValidateError).cause).toBe(thrown);
  });

  it('toValidateError returns an existing ValidateError unchanged', () => {
    const original = new ValidateError('already', []);
    expect(toValidateError(original)).toBe(original);
  });
});
