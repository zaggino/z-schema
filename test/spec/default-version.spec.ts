import { ZSchema } from '../../src/z-schema.ts';

describe('Draft-04 is the default behavior', () => {
  it('compileSchema() treats schema as draft-04', () => {
    const validator = new ZSchema();
    const s = { id: 'hello' };
    expect.soft(validator.validateSchema(s)).toBe(true);
    expect(validator.getLastErrors()).toBe(null);
    expect(s).toEqual({ id: 'hello' });
    expect(validator.scache.cache['hello'].$schema).toEqual('http://json-schema.org/draft-04/schema#');
  });
});
