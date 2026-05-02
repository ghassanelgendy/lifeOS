# iOS 6 Compat Gateway (GCP VM)

Goal: make **lifeOS** usable on **iOS 6 UIWebView** by ensuring the phone only talks to **one origin** (your VM), while the VM talks to **Supabase** using modern TLS.

## What this gateway does

- Serves your built lifeOS frontend (`dist/`) from nginx
- Proxies `/<prefix>/...` (default: `/supabase/`) to your real Supabase project:
  - `/supabase/auth/v1/*`
  - `/supabase/rest/v1/*`
  - `/supabase/storage/v1/*`
  - `/supabase/functions/v1/*`

Then you build lifeOS with:

- `VITE_SUPABASE_URL=http://YOUR_VM_DOMAIN_OR_IP/supabase`
- `VITE_SUPABASE_ANON_KEY=...`

So **supabase-js** calls go to your VM (HTTP / old TLS), not directly to `*.supabase.co`.

## Deploy on a GCP VM (Ubuntu)

### 1) Install nginx

```bash
sudo apt-get update
sudo apt-get install -y nginx
```

### 2) Put built lifeOS files on the VM

On your dev machine (this repo), use a **legacy build** (ES5 + polyfills). iOS 6 Safari cannot run the default modern bundle.

**PowerShell (Windows):**

```powershell
$env:IOS6_LEGACY="1"
$env:VITE_SUPABASE_URL="http://YOUR_VM_DOMAIN_OR_IP/supabase"
$env:VITE_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
npm run build
```

**bash:**

```bash
IOS6_LEGACY=1 \
VITE_SUPABASE_URL="http://YOUR_VM_DOMAIN_OR_IP/supabase" \
VITE_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY" \
npm run build
```

This disables the PWA service-worker injection for that build (old Safari does not support service workers).

Copy `dist/` to the VM:

```bash
scp -r dist/* ubuntu@YOUR_VM_IP:/var/www/lifeos/
```

### 3) Configure nginx

Copy the nginx site file from this folder:

```bash
sudo mkdir -p /var/www/lifeos
sudo cp ios6-gateway/nginx/lifeos.conf /etc/nginx/sites-available/lifeos
sudo ln -sf /etc/nginx/sites-available/lifeos /etc/nginx/sites-enabled/lifeos
sudo nginx -t
sudo systemctl restart nginx
```

### 4) Set the Supabase project ref in nginx

Edit:

- `/etc/nginx/sites-available/lifeos`

Replace:

- `SUPABASE_PROJECT_REF`

with your real project ref (the subdomain part of `https://<ref>.supabase.co`).

### 5) Open firewall

Allow inbound TCP **80** on the VM (GCP firewall rule).

## Notes

- iOS 6 works best with **plain HTTP**. If you enable HTTPS, you’ll likely hit certificate/TLS issues on iOS 6.
- This gateway only forwards requests; your **Supabase RLS** is still the real security boundary.

## If Safari shows a white screen on iPhone 4s

1. **Prove the VM + HTTP work on the phone** (no React involved):

   After uploading `dist/`, open:

   - `http://YOUR_VM_IP/ios6-check.html`

   You should see “JavaScript: OK” and “GET /index.html: OK”. If this fails, fix nginx/firewall/paths first.

2. **Re-upload a fresh legacy build** with `IOS6_LEGACY=1` (see above). The main app bundle is **~1.8MB minified**; a 4s may run out of memory or take a long time to parse. Wait 1–2 minutes once.

3. **Reality check**: lifeOS is **React 19 + large deps**. Even with a legacy bundle, **full parity on iOS 6 is not guaranteed**. If the check page works but `/` stays blank, the practical path is the **UIWebView wrapper** shell + a **reduced “lite”** UI for 4s, or use the phone only as a thin client to a minimal HTML login.

4. Optional: on a Mac, tether the 4s and use **Safari → Develop** Web Inspector to see the first JS error (if any).

## 502 Bad Gateway on `/supabase/*`

Usually nginx → Supabase HTTPS proxy is misconfigured. This repo’s `lifeos.conf` uses a **literal** `proxy_pass https://wxqmrercyutrrlnhlmus.supabase.co` so nginx resolves DNS at startup (variable `proxy_pass` without `resolver` often yields **502**).

On the VM after editing the site file:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

Test from the VM:

```bash
curl -sS -o /dev/null -w "%{http_code}\n" \
  -X POST "http://127.0.0.1/supabase/auth/v1/token?grant_type=password" \
  -H "Content-Type: application/json" \
  -H "apikey: YOUR_ANON_KEY" \
  -d '{"email":"x@y.com","password":"bad"}'
```

You should get **400** or **401**, not **502** (502 means the proxy could not reach Supabase).

