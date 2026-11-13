import { describe, expect, it } from 'vitest';
import { checkPassword, isPasswordAcceptable, passwordScore } from './passwordRules';

describe('passwordRules', () => {
  it('flags each rule on its own', () => {
    expect(checkPassword('abc')).toEqual({ length: false, case: false, digit: false, unique: true });
    expect(checkPassword('Abcdefgh1').length).toBe(true);
    expect(checkPassword('abcdefgh').case).toBe(false);
    expect(checkPassword('Abcdefgh').digit).toBe(false);
  });
  it('rejects common passwords and reuse of the name or email', () => {
    expect(checkPassword('Password1').unique).toBe(false);
    expect(checkPassword('Ghassan2024x', { name: 'Ghassan Ali' }).unique).toBe(false);
    expect(checkPassword('Sunny-ghesso9', { email: 'ghesso@x.com' }).unique).toBe(false);
  });
  it('accepts a strong password', () => {
    expect(isPasswordAcceptable('Tulip-Garden-42')).toBe(true);
    expect(passwordScore(checkPassword('Tulip-Garden-42'))).toBe(4);
  });
});
