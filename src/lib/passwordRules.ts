// Password rules for sign-up. Length first (the strongest single factor), then variety,
// then the two things people reuse most: their own details and a handful of known-bad passwords.

export const MIN_PASSWORD_LENGTH = 8;

const COMMON = new Set([
  'password', 'password1', 'password123', '12345678', '123456789', '1234567890', 'qwerty123', 'qwertyuiop',
  'iloveyou', 'admin123', 'welcome1', 'letmein123', 'abc12345', '11111111', '00000000', 'lifeos123',
]);

export type PasswordRuleId = 'length' | 'case' | 'digit' | 'unique';

export interface PasswordContext {
  email?: string;
  name?: string;
}

export function checkPassword(password: string, ctx: PasswordContext = {}): Record<PasswordRuleId, boolean> {
  const lower = password.toLowerCase();
  const local = (ctx.email ?? '').split('@')[0]?.toLowerCase() ?? '';
  const first = (ctx.name ?? '').trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  const reusesDetails = [local, first].some((part) => part.length >= 3 && lower.includes(part));
  return {
    length: password.length >= MIN_PASSWORD_LENGTH,
    case: /[a-z؀-ۿ]/.test(password) && /[A-Z]/.test(password) || (/[a-z]/.test(password) && /[A-Z]/.test(password)),
    digit: /\d/.test(password),
    unique: password.length > 0 && !COMMON.has(lower) && !reusesDetails,
  };
}

export function passwordScore(checks: Record<PasswordRuleId, boolean>): number {
  return Object.values(checks).filter(Boolean).length;
}

export function isPasswordAcceptable(password: string, ctx: PasswordContext = {}): boolean {
  return passwordScore(checkPassword(password, ctx)) === 4;
}
