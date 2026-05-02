import { Router } from "express";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const router = Router();

function isPrivateIP(addr: string): boolean {
  const a = addr.trim().toLowerCase();

  const ipv4Mapped = a.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/) || a.match(/^::ffff:([0-9a-f]{4}:[0-9a-f]{4})$/);
  if (ipv4Mapped) {
    const candidate = ipv4Mapped[1];
    if (/^[0-9a-f]{4}:[0-9a-f]{4}$/.test(candidate)) {
      const [hi, lo] = candidate.split(":").map((h) => parseInt(h, 16));
      const d1 = (hi >> 8) & 0xff;
      const d2 = hi & 0xff;
      const d3 = (lo >> 8) & 0xff;
      const d4 = lo & 0xff;
      return isPrivateIPv4(`${d1}.${d2}.${d3}.${d4}`);
    }
    return isPrivateIPv4(candidate);
  }

  if (isIP(a) === 6) return isPrivateIPv6(a);
  if (isIP(a) === 4) return isPrivateIPv4(a);

  return false;
}

function isPrivateIPv4(addr: string): boolean {
  const parts = addr.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) return true;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a === 240 ||
    a === 255
  );
}

function isPrivateIPv6(addr: string): boolean {
  const a = addr.toLowerCase();
  return (
    a === "::1" ||
    a === "::" ||
    a.startsWith("fc") ||
    a.startsWith("fd") ||
    a.startsWith("fe80") ||
    a.startsWith("ff") ||
    a.startsWith("64:ff9b")
  );
}

async function hostIsBlocked(hostname: string): Promise<boolean> {
  const h = hostname.replace(/^\[/, "").replace(/\]$/, "").toLowerCase();

  if (isPrivateIP(h)) return true;

  try {
    const records = await lookup(h, { all: true, verbatim: true });
    return records.some((r) => isPrivateIP(r.address));
  } catch {
    return true;
  }
}

const ALLOWED_PROTOCOLS = new Set(["https:", "http:"]);
const MAX_REDIRECTS = 3;

router.get("/proxy", async (req, res) => {
  const raw = req.query.url;
  if (typeof raw !== "string") {
    res.status(400).json({ error: "url must be a single string query parameter" });
    return;
  }

  const normalizedUrl = raw.trim().replace(/^webcal:\/\//i, "https://");

  let parsed: URL;
  try {
    parsed = new URL(normalizedUrl);
  } catch {
    res.status(400).json({ error: "Invalid url" });
    return;
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    res.status(400).json({ error: "Only http/https URLs are allowed" });
    return;
  }

  if (await hostIsBlocked(parsed.hostname)) {
    res.status(403).json({ error: "Forbidden: private or internal hosts are not allowed" });
    return;
  }

  try {
    let currentUrl = normalizedUrl;
    let redirectsLeft = MAX_REDIRECTS;
    let response!: Response;

    while (true) {
      response = await fetch(currentUrl, {
        redirect: "manual",
        headers: {
          "User-Agent": "lifeOS/1.0",
          Accept: "text/calendar, text/plain, */*",
        },
      });

      const isRedirect = [301, 302, 307, 308].includes(response.status);
      const location = response.headers.get("location");

      if (isRedirect && location) {
        if (redirectsLeft-- <= 0) {
          res.status(502).json({ error: "Too many redirects" });
          return;
        }

        let nextUrl: URL;
        try {
          nextUrl = new URL(location, currentUrl);
        } catch {
          res.status(502).json({ error: "Invalid redirect location" });
          return;
        }

        if (!ALLOWED_PROTOCOLS.has(nextUrl.protocol)) {
          res.status(403).json({ error: "Redirect to non-http(s) URL blocked" });
          return;
        }

        if (await hostIsBlocked(nextUrl.hostname)) {
          res.status(403).json({ error: "Redirect to private/internal host blocked" });
          return;
        }

        currentUrl = nextUrl.toString();
        continue;
      }

      break;
    }

    if (!response.ok) {
      res.status(response.status).json({ error: "Upstream error" });
      return;
    }

    const text = await response.text();
    res.setHeader("Content-Type", response.headers.get("Content-Type") || "text/calendar; charset=utf-8");
    res.setHeader("Cache-Control", "no-store, no-cache, max-age=0, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.send(text);
  } catch (err) {
    req.log.error({ err }, "[proxy] fetch failed");
    res.status(502).json({ error: "Failed to fetch" });
  }
});

export default router;
