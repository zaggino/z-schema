import { ZSchema } from '../../src/z-schema.ts';

describe('multipleOf', () => {
  const validator = ZSchema.create({ safe: true });
  const isMultiple = (value: number, multipleOf: number) => validator.validate(value, { multipleOf }).valid;

  describe('integers beyond the safe range', () => {
    // their quotient has no bits left for a fraction, so it can't decide these
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
      [1e20, 3e19, false],
    ])('%s is a multiple of %s: %s', (value, multipleOf, expected) => {
      expect(isMultiple(value, multipleOf)).toBe(expected);
    });
  });

  describe('at the edge of the safe range', () => {
    it.each([
      [Number.MAX_SAFE_INTEGER, 1, true],
      [Number.MAX_SAFE_INTEGER, 3, false],
      [Number.MAX_SAFE_INTEGER, 7, false],
      [-Number.MAX_SAFE_INTEGER, 3, false],
      [2 ** 53, 2, true],
      [2 ** 53, 3, false],
      [-(2 ** 53), 2, true],
      [-(2 ** 53), 3, false],
    ])('%s is a multiple of %s: %s', (value, multipleOf, expected) => {
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

  describe('decimal divisors beyond the safe range', () => {
    // 1.5 and 0.75 are exact as doubles, so a remainder decides
    it.each([
      [1e20, 1.5, false],
      [3e20, 1.5, true],
      [1e20, 0.75, false],
      [1e20, 0.25, true],
      [-1e20, 1.5, false],
    ])('%s is a multiple of %s: %s', (value, multipleOf, expected) => {
      expect(isMultiple(value, multipleOf)).toBe(expected);
    });

    it('accepts a divisor its double only approximates, as the quotient check always did', () => {
      // the remainder of 1e20 by the double nearest 0.1 is not zero, and proves nothing
      expect(isMultiple(1e20, 0.1)).toBe(true);
    });
  });

  describe('quotients that overflow', () => {
    it.each([
      [1e308, 0.5, true],
      [-1e308, 0.5, true],
      [1e308, 0.25, true],
    ])('%s is a multiple of %s: %s', (value, multipleOf, expected) => {
      expect(isMultiple(value, multipleOf)).toBe(expected);
    });

    it('still rejects a divisor its double only approximates', () => {
      expect(isMultiple(1e308, 0.123456789)).toBe(false);
      expect(isMultiple(1e308, 0.1)).toBe(false);
    });
  });

  it('rejects values that are not finite', () => {
    expect(isMultiple(Infinity, 3)).toBe(false);
    expect(isMultiple(-Infinity, 0.5)).toBe(false);
    expect(isMultiple(Number.NaN, 3)).toBe(false);
  });

  it('ignores values that are not numbers', () => {
    expect(validator.validate('9', { multipleOf: 2 }).valid).toBe(true);
  });

  it('reports MULTIPLE_OF with the value and the divisor', () => {
    const { err } = validator.validate(1e20, { multipleOf: 3 });
    expect(err?.details?.[0]).toMatchObject({ code: 'MULTIPLE_OF', params: [1e20, 3] });
  });
});
