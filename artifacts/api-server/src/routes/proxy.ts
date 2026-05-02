import { Router } from "express";

const router = Router();

router.get("/proxy", async (req, res) => {
  const raw = req.query.url;
  const url = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;
  const normalizedUrl = url ? url.trim().replace(/^webcal:\/\//i, "https://") : "";

  if (!normalizedUrl || (!normalizedUrl.startsWith("https://") && !normalizedUrl.startsWith("http://"))) {
    res.status(400).json({ error: "Missing or invalid url" });
    return;
  }

  try {
    const response = await fetch(normalizedUrl, {
      headers: {
        "User-Agent": "lifeOS/1.0",
        Accept: "text/calendar, text/plain, */*",
      },
    });

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
