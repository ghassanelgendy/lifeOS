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
  const F = "Cairo,Tahoma,'Segoe UI',Arial,sans-serif";
  const html = `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark light"><meta name="supported-color-schemes" content="dark light"><title>lifeOS</title>
<style>
@media (prefers-color-scheme: light){
  body,.bg{background:#f4f4f5 !important}
  .ink{color:#0c0c0e !important;border-color:#0c0c0e !important}
  .mute{color:#52525b !important}
  .rule{border-color:#d4d4d8 !important}
}
</style></head>
<body class="bg" style="margin:0;padding:0;background:#0c0c0e">
<table role="presentation" class="bg" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0c0c0e"><tr><td align="center" style="padding:44px 24px 56px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:440px">
<tr><td style="padding-bottom:40px"><img src="https://life-os-tan.vercel.app/brand/lifeos-mark-email.png" width="36" height="36" alt="lifeOS" style="display:block;border:0;border-radius:9px"></td></tr>
<tr><td class="ink" style="font-family:${F};color:#f4f4f5">
<h1 style="margin:0 0 10px;font-size:24px;line-height:1.45;font-weight:700">${hello}</h1>
<p class="mute" style="margin:0 0 26px;font-size:16px;line-height:2;color:#c4c4cb">أهلًا بك في lifeOS. حسابك جاهز.</p>
<p class="ink" style="margin:0 0 30px;padding:2px 16px 2px 0;border-right:3px solid #f4f4f5;font-size:16px;line-height:2;color:#f4f4f5">لا تنسَ أن تجدد نيتك: اجعل تنظيم يومك كله لله، وما تبنيه هنا عونًا لك على طاعته.</p>
${steps.map(([t, d], i) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.9"><span class="mute" style="color:#8e8e96">${i + 1}</span>&nbsp;&nbsp;<strong>${t}.</strong> <span class="mute" style="color:#c4c4cb">${d}</span></p>`).join('')}
${appUrl ? `<p style="margin:30px 0 0"><a class="ink" href="${esc(appUrl)}" style="font-size:18px;font-weight:700;color:#f4f4f5;text-decoration:none;border-bottom:2px solid #f4f4f5;padding-bottom:3px">افتح lifeOS&nbsp;&larr;</a></p>` : ''}
</td></tr>
<tr><td style="padding:34px 0 22px"><div class="rule" style="border-top:1px solid #2a2a2e;height:1px;line-height:1px;font-size:1px">&nbsp;</div></td></tr>
<tr><td class="mute" style="font-family:${F};font-size:13px;line-height:1.9;color:#8e8e96">بياناتك خاصة بك وحدك، ولا يراها أحد غيرك. إن لم تنشئ هذا الحساب فتجاهل الرسالة.</td></tr>
</table></td></tr></table>
</body></html>`;
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
