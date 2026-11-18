#!/usr/bin/env node
// Pushes supabase/templates/*.html and their subjects to the hosted project's Auth settings,
// so nothing has to be pasted into the dashboard by hand.
//
//   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/push-auth-templates.mjs           # dry run: shows what would change
//   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/push-auth-templates.mjs --apply   # writes it
//
// Create the token at https://supabase.com/dashboard/account/tokens (in the account that owns the project).
// The token is read from the environment only; it is never stored or printed.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const REF = process.env.SUPABASE_PROJECT_REF || 'vlbgxbzwasgpbfzfabnl';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const APPLY = process.argv.includes('--apply');
const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'templates');

if (!TOKEN) {
  console.error('Set SUPABASE_ACCESS_TOKEN first (https://supabase.com/dashboard/account/tokens).');
  process.exit(1);
}

// [dashboard field stem, file, subject]. Auth emails use `mailer_templates_<stem>_content`;
// security notifications use `<stem>_notification`.
const AUTH = [
  ['confirmation', 'confirmation', 'أكّد بريدك | Confirm your lifeOS email'],
  ['invite', 'invite', 'دعوة إلى lifeOS | You are invited to lifeOS'],
  ['magic_link', 'magic_link', 'رابط الدخول | Your lifeOS sign-in link'],
  ['email_change', 'email_change', 'تأكيد البريد الجديد | Confirm your new email'],
  ['recovery', 'recovery', 'إعادة تعيين كلمة المرور | Reset your lifeOS password'],
  ['reauthentication', 'reauthentication', 'رمز التحقق | Your lifeOS verification code'],
];
const NOTIFY = [
  ['password_changed', 'password_changed', 'تغيّرت كلمة مرورك | Your lifeOS password was changed'],
  ['email_changed', 'email_changed', 'تغيّر بريد حسابك | Your lifeOS email was changed'],
  ['phone_changed', 'phone_changed', 'تغيّر رقم هاتفك | Your lifeOS phone number was changed'],
  ['identity_linked', 'identity_linked', 'رُبط حساب جديد بحسابك | A sign-in method was added'],
  ['identity_unlinked', 'identity_unlinked', 'فُصل حساب عن حسابك | A sign-in method was removed'],
  ['mfa_factor_enrolled', 'mfa_factor_enrolled', 'فُعّل التحقق بخطوتين | Two-step verification added'],
  ['mfa_factor_unenrolled', 'mfa_factor_unenrolled', 'أُزيل التحقق بخطوتين | Two-step verification removed'],
];

const api = (method, body) =>
  fetch(`https://api.supabase.com/v1/projects/${REF}/config/auth`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

const get = await api('GET');
if (!get.ok) {
  console.error(`Could not read the project's auth config (${get.status}). Wrong token, or a token from a different Supabase account than the one that owns ${REF}?`);
  process.exit(1);
}
const current = await get.json();

const patch = {};
const skipped = [];
const put = (key, value) => {
  if (key in current) patch[key] = value;
  else skipped.push(key);
};
const html = (name) => readFileSync(join(dir, `${name}.html`), 'utf8');

for (const [stem, file, subject] of AUTH) {
  put(`mailer_subjects_${stem}`, subject);
  put(`mailer_templates_${stem}_content`, html(file));
}
for (const [stem, file, subject] of NOTIFY) {
  put(`mailer_notifications_${stem}_enabled`, true);
  put(`mailer_subjects_${stem}_notification`, subject);
  put(`mailer_templates_${stem}_notification_content`, html(file));
}

const changed = Object.keys(patch).filter((k) => patch[k] !== current[k]);
console.log(`Project ${REF}`);
console.log(`${changed.length} setting(s) would change:`);
for (const k of changed) console.log(`  ~ ${k}`);
if (skipped.length) {
  console.log(`\nSkipped (this project's API does not list these fields):`);
  for (const k of skipped) console.log(`  - ${k}`);
}

if (!APPLY) {
  console.log('\nDry run only. Run again with --apply to write these.');
  process.exit(0);
}

const res = await api('PATCH', patch);
if (!res.ok) {
  console.error(`\nUpdate failed (${res.status}): ${await res.text()}`);
  process.exit(1);
}
console.log('\nDone. The templates are live in Authentication, Emails.');
