import { ZSchema } from '../../src/z-schema.ts';

describe('default behavior', () => {
  it('compileSchema() treats schema as default schema', () => {
    const validator = ZSchema.create();
    const s = { id: 'hello' };
    expect(() => validator.validateSchema(s)).not.toThrow();
    expect(s).toEqual({ id: 'hello' });
    expect(validator.scache.cache['hello'].$schema).toEqual(validator.getDefaultSchemaId());
  });
});
