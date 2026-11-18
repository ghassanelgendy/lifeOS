// Thin wrappers over Supabase Auth for the account screens: password reset, password and email
// change, two-step verification (TOTP), linked sign-in methods and account deletion.
// Every function returns { error } instead of throwing, so the UI can show the message.
import type { UserIdentity } from '@supabase/supabase-js';
import { supabase } from './supabase';

type Result<T = unknown> = { data?: T; error: string | null };

/** Where Supabase sends the user back to after a reset or confirmation link. */
const origin = () => (typeof window !== 'undefined' ? window.location.origin : '');

export async function requestPasswordReset(email: string): Promise<Result> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${origin()}/reset-password` });
  return { error: error ? error.message : null };
}

/**
 * `currentPassword` is checked by Supabase itself when "Require current password when updating" is on.
 * Supabase asks for a fresh email code when the session is old; `needsNonce` tells the UI to ask for it.
 */
export async function updatePassword(
  password: string,
  opts: { nonce?: string; currentPassword?: string } = {},
): Promise<Result & { needsNonce?: boolean; wrongCurrent?: boolean }> {
  const attrs: { password: string; nonce?: string; current_password?: string } = { password };
  if (opts.nonce) attrs.nonce = opts.nonce;
  if (opts.currentPassword) attrs.current_password = opts.currentPassword;
  const { error } = await supabase.auth.updateUser(attrs);
  if (!error) return { error: null };
  const text = `${error.message} ${(error as { code?: string }).code ?? ''}`;
  return {
    error: error.message,
    needsNonce: /reauth|nonce/i.test(text),
    wrongCurrent: /current.?password|invalid.*password/i.test(text),
  };
}

export async function sendReauthCode(): Promise<Result> {
  const { error } = await supabase.auth.reauthenticate();
  return { error: error ? error.message : null };
}

export async function updateEmail(email: string): Promise<Result> {
  const { error } = await supabase.auth.updateUser({ email: email.trim() }, { emailRedirectTo: `${origin()}/dashboard` });
  return { error: error ? error.message : null };
}

export async function updateDisplayName(name: string): Promise<Result> {
  const { error } = await supabase.auth.updateUser({ data: { full_name: name.trim() } });
  return { error: error ? error.message : null };
}

export async function signOutOtherDevices(): Promise<Result> {
  const { error } = await supabase.auth.signOut({ scope: 'others' });
  return { error: error ? error.message : null };
}

// ---- Two-step verification (authenticator app) ----

export interface TotpFactor { id: string; friendlyName: string | null; status: 'verified' | 'unverified'; }

export async function listTotpFactors(): Promise<Result<TotpFactor[]>> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) return { error: error.message };
  return { data: data.totp.map((f) => ({ id: f.id, friendlyName: f.friendly_name ?? null, status: f.status })), error: null };
}

export interface TotpEnrollment { factorId: string; qr: string; secret: string; uri: string; }

export async function startTotpEnrollment(): Promise<Result<TotpEnrollment>> {
  // An abandoned, unverified factor blocks a new one with the same name, so clear those first.
  const existing = await supabase.auth.mfa.listFactors();
  for (const f of existing.data?.all ?? []) {
    if (f.factor_type === 'totp' && f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `lifeOS ${new Date().toISOString().slice(0, 10)}` });
  if (error) return { error: error.message };
  return { data: { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret, uri: data.totp.uri }, error: null };
}

/** Challenge and verify in one step: finishes enrolment, and also signs a session up to aal2. */
export async function verifyTotp(factorId: string, code: string): Promise<Result> {
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.replace(/\s/g, '') });
  return { error: error ? error.message : null };
}

export async function removeTotpFactor(factorId: string): Promise<Result> {
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  return { error: error ? error.message : null };
}

/** True when the signed-in session still needs its second step. */
export async function needsMfaStep(): Promise<{ needed: boolean; factorId?: string }> {
  try {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || !data) return { needed: false };
    if (data.currentLevel === 'aal1' && data.nextLevel === 'aal2') {
      const factors = await supabase.auth.mfa.listFactors();
      const verified = factors.data?.totp.find((f) => f.status === 'verified');
      return verified ? { needed: true, factorId: verified.id } : { needed: false };
    }
  } catch {
    // Offline or a transient error: never lock the user out of their own data because of it.
  }
  return { needed: false };
}

// ---- Linked sign-in methods ----

export async function listIdentities(): Promise<Result<UserIdentity[]>> {
  const { data, error } = await supabase.auth.getUserIdentities();
  if (error) return { error: error.message };
  return { data: data.identities, error: null };
}

export async function linkGoogle(): Promise<Result> {
  const { error } = await supabase.auth.linkIdentity({ provider: 'google', options: { redirectTo: `${origin()}/settings` } });
  return { error: error ? error.message : null };
}

export async function unlinkIdentity(identity: UserIdentity): Promise<Result> {
  const { error } = await supabase.auth.unlinkIdentity(identity);
  return { error: error ? error.message : null };
}

// ---- Delete account ----

/** The phrase the user types to arm the delete button. */
export const DELETE_CONFIRM_WORD = 'DELETE';

export function canConfirmDelete(typedWord: string, typedEmail: string, accountEmail: string | undefined): boolean {
  return typedWord.trim() === DELETE_CONFIRM_WORD && !!accountEmail && typedEmail.trim().toLowerCase() === accountEmail.toLowerCase();
}

export async function deleteAccount(): Promise<Result> {
  const { data, error } = await supabase.functions.invoke('delete-account', { body: { confirm: DELETE_CONFIRM_WORD } });
  if (error) return { error: error.message };
  if (data && typeof data === 'object' && 'error' in data && (data as { error?: string }).error) return { error: String((data as { error: string }).error) };
  return { error: null };
}
