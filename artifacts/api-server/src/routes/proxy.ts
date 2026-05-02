import { Router } from "express";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const router = Router();

const BLOCKED_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^::1$/,
  /^fc00:/i,
  /^fd[0-9a-f]{2}:/i,
  /^fe80:/i,
  /^0\./,
];

function isBlockedHost(hostname: string): boolean {
  if (BLOCKED_PATTERNS.some((re) => re.test(hostname))) return true;
  if (isIP(hostname) !== 0) {
    return BLOCKED_PATTERNS.some((re) => re.test(hostname));
  }
  return false;
}

async function isBlockedAfterResolution(hostname: string): Promise<boolean> {
  try {
    const { address } = await lookup(hostname);
    return BLOCKED_PATTERNS.some((re) => re.test(address));
  } catch {
    return true;
  }
}

const ALLOWED_PROTOCOLS = new Set(["https:", "http:"]);
const MAX_REDIRECTS = 3;

router.get("/proxy", async (req, res) => {
  const raw = req.query.url;
  const url = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;
  const normalizedUrl = url ? url.trim().replace(/^webcal:\/\//i, "https://") : "";

  if (!normalizedUrl) {
    res.status(400).json({ error: "Missing url parameter" });
    return;
  }

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

  if (isBlockedHost(parsed.hostname)) {
    res.status(403).json({ error: "Forbidden: private or internal hosts are not allowed" });
    return;
  }

  if (await isBlockedAfterResolution(parsed.hostname)) {
    res.status(403).json({ error: "Forbidden: host resolves to a private address" });
    return;
  }

  try {
    let currentUrl = normalizedUrl;
    let redirectsLeft = MAX_REDIRECTS;
    let response: Response;

    while (true) {
      response = await fetch(currentUrl, {
        redirect: "manual",
        headers: {
          "User-Agent": "lifeOS/1.0",
          Accept: "text/calendar, text/plain, */*",
        },
      });

      const location = response.headers.get("location");
      if ((response.status === 301 || response.status === 302 || response.status === 307 || response.status === 308) && location) {
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

        if (isBlockedHost(nextUrl.hostname) || (await isBlockedAfterResolution(nextUrl.hostname))) {
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
