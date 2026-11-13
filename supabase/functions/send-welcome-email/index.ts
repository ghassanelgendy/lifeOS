// Sends the Arabic welcome email through Resend when a user's account becomes confirmed.
// Called by the Postgres trigger `welcome_email_on_confirm` (see the 2026-11 migration) with a
// shared secret kept in Vault. Secrets: RESEND_API_KEY (required); APP_URL (optional, adds the button).
/// <reference path="../deno.d.ts" />

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const FROM = 'lifeOS <lifeos@ghassan.online>';

const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function render(name: string, appUrl: string | null) {
  const hello = name ? `السلام عليكم يا ${esc(name)}،` : 'السلام عليكم،';
  const steps = [
    ['أضف أول مهمة لليوم', 'اكتب ما تريد إنجازه، وحدد له وقتًا يناسب صلواتك.'],
    ['فعّل مواقيت الصلاة والأذكار', 'من الإعدادات، ليصلك التذكير في وقته.'],
    ['جرّب المساعد', 'اضغط Ctrl + A في أي صفحة واطلب منه ترتيب يومك.'],
  ];
  const html = `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"></head>
<body style="margin:0;background:#f6f5f2;font-family:Tahoma,'Segoe UI',Arial,sans-serif;color:#1c1b19">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
  <div style="font-size:20px;font-weight:700;letter-spacing:-0.01em;margin-bottom:24px" dir="ltr">lifeOS</div>
  <div style="background:#ffffff;border:1px solid #e4e1da;border-radius:14px;padding:28px 24px;line-height:1.9;font-size:16px">
    <p style="margin:0 0 14px;font-size:18px;font-weight:700">${hello}</p>
    <p style="margin:0 0 14px">أهلًا بك في lifeOS. حسابك جاهز.</p>
    <p style="margin:0 0 22px;padding:12px 14px;background:#f3f1ec;border-radius:10px">لا تنسَ أن تجدد نيتك: اجعل تنظيم يومك كله لله، وما تبنيه هنا عونًا لك على طاعته.</p>
    <p style="margin:0 0 8px;font-weight:700">ابدأ بثلاث خطوات</p>
    <ol style="margin:0 0 22px;padding:0 20px 0 0">
      ${steps.map(([t, d]) => `<li style="margin-bottom:8px"><strong>${t}.</strong> ${d}</li>`).join('')}
    </ol>
    ${appUrl ? `<p style="margin:0 0 6px"><a href="${esc(appUrl)}" style="display:inline-block;background:#1c1b19;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:10px;font-weight:700">افتح lifeOS</a></p>` : ''}
  </div>
  <p style="margin:18px 4px 0;font-size:13px;line-height:1.8;color:#6b675f">بياناتك خاصة بك وحدك، ولا يراها أحد غيرك. إن لم تنشئ هذا الحساب فتجاهل الرسالة.</p>
</div></body></html>`;
  const text = [
    hello,
    '',
    'أهلًا بك في lifeOS. حسابك جاهز.',
    '',
    'لا تنسَ أن تجدد نيتك: اجعل تنظيم يومك كله لله، وما تبنيه هنا عونًا لك على طاعته.',
    '',
    'ابدأ بثلاث خطوات:',
    ...steps.map(([t, d], i) => `${i + 1}. ${t}. ${d}`),
    ...(appUrl ? ['', appUrl] : []),
    '',
    'بياناتك خاصة بك وحدك، ولا يراها أحد غيرك. إن لم تنشئ هذا الحساب فتجاهل الرسالة.',
  ].join('\n');
  return { html, text };
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const secret = req.headers.get('x-webhook-secret')?.trim() ?? '';
  const { data: ok } = secret ? await supabase.rpc('verify_welcome_email_secret', { p_secret: secret }) : { data: false };
  if (!ok) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) return new Response(JSON.stringify({ error: 'RESEND_API_KEY is not set' }), { status: 500 });

  let body: { email?: string; name?: string };
  try { body = await req.json(); } catch { return new Response('Bad request', { status: 400 }); }
  const email = body.email?.trim();
  if (!email) return new Response('Bad request', { status: 400 });

  const appUrl = Deno.env.get('APP_URL')?.trim() || null;
  const { html, text } = render(body.name?.trim() ?? '', appUrl);

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [email], subject: 'أهلًا بك في lifeOS', html, text }),
  });
  const out = await res.text();
  if (!res.ok) console.error('Resend error', res.status, out);
  return new Response(out, { status: res.ok ? 200 : 502, headers: { 'Content-Type': 'application/json' } });
});
