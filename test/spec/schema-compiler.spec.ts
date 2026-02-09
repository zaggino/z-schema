import { ValidateError } from '../../src/errors.ts';
import { JsonSchema } from '../../src/json-schema.ts';
import { collectIds, collectReferences } from '../../src/schema-compiler.js';
import { ZSchema } from '../../src/z-schema.ts';

describe('collectReferences', () => {
  it('should collect $ref with id scope', () => {
    const schema = {
      id: 'file:///c:/folder/file.json',
      definitions: {
        foo: { type: 'number' },
      },
      allOf: [{ $ref: '#/definitions/foo' }],
    };
    const refs = collectReferences(schema as any);
    expect(refs).toHaveLength(1);
    expect(refs[0].ref).toBe('file:///c:/folder/file.json#/definitions/foo');
    expect(refs[0].key).toBe('$ref');
    expect(refs[0].path).toEqual(['allOf', 0]);
  });

  it('should collect $ref with nested ids', () => {
    const schema: JsonSchema = {
      id: 'file:///c:/folder/file.json',
      definitions: {
        person: {
          id: 'personId',
          type: 'object',
          properties: {
            firstName: { type: 'string' },
            lastName: { type: 'string' },
          },
          required: ['firstName', 'lastName'],
        },
        address: {
          id: 'addressId',
          type: 'object',
          properties: {
            street: { type: 'string' },
            city: { type: 'string' },
          },
          required: ['street', 'city'],
        },
      },
      properties: {
        address: {
          id: 'trickyId',
          allOf: [{ $ref: '#personId' }, { $ref: '#addressId' }],
        },
      },
    };
    const refs = collectReferences(schema);
    expect(refs).toHaveLength(2);
    const refStrs = refs.map((x) => x.ref).sort();
    expect.soft(refStrs[0]).toBe('file:///c:/folder/file.json#addressId');
    expect.soft(refStrs[1]).toBe('file:///c:/folder/file.json#personId');
    const validator = ZSchema.create();
    validator.compileSchema(schema);
  });

  it('should collect $ref with nested ids and not/definitions', () => {
    const schema: JsonSchema = {
      id: 'http://example.com/a.json',
      definitions: {
        x: {
          id: 'http://example.com/b/c.json',
          not: {
            definitions: {
              y: {
                id: 'd.json',
                type: 'number',
              },
            },
          },
        },
      },
      allOf: [
        {
          $ref: 'http://example.com/b/d.json',
        },
      ],
    };
    const ids = collectIds(schema);
    expect(ids).toHaveLength(3);

    const validator = ZSchema.create();
    const isValid = validator.validateSchema(schema);
    expect(Object.keys(validator.scache.cache).sort()).toEqual(
      [
        'http://json-schema.org/draft-04/schema',
        'http://example.com/a.json',
        'http://example.com/b/c.json',
        'http://example.com/b/d.json',
      ].sort()
    );

    const absoluteIds = ids.filter((x) => x.type === 'absolute');
    for (const absoluteId of absoluteIds) {
      expect(validator.scache.checkCacheForUri(absoluteId.id)).toBe(true);
    }

    const relativeIds = ids.filter((x) => x.type === 'relative');
    expect(relativeIds.length).toBe(1);
    expect(relativeIds[0].absoluteParent).toBeTruthy();
    expect(relativeIds[0].absoluteUri).toBe('http://example.com/b/d.json');

    expect.soft(isValid).toBe(true);
  });

  it('should compile an array of schemas', () => {
    const schemas: JsonSchema[] = [
      {
        id: 'id',
        type: 'number',
      },
      {
        id: 'user',
        type: 'object',
        properties: {
          id: {
            $ref: 'id',
          },
          posts: {
            type: 'array',
            items: {
              $ref: 'post',
            },
          },
        },
      },
      {
        id: 'post',
        type: 'object',
        properties: {
          id: {
            $ref: 'id',
          },
          author: {
            $ref: 'user',
          },
        },
      },
    ];
    const validator = ZSchema.create();
    const isValid = validator.validateSchema(schemas);
    expect(Object.keys(validator.scache.cache).sort()).toEqual(
      ['http://json-schema.org/draft-04/schema', 'id', 'user', 'post'].sort()
    );
    expect.soft(isValid).toBe(true);
  });

  it('should correctly collect refs', () => {
    const schema = {
      id: 'http://localhost:1234/sibling_id/base/',
      definitions: {
        foo: {
          id: 'http://localhost:1234/sibling_id/foo.json',
          type: 'string',
        },
        base_foo: {
          $comment: 'this canonical uri is http://localhost:1234/sibling_id/base/foo.json',
          id: 'foo.json',
          type: 'number',
        },
      },
      allOf: [
        {
          $comment:
            '$ref resolves to http://localhost:1234/sibling_id/base/foo.json, not http://localhost:1234/sibling_id/foo.json',
          id: 'http://localhost:1234/sibling_id/',
          $ref: 'foo.json',
        },
      ],
    };
    const refs = collectReferences(schema as any);
    expect(refs.length).toBe(1);
    expect(refs[0].ref).toBe('http://localhost:1234/sibling_id/base/foo.json');
    const validator = ZSchema.create();
    expect(validator.validateSafe(1, schema).valid).toBe(true);
    expect(validator.validateSafe('a', schema).valid).toBe(false);
  });

  it('compileSchemaSafe returns ValidateResponse for valid schema', () => {
    const validator = ZSchema.create();
    const validSchema = { type: 'string' };
    const result = validator.compileSchemaSafe(validSchema);
    expect(result.valid).toBe(true);
    expect(result.err).toBeUndefined();
  });

  it('compileSchemaSafe returns ValidateResponse for invalid schema', () => {
    const validator = ZSchema.create();
    const invalidSchema = { $ref: '#/nonexistent' }; // circular or invalid
    const result = validator.compileSchemaSafe(invalidSchema);
    expect(result.valid).toBe(false);
    expect(result.err).toBeInstanceOf(ValidateError);
  });
});
