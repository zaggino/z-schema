import type { FastValidator } from '../../src/fast-validator.ts';
import type { JsonSchema } from '../../src/json-schema-versions.ts';
import type { ValidateOptions, ValidateResponse, ZSchemaBase } from '../../src/z-schema-base.ts';
import type { ZSchemaOptions } from '../../src/z-schema-options.ts';
import type { ZSchemaSafe } from '../../src/z-schema.ts';

import { buildFastValidator } from '../../src/fast-validator.ts';
import { ZSchema } from '../../src/z-schema.ts';

/**
 * Builds the fast validator for the compiled clone that `validator` cached for `schema`. The schema must
 * already have been validated or compiled on `validator`; `undefined` when it is not cached or the builder
 * rejects it.
 */
export const buildFastFor = (validator: ZSchemaBase, schema: JsonSchema): FastValidator | undefined => {
  const key = validator.compiledSchemaCache.keyOf(schema);
  if (key === undefined) {
    return undefined;
  }
  const compiled = validator.compiledSchemaCache.get(key, validator.options);
  return compiled ? buildFastValidator(compiled, validator) : undefined;
};

const lone = String.fromCharCode(0xd8_3d);
const astral = String.fromCharCode(0xd8_3d, 0xde_00);

export const SAMPLES: unknown[] = [
  undefined,
  null,
  true,
  false,
  Number.NaN,
  Number.POSITIVE_INFINITY,
  Number.NEGATIVE_INFINITY,
  -0,
  0,
  1,
  1.5,
  -3,
  10,
  0.1,
  0.3,
  1e21,
  Number.MAX_SAFE_INTEGER,
  1n,
  () => 1,
  [],
  [1],
  [1, 2],
  {},
  { a: 1 },
  new Date(0),
  '',
  'a',
  'abc',
  'abcdef',
  'aa',
  'foo',
  'foo-bar',
  '2020-01-01',
  'not a date',
  'a@b.co',
  astral,
  astral + astral,
  lone,
  `${lone}${lone}`,
  `a${astral}`,
];

export const sparseArray = (length: number, entries: Record<number, unknown>): unknown[] => {
  const arr: unknown[] = [];
  arr.length = length;
  for (const key of Object.keys(entries)) {
    arr[Number(key)] = entries[Number(key)];
  }
  return arr;
};

export const codesOf = (res: ValidateResponse): string[] => (res.err?.details ?? []).map((d) => d.code);

export type Outcome = { valid: boolean; codes: string[] } | { thrown: string };

export const outcome = (run: () => ValidateResponse): Outcome => {
  try {
    const res = run();
    return { valid: res.valid, codes: codesOf(res) };
  } catch (error) {
    return { thrown: (error as Error).message };
  }
};

/**
 * Validates `data` against `schema` on a fresh validator built from `options`. A first call on a fresh instance
 * is a compiled-cache miss, so the interpreter decides - the fast validator never answers. Use it as the
 * reference side of every comparison with a fast validator. Throws what the interpreter throws.
 */
export const interpreterRun = (
  options: ZSchemaOptions,
  schema: JsonSchema,
  data: unknown,
  setup?: (v: ZSchemaSafe) => void,
  validateOptions?: ValidateOptions
): ValidateResponse => {
  const v = ZSchema.create({ ...options, safe: true });
  setup?.(v);
  // the guard: a cached entry would let the fast validator answer instead of the interpreter
  const key = v.compiledSchemaCache.keyOf(schema);
  expect(key === undefined ? undefined : v.compiledSchemaCache.getEntry(key, v.options)).toBeUndefined();
  return validateOptions ? v.validate(data, schema, validateOptions) : v.validate(data, schema);
};

/** {@link interpreterRun} reduced to the shape of {@link outcome}. */
export const interpreterOutcome = (
  options: ZSchemaOptions,
  schema: JsonSchema,
  data: unknown,
  setup?: (v: ZSchemaSafe) => void
): Outcome => outcome(() => interpreterRun(options, schema, data, setup));

/**
 * Interpreter verdicts for `schema` from one validator: each schema is compiled once instead of once per sample.
 * After every call the cache entry's fast validator is set to `null` ("unsupported"), so a later call on the
 * cached schema still runs the interpreter; the guard checks that before each call.
 */
const interpreterReference = (options: ZSchemaOptions, schema: JsonSchema) => {
  const v = ZSchema.create({ ...options, safe: true });
  const entryOf = () => {
    const key = v.compiledSchemaCache.keyOf(schema);
    return key === undefined ? undefined : v.compiledSchemaCache.getEntry(key, v.options);
  };
  return (data: unknown): boolean => {
    const before = entryOf();
    expect(before === undefined || before.fast === null).toBe(true);
    const { valid } = v.validate(data, schema);
    const after = entryOf();
    if (after !== undefined) {
      after.fast = null;
    }
    return valid;
  };
};

/** Compiles `schema` on a fresh validator and returns the fast validator built for the compiled clone. */
export const fastFor = (schema: JsonSchema, opts: ZSchemaOptions = {}, setup?: (v: ZSchemaSafe) => void) => {
  const v = ZSchema.create({ safe: true, ...opts });
  setup?.(v);
  const compiled = v.compile(schema);
  compiled(1);
  v.validate(1, schema);
  return {
    v,
    fast: buildFastFor(v, schema),
    /**
     * Interpreter verdict with the same options and setup. A `setup` may register stateful formats, so it gets
     * a fresh validator per call; without one, a single validator pinned to the interpreter is reused.
     */
    reference: setup
      ? (data: unknown) => interpreterRun(opts, schema, data, setup).valid
      : interpreterReference(opts, schema),
  };
};

export const expectAgrees = (schema: JsonSchema, opts: ZSchemaOptions = {}, samples: unknown[] = SAMPLES) => {
  const { fast, reference } = fastFor(schema, opts);
  expect(fast).toBeDefined();
  for (const sample of samples) {
    expect(fast!(sample), `${Object.prototype.toString.call(sample)} against ${JSON.stringify(schema)}`).toBe(
      reference(sample)
    );
  }
};

export const suites = (
  title: string,
  schemas: Array<[string, JsonSchema]>,
  samples: unknown[],
  drafts: ReadonlyArray<ZSchemaOptions['version']>
) => {
  describe(title, () => {
    for (const version of drafts) {
      for (const [name, schema] of schemas) {
        it(`${version}: ${name} has a fast validator`, () => {
          expect(fastFor(schema, { version }).fast).toBeDefined();
        });
        it(`${version}: ${name} agrees with the interpreter`, () => {
          const { fast, reference } = fastFor(schema, { version });
          if (fast === undefined) {
            return;
          }
          for (const sample of samples) {
            expect(fast(sample), `${JSON.stringify(sample)} against ${JSON.stringify(schema)}`).toBe(reference(sample));
          }
        });
      }
    }
  });
};

/** Subscribes `listener` for unhandled promise rejections (Node `process` or the browser event). */
export const listenForUnhandledRejections = (listener: (reason: unknown) => void): (() => void) => {
  if (typeof process !== 'undefined' && typeof process.on === 'function') {
    process.on('unhandledRejection', listener);
    return () => {
      process.off('unhandledRejection', listener);
    };
  }
  const handler = (event: Event) => {
    listener((event as PromiseRejectionEvent).reason);
  };
  globalThis.addEventListener('unhandledrejection', handler);
  return () => {
    globalThis.removeEventListener('unhandledrejection', handler);
  };
};
