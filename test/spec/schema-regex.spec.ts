import { compileSchemaRegex } from '../../src/utils/schema-regex.ts';

describe('compileSchemaRegex', () => {
  it('fails for invalid regex pattern (no Unicode)', () => {
    const result = compileSchemaRegex('[');
    expect(result.ok).toBe(false);
    expect(result.error.pattern).toBe('[');
    expect(typeof result.error.message).toBe('string');
    expect(result.error.message.length).toBeGreaterThan(0);
  });

  it('compiles valid pattern with Unicode property escape', () => {
    const result = compileSchemaRegex('^\\p{L}+$');
    expect(result.ok).toBe(true);
    expect(result.value).toBeInstanceOf(RegExp);
    expect(result.value.flags).toContain('u');
  });

  it('compiles valid pattern without Unicode property escape', () => {
    const result = compileSchemaRegex('^abc$');
    expect(result.ok).toBe(true);
    expect(result.value).toBeInstanceOf(RegExp);
    expect(result.value.flags).not.toContain('u');
  });

  it('fails for invalid Unicode property escape (even with u flag)', () => {
    const result = compileSchemaRegex('^\\p{INVALID}+$');
    expect(result.ok).toBe(false);
    expect(result.error.pattern).toBe('^\\p{INVALID}+$');
    expect(typeof result.error.message).toBe('string');
    expect(result.error.message.length).toBeGreaterThan(0);
  });
});
