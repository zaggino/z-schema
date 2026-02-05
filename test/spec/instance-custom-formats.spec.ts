// Test for https://github.com/zaggino/z-schema/issues/224
// Not getting all schema errors from optional parent object

import ZSchema from '../../src/index.ts';

describe('Issue #214: Custom formats are module-scoped', function () {
  it('should allow custom formats instance scoped', function () {
    const validator1 = new ZSchema();
    validator1.registerFormat('instance1-format', function (str) {
      return str === 'instance1';
    });
    const validator2 = new ZSchema();
    validator2.registerFormat('instance2-format', function (str) {
      return str === 'instance2';
    });
    // Test validator1
    const schema1 = { type: 'string', format: 'instance1-format' };
    expect(validator1.validate('instance1', schema1)).toBe(true);
    expect(validator1.validate('instance2', schema1)).toBe(false);
    // Test validator2
    const schema2 = { type: 'string', format: 'instance2-format' };
    expect(validator2.validate('instance2', schema2)).toBe(true);
    expect(validator2.validate('instance1', schema2)).toBe(false);
    // Test that formats are not shared
    expect(validator1.validate('instance2', schema2)).toBe(false);
    expect(validator2.validate('instance1', schema1)).toBe(false);
  });
});
