import { describe, expect, it } from 'vitest';
import { canConfirmDelete } from './accountSecurity';

describe('canConfirmDelete', () => {
  const email = 'Ghassan@Example.com';
  it('needs the exact word and the account email', () => {
    expect(canConfirmDelete('DELETE', 'ghassan@example.com', email)).toBe(true);
    expect(canConfirmDelete(' DELETE ', ' GHASSAN@example.com ', email)).toBe(true);
  });
  it('refuses a wrong word, a wrong email or no account', () => {
    expect(canConfirmDelete('delete', 'ghassan@example.com', email)).toBe(false);
    expect(canConfirmDelete('DELETE', 'other@example.com', email)).toBe(false);
    expect(canConfirmDelete('DELETE', '', email)).toBe(false);
    expect(canConfirmDelete('DELETE', 'a@b.c', undefined)).toBe(false);
  });
});
