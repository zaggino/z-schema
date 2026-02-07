import { ZSchema } from '../../src/z-schema.ts';

describe('Draft-04 is the default behavior', () => {
  it('compileSchema() treats schema as draft-04', () => {
    const validator = ZSchema.create();
    const s = { id: 'hello' };
    expect(() => validator.validateSchema(s)).not.toThrow();
    expect(s).toEqual({ id: 'hello' });
    expect(validator.scache.cache['hello'].$schema).toEqual('http://json-schema.org/draft-04/schema#');
  });
});
