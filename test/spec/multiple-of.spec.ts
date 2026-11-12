import { ZSchema } from '../../src/z-schema.ts';

describe('multipleOf', () => {
  const validator = ZSchema.create({ safe: true });
  const isMultiple = (value: number, multipleOf: number) => validator.validate(value, { multipleOf }).valid;

  describe('integers above 2^53', () => {
    // the quotient of such a value is always an integer, so it can't decide this
    it.each([
      [3e20, 3, true],
      [1e20, 3, false],
      [-1e20, 3, false],
      [-3e20, 3, true],
      [2 ** 53 + 2, 2, true],
      [2 ** 60, 3, false],
      [2 ** 60, 2 ** 20, true],
      [2 ** 70, 1024, true],
      [2 ** 70, 7, false],
    ])('%d is a multiple of %d: %s', (value, multipleOf, expected) => {
      expect(isMultiple(value, multipleOf)).toBe(expected);
    });
  });

  describe('integers', () => {
    it.each([
      [0, 3, true],
      [9, 3, true],
      [10, 3, false],
      [-9, 3, true],
      [-10, 3, false],
      [3, 9, false],
    ])('%d is a multiple of %d: %s', (value, multipleOf, expected) => {
      expect(isMultiple(value, multipleOf)).toBe(expected);
    });
  });

  describe('decimals keep their tolerance', () => {
    it.each([
      [136.67, 0.01, true],
      [136.675, 0.01, false],
      [0.3, 0.1, true],
      [0.35, 0.1, false],
      [4.5, 1.5, true],
      [7, 0.5, true],
      [7.25, 0.5, false],
      [-0.3, 0.1, true],
      [0.0075, 0.0001, true],
      [0.00751, 0.0001, false],
    ])('%d is a multiple of %d: %s', (value, multipleOf, expected) => {
      expect(isMultiple(value, multipleOf)).toBe(expected);
    });
  });

  it('keeps the tolerance for a decimal divisor above 2^53', () => {
    // 0.1 is not exact as a double, so the remainder of 1e20 is not zero
    expect(isMultiple(1e20, 0.1)).toBe(true);
  });

  describe('quotients that overflow', () => {
    it('accepts a value whose remainder is zero', () => {
      expect(isMultiple(1e308, 0.5)).toBe(true);
    });

    it('rejects a value whose remainder is not zero', () => {
      expect(isMultiple(1e308, 0.123456789)).toBe(false);
    });
  });

  it('ignores values that are not numbers', () => {
    expect(validator.validate('9', { multipleOf: 2 }).valid).toBe(true);
  });

  it('reports MULTIPLE_OF with the value and the divisor', () => {
    const { err } = validator.validate(1e20, { multipleOf: 3 });
    expect(err?.details?.[0]).toMatchObject({ code: 'MULTIPLE_OF', params: [1e20, 3] });
  });
});
