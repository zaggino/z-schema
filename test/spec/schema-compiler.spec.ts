import { JsonSchema } from '../../src/json-schema.ts';
import { collectReferences } from '../../src/schema-compiler.js';
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
    const validator = new ZSchema();
    validator.compileSchema(schema);
    const missingRefs = validator.getMissingReferences();
    expect(missingRefs).toHaveLength(0);
    const missingRemoteRefs = validator.getMissingRemoteReferences();
    expect(missingRemoteRefs).toHaveLength(0);
  });
});
