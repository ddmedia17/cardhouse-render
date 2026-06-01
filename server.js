/* ============================================================
   CardHouse render service
   POST /render  { html }  ->  application/pdf
   Renders a self-contained print HTML with headless Chromium and
   returns a print-ready PDF. Same engine that draws the on-screen
   proof, so the output matches exactly — and it's fully automated
   (no print dialog). The CSS @page size in the HTML drives the page
   dimensions (trim + 4 mm bleed), printBackground keeps colors/textures.
   ============================================================ */
const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');

const app = express();
app.use(cors());                          // allow the GoDaddy site to call this
app.use(express.json({ limit: '30mb' })); // logos are inlined as data URLs → allow big bodies

// Reuse one browser across requests (faster than launching per call).
let browserPromise = null;
function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
    });
  }
  return browserPromise;
}

app.get('/health', (_req, res) => res.send('ok'));

app.post('/render', async (req, res) => {
  const { html, filename } = req.body || {};
  if (!html || typeof html !== 'string') {
    return res.status(400).json({ error: 'Missing "html" string in body.' });
  }
  let page;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 60000 });
    // make sure web fonts are loaded before snapshotting
    await page.evaluate(async () => { if (document.fonts && document.fonts.ready) await document.fonts.ready; });
    // Measure the actual print-page box (.ch-pp) and size the PDF page to it exactly. Using explicit
    // width/height with scale:1 stops Chrome's shrink-to-fit, which was scaling the content to ~81%
    // and leaving white margins. Falls back to the CSS @page size if no .ch-pp is present.
    const box = await page.evaluate(() => {
      const pp = document.querySelector('.ch-pp');
      if (!pp) return null;
      const r = pp.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    });
    const pdfOpts = {
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    };
    if (box && box.w > 0 && box.h > 0) {
      pdfOpts.width = box.w + 'px';
      pdfOpts.height = box.h + 'px';
      pdfOpts.scale = 1;
    } else {
      pdfOpts.preferCSSPageSize = true;
    }
    const pdf = await page.pdf(pdfOpts);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="${(filename || 'card').replace(/[^a-z0-9._-]/gi, '_')}.pdf"`);
    // page.pdf() returns a Uint8Array; wrap in a Buffer so Express sends raw bytes (not JSON).
    res.send(Buffer.from(pdf));
  } catch (err) {
    console.error('render error:', err);
    res.status(500).json({ error: String(err && err.message || err) });
  } finally {
    if (page) { try { await page.close(); } catch (_) {} }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`CardHouse render service listening on :${PORT}`));
