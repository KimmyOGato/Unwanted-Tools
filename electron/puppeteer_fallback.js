// Optional Puppeteer fallback for pages that require JS interaction to reveal audio links.
// This is a scaffold: Puppeteer is NOT installed by default. To enable, run:
//   npm install puppeteer --save
// Then call `renderAndExtract(url, { waitForSelector: '.audio-row' })` from main process.

async function renderAndExtract(url, opts = {}) {
  try {
    const puppeteer = require('puppeteer')
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] })
    const page = await browser.newPage()
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })

    if (opts.waitForSelector) {
      try {
        await page.waitForSelector(opts.waitForSelector, { timeout: 8000 })
      } catch (e) {
        // selector not found — continue
      }
    }

    // run page script to collect candidate links
    const candidates = await page.evaluate(() => {
      const out = []
      // audio tags
      document.querySelectorAll('audio[src], audio source[src]').forEach(el => {
        out.push(el.src || el.getAttribute('src'))
      })
      // anchors
      document.querySelectorAll('a[href]').forEach(a => {
        const h = a.href || a.getAttribute('href')
        if (h) out.push(h)
      })
      // data attributes
      document.querySelectorAll('[data-src], [data-href], [data-url]').forEach(el => {
        const s = el.getAttribute('data-src') || el.getAttribute('data-href') || el.getAttribute('data-url')
        if (s) out.push(s)
      })
      return out.filter(Boolean)
    })

    await browser.close()
    // normalize unique
    const uniq = Array.from(new Set(candidates))
    return { items: uniq }
  } catch (err) {
    return { error: String(err) }
  }
}

module.exports = { renderAndExtract }
