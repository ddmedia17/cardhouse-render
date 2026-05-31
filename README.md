# CardHouse Render Service

A tiny Node + Puppeteer service that turns a card's print HTML into a **print-ready PDF** using real headless Chromium. Because it's the same engine that draws the on-screen proof, the PDF matches the proof exactly — and it's fully automated (no "Save as PDF" dialog). This is also the service that will later submit orders to Gelato.

## What it does
`POST /render` with JSON `{ "html": "<full self-contained print HTML>", "filename": "marquee-front" }`
→ responds with `application/pdf` (the print file).

The page size, bleed, and layout are all baked into the HTML's CSS `@page` rule (trim + 4 mm bleed); the service just renders it with `printBackground` on.

## Run locally
```bash
cd render-service
npm install            # downloads a matching Chromium (~150 MB, one time)
npm start              # http://localhost:3000
curl http://localhost:3000/health   # -> ok
```

## Deploy (pick one)
All of these read the included `Dockerfile`, which installs Chromium's system libs.

**Render.com**
1. New → Web Service → connect the repo (or this folder).
2. Environment: **Docker**. It auto-detects the `Dockerfile`.
3. Deploy. Note the URL, e.g. `https://cardhouse-render.onrender.com`.

**Railway / Fly.io / any Docker host**
- Point it at this folder; it builds from the `Dockerfile`. Expose port `3000`.

**Plain VPS**
```bash
# Ubuntu: install the libs from the Dockerfile, then:
npm install && PORT=3000 node server.js   # run under pm2/systemd for production
```

## Connect the site
In the CardHouse front-end set the service URL (see `assets/js/preview.js`, `CH_RENDER_URL`).
Example: `window.CH_RENDER_URL = "https://cardhouse-render.onrender.com/render";`

CORS is open so the GoDaddy-hosted site can call it. Lock it down to your domain in `server.js` (`cors({ origin: "https://yourdomain.com" })`) before going live.

## Notes
- Bodies can be large (logos are inlined as data URLs) — limit is 30 MB.
- For strict Gelato compliance later, add a Ghostscript step to convert the RGB PDF to **PDF/X-4 + GRACoL 2006**. Hook that in after `page.pdf()` in `server.js`.
