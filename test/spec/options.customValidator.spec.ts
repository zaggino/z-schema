import type { JsonSchema } from '../../src/json-schema-versions.ts';
import type { Report } from '../../src/report.ts';

import { ZSchema } from '../../src/z-schema.ts';

/** Trims the string properties named by the `trim` keyword of the schema. */
const trimStrings = (_report: Report, schema: unknown, json: unknown) => {
  const { trim } = schema as { trim?: unknown };
  if (Array.isArray(trim)) {
    const holder = json as Record<string, unknown>;
    for (let i = 0; i < trim.length; i++) {
      const value = holder[trim[i]];
      if (typeof value === 'string') {
        holder[trim[i]] = value.trim();
      }
    }
  }
};

const trimSchema = {
  type: 'object',
  properties: { name: { type: 'string', maxLength: 10 } },
  trim: ['name'],
} as JsonSchema;

/** Records the `tag` keyword of every schema the custom validator is called for (the meta-schemas have none). */
const recordTags = (seen: string[]) => (_report: Report, schema: unknown) => {
  const { tag } = schema as { tag?: unknown };
  if (typeof tag === 'string') {
    seen.push(tag);
  }
};

const byText = (a: string, b: string) => a.localeCompare(b);

/** A schema that uses the `tag` keyword, which the schema types do not know. */
const tagged = (schema: Record<string, unknown>) => schema as JsonSchema;

describe('customValidator option: changing the value', () => {
  it('changes the value through the object that holds it', () => {
    const validator = ZSchema.create({ customValidator: trimStrings, safe: true });
    const user = { name: '  Ada  ' };
    expect(validator.validate(user, trimSchema).valid).toBe(true);
    expect(user).toEqual({ name: 'Ada' });
  });

  it('changes the value on every call of a validator and of a compiled function', () => {
    const validator = ZSchema.create({ customValidator: trimStrings, safe: true });
    const compiled = validator.compile(trimSchema);
    for (let i = 0; i < 3; i++) {
      const direct = { name: ' a ' };
      const viaCompiled = { name: ' b ' };
      expect(validator.validate(direct, trimSchema).valid).toBe(true);
      expect(compiled(viaCompiled).valid).toBe(true);
      expect(direct).toEqual({ name: 'a' });
      expect(viaCompiled).toEqual({ name: 'b' });
    }
  });

  it('does not validate the changed value again', () => {
    const validator = ZSchema.create({ customValidator: trimStrings, safe: true });
    // 13 characters as passed in, 10 after trimming: maxLength saw the string as it was passed in
    const user = { name: ' 0123456789  ' };
    const result = validator.validate(user, trimSchema);
    expect(result.valid).toBe(false);
    expect(result.err?.details?.[0].code).toBe('MAX_LENGTH');
  });

  it('runs for every sub-schema of a validation that finishes without errors', () => {
    const seen: string[] = [];
    const validator = ZSchema.create({
      safe: true,
      customValidator: recordTags(seen),
    });
    const schema = tagged({
      tag: 'root',
      properties: {
        a: {
          tag: 'a',
          anyOf: [
            { tag: 'no', type: 'number' },
            { tag: 'yes', type: 'string' },
          ],
        },
      },
      items: { tag: 'item' },
    });
    expect(validator.validate({ a: 'x' }, schema).valid).toBe(true);
    expect(seen.toSorted(byText)).toEqual(['a', 'no', 'root', 'yes']);
  });

  it('may not run for a value once a validation has an error', () => {
    const seen: string[] = [];
    const validator = ZSchema.create({
      safe: true,
      breakOnFirstError: true,
      customValidator: recordTags(seen),
    });
    const schema = tagged({ tag: 'root', type: 'object', properties: { a: { tag: 'a' } }, required: ['b'] });
    expect(validator.validate({ a: 1 }, schema).valid).toBe(false);
    expect(seen).toEqual(['root']);
  });
});
