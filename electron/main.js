const { app, BrowserWindow, ipcMain, dialog, Menu, Notification } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')
// Ensure application name is consistent in menus and window titles
try { app.name = 'Unwanted Tools' } catch (e) { /* ignore */ }
let autoUpdater
try {
  // electron-updater is optional in dev; require if available
  // eslint-disable-next-line global-require
  const { autoUpdater: _au } = require('electron-updater')
  autoUpdater = _au
  
  // Configure updater to use the new Unwanted-Tools repository
  if (autoUpdater) {
    try {
      autoUpdater.owner = 'KimmyOGato'
      autoUpdater.repo = 'Unwanted-Tools'
      console.log('[Main] Auto-updater configured for:', `${autoUpdater.owner}/${autoUpdater.repo}`)
    } catch (e) {
      console.log('[Main] Failed to configure auto-updater owner/repo:', e && e.message)
    }
  }
} catch (e) {
  console.log('[Main] electron-updater not available:', e && e.message)
}
// Some node/http libraries (undici) expect Web `File` to exist.
// Electron/Node may not provide it in all runtimes; provide a minimal polyfill
// before loading `node-fetch`/undici to avoid ReferenceError: File is not defined
if (typeof global.File === 'undefined') {
  global.File = class File {
    constructor(bits = [], filename = '', options = {}) {
      this.bits = bits
      this.name = filename
      this.lastModified = options.lastModified || Date.now()
      this.size = Array.isArray(bits) ? bits.reduce((s, b) => s + (b ? b.length || 0 : 0), 0) : 0
      this.type = options.type || ''
    }
  }
}

const fetch = require('node-fetch')
const cheerio = require('cheerio')
const soulseek = require('./soulseek')
let ytdl
try { ytdl = require('ytdl-core') } catch (e) { ytdl = null }

// Helper to locate bundled ffmpeg binary (packaged by ffmpeg-static)
function getFFmpegPath() {
  try {
    const ffmpegStatic = require('ffmpeg-static')
    if (ffmpegStatic && fs.existsSync(ffmpegStatic)) return ffmpegStatic
  } catch (e) {}
  // fallback: try common paths
  const candidates = [
    path.join(__dirname, '..', 'node_modules', 'ffmpeg-static', 'bin', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'),
    'ffmpeg'
  ]
  for (const c of candidates) {
    try { if (fs.existsSync(c)) return c } catch (e) {}
  }
  return 'ffmpeg'
}

let keytar
try {
  keytar = require('keytar')
  console.log('[Main] keytar available for secure credential storage')
} catch (e) {
  console.log('[Main] keytar not available:', e && e.message)
  keytar = null
}

// Expose registration helpers if the soulseek wrapper supports them
try {
  const canReg = soulseek.canRegister && soulseek.canRegister()
  console.log('[Main] soulseek.canRegister:', canReg)
} catch (e) {
  console.log('[Main] soulseek.canRegister check failed:', e && e.message)
}

// Detect development mode: check if dist folder exists and has index.html
// If not, we're in dev mode; also check NODE_ENV
// Determine dev mode:
// - If running the `electron-dev` npm script (concurrently starts Vite + Electron),
//   npm sets `npm_lifecycle_event='electron-dev'`, so treat that as dev.
// - Or if NODE_ENV==='development' or dist/index.html is missing.
let isDev = process.env.NODE_ENV === 'development' || process.env.npm_lifecycle_event === 'electron-dev' || !fs.existsSync(path.join(__dirname, '../dist/index.html'))

console.log('[Main] isDev:', isDev)
console.log('[Main] NODE_ENV:', process.env.NODE_ENV)
console.log('[Main] npm_lifecycle_event:', process.env.npm_lifecycle_event)
console.log('[Main] dist/index.html exists:', fs.existsSync(path.join(__dirname, '../dist/index.html')))

let mainWindow = null

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: !isDev,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // Keep global reference so menu handlers can act on it
  mainWindow = win

  // Set window title
  win.setTitle('Unwanted Tools')

  console.log('[Main] Creating window, isDev:', isDev)

  if (isDev) {
    // Load Vite dev server
    console.log('[Main] Loading from dev server: http://localhost:5173')
    win.loadURL('http://localhost:5173')
    try { win.webContents.openDevTools() } catch (e) { /* ignore */ }
  } else {
    // Load the built index.html
    const filePath = path.join(__dirname, '../dist/index.html')
    console.log('[Main] Loading from file:', filePath)
    win.loadFile(filePath)
    // Allow forcing DevTools via command-line flags for debugging (temporary)
    if (process.argv.some(a => a && (a === '--debug' || a === '--force-devtools' || a === '--open-devtools'))) {
      try { win.webContents.openDevTools() } catch (e) {}
    }

    // Forward renderer console messages to main process terminal for easier capture
    try {
      win.webContents.on('console-message', (e, level, message, line, sourceId) => {
        console.log(`[Renderer][console:${level}] ${message} (${sourceId}:${line})`)
      })
    } catch (e) {
      console.error('[Main] Failed to register console-message listener', e)
    }

    // Inject global error handlers into renderer so uncaught errors are logged to console
    try {
      win.webContents.on('did-finish-load', () => {
        try {
          win.webContents.executeJavaScript(`
            window.addEventListener('error', (e) => {
              try { console.error('[Renderer][window.error]', e.message, e.filename + ':' + e.lineno) } catch (err) {}
            });
            window.addEventListener('unhandledrejection', (e) => {
              try { console.error('[Renderer][unhandledrejection]', e.reason) } catch (err) {}
            });
          `).catch(() => {})
        } catch (err) {}
      })
    } catch (e) {
      console.error('[Main] Failed to inject renderer error handlers', e)
    }
  }

  // Handle renderer crashes
  win.webContents.on('crashed', () => console.error('[Main] Renderer process crashed'))

  win.on('closed', () => { if (mainWindow === win) mainWindow = null })
  // Emit window state events so renderer can update maximize/restore UI
  try {
    win.on('maximize', () => { try { win.webContents.send('window-is-maximized', true) } catch (e) {} })
    win.on('unmaximize', () => { try { win.webContents.send('window-is-maximized', false) } catch (e) {} })
  } catch (e) {
    console.error('[Main] Failed to register window state events', e)
  }
}

function parseWaybackInput(input) {
  try {
    const u = new URL(input)
    if (u.hostname.includes('web.archive.org')) {
      // pathname can contain a full URL after the stamp (including http://),
      // so use a regex to reliably extract stamp and original resource.
      // Examples supported:
      //  - /web/20020527110458/http://www.pulseultra.com/
      //  - /web/*/http://example.com/
      const m = (u.pathname || '').match(/^\/web\/([^/]+)\/(.+)$/)
      if (m) {
        const stamp = m[1] === '*' ? null : m[1]
        // m[2] may contain encoded or raw url path — preserve as-is but normalize
        let rest = m[2]
        try {
          // If rest already begins with a protocol, use directly; otherwise assume http
          rest = rest.startsWith('http') ? rest : 'http://' + rest
        } catch (e) {
          rest = rest
        }
        return { original: rest, stamp }
      }
    }
    return { original: input, stamp: null }
  } catch (e) {
    return { original: input, stamp: null }
  }
}

async function getResourcesFromArchivedPage(stamp, original, limit = 12) {
  try {
    // Advanced metadata extraction from page
    const extractPageMetadata = ($) => {
      const metadata = {
        title: ($('title').text() || $('meta[property="og:title"]').attr('content') || $('meta[name="title"]').attr('content') || '').trim(),
        description: ($('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || '').trim(),
        image: ($('meta[property="og:image"]').attr('content') || $('meta[name="og:image"]').attr('content') || $('link[rel="image_src"]').attr('href') || '').trim(),
        author: ($('meta[property="article:author"]').attr('content') || $('meta[name="author"]').attr('content') || $('[rel="author"]').text() || '').trim(),
        published: ($('meta[property="article:published_time"]').attr('content') || $('meta[name="publishdate"]').attr('content') || $('meta[name="date"]').attr('content') || '').trim(),
        modified: ($('meta[property="article:modified_time"]').attr('content') || $('meta[name="modifieddate"]').attr('content') || '').trim(),
        type: ($('meta[property="og:type"]').attr('content') || '').trim(),
        url: ($('meta[property="og:url"]').attr('content') || $('link[rel="canonical"]').attr('href') || '').trim()
      }
      // Try JSON-LD structured data
      let jsonLd = null
      try {
        const scripts = $('script[type="application/ld+json"]')
        if (scripts.length > 0) {
          const data = JSON.parse(scripts.first().html() || '{}')
          jsonLd = data
        }
      } catch (e) { /* ignore */ }
      return { metadata, jsonLd }
    }

    // Helper: parse a single archived page body and extract resource items with context
    const parseBody = (body, usedStamp) => {
      const $ = cheerio.load(body)
      const candidates = []
      const { metadata, jsonLd } = extractPageMetadata($)

      const pushCandidateRaw = (link, ctx) => {
        if (!link) return
        try {
          // Normalize web.archive.org prefixed links
          const m = String(link).match(/\/web\/(\d+)[^\/]*\/(https?:\/\/.+)$/)
          if (m) {
            candidates.push({ link: m[2], ctx })
            return
          }
          const absolute = new URL(link, original).toString()
          candidates.push({ link: absolute, ctx })
        } catch (e) {
          // ignore
        }
      }

      // Page-level metadata
      const pageTitle = metadata.title || ($('title').text() || '').trim()
      const metaOgImage = metadata.image
      const metaDate = metadata.published
      const metaAuthor = metadata.author

      // Collect images from many patterns - ENHANCED IMAGE EXTRACTION
      // img, data-src, srcset, picture/source, lazily-loaded images
      $('img[src], img[data-src], img[data-lazy-src], img[data-original]').each((i, el) => {
        const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src') || $(el).attr('data-original')
        const alt = $(el).attr('alt') || ''
        const title = $(el).attr('title') || ''
        const width = $(el).attr('width') || $(el).css('width') || null
        const height = $(el).attr('height') || $(el).css('height') || null
        if (src) pushCandidateRaw(src, { type: 'img', alt, title, width, height, isLazyLoaded: !!$(el).attr('data-lazy-src') })
      })

      // Enhanced srcset extraction with resolution detection
      $('picture source[src], picture source[srcset], source[src], source[srcset], img[srcset], [data-srcset]').each((i, el) => {
        const s = $(el).attr('src') || $(el).attr('srcset') || $(el).attr('data-srcset')
        if (!s) return
        s.split(',').forEach(part => {
          const trimmed = part.trim()
          const urlPart = trimmed.split(' ')[0]
          // Extract resolution hint (e.g., "2x", "1920w")
          const resMatch = trimmed.match(/(\d+)(x|w)/)
          const resolution = resMatch ? `${resMatch[1]}${resMatch[2]}` : null
          if (urlPart) pushCandidateRaw(urlPart, { type: 'img', resolution, isSrcset: true })
        })
      })

      // Extract images from noscript tags (progressive enhancement)
      $('noscript').each((i, el) => {
        const html = $(el).html() || ''
        const imgMatches = html.match(/<img[^>]+src=['"]?([^'">\s]+)/gi)
        if (imgMatches) {
          imgMatches.forEach(match => {
            const srcMatch = match.match(/src=['"]?([^'">\s]+)/)
            if (srcMatch && srcMatch[1]) {
              pushCandidateRaw(srcMatch[1], { type: 'img', context: 'noscript' })
            }
          })
        }
      })

      // Extract images from CSS background images (all elements)
      $('[style*="background"], [style*="background-image"]').each((i, el) => {
        const st = $(el).attr('style') || ''
        const matches = st.match(/url\(['"]?([^'")]+)['"]?\)/g)
        if (matches) {
          matches.forEach(m => {
            const url = m.match(/url\(['"]?([^'")]+)['"]?\)/)
            if (url && url[1]) pushCandidateRaw(url[1], { type: 'img', context: 'background-image' })
          })
        }
      })

      // Extract images from JSON-LD structured data
      if (jsonLd && jsonLd.image) {
        const imgs = Array.isArray(jsonLd.image) ? jsonLd.image : [jsonLd.image]
        imgs.forEach(img => {
          if (typeof img === 'string' && img) {
            pushCandidateRaw(img, { type: 'img', context: 'json-ld' })
          } else if (img && img.url) {
            pushCandidateRaw(img.url, { type: 'img', context: 'json-ld' })
          }
        })
      }

      // meta og:image and link rel
      if (metaOgImage) pushCandidateRaw(metaOgImage, { type: 'meta' })
      const linkImage = $('link[rel="image_src"]').attr('href') || null
      if (linkImage) pushCandidateRaw(linkImage, { type: 'meta' })

      // Extract from Open Graph and Twitter Card metas
      $('meta[property*="image"], meta[name*="image"], meta[property*="twitter:image"], meta[name*="twitter:image"]').each((i, el) => {
        const src = $(el).attr('content')
        if (src) pushCandidateRaw(src, { type: 'img', context: 'meta-cards' })
      })

      // audio/video tags
      $('audio source[src], audio[src], video source[src], video[src]').each((i, el) => pushCandidateRaw($(el).attr('src'), { type: 'media' }))

      // anchors that look like media
      $('a[href]').each((i, el) => {
        const href = $(el).attr('href')
        if (!href) return
        const lower = href.toLowerCase()
        if (lower.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg|mp3|ogg|m4a|wav|mp4|mov)(\?|$)/) || lower.includes('media') || lower.includes('files')) {
          pushCandidateRaw(href, { type: 'link', text: $(el).text().trim() || null })
        }
      })

      // data attributes and inline styles
      $('[data-src], [data-href], [data-url]').each((i, el) => pushCandidateRaw($(el).attr('data-src') || $(el).attr('data-href') || $(el).attr('data-url'), { type: 'data' }))
      $('*[style]').each((i, el) => {
        const st = $(el).attr('style') || ''
        const m = st.match(/background-image:\s*url\(['"]?([^'\")]+)['"]?\)/i)
        if (m && m[1]) pushCandidateRaw(m[1], { type: 'style' })
      })

      // Extract headlines and text content
      const headlines = []
      $('h1, h2, h3, h4').each((i, el) => {
        const text = $(el).text().trim()
        if (text && text.length > 3) headlines.push(text)
      })

      // Extract iframe embeds
      $('iframe[src]').each((i, el) => {
        const src = $(el).attr('src')
        if (src && (src.includes('youtube') || src.includes('vimeo') || src.includes('player') || src.includes('embed'))) {
          pushCandidateRaw(src, { type: 'iframe' })
        }
      })

      // For grouping: try to find section headings or gallery containers near each image
      const resolved = []
      const seenUrls = new Set()
      
      for (const c of candidates) {
        try {
          const abs = new URL(c.link, original).toString()
          
          // Skip duplicates
          if (seenUrls.has(abs)) continue
          seenUrls.add(abs)
          
          // Determine context: find nearest ancestor with class indicating gallery or a figure tag
          let groupTitle = null
          try {
            const el = $(`[src="${c.link}"]`).first()
            let node = el
            if (!node || node.length === 0) {
              // try by href
              node = $(`a[href="${c.link}"]`).first()
            }
            if (node && node.length > 0) {
              // climb up to find a header or gallery container
              let parent = node.parent()
              let found = null
              for (let i=0;i<6 && parent && parent.length>0;i++) {
                const cls = (parent.attr('class') || '').toLowerCase()
                if (cls && (cls.includes('gallery') || cls.includes('album') || cls.includes('photos') || cls.includes('track') || cls.includes('figure') || cls.includes('gallery-item'))) {
                  found = parent; break
                }
                parent = parent.parent()
              }
              if (found) {
                const h = found.find('h1,h2,h3').first()
                if (h && h.length>0) groupTitle = h.text().trim()
              }
              if (!groupTitle) {
                // fallback to nearest heading before the node
                const prevHead = node.prevAll('h1,h2,h3').first()
                if (prevHead && prevHead.length>0) groupTitle = prevHead.text().trim()
              }
            }
          } catch (e) { /* ignore context extraction errors */ }

          // If still no groupTitle, use pageTitle
          if (!groupTitle) groupTitle = pageTitle || null

          // Year from usedStamp if available
          let year = null
          try {
            if (usedStamp && /^\d{4}/.test(usedStamp)) year = usedStamp.substring(0,4)
            else if (metaDate && /^\d{4}/.test(metaDate)) year = metaDate.substring(0,4)
          } catch (e) { }

          // guess mimetype from extension
          let mimetype = null
          try {
            const p = new URL(abs).pathname
            const ext = (p.split('.').pop() || '').toLowerCase()
            const map = {
              jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp', svg: 'image/svg+xml',
              mp3: 'audio/mpeg', ogg: 'audio/ogg', m4a: 'audio/mp4', wav: 'audio/wav',
              mp4: 'video/mp4', mov: 'video/quicktime'
            }
            mimetype = map[ext] || null
          } catch (e) { mimetype = null }

          // Extract quality hints from filename and context - ENHANCED
          let qualityHints = { isLargeLikely: false, isThumbnail: false, isDuplicate: false, resolution: null, priority: 0 }
          try {
            const pathname = new URL(abs).pathname.toLowerCase()
            const filename = pathname.split('/').pop()
            const url = abs.toLowerCase()
            
            // THUMBNAIL DETECTION
            const thumbnailPatterns = ['thumb', 'icon', 'small', 'xs_', '16x', '32x', '64x', '48x', 'thumbnail', 'mini', '-s.jpg', '_s.', 'small_', 'tiny']
            if (thumbnailPatterns.some(p => filename.includes(p))) {
              qualityHints.isThumbnail = true
              qualityHints.priority -= 5
            }
            
            // HIGH QUALITY DETECTION
            const highQualityPatterns = ['high', 'hd', 'full', 'original', '1920', '1080', '2048', '2560', '3840', '4096', '8192', '-l.', '-xl.', '_hq', '_large', '-large', '@2x', '@3x']
            if (highQualityPatterns.some(p => filename.includes(p))) {
              qualityHints.isLargeLikely = true
              qualityHints.priority += 10
            }
            
            // RESOLUTION DETECTION FROM FILENAME
            const resMatch = filename.match(/(\d{3,4})x(\d{3,4})/)
            if (resMatch) {
              const width = parseInt(resMatch[1])
              const height = parseInt(resMatch[2])
              qualityHints.resolution = `${width}x${height}`
              // Favor larger images
              if (width >= 1920 || height >= 1080) {
                qualityHints.priority += 8
              } else if (width >= 800 && height >= 600) {
                qualityHints.priority += 4
              }
            }
            
            // CDN & PROXY DETECTION
            const cdnPatterns = ['cdn.', 'img.', 'images.', 'static.', 'assets.', 'media.', 's3.', 'cloudfront', 'fastly', 'imgix', 'cloudinary']
            if (cdnPatterns.some(p => url.includes(p))) {
              qualityHints.isCDN = true
              qualityHints.priority += 1
            }
            
            // SKIP CERTAIN PATTERNS (tracking pixels, resources)
            const skipPatterns = ['pixel', 'spacer', '/css/', '/js/', 'jquery', 'analytics', 'tracking', 'beacon', '.gif?', '1x1', 'invisible']
            if (skipPatterns.some(p => filename.includes(p) || pathname.includes(p))) {
              continue
            }
            
            // FILE FORMAT QUALITY SCORING
            if (filename.endsWith('.webp')) qualityHints.priority += 2  // Modern format
            if (filename.endsWith('.png')) qualityHints.priority += 1   // Lossless
            if (filename.endsWith('.gif')) qualityHints.priority -= 1   // Usually lower quality
            if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) qualityHints.priority += 0 // Neutral
            
          } catch (e) { }

          // Add metadata from extraction
          const result = {
            original: abs,
            archived: (usedStamp && usedStamp !== '*') ? `https://web.archive.org/web/${usedStamp}/${abs}` : `https://web.archive.org/web/*/${abs}`,
            mimetype,
            timestamp: usedStamp || null,
            groupTitle,
            groupYear: year,
            context: c.ctx, // Type of extraction (img, media, link, etc)
            alt: c.ctx && c.ctx.alt ? c.ctx.alt : null,
            title: c.ctx && c.ctx.title ? c.ctx.title : null,
            qualityHints,
            pageMetadata: {
              pageTitle,
              author: metaAuthor,
              publishedDate: metaDate,
              headlines: headlines.length > 0 ? headlines.slice(0, 3) : null
            }
          }
          resolved.push(result)
        } catch (e) {}
      }

      return resolved
    }

    // If stamp is missing or wildcard, query CDX to obtain capture stamps for the original page
    const items = []
    if (!stamp || stamp === '*' || String(stamp).trim() === '') {
      try {
        // Smart limit: start with requested limit, can go up to 500 for deep search
        const baseLimit = Number(limit || 12)
        const actualLimit = Math.min(baseLimit <= 30 ? 500 : baseLimit, 500)
        const cdxQuery = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(original)}&output=json&fl=timestamp,original&filter=statuscode:200&limit=${actualLimit}`

        // Intelligent file cache: store full CDX response indefinitely, metadata separately
        let cdxJson = null
        let cacheMetadata = null
        try {
          const cacheDir = path.join(app.getPath('userData') || os.tmpdir(), 'cdx-cache')
          try { fs.mkdirSync(cacheDir, { recursive: true }) } catch (e) {}
          const safeName = encodeURIComponent(original).replace(/[%]/g, '_')
          const cacheFile = path.join(cacheDir, `${safeName}.json`)
          const metaFile = path.join(cacheDir, `${safeName}_meta.json`)
          
          let useCache = false
          try {
            if (fs.existsSync(cacheFile)) {
              const raw = fs.readFileSync(cacheFile, 'utf8')
              cdxJson = JSON.parse(raw)
              try {
                const metaRaw = fs.readFileSync(metaFile, 'utf8')
                cacheMetadata = JSON.parse(metaRaw)
              } catch (e) {}
              // Cache is valid permanently for CDX (data doesn't change)
              useCache = true
            }
          } catch (e) { /* ignore cache read errors */ }

          if (!useCache) {
            const cdxRes = await fetch(cdxQuery, { timeout: 20000 })
            if (cdxRes && cdxRes.ok) {
              cdxJson = await cdxRes.json()
              try {
                // Store cache data
                fs.writeFileSync(cacheFile, JSON.stringify(cdxJson), 'utf8')
                // Store metadata (when cached, total count, etc)
                fs.writeFileSync(metaFile, JSON.stringify({ cachedAt: Date.now(), totalRows: cdxJson ? cdxJson.length : 0 }), 'utf8')
              } catch (e) { /* ignore write errors */ }
            }
          }
        } catch (e) {
          // if cache logic fails, fall back to direct fetch
          try {
            const cdxRes = await fetch(cdxQuery, { timeout: 20000 })

            if (cdxRes && cdxRes.ok) cdxJson = await cdxRes.json()
          } catch (er) { /* ignore */ }
        }
        if (cdxJson) {
          // first row may be header if output=json
          // Collect timestamps to fetch: adaptive limit based on results
          const tsList = []
          const maxToFetch = Math.min(baseLimit <= 12 ? 50 : baseLimit <= 30 ? 200 : 500, cdxJson.length - 1)
          
          for (let i = 1; i < Math.min(cdxJson.length, maxToFetch + 1); i++) {
            const row = cdxJson[i]
            if (!row || !row[0]) continue
            tsList.push(row[0])
          }

          // If initial results are low, automatically expand search
          if (tsList.length < baseLimit && cdxJson.length > baseLimit) {
            // We have more data available, keep going
            for (let i = baseLimit + 1; i < Math.min(cdxJson.length, Math.min(300, cdxJson.length)); i++) {
              const row = cdxJson[i]
              if (!row || !row[0]) continue
              if (!tsList.includes(row[0])) tsList.push(row[0])
              if (tsList.length >= 150) break // Stop at reasonable limit
            }
          }

          // Fetch archived pages in batches with limited concurrency (4 parallel)
          const concurrency = 4
          for (let i = 0; i < tsList.length; i += concurrency) {
            const batch = tsList.slice(i, i + concurrency)
            const promises = batch.map(async (ts) => {
              try {
                const archivedPage = `https://web.archive.org/web/${ts}/${original}`
                const r = await fetch(archivedPage, { timeout: 20000 })
                if (!r || !r.ok) return []
                const body = await r.text()
                return parseBody(body, ts)
              } catch (e) {
                return []
              }
            })
            try {
              const results = await Promise.all(promises)
              for (const arr of results) {
                for (const p of arr) items.push(p)
              }
            } catch (e) {
              // ignore batch errors
            }
          }
        }
      } catch (e) {
        // fallback: return empty
      }
      return { items }
    }

    // Otherwise we have a specific stamp: fetch and parse once
    const archivedPage = `https://web.archive.org/web/${stamp}/${original}`
    const res = await fetch(archivedPage, { timeout: 20000 })
    if (!res.ok) return { error: `HTTP ${res.status}` }
    const body = await res.text()
    if (!/\<\s*html/i.test(body)) return { items: [] }
    const parsed = parseBody(body, stamp)
    for (const p of parsed) items.push(p)

    return { items }
  } catch (err) {
    return { error: String(err) }
  }
}

ipcMain.handle('select-folder', async () => {
  try {
    const res = await dialog.showOpenDialog(mainWindow || null, { properties: ['openDirectory'] })
    if (!res) return null
    if (res.canceled) return null
    if (res.filePaths && res.filePaths.length > 0) return res.filePaths[0]
    return null
  } catch (e) {
    console.error('[Main][select-folder] error:', String(e))
    return null
  }
})

ipcMain.handle('download-resource', async (event, { url, destFolder, filename, groupTitle, groupYear }) => {
  try {
    const res = await fetch(url)
    if (!res.ok) return { error: `HTTP ${res.status}` }

    // Build target folder: if group metadata is provided, create a subfolder
    let targetFolder = destFolder
    try {
      if (groupTitle) {
        const safeGroup = String(groupTitle).replace(/[<>:"/\\|?*]+/g, '_').trim()
        const safeYear = groupYear ? String(groupYear).replace(/[<>:"/\\|?*]+/g, '_').trim() : ''
        const sub = safeYear ? `${safeGroup}_${safeYear}` : safeGroup
        targetFolder = path.join(destFolder, sub)
      }
    } catch (e) {
      // fallback to destFolder on any error
      targetFolder = destFolder
    }

    fs.mkdirSync(targetFolder, { recursive: true })

    const unsafeName = filename || path.basename(new URL(url).pathname) || `resource_${Date.now()}`
    let safeName = unsafeName.replace(/[<>:"/\\|?*]+/g, '_')
    const ext = path.extname(safeName)

    if (!ext) {
      const ct = res.headers.get('content-type') || ''
      const map = {
        'image/jpeg': '.jpg',
        'image/jpg': '.jpg',
        'image/png': '.png',
        'image/gif': '.gif',
        'image/webp': '.webp',
        'audio/mpeg': '.mp3',
        'audio/ogg': '.ogg',
        'video/mp4': '.mp4',
        'video/quicktime': '.mov'
      }
      if (map[ct.split(';')[0].trim()]) {
        safeName += map[ct.split(';')[0].trim()]
      } else {
        try {
          const pExt = path.extname(new URL(url).pathname)
          if (pExt) safeName += pExt
        } catch (e) {
          // ignore
        }
      }
    }

    const fullPath = path.join(targetFolder, safeName)

    const fileStream = fs.createWriteStream(fullPath)
    return await new Promise((resolve, reject) => {
      const body = res.body
      let received = 0
      const total = res.headers.get('content-length') ? parseInt(res.headers.get('content-length'), 10) : 0

      body.on('data', (chunk) => {
        received += chunk.length
        event.sender.send('download-progress', { url, filename: safeName, received, total, path: fullPath })
      })
      body.pipe(fileStream)
      fileStream.on('finish', () => {
        // notify renderer that download completed
        try {
          event.sender.send('download-complete', { url, filename: safeName, path: fullPath })
        } catch (e) { /* best-effort */ }
        resolve({ path: fullPath })
      })
      fileStream.on('error', (e) => {
        try {
          event.sender.send('download-complete', { url, filename: safeName, error: String(e) })
        } catch (err) { /* ignore */ }
        reject({ error: String(e) })
      })
    })
  } catch (err) {
    return { error: String(err) }
  }
})

// Probe resource to determine content-type and try to find direct audio links when pages require JS "load" buttons
ipcMain.handle('probe-resource', async (event, { url } = {}) => {
  try {
    console.log('[Main][probe-resource] probing:', url)
    // Try HEAD first to get content-type
    let ct = ''
    try {
      const headRes = await fetch(url, { method: 'HEAD', timeout: 10000 })
      if (headRes && headRes.ok) ct = headRes.headers.get('content-type') || ''
      console.log('[Main][probe-resource] HEAD content-type:', ct)
    } catch (e) {
      console.log('[Main][probe-resource] HEAD failed, will try GET:', e.message)
      // HEAD may be blocked; fall back to GET below
    }

    // If HEAD suggests audio, return immediately
    if (ct && ct.split(';')[0].trim().startsWith('audio/')) {
      console.log('[Main][probe-resource] detected audio via HEAD')
      return { type: 'audio', contentType: ct, url }
    }

    // Fetch the body to inspect HTML and try to locate a direct audio URL
    const res = await fetch(url, { timeout: 20000 })
    if (!res.ok) {
      console.log('[Main][probe-resource] fetch failed:', res.status)
      return { error: `HTTP ${res.status}` }
    }
    const contentType = res.headers.get('content-type') || ''
    console.log('[Main][probe-resource] GET content-type:', contentType)
    if (contentType.split(';')[0].trim().startsWith('audio/')) {
      console.log('[Main][probe-resource] detected audio via GET')
      return { type: 'audio', contentType, url }
    }

    const body = await res.text()
    console.log('[Main][probe-resource] body length:', body.length)
    // If HTML, parse and look for audio tags, anchors to .mp3, or scripts containing media urls
    if (contentType.includes('text/html') || /<\s*html/i.test(body)) {
      console.log('[Main][probe-resource] detected HTML, searching for audio links')
      const $ = cheerio.load(body)
      // try audio tags first
      const candidates = []
      $('audio source[src], audio[src]').each((i, el) => {
        const s = $(el).attr('src')
        if (s) {
          candidates.push(s)
          console.log('[Main][probe-resource] found audio tag src:', s)
        }
      })
      // anchors pointing to mp3
      $('a[href]').each((i, el) => {
        const href = $(el).attr('href')
        if (href && href.toLowerCase().includes('.mp3')) {
          candidates.push(href)
          console.log('[Main][probe-resource] found mp3 link:', href)
        }
      })
      // iframes
      $('iframe[src]').each((i, el) => {
        const s = $(el).attr('src')
        if (s && s.toLowerCase().includes('.mp3')) {
          candidates.push(s)
          console.log('[Main][probe-resource] found iframe src:', s)
        }
      })

      // normalize and test candidates for absolute url
      for (const c of candidates) {
        try {
          const absolute = new URL(c, url).toString()
          // lightweight HEAD check for audio
          try {
            const h = await fetch(absolute, { method: 'HEAD', timeout: 8000 })
            const ct2 = h.headers.get('content-type') || ''
            if (ct2.split(';')[0].trim().startsWith('audio/')) {
              console.log('[Main][probe-resource] candidate confirmed audio:', absolute)
              return { type: 'audio', contentType: ct2, url: absolute }
            }
          } catch (e) {
            console.log('[Main][probe-resource] candidate HEAD failed:', absolute, e.message)
            // ignore candidate if HEAD fails
          }
        } catch (e) {
          console.log('[Main][probe-resource] invalid candidate URL:', c, e.message)
        }
      }

      // nothing found — page likely requires JS interaction (load button)
      console.log('[Main][probe-resource] no direct audio found, page likely needs JS')
      return { type: 'html', contentType, needsInteraction: true }
    }

    console.log('[Main][probe-resource] unknown type')
    return { type: 'unknown', contentType }
  } catch (err) {
    console.error('[Main][probe-resource] error:', String(err))
    return { error: String(err) }
  }
})

ipcMain.handle('open-external', async (event, url) => {
  try {
    const { shell } = require('electron')
    await shell.openExternal(url)
    return { ok: true }
  } catch (e) {
    return { error: String(e) }
  }
})

// Soulseek: check server, search and download handlers
ipcMain.handle('soulseek-check', async (event, { host = 'server.slsknet.org', port = 2242 } = {}) => {
  try {
    const res = await soulseek.checkServer(host, port, 5000)
    return res
  } catch (e) {
    return { ok: false, error: String(e) }
  }
})

ipcMain.handle('soulseek-has-client', async () => {
  return { available: soulseek.hasClient }
})

ipcMain.handle('soulseek-search', async (event, { host, port, username, password, query } = {}) => {
  if (!soulseek.hasClient) return { error: 'missing-soulseek-lib', message: 'No Soulseek client library installed. Install a compatible package (e.g. slsk-client) and restart the app.' }
  try {
    const client = await soulseek.createClient({ host, port, username, password })
    if (!client) return { error: 'client-init-failed' }
    // library-specific API: attempt common patterns (promisify callback APIs)
    if (client.search) {
      return await new Promise((resolve) => {
        try {
          client.search({ req: query, timeout: 5000 }, (err, res) => {
            if (err) return resolve({ error: String(err) })
            return resolve({ items: res || [] })
          })
        } catch (e) { return resolve({ error: String(e) }) }
      })
    }
    if (client.find) {
      return await new Promise((resolve) => {
        try {
          client.find(query, (err, res) => {
            if (err) return resolve({ error: String(err) })
            return resolve({ items: res || [] })
          })
        } catch (e) { return resolve({ error: String(e) }) }
      })
    }
    return { error: 'unsupported-client-api' }
  } catch (e) {
    return { error: String(e), stack: e && e.stack ? String(e.stack) : undefined }
  }
})

ipcMain.handle('soulseek-download', async (event, payload = {}) => {
  console.log('[Main][soulseek-download] received payload:', JSON.stringify(payload).substring(0, 200))
  const { fileId, file, peer, destination, creds } = payload || {}
  if (!soulseek.hasClient) return { error: 'missing-soulseek-lib' }
  try {
    const client = await soulseek.createClient(creds)
    if (!client) return { error: 'client-init-failed' }

    // Normalize incoming file object from several possible shapes.
    // Many clients expect the full search-result object (with `user`, `slots`, etc.),
    // so preserve the original object when provided. If a raw string is passed,
    // convert it into an object { file: string } to keep a consistent shape.
    let fileObj = null
    let originalItem = null
    if (fileId && typeof fileId === 'object') {
      originalItem = fileId
      fileObj = fileId // keep full object (client often expects user + file fields)
      console.log('[Main][soulseek-download] using fileId object')
    } else if (fileId && typeof fileId === 'string') {
      fileObj = { file: fileId }
      console.log('[Main][soulseek-download] converted fileId string to object')
    } else if (file && typeof file === 'object') {
      originalItem = file
      fileObj = file
      console.log('[Main][soulseek-download] using file object')
    } else if (file && typeof file === 'string') {
      fileObj = { file }
      console.log('[Main][soulseek-download] converted file string to object')
    }

    if (!fileObj) {
      if (fileId && typeof fileId === 'string' && peer) {
        return { error: 'missing-file-object', message: 'Provide the original search result object (contains `file` and `user`).' }
      }
      return { error: 'missing-file-object', message: 'Provide the search result file object when requesting download.' }
    }

    const filePathStr = (typeof fileObj === 'string') ? fileObj : (fileObj.file || fileObj.path || fileObj.name || fileObj.filename || '')
    const filename = (filePathStr || '').toString().replace(/^@@/, '').split(/[\\/]/).pop() || `slsk_${Date.now()}`

    // Normalize destination: accept folder or full file path
    let outPath = ''
    if (destination) {
      try {
        if (fs.existsSync(destination) && fs.lstatSync(destination).isDirectory()) {
          outPath = path.join(destination, filename)
        } else if (String(destination).endsWith('/') || String(destination).endsWith('\\')) {
          outPath = path.join(destination, filename)
        } else {
          outPath = destination
        }
      } catch (e) {
        outPath = destination
      }
    } else {
      outPath = path.join(app.getPath('downloads') || os.tmpdir(), filename)
    }

    // Prepare logs directory
    try { fs.mkdirSync(path.join(__dirname, '..', 'build', 'logs'), { recursive: true }) } catch (e) { }

    // If client provides downloadStream (preferred) use it. Add timeouts
    if (typeof client.downloadStream === 'function') {
      try {
        const stream = await new Promise((resolve, reject) => {
          let settled = false
          const timer = setTimeout(() => {
            if (!settled) {
              settled = true
              return reject(new Error('downloadStream-callback-timeout'))
            }
          }, 30000)
          try {
            client.downloadStream({ file: fileObj }, (err, s) => {
              if (settled) return
              settled = true
              clearTimeout(timer)
              if (err) return reject(err)
              return resolve(s)
            })
          } catch (e) {
            if (!settled) { settled = true; clearTimeout(timer); reject(e) }
          }
        })

        return await new Promise((resolve) => {
          try {
            const ws = fs.createWriteStream(outPath)
            let received = 0
            let finished = false
            let firstData = false
            // Initial timeout: wait up to 30s for first data chunk
            const INITIAL_TIMEOUT_MS = 30 * 1000
            // Inactivity timeout after first data: reset on activity. Use 5 minutes of inactivity as threshold.
            const INACTIVITY_MS = 5 * 60 * 1000
            let streamTimer = null
            const startTimer = (isInitial = false) => {
              try { if (streamTimer) clearTimeout(streamTimer) } catch (e) {}
              const timeout = isInitial ? INITIAL_TIMEOUT_MS : INACTIVITY_MS
              streamTimer = setTimeout(() => {
                if (!finished) {
                  finished = true
                  try { ws.end() } catch (e) {}
                  const errorMsg = firstData ? 'stream inactivity timeout' : 'stream no-data timeout'
                  const logPath = path.join(__dirname, '..', 'build', 'logs', `soulseek-download-stream-timeout-${Date.now()}.log`)
                  try { fs.writeFileSync(logPath, errorMsg + '\n\n' + JSON.stringify({ fileObj, received, firstData }, null, 2)) } catch (e) {}
                  console.log('[Main][soulseek-download]', errorMsg, 'for', filename)
                  try { if (mainWindow && mainWindow.webContents) mainWindow.webContents.send('download-complete', { filename, error: 'stream-timeout', log: logPath }) } catch (e) {}
                  return resolve({ error: 'stream-timeout', log: logPath })
                }
              }, timeout)
            }

            // prime the timer (initial, waiting for first data)
            startTimer(true)

            const sendProgress = () => {
              try {
                if (mainWindow && mainWindow.webContents) {
                  mainWindow.webContents.send('soulseek-download-progress', { filename, received })
                  mainWindow.webContents.send('download-progress', { filename, received, total: 0, path: outPath })
                }
              } catch (e) {}
            }

            stream.on('data', (chunk) => {
              if (!firstData) {
                firstData = true
                console.log('[Main][soulseek-download] first data received for', filename)
              }
              received += chunk.length
              // reset inactivity timer on activity (use inactivity timeout now)
              startTimer(false)
              sendProgress()
            })

            const finishSuccess = () => {
              if (finished) return
              finished = true
              try { if (streamTimer) clearTimeout(streamTimer) } catch (e) {}
              try { ws.end() } catch (e) {}
              try {
                if (mainWindow && mainWindow.webContents) {
                  mainWindow.webContents.send('soulseek-download-progress', { filename, received })
                  mainWindow.webContents.send('download-progress', { filename, received, total: 0, path: outPath })
                  mainWindow.webContents.send('download-complete', { filename, path: outPath })
                }
              } catch (e) {}
              return resolve({ ok: true, path: outPath })
            }

            stream.on('end', finishSuccess)
            stream.on('close', finishSuccess)

            stream.on('error', (err) => {
              if (finished) return
              finished = true
              try { if (streamTimer) clearTimeout(streamTimer) } catch (e) {}
              try { ws.end() } catch (e) {}
              const logPath = path.join(__dirname, '..', 'build', 'logs', `soulseek-download-${Date.now()}.log`)
              try { fs.writeFileSync(logPath, String(err.stack || err) + '\n\n' + JSON.stringify({ fileObj }, null, 2)) } catch (e) {}
              console.log('[Main][soulseek-download] stream error:', String(err).substring(0, 100))
              try { if (mainWindow && mainWindow.webContents) mainWindow.webContents.send('download-complete', { filename, error: String(err), log: logPath }) } catch (e) {}
              return resolve({ error: String(err), log: logPath })
            })

            ws.on('error', (err) => {
              if (finished) return
              finished = true
              try { if (streamTimer) clearTimeout(streamTimer) } catch (e) {}
              const logPath = path.join(__dirname, '..', 'build', 'logs', `soulseek-download-write-${Date.now()}.log`)
              try { fs.writeFileSync(logPath, String(err.stack || err) + '\n\n' + JSON.stringify({ fileObj }, null, 2)) } catch (e) {}
              try { if (mainWindow && mainWindow.webContents) mainWindow.webContents.send('download-complete', { filename, error: String(err), log: logPath }) } catch (e) {}
              return resolve({ error: String(err), log: logPath })
            })

            stream.pipe(ws)
          } catch (e) {
            const logPath = path.join(__dirname, '..', 'build', 'logs', `soulseek-download-init-${Date.now()}.log`)
            try { fs.writeFileSync(logPath, String(e.stack || e) + '\n\n' + JSON.stringify({ fileObj }, null, 2)) } catch (er) {}
            try { if (mainWindow && mainWindow.webContents) mainWindow.webContents.send('download-complete', { filename, error: String(e), log: logPath }) } catch (err) {}
            return resolve({ error: String(e), log: logPath })
          }
        })
      } catch (e) {
        const logPath = path.join(__dirname, '..', 'build', 'logs', `soulseek-download-init-${Date.now()}.log`)
        try { fs.writeFileSync(logPath, String(e.stack || e) + '\n\n' + JSON.stringify({ fileObj }, null, 2)) } catch (er) {}
        return { error: String(e), log: logPath }
      }
    }

    // Fallback: callback-based download
    if (typeof client.download === 'function') {
      console.log('[Main][soulseek-download] using callback-based download fallback for', filename)
      return await new Promise((resolve) => {
        try {
          let settled = false
          const cbTimer = setTimeout(() => {
            if (!settled) {
              settled = true
              const logPath = path.join(__dirname, '..', 'build', 'logs', `soulseek-download-cb-timeout-${Date.now()}.log`)
              try { fs.writeFileSync(logPath, 'download callback timeout\n\n' + JSON.stringify({ fileObj }, null, 2)) } catch (e) {}
              return resolve({ error: 'download-cb-timeout', log: logPath })
            }
          }, 120000)

          client.download({ file: fileObj, path: outPath }, (err, data) => {
            if (settled) return
            settled = true
            clearTimeout(cbTimer)
            if (err) {
              const logPath = path.join(__dirname, '..', 'build', 'logs', `soulseek-download-cb-${Date.now()}.log`)
              try { fs.writeFileSync(logPath, String(err.stack || err) + '\n\n' + JSON.stringify({ fileObj }, null, 2)) } catch (e) {}
              try { if (mainWindow && mainWindow.webContents) mainWindow.webContents.send('download-complete', { filename, error: String(err), log: logPath }) } catch (e) {}
              return resolve({ error: String(err), log: logPath })
            }
            try {
              if (Buffer.isBuffer(data)) { fs.writeFileSync(outPath, data); try { if (mainWindow && mainWindow.webContents) mainWindow.webContents.send('download-complete', { filename, path: outPath }) } catch (e) {} ; return resolve({ ok: true, path: outPath }) }
              try { if (mainWindow && mainWindow.webContents) mainWindow.webContents.send('download-complete', { filename, path: outPath }) } catch (e) {}
              return resolve({ ok: true, path: outPath })
            } catch (e) {
              const logPath = path.join(__dirname, '..', 'build', 'logs', `soulseek-download-write-${Date.now()}.log`)
              try { fs.writeFileSync(logPath, String(e.stack || e) + '\n\n' + JSON.stringify({ fileObj }, null, 2)) } catch (er) {}
              try { if (mainWindow && mainWindow.webContents) mainWindow.webContents.send('download-complete', { filename, error: String(e), log: logPath }) } catch (err) {}
              return resolve({ error: String(e), log: logPath })
            }
          })
        } catch (e) {
          const logPath = path.join(__dirname, '..', 'build', 'logs', `soulseek-download-throw-${Date.now()}.log`)
          try { fs.writeFileSync(logPath, String(e.stack || e) + '\n\n' + JSON.stringify({ fileObj }, null, 2)) } catch (er) {}
          return resolve({ error: String(e), log: logPath })
        }
      })
    }

    return { error: 'unsupported-client-download', message: 'Client does not expose download or downloadStream methods.' }
  } catch (e) {
    const logPath = path.join(__dirname, '..', 'build', 'logs', `soulseek-download-exception-${Date.now()}.log`)
    try { fs.writeFileSync(logPath, String(e.stack || e) + '\n\n' + JSON.stringify({ payload: payload }, null, 2)) } catch (er) {}
    return { error: String(e), log: logPath, stack: e && e.stack ? String(e.stack) : undefined }
  }
})

// Application lifecycle and menu
const isMac = process.platform === 'darwin'

function buildAppMenu() {
  // Remove the application menu so the native menu options do not appear.
  // This hides the native File/Edit/View/etc. menu bar on all platforms.
  try {
    Menu.setApplicationMenu(null)
  } catch (e) {
    console.error('[Main] Failed to remove application menu:', e)
  }
}

// Start the app
app.whenReady().then(() => {
  buildAppMenu()
  createWindow()
  app.on('activate', () => {
    if (!mainWindow) createWindow()
  })
}).catch((e) => {
  console.error('[Main] app.whenReady error:', String(e))
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// Window control IPC handlers (used by renderer via preload)
try {
  ipcMain.on('window-minimize', () => { try { if (mainWindow) mainWindow.minimize() } catch (e) {} })
  ipcMain.on('window-toggle-maximize', () => {
    try {
      if (!mainWindow) return
      if (mainWindow.isMaximized()) { mainWindow.unmaximize(); mainWindow.webContents.send('window-is-maximized', false) }
      else { mainWindow.maximize(); mainWindow.webContents.send('window-is-maximized', true) }
    } catch (e) { console.error('[Main] window-toggle-maximize error', e) }
  })
  ipcMain.on('window-close', () => { try { if (mainWindow) mainWindow.close() } catch (e) {} })
  ipcMain.handle('window-is-maximized', () => !!(mainWindow && mainWindow.isMaximized()))
} catch (e) {
  console.error('[Main] Failed to register window IPC handlers', e)
}

// Auto-updater: wire electron-updater to renderer via IPC
try {
  if (autoUpdater) {
    // Do not auto-download by default; let renderer ask to download
    try { autoUpdater.autoDownload = false } catch (e) {}

    autoUpdater.on('checking-for-update', () => {
      try { if (mainWindow && mainWindow.webContents) mainWindow.webContents.send('update-checking') } catch (e) {}
    })

    autoUpdater.on('update-available', (info) => {
      try { if (mainWindow && mainWindow.webContents) mainWindow.webContents.send('update-available', info) } catch (e) {}
    })

    autoUpdater.on('update-not-available', (info) => {
      try { if (mainWindow && mainWindow.webContents) mainWindow.webContents.send('update-not-available', info) } catch (e) {}
    })

    autoUpdater.on('error', (err) => {
      try { if (mainWindow && mainWindow.webContents) mainWindow.webContents.send('update-error', String(err)) } catch (e) {}
    })

    autoUpdater.on('download-progress', (progress) => {
      try { if (mainWindow && mainWindow.webContents) mainWindow.webContents.send('update-download-progress', progress) } catch (e) {}
    })

    autoUpdater.on('update-downloaded', (info) => {
      try { if (mainWindow && mainWindow.webContents) mainWindow.webContents.send('update-downloaded', info) } catch (e) {}
    })

    ipcMain.handle('check-for-updates', async () => {
      try {
        const res = await autoUpdater.checkForUpdates()
        return { ok: true, result: res }
      } catch (e) {
        console.error('[Main][updater] check-for-updates error', e)
        return { error: String(e) }
      }
    })

    ipcMain.handle('download-update', async () => {
      try {
        const res = await autoUpdater.downloadUpdate()
        return { ok: true, result: res }
      } catch (e) {
        console.error('[Main][updater] download-update error', e)
        return { error: String(e) }
      }
    })

    ipcMain.handle('cancel-update-download', async () => {
      try {
        if (typeof autoUpdater.cancelDownload === 'function') {
          await autoUpdater.cancelDownload()
          return { ok: true }
        }
        return { error: 'cancel_not_supported' }
      } catch (e) {
        console.error('[Main][updater] cancel-update-download error', e)
        return { error: String(e) }
      }
    })

    ipcMain.handle('install-update', async () => {
      try {
        // quitAndInstall may return immediately; call without forcing the app to run as admin
        try { autoUpdater.quitAndInstall(false, true) } catch (e) { try { autoUpdater.quitAndInstall() } catch (er) {} }
        return { ok: true }
      } catch (e) {
        console.error('[Main][updater] install-update error', e)
        return { error: String(e) }
      }
    })
  } else {
    // Provide no-op handlers so renderer calls don't throw if electron-updater missing
    ipcMain.handle('check-for-updates', async () => ({ error: 'updater_unavailable' }))
    ipcMain.handle('download-update', async () => ({ error: 'updater_unavailable' }))
    ipcMain.handle('cancel-update-download', async () => ({ error: 'updater_unavailable' }))
    ipcMain.handle('install-update', async () => ({ error: 'updater_unavailable' }))
  }
} catch (e) {
  console.error('[Main] Failed to initialize auto-updater IPC handlers:', e)
}

// User data backup/restore handlers to preserve data between updates
ipcMain.handle('backup-user-data', async (event) => {
  try {
    const userData = {}
    // Collect all localStorage keys starting with 'uwt:' (Unwanted Tools)
    // In Electron, we access it through the renderer process, so we ask the renderer to send it
    if (mainWindow && mainWindow.webContents) {
      const data = await mainWindow.webContents.executeJavaScript(`
        const result = {}
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key && key.startsWith('uwt:')) {
            result[key] = localStorage.getItem(key)
          }
        }
        result
      `)
      return { ok: true, data: data || {} }
    }
    return { ok: true, data: {} }
  } catch (e) {
    console.error('[Main] backup-user-data error:', e)
    return { error: String(e) }
  }
})

ipcMain.handle('restore-user-data', async (event, backup) => {
  try {
    // Restore backed up localStorage to renderer
    if (mainWindow && mainWindow.webContents && backup && typeof backup === 'object') {
      await mainWindow.webContents.executeJavaScript(`
        Object.entries(${JSON.stringify(backup)}).forEach(([key, value]) => {
          try { localStorage.setItem(key, value) } catch (e) {}
        })
      `)
    }
    return { ok: true }
  } catch (e) {
    console.error('[Main] restore-user-data error:', e)
    return { error: String(e) }
  }
})

// Minimal MP3 search handler to avoid "No handler registered" errors.
// Returns an empty items array for now; can be expanded to implement real search logic.
ipcMain.handle('search-mp3', async (event, { artist = '', song = '', genre = '' } = {}) => {
  try {
    console.log('[Main][search-mp3] received opts:', { artist, song, genre })

    // Primary source: buildism.net MP3 search (site scraping)
    try {
      const params = new URLSearchParams({ artist, song, genre, submit: 'Search' })
      const url = `https://buildism.net/mp3-search/?${params.toString()}`
      console.log('[Main][search-mp3] requesting buildism:', url)
      const res = await fetch(url, { timeout: 30000, headers: { 'User-Agent': 'Mozilla/5.0' } })
      console.log('[Main][search-mp3] buildism status:', res.status)
      if (res && res.ok) {
        const html = await res.text()
        const $ = cheerio.load(html)
        const items = []
        const pushIfNew = (link, title) => {
          if (!link || !link.trim()) return
          try {
            const absolute = new URL(link, url).toString()
            if (!items.find(i => i.url === absolute)) {
              items.push({ title: title || absolute.split('/').pop() || 'audio', url: absolute })
              console.log('[Main][search-mp3] added:', absolute, 'title:', title)
            }
          } catch (e) {
            // ignore invalid urls
          }
        }

        // Look for custom audio rows (site-specific)
        $('.audio-row, .track, .song, .music-item').each((i, el) => {
          const dataUrl = $(el).attr('data-url') || $(el).attr('data-src') || $(el).find('a').attr('href')
          const title = $(el).find('.title, .track-title, .song-title').text().trim() || null
          if (dataUrl) pushIfNew(dataUrl, title)
        })

        // anchors ending with common audio extensions
        $('a[href]').each((i, el) => {
          const href = $(el).attr('href')
          if (!href) return
          const lower = href.toLowerCase()
          const text = $(el).text().trim()
          if (lower.match(/\.(mp3|ogg|m4a|flac|wav)(\?|$)/)) pushIfNew(href, text || null)
        })

        // audio/video tags
        $('audio source[src], audio[src], video source[src], video[src]').each((i, el) => {
          pushIfNew($(el).attr('src') || $(el).attr('data-src'), null)
        })

        // data attributes and JSON blobs
        $('[data-src], [data-href], [data-url]').each((i, el) => pushIfNew($(el).attr('data-src') || $(el).attr('data-href') || $(el).attr('data-url')))
        $('script[type="application/json"], script[type="application/ld+json"]').each((i, el) => {
          try {
            const data = JSON.parse($(el).text())
            if (data && typeof data === 'object') {
              if (data.url) pushIfNew(data.url, data.name || null)
              if (data.audio) pushIfNew(data.audio, null)
              if (data.musicURL) pushIfNew(data.musicURL, null)
            }
          } catch (e) { /* ignore invalid json */ }
        })

        console.log('[Main][search-mp3] final count:', items.length, 'items from buildism')
        if (items.length > 0) return { items }
      }
    } catch (err) {
      console.log('[Main][search-mp3] buildism search failed, will fallback to CDX:', String(err))
    }

    // Fallback: query Wayback CDX for .mp3 captures and filter by terms
    try {
      const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=*.mp3&output=json&fl=original,timestamp,mimetype&filter=statuscode:200&limit=500`
      console.log('[Main][search-mp3] querying CDX:', cdxUrl)
      const r2 = await fetch(cdxUrl, { timeout: 30000 })
      if (!r2 || !r2.ok) return { items: [] }
      const data = await r2.json()
      if (!Array.isArray(data) || data.length === 0) return { items: [] }

      const terms = [artist, song, genre].filter(Boolean).map(s => s.toLowerCase())
      const seen = new Set()
      const items = []
      for (const row of data) {
        if (!row || !row[0]) continue
        const original = row[0]
        const timestamp = row[1] || ''
        const mimetype = row[2] || ''
        if (seen.has(original)) continue
        seen.add(original)
        const low = original.toLowerCase()
        if (terms.length > 0) {
          let matched = false
          for (const t of terms) {
            if (!t) continue
            if (low.includes(t)) { matched = true; break }
          }
          if (!matched) continue
        }
        const archivedUrl = timestamp ? `https://web.archive.org/web/${timestamp}id_/${original}` : original
        const filename = original.split('/').pop() || original
        items.push({ url: archivedUrl, original, timestamp, mimetype, title: filename })
        if (items.length >= 200) break
      }
      return { items }
    } catch (cdxErr) {
      console.error('[Main][search-mp3] CDX fallback failed:', String(cdxErr))
      return { items: [] }
    }

  } catch (e) {
    console.error('[Main][search-mp3] error:', String(e))
    return { error: String(e) }
  }
})

// Minimal fetch-resources handler used by the renderer to retrieve items from a link.
// In the full app this resolves Wayback pages and extracts resources; here we return an empty set.
ipcMain.handle('fetch-resources', async (event, link, filters = {}) => {
  try {
    console.log('[Main][fetch-resources] link:', link, 'filters:', filters)
    // If link looks like a web.archive.org capture, try to parse resources
    try {
      const parsed = parseWaybackInput(link || '')
      if (parsed && parsed.original) {
        // Detect prefix/wildcard searches (user provided a trailing *) or filters.deep request
        const isPrefix = /\*$/.test(parsed.original) || (typeof link === 'string' && /\*$/.test(link)) || !!filters.deep
        const limit = filters && filters.limit ? Math.min(200, Number(filters.limit)) : 50

        if (isPrefix) {
          // Remove trailing wildcard for CDX prefix search
          let base = parsed.original.replace(/\*+$/,'')
          // Ensure base includes protocol for CDX queries
          if (!/^https?:\/\//i.test(base)) base = 'http://' + base

          const cdxQuery = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(base)}&output=json&fl=timestamp,original&filter=statuscode:200&matchType=prefix&limit=${limit}`
          try {
            const cdxRes = await fetch(cdxQuery, { timeout: 20000 })
            if (!cdxRes || !cdxRes.ok) return { items: [] }
            const cdxJson = await cdxRes.json()
            if (!Array.isArray(cdxJson) || cdxJson.length <= 1) return { items: [] }

            // Collect unique (timestamp, original) pairs and fetch archived pages in batches
            const rows = []
            for (let i = 1; i < cdxJson.length; i++) {
              const row = cdxJson[i]
              if (!row || !row[0] || !row[1]) continue
              rows.push({ ts: row[0], original: row[1] })
            }

            const items = []
            const seen = new Set()
            const concurrency = 4
            for (let i = 0; i < rows.length; i += concurrency) {
              // Emit progress event to renderer
              const progress = Math.min(i + concurrency, rows.length)
              event.sender.send('search-progress', { current: progress, total: rows.length })
              
              const batch = rows.slice(i, i + concurrency)
              const promises = batch.map(async (r) => {
                try {
                  const res = await getResourcesFromArchivedPage(r.ts, r.original, 12)
                  return res && res.items ? res.items : []
                } catch (e) { return [] }
              })
              try {
                const results = await Promise.all(promises)
                for (const arr of results) {
                  for (const it of arr) {
                    const key = (it.archived || '')
                    if (!key) continue
                    if (seen.has(key)) continue
                    seen.add(key)
                    items.push(it)
                    if (items.length >= limit) break
                  }
                  if (items.length >= limit) break
                }
              } catch (e) { /* ignore batch errors */ }
              if (items.length >= limit) break
            }

            return { items }
          } catch (e) {
            console.error('[Main][fetch-resources] CDX prefix search failed:', String(e))
            return { items: [] }
          }
        }

        // Non-prefix (single original) behavior: delegate to existing extractor
        const res = await getResourcesFromArchivedPage(parsed.stamp || '*', parsed.original, filters && filters.limit ? Number(filters.limit) : 12)
        if (res && res.items) return { items: res.items }
      }
    } catch (e) {
      // fallthrough to empty
      console.error('[Main][fetch-resources] error parsing input:', String(e))
    }
    return { items: [] }
  } catch (e) {
    console.error('[Main][fetch-resources] error:', String(e))
    return { error: String(e) }
  }
})

// Deep search: comprehensive search across ENTIRE Wayback Machine
ipcMain.handle('deep-search-wayback', async (event, searchTerm, options = {}) => {
  try {
    console.log('[Main][deep-search-wayback] ===== DEEP SEARCH START =====')
    console.log('[Main][deep-search-wayback] Searching entire Wayback for:', searchTerm)
    
    const maxResults = Math.min(options.maxResults || 100, 500)
    const items = []
    const seen = new Set()
    const searchLower = searchTerm.toLowerCase()
    const allRows = []

    // Phase 1: Get diverse captures from across Wayback Machine
    // Query specific domains instead of wildcards to get valid captures
    console.log('[Main][deep-search-wayback] PHASE 1: Querying CDX API for captures from major sites...')
    
    // Major content sites in Wayback
    const sitesToSearch = [
      'youtube.com', 'vimeo.com', 'dailymotion.com', 'soundcloud.com',
      'spotify.com', 'bandcamp.com', 'archive.org', 'flickr.com',
      'instagram.com', 'twitter.com', 'reddit.com', 'tumblr.com',
      'imgix.net', 'wikimedia.org', 'cloudinary.com', 'media.tumblr.com'
    ]
    
    for (let sIdx = 0; sIdx < sitesToSearch.length && allRows.length < 400; sIdx++) {
      const site = sitesToSearch[sIdx]
      
      try {
        console.log(`[Main][deep-search-wayback] Querying CDX for ${site}...`)
        
        // Get captures from this specific site
        const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent('*.' + site + '/*')}&output=json&fl=timestamp,original&filter=statuscode:200&limit=100&sort=reverse`
        
        const cdxRes = await fetch(cdxUrl, { timeout: 20000 })
        if (!cdxRes || !cdxRes.ok) {
          console.log(`[Main][deep-search-wayback] CDX failed for ${site}: status ${cdxRes?.status}`)
          continue
        }
        
        const cdxJson = await cdxRes.json()
        console.log(`[Main][deep-search-wayback] CDX returned ${cdxJson.length} rows for ${site}`)
        
        if (!Array.isArray(cdxJson) || cdxJson.length <= 1) continue

        // Collect valid captures (skip header row at index 0)
        for (let i = 1; i < Math.min(cdxJson.length, 80); i++) {
          const row = cdxJson[i]
          if (!row || !row[0] || !row[1]) continue
          
          // Validate the URL - skip wildcards and invalid URLs
          const originalUrl = String(row[1])
          if (originalUrl.includes('*') || originalUrl.includes('%') || !originalUrl.includes('.')) {
            continue
          }
          
          const key = `${row[0]}_${originalUrl}`
          if (!seen.has(key)) {
            seen.add(key)
            allRows.push({ ts: row[0], original: originalUrl })
          }
        }
        
        console.log(`[Main][deep-search-wayback] Total valid captures: ${allRows.length}`)
      } catch (e) {
        console.log(`[Main][deep-search-wayback] Error querying ${site}:`, String(e).substring(0, 60))
        continue
      }
    }

    console.log(`[Main][deep-search-wayback] PHASE 2: Collected ${allRows.length} valid captures`)
    
    if (allRows.length === 0) {
      console.log('[Main][deep-search-wayback] ERROR: No valid captures found')
      return { items: [], error: 'No captures found' }
    }

    // Phase 2: Shuffle for diversity
    for (let i = allRows.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allRows[i], allRows[j]] = [allRows[j], allRows[i]]
    }
    console.log('[Main][deep-search-wayback] PHASE 2: Shuffled capture order')

    // Phase 3: Fetch and parse pages
    console.log('[Main][deep-search-wayback] PHASE 3: Fetching and parsing archived pages...')
    
    const concurrency = 3
    let pagesProcessed = 0
    
    for (let i = 0; i < allRows.length && items.length < maxResults; i += concurrency) {
      const batch = allRows.slice(i, i + concurrency)
      
      // Emit progress
      const progress = Math.min(i + concurrency, allRows.length)
      event.sender.send('search-progress', { 
        current: progress, 
        total: allRows.length,
        found: items.length 
      })
      
      if (i % 30 === 0) {
        console.log(`[Main][deep-search-wayback] Progress: ${progress}/${allRows.length} | Found: ${items.length}/${maxResults}`)
      }

      const promises = batch.map(async (r) => {
        try {
          const archivedUrl = `https://web.archive.org/web/${r.ts}/${r.original}`
          
          const res = await fetch(archivedUrl, { timeout: 12000 })
          if (!res || !res.ok) return []
          
          const body = await res.text()
          const $ = cheerio.load(body)
          const pageMedia = []

          // Extract images
          $('img').each((idx, el) => {
            if (pageMedia.length > 15) return
            
            const src = $(el).attr('src') || $(el).attr('data-src') || ''
            const alt = $(el).attr('alt') || ''
            
            if (src && src.trim()) {
              try {
                const abs = new URL(src, r.original).toString()
                if (!seen.has(abs)) {
                  seen.add(abs)
                  pageMedia.push({
                    original: abs,
                    archived: `https://web.archive.org/web/${r.ts}/${abs}`,
                    mimetype: 'image/jpeg',
                    timestamp: r.ts,
                    source: r.original,
                    alt
                  })
                }
              } catch (e) {}
            }
          })

          // Extract direct video/audio
          $('video source, audio source').each((idx, el) => {
            const src = $(el).attr('src') || ''
            try {
              if (src) {
                const abs = new URL(src, r.original).toString()
                if (!seen.has(abs)) {
                  seen.add(abs)
                  const ext = abs.split('.').pop().toLowerCase()
                  const isAudio = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext)
                  const isVideo = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'm4v'].includes(ext)
                  
                  if (isAudio || isVideo) {
                    pageMedia.push({
                      original: abs,
                      archived: `https://web.archive.org/web/${r.ts}/${abs}`,
                      mimetype: isAudio ? 'audio/mpeg' : 'video/mp4',
                      timestamp: r.ts,
                      source: r.original
                    })
                  }
                }
              }
            } catch (e) {}
          })

          // Extract from data attributes
          $('[data-src], [data-video], [data-audio]').each((idx, el) => {
            if (pageMedia.length > 20) return
            
            const src = $(el).attr('data-src') || $(el).attr('data-video') || $(el).attr('data-audio') || ''
            try {
              if (src && src.length < 500) {
                const abs = new URL(src, r.original).toString()
                const ext = abs.split('.').pop().toLowerCase()
                
                if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
                  if (!seen.has(abs)) {
                    seen.add(abs)
                    pageMedia.push({
                      original: abs,
                      archived: `https://web.archive.org/web/${r.ts}/${abs}`,
                      mimetype: 'image/jpeg',
                      timestamp: r.ts,
                      source: r.original
                    })
                  }
                } else if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) {
                  if (!seen.has(abs)) {
                    seen.add(abs)
                    pageMedia.push({
                      original: abs,
                      archived: `https://web.archive.org/web/${r.ts}/${abs}`,
                      mimetype: 'audio/mpeg',
                      timestamp: r.ts,
                      source: r.original
                    })
                  }
                } else if (['mp4', 'webm'].includes(ext)) {
                  if (!seen.has(abs)) {
                    seen.add(abs)
                    pageMedia.push({
                      original: abs,
                      archived: `https://web.archive.org/web/${r.ts}/${abs}`,
                      mimetype: 'video/mp4',
                      timestamp: r.ts,
                      source: r.original
                    })
                  }
                }
              }
            } catch (e) {}
          })

          // Extract from links
          $('a[href]').each((idx, el) => {
            if (pageMedia.length > 20) return
            
            const href = $(el).attr('href') || ''
            const text = $(el).text()
            
            if (href && href.length < 500) {
              try {
                const abs = new URL(href, r.original).toString()
                const lowerAbs = abs.toLowerCase()
                
                const mediaMatch = lowerAbs.match(/\.(jpg|jpeg|png|gif|webp|mp3|mp4|webm|wav|ogg|m4a|aac|mov|avi)(\?|#|$)/i)
                if (mediaMatch && !seen.has(abs)) {
                  seen.add(abs)
                  const ext = mediaMatch[1].toLowerCase()
                  let mimetype = 'image/jpeg'
                  
                  if (['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(ext)) {
                    mimetype = 'audio/mpeg'
                  } else if (['mp4', 'webm', 'mov', 'avi'].includes(ext)) {
                    mimetype = 'video/mp4'
                  }
                  
                  pageMedia.push({
                    original: abs,
                    archived: `https://web.archive.org/web/${r.ts}/${abs}`,
                    mimetype,
                    timestamp: r.ts,
                    source: r.original,
                    title: text.substring(0, 100)
                  })
                }
              } catch (e) {}
            }
          })

          pagesProcessed++
          return pageMedia
        } catch (e) {
          console.log('[Main][deep-search-wayback] Page error:', String(e).substring(0, 60))
          return []
        }
      })

      try {
        const results = await Promise.all(promises)
        for (const pageMedia of results) {
          for (const item of pageMedia) {
            items.push(item)
            if (items.length >= maxResults) break
          }
          if (items.length >= maxResults) break
        }
      } catch (e) {
        console.log('[Main][deep-search-wayback] Batch error:', String(e))
      }

      if (items.length >= maxResults) break
    }

    console.log(`[Main][deep-search-wayback] PHASE 3 COMPLETE`)
    console.log(`[Main][deep-search-wayback] Pages processed: ${pagesProcessed}`)
    console.log(`[Main][deep-search-wayback] Total media found: ${items.length}`)
    console.log('[Main][deep-search-wayback] ===== DEEP SEARCH COMPLETE =====')
    
    return { items }
  } catch (e) {
    console.error('[Main][deep-search-wayback] FATAL ERROR:', String(e))
    return { error: String(e), items: [] }
  }
})

// YouTube Video Finder: Find deleted/archived YouTube videos
ipcMain.handle('find-deleted-youtube-video', async (event, videoId) => {
  try {
    console.log('[Main][youtube-finder] Searching for video:', videoId)
    
    if (!videoId || videoId.length !== 11) {
      return { error: 'Invalid YouTube video ID' }
    }

    const videos = []
    
    // Query Wayback Machine for this specific YouTube video
    try {
      const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`
      const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(youtubeUrl)}&output=json&fl=timestamp,original&filter=statuscode:200&limit=100&sort=reverse`
      
      console.log('[Main][youtube-finder] Querying CDX for:', youtubeUrl)
      
      const cdxRes = await fetch(cdxUrl, { timeout: 15000 })
      if (!cdxRes || !cdxRes.ok) {
        console.log('[Main][youtube-finder] CDX query failed')
        return { videos: [] }
      }
      
      const cdxJson = await cdxRes.json()
      if (!Array.isArray(cdxJson) || cdxJson.length <= 1) {
        console.log('[Main][youtube-finder] No captures found')
        return { videos: [] }
      }

      // Collect captures
      const captures = []
      for (let i = 1; i < Math.min(cdxJson.length, 20); i++) {
        const row = cdxJson[i]
        if (!row || !row[0] || !row[1]) continue
        captures.push({ ts: row[0], url: row[1] })
      }

      console.log(`[Main][youtube-finder] Found ${captures.length} captures`)

      // Fetch each capture to extract video information
      for (let i = 0; i < captures.length && videos.length < 10; i++) {
        const capture = captures[i]
        
        try {
          const archivedUrl = `https://web.archive.org/web/${capture.ts}/${capture.url}`
          console.log('[Main][youtube-finder] Fetching:', archivedUrl.substring(0, 70))
          
          const res = await fetch(archivedUrl, { timeout: 10000 })
          if (!res || !res.ok) continue
          
          const body = await res.text()
          const $ = cheerio.load(body)
          
          // Extract video title
          const title = $('meta[name="title"]').attr('content') || 
                       $('meta[property="og:title"]').attr('content') || 
                       $('h1.title').text() ||
                       'Vídeo sem título'
          
          // Extract video description
          const description = $('meta[name="description"]').attr('content') || 
                             $('meta[property="og:description"]').attr('content') || ''
          
          // Extract thumbnail
          const thumbnail = $('meta[property="og:image"]').attr('content') || ''
          
          // Extract upload date
          const dateStr = $('meta[itemprop="uploadDate"]').attr('content') || ''
          
          // Extract channel name
          const channel = $('a.yt-simple-endpoint[title]').attr('title') || 
                         $('meta[name="author"]').attr('content') || ''

          // Try to extract video download link from player config
          let videoUrl = null
          const playerMatch = body.match(/ytInitialData\s*=\s*({.*?});/)
          if (playerMatch) {
            try {
              const playerData = JSON.parse(playerMatch[1])
              // Look for video streams in the player config
              const videoStreams = body.match(/"url":"https:\/\/[^"]*\.mp4[^"]*"/g)
              if (videoStreams && videoStreams.length > 0) {
                videoUrl = videoStreams[0].match(/"url":"([^"]+)"/)[1]
              }
            } catch (e) {}
          }

          // Fallback: look for video in iframes or embeds
          if (!videoUrl) {
            const iframes = $('iframe[src*="youtube"]')
            if (iframes.length > 0) {
              videoUrl = $(iframes[0]).attr('src')
            }
          }

          if (title && title !== 'Vídeo sem título') {
            videos.push({
              title: title.substring(0, 200),
              description: description.substring(0, 300),
              thumbnail: thumbnail,
              upload_date: dateStr,
              channel: channel.substring(0, 100),
              url: archivedUrl,
              source: 'Wayback Machine',
              timestamp: capture.ts
            })
          }
        } catch (e) {
          console.log('[Main][youtube-finder] Error fetching capture:', String(e).substring(0, 60))
          continue
        }
      }

      console.log(`[Main][youtube-finder] Extracted ${videos.length} videos`)
      return { videos }
    } catch (e) {
      console.error('[Main][youtube-finder] Search error:', String(e))
      return { error: String(e) }
    }
  } catch (e) {
    console.error('[Main][youtube-finder] error:', String(e))
    return { error: String(e) }
  }
})

// YouTube Search by term (name, channel, etc) - searches multiple archives
ipcMain.handle('search-youtube-by-term', async (event, searchTerm, searchType = 'term') => {
  try {
    console.log('[Main][youtube-search-term] Searching for:', searchTerm, 'type:', searchType)
    
    const videos = []
    const seen = new Set()

    // Multiple archive sources to search
    const archives = [
      { name: 'Wayback Machine', urlPrefix: 'https://web.archive.org/cdx/search/cdx', cdx: true },
      { name: 'Filmot', api: 'https://filmot.com/api' },
      { name: 'GhostArchive', api: 'https://ghostarchive.org' },
    ]

    // Search Wayback Machine
    try {
      let searchUrl = ''
      if (searchType === 'channel') {
        searchUrl = `youtube.com/c/${encodeURIComponent(searchTerm)}*`
      } else if (searchType === 'video') {
        searchUrl = `youtube.com/watch?v=${encodeURIComponent(searchTerm)}`
      } else {
        // For terms, search the whole youtube domain
        searchUrl = `youtube.com/*${encodeURIComponent(searchTerm)}*`
      }

      const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(searchUrl)}&output=json&fl=timestamp,original&filter=statuscode:200&limit=100&sort=reverse`
      
      console.log('[Main][youtube-search-term] Querying Wayback:', searchUrl.substring(0, 80))
      
      const cdxRes = await fetch(cdxUrl, { timeout: 15000 })
      if (cdxRes && cdxRes.ok) {
        const cdxJson = await cdxRes.json()
        if (Array.isArray(cdxJson) && cdxJson.length > 1) {
          // Collect all captures
          const waybackCaptures = []
          for (let i = 1; i < cdxJson.length; i++) {
            const row = cdxJson[i]
            if (!row || !row[0] || !row[1]) continue
            
            const url = String(row[1])
            // Extract video IDs from URLs
            const videoIdMatch = url.match(/v=([a-zA-Z0-9_-]{11})/)
            if (videoIdMatch && videoIdMatch[1]) {
              const vid = videoIdMatch[1]
              if (!seen.has(vid)) {
                seen.add(vid)
                waybackCaptures.push({
                  id: vid,
                  title: `Video ${vid}`,
                  url: `https://web.archive.org/web/${row[0]}/${url}`,
                  timestamp: row[0],
                  source: 'Wayback Machine'
                })
              }
            } else if (searchType === 'channel') {
              // For channel search, collect all URLs
              waybackCaptures.push({
                url: `https://web.archive.org/web/${row[0]}/${url}`,
                timestamp: row[0],
                source: 'Wayback Machine'
              })
            }
          }
          
          console.log(`[Main][youtube-search-term] Found ${waybackCaptures.length} Wayback captures`)
          videos.push(...waybackCaptures.slice(0, 50))
        }
      }
    } catch (e) {
      console.log('[Main][youtube-search-term] Wayback search error:', String(e).substring(0, 60))
    }

    // Try Filmot API (searches deleted YouTube videos)
    try {
      console.log('[Main][youtube-search-term] Querying Filmot for:', searchTerm)
      const filmotUrl = `https://filmot.com/api/search?q=${encodeURIComponent(searchTerm)}&limit=20`
      const filmotRes = await fetch(filmotUrl, { timeout: 10000 })
      
      if (filmotRes && filmotRes.ok) {
        const filmotData = await filmotRes.json()
        if (Array.isArray(filmotData?.results)) {
          for (const video of filmotData.results) {
            if (video.id && !seen.has(video.id)) {
              seen.add(video.id)
              videos.push({
                id: video.id,
                title: video.title || `Video ${video.id}`,
                channel: video.channel || video.uploader || '',
                upload_date: video.uploadDate || video.published || '',
                description: video.description || '',
                url: `https://filmot.com/${video.id}`,
                source: 'Filmot',
                thumbnail: video.thumbnail || ''
              })
            }
          }
        }
      }
    } catch (e) {
      console.log('[Main][youtube-search-term] Filmot search error:', String(e).substring(0, 60))
    }

    // Try Hobune (YouTube archive)
    try {
      console.log('[Main][youtube-search-term] Querying Hobune for:', searchTerm)
      const hobuneUrl = `https://hobune.stream/v/${encodeURIComponent(searchTerm)}`
      const hobuneRes = await fetch(hobuneUrl, { timeout: 10000 })
      
      if (hobuneRes && hobuneRes.ok) {
        const body = await hobuneRes.text()
        const $ = cheerio.load(body)
        
        // Extract video IDs from Hobune search results
        $('a[href*="/v/"]').each((idx, el) => {
          if (videos.length >= 50) return
          
          const href = $(el).attr('href')
          const text = $(el).text()
          
          if (href && text) {
            const videoIdMatch = href.match(/\/v\/([a-zA-Z0-9_-]{11})/)
            if (videoIdMatch && videoIdMatch[1]) {
              const vid = videoIdMatch[1]
              if (!seen.has(vid)) {
                seen.add(vid)
                videos.push({
                  id: vid,
                  title: text.substring(0, 200),
                  url: `https://hobune.stream${href}`,
                  source: 'Hobune',
                  videoUrl: `https://www.youtube.com/watch?v=${vid}`
                })
              }
            }
          }
        })
      }
    } catch (e) {
      console.log('[Main][youtube-search-term] Hobune search error:', String(e).substring(0, 60))
    }

    // Try RemovedEDM (removed videos archive)
    try {
      console.log('[Main][youtube-search-term] Querying RemovedEDM for:', searchTerm)
      const removedEdmUrl = `https://www.removededm.com/search?q=${encodeURIComponent(searchTerm)}&type=video`
      const removedRes = await fetch(removedEdmUrl, { timeout: 10000 })
      
      if (removedRes && removedRes.ok) {
        const body = await removedRes.text()
        const $ = cheerio.load(body)
        
        // Extract videos from RemovedEDM
        $('[data-video-id]').each((idx, el) => {
          if (videos.length >= 50) return
          
          const vid = $(el).attr('data-video-id')
          const title = $(el).find('[data-title]').attr('data-title') || $(el).text()
          
          if (vid && vid.match(/^[a-zA-Z0-9_-]{11}$/)) {
            if (!seen.has(vid)) {
              seen.add(vid)
              videos.push({
                id: vid,
                title: title.substring(0, 200),
                url: `https://www.removededm.com/watch/${vid}`,
                source: 'RemovedEDM',
                videoUrl: `https://www.youtube.com/watch?v=${vid}`
              })
            }
          }
        })
      }
    } catch (e) {
      console.log('[Main][youtube-search-term] RemovedEDM search error:', String(e).substring(0, 60))
    }

    // For channel searches, parse Wayback captures to extract videos
    if (searchType === 'channel' && videos.length > 0) {
      const channelResults = []
      
      for (let i = 0; i < Math.min(videos.length, 10); i++) {
        const v = videos[i]
        if (!v.url) continue
        
        try {
          const res = await fetch(v.url, { timeout: 8000 })
          if (!res || !res.ok) continue
          
          const body = await res.text()
          const $ = cheerio.load(body)
          
          // Extract video links
          $('a[href*="/watch?v="]').each((idx, el) => {
            if (channelResults.length >= 20) return
            
            const href = $(el).attr('href')
            const title = $(el).attr('title') || $(el).text()
            
            const videoIdMatch = href.match(/v=([a-zA-Z0-9_-]{11})/)
            if (videoIdMatch && videoIdMatch[1] && !seen.has(videoIdMatch[1])) {
              seen.add(videoIdMatch[1])
              channelResults.push({
                id: videoIdMatch[1],
                title: title.substring(0, 200),
                url: v.url,
                source: 'Wayback Machine',
                channel: searchTerm,
                videoUrl: `https://www.youtube.com/watch?v=${videoIdMatch[1]}`
              })
            }
          })
        } catch (e) {
          console.log('[Main][youtube-search-term] Error parsing channel page:', String(e).substring(0, 60))
          continue
        }
      }
      
      return { videos: channelResults.slice(0, 20) }
    }

    console.log(`[Main][youtube-search-term] Total videos found: ${videos.length}`)
    return { videos: videos.slice(0, 50) }
  } catch (e) {
    console.error('[Main][youtube-search-term] error:', String(e))
    return { error: String(e), videos: [] }
  }
})

// Download YouTube video using yt-dlp
ipcMain.handle('download-youtube-video', async (event, videoUrl, title = 'video') => {
  try {
    console.log('[Main][youtube-download] Downloading from:', videoUrl.substring(0, 80))
    
    // Use yt-dlp to download the video
    const { spawn } = require('child_process')
    const path = require('path')
    const os = require('os')
    
    const downloadsPath = path.join(os.homedir(), 'Downloads')
    const outputTemplate = path.join(downloadsPath, `${title.replace(/[<>:"/\\|?*]/g, '_')}.%(ext)s`)
    
    return new Promise((resolve) => {
      try {
        const ytdlp = spawn('yt-dlp', [
          '-f', 'best',
          '-o', outputTemplate,
          videoUrl
        ], { stdio: ['ignore', 'pipe', 'pipe'] })

        let output = ''
        ytdlp.stdout.on('data', (data) => {
          output += data.toString()
        })

        ytdlp.stderr.on('data', (data) => {
          output += data.toString()
        })

        ytdlp.on('close', (code) => {
          if (code === 0) {
            console.log('[Main][youtube-download] Download successful')
            resolve({ ok: true, path: downloadsPath, message: 'Downloaded to ' + downloadsPath })
          } else {
            console.log('[Main][youtube-download] Download failed with code:', code)
            resolve({ error: 'Download failed', detail: output })
          }
        })

        ytdlp.on('error', (err) => {
          console.log('[Main][youtube-download] Error:', err.code)
          resolve({ error: 'yt-dlp not available', info: 'Install via: pip install yt-dlp', detail: String(err) })
        })

        // Safety timeout
        const timeout = setTimeout(() => {
          try { ytdlp.kill() } catch (e) {}
          resolve({ error: 'Download timeout' })
        }, 300000) // 5 minutes

      } catch (e) {
        console.error('[Main][youtube-download] Error:', String(e))
        resolve({ error: String(e) })
      }
    })
  } catch (e) {
    console.error('[Main][youtube-download] error:', String(e))
    return { error: String(e) }
  }
})

// Soulseek credentials storage using OS keychain (keytar)
const SOULSEEK_SERVICE = 'unwanted-tools-soulseek'

ipcMain.handle('soulseek-store-creds', async (event, creds = {}) => {
  if (!keytar) return { error: 'secure storage not available' }
  try {
    // store the whole creds object as JSON under a single account name
    const payload = JSON.stringify(creds || {})
    await keytar.setPassword(SOULSEEK_SERVICE, 'soulseek', payload)
    return { ok: true }
  } catch (e) {
    console.error('[Main][soulseek-store-creds] error:', e)
    return { error: String(e) }
  }
})

ipcMain.handle('soulseek-get-creds', async () => {
  if (!keytar) return { error: 'secure storage not available' }
  try {
    const payload = await keytar.getPassword(SOULSEEK_SERVICE, 'soulseek')
    if (!payload) return { ok: false }
    try {
      const obj = JSON.parse(payload)
      return { ok: true, creds: obj }
    } catch (e) {
      // fallback: return raw string as password field
      return { ok: true, creds: { password: payload } }
    }
  } catch (e) {
    console.error('[Main][soulseek-get-creds] error:', e)
    return { error: String(e) }
  }
})

ipcMain.handle('soulseek-delete-creds', async () => {
  if (!keytar) return { error: 'secure storage not available' }
  try {
    const deleted = await keytar.deletePassword(SOULSEEK_SERVICE, 'soulseek')
    return { ok: !!deleted }
  } catch (e) {
    console.error('[Main][soulseek-delete-creds] error:', e)
    return { error: String(e) }
  }
})

// Check whether registration is supported by the installed client library
ipcMain.handle('soulseek-can-register', async () => {
  try {
    if (soulseek && typeof soulseek.canRegister === 'function') return { ok: !!soulseek.canRegister() }
    return { ok: false }
  } catch (e) {
    return { error: String(e) }
  }
})

// Attempt to create/register an account using the client library (best-effort)
ipcMain.handle('soulseek-create-account', async (event, opts = {}) => {
  try {
    if (!soulseek || typeof soulseek.registerAccount !== 'function') return { error: 'registration_not_supported' }
    const res = await soulseek.registerAccount(opts)
    return res
  } catch (e) {
    console.error('[Main][soulseek-create-account] error:', e)
    return { error: String(e) }
  }
})

ipcMain.handle('soulseek-check-username', async (event, opts = {}) => {
  try {
    if (!soulseek || typeof soulseek.checkUsernameAvailable !== 'function') return { error: 'check_not_supported' }
    const res = await soulseek.checkUsernameAvailable(opts)
    return res
  } catch (e) {
    console.error('[Main][soulseek-check-username] error:', e)
    return { error: String(e) }
  }
})

// Desktop notifications on download complete (Windows/macOS/Linux)
ipcMain.on('show-notification', (event, { title, body, icon }) => {
  try {
    if (Notification.isSupported()) {
      const notification = new Notification({
        title: title || 'Unwanted Tools',
        body: body || 'Download completed',
        icon: icon || path.join(__dirname, '../build/icon.base64.txt')
      })
      notification.show()
    }
  } catch (e) {
    console.log('[Main] notification error:', e.message)
  }
})

// Video downloader handler (requires yt-dlp)
ipcMain.handle('download-video', async (event, opts = {}) => {
  const { url, destination } = opts
  console.log('[Main][download-video] received:', { url, destination: destination?.substring(0, 50) })
  
  try {
    if (!url) return { error: 'Missing URL' }
    if (!destination) return { error: 'Missing destination' }
    // For now, we'll return a message asking user to install it
    // If this is a YouTube URL and ytdl-core is available, use it (no external binary needed)
    const isYouTube = /(?:youtube\.com|youtu\.be)/i.test(url)
    if (isYouTube && ytdl) {
      try {
        const info = await ytdl.getInfo(url)
        const title = (info.videoDetails && info.videoDetails.title) ? info.videoDetails.title.replace(/[<>:\"/\\|?*]+/g,'_') : `video_${Date.now()}`
        const ext = opts.audioOnly ? 'webm' : 'mp4'
        const filename = `${title}.${ext}`
        const outPath = path.join(destination, filename)
        const ytdlOpts = opts.audioOnly ? { quality: 'highestaudio', filter: 'audioonly' } : { quality: 'highestvideo' }
        const stream = ytdl(url, ytdlOpts)
        const ws = fs.createWriteStream(outPath)
        stream.on('progress', (chunkLength, downloaded, total) => {
          try { if (mainWindow && mainWindow.webContents) mainWindow.webContents.send('download-video-progress', { type: 'progress', downloaded, total }) } catch (e) {}
        })
        stream.on('error', (err) => {
          try { if (mainWindow && mainWindow.webContents) mainWindow.webContents.send('download-video-complete', { ok: false, error: String(err) }) } catch (e) {}
        })
        stream.pipe(ws)
        return await new Promise((resolve) => {
          ws.on('finish', () => { try { if (mainWindow && mainWindow.webContents) mainWindow.webContents.send('download-video-complete', { ok: true, path: outPath }) } catch (e) {} ; resolve({ ok: true, path: outPath }) })
          ws.on('error', (e) => { try { if (mainWindow && mainWindow.webContents) mainWindow.webContents.send('download-video-complete', { ok: false, error: String(e) }) } catch (er) {} ; resolve({ error: String(e) }) })
        })
      } catch (e) {
        console.error('[Main][download-video][ytdl] error:', e)
        // fall through to yt-dlp logic
      }
    }

    const { spawn } = require('child_process')
    
      try {
        // Determine executable path: prefer bundled `yt-dlp` from yt-dlp-exec, then .bin shim, then system 'yt-dlp'
        const candidatesCheck = [
          path.join(__dirname, '..', 'node_modules', 'yt-dlp-exec', 'bin', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'),
          path.join(__dirname, '..', 'node_modules', '.bin', process.platform === 'win32' ? 'yt-dlp.cmd' : 'yt-dlp'),
          'yt-dlp'
        ]
        let exePath = 'yt-dlp'
        for (const c of candidatesCheck) {
          try { if (fs.existsSync(c)) { exePath = c; break } } catch (e) {}
        }

      return await new Promise((resolve) => {
        let checked = false

        const onAvailable = () => {
          if (checked) return
          checked = true
          // yt-dlp is available, proceed with download
          // Build yt-dlp args. Always use best quality. Support audio-only and playlist mode.
          const outputTemplate = path.join(destination, '%(title)s.%(ext)s')
          const args = ['-f', 'best', '-o', outputTemplate, url]

          // By default, download only single video (no playlist)
          // If user explicitly wants playlist, use --yes-playlist instead
          if (opts.downloadPlaylist) {
            args.push('--yes-playlist')
            args.push('-i') // ignore errors for missing videos in playlist
          } else {
            args.push('--no-playlist')
          }

          if (opts.audioOnly) {
            // extract audio and convert to mp3
            args.unshift('-x')
            args.push('--audio-format', 'mp3')
            // ensure filename extension is mp3 in template
          }

          let output = ''
          let errored = false
          let download
          try {
            // Spawn yt-dlp binary directly (bundled in node_modules or from system)
            // Prefer several local binary locations (yt-dlp-exec's bundled exe, .bin shims), then fallback to system 'yt-dlp'
            const candidates = [
              path.join(__dirname, '..', 'node_modules', 'yt-dlp-exec', 'bin', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'),
              path.join(__dirname, '..', 'node_modules', '.bin', process.platform === 'win32' ? 'yt-dlp.cmd' : 'yt-dlp'),
              'yt-dlp'
            ]
            let exe = 'yt-dlp'
            for (const c of candidates) {
              try { if (fs.existsSync(c)) { exe = c; break } } catch (e) {}
            }
            // If we have ffmpeg bundled, pass it to yt-dlp
            const ffmpegPath = getFFmpegPath()
            if (ffmpegPath && ffmpegPath !== 'ffmpeg') {
              args.push('--ffmpeg-location', ffmpegPath)
            }
            download = spawn(exe, args, { stdio: ['ignore', 'pipe', 'pipe'] })
          } catch (dErr) {
            return resolve({ error: 'Failed to spawn yt-dlp for download', detail: String(dErr) })
          }

          // Stream stdout/stderr lines to renderer so UI can show progress
          download.stdout.on('data', (data) => {
            const text = data.toString()
            output += text
            try { if (mainWindow && mainWindow.webContents) mainWindow.webContents.send('download-video-progress', { type: 'stdout', text }) } catch (e) {}
            console.log('[Main][download-video] stdout:', text.substring(0, 200))
          })

          download.stderr.on('data', (data) => {
            const text = data.toString()
            output += text
            try { if (mainWindow && mainWindow.webContents) mainWindow.webContents.send('download-video-progress', { type: 'stderr', text }) } catch (e) {}
          })

          download.on('error', (err) => {
            if (errored) return
            errored = true
            console.error('[Main][download-video] spawn error during download:', err && err.code, err && err.message)
            try { if (mainWindow && mainWindow.webContents) mainWindow.webContents.send('download-video-complete', { ok: false, error: String(err) }) } catch (e) {}
            return resolve({ error: 'yt-dlp spawn error', detail: String(err) })
          })

          download.on('close', (code) => {
            if (code === 0) {
              try { if (mainWindow && mainWindow.webContents) mainWindow.webContents.send('download-video-complete', { ok: true, message: 'Video downloaded' }) } catch (e) {}
              resolve({ ok: true, message: 'Video downloaded successfully' })
            } else {
              try { if (mainWindow && mainWindow.webContents) mainWindow.webContents.send('download-video-complete', { ok: false, error: output }) } catch (e) {}
              resolve({ error: 'Video download failed', detail: output })
            }
          })
        }

        // spawn the exePath with --version to verify availability
        let ytdlp = null
        try {
          ytdlp = spawn(exePath, ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] })
        } catch (err) {
          if (checked) return
          checked = true
          return resolve({ error: 'yt-dlp spawn failed', info: 'yt-dlp not installed or not in PATH', detail: String(err) })
        }

        ytdlp.on('error', (err) => {
          if (checked) return
          checked = true
          console.log('[Main][download-video] yt-dlp spawn error:', err && err.code)
          return resolve({ error: 'yt-dlp not installed or not in PATH', info: 'Install via: pip install yt-dlp OR choco install yt-dlp', detail: String(err) })
        })

        ytdlp.on('close', (code) => {
          if (checked) return
          if (code === 0) return onAvailable()
          checked = true
          return resolve({ error: 'yt-dlp not available (non-zero exit)', info: 'Ensure yt-dlp is installed and runnable from PATH' })
        })

        // safety timeout: if yt-dlp doesn't respond within 5s, assume missing
        const _t = setTimeout(() => {
          if (checked) return
          checked = true
          try { ytdlp.kill && ytdlp.kill() } catch (e) {}
          return resolve({ error: 'yt-dlp check timeout', info: 'yt-dlp did not respond; ensure it is installed and in PATH' })
        }, 5000)
      })
    } catch (e) {
      console.error('[Main][download-video] unexpected error:', e)
      // persist error to logs for easier debugging
      try { fs.mkdirSync(path.join(__dirname, '..', 'build', 'logs'), { recursive: true }) } catch (er) {}
      const logPath = path.join(__dirname, '..', 'build', 'logs', `download-video-error-${Date.now()}.log`)
      try { fs.writeFileSync(logPath, String(e.stack || e), 'utf8') } catch (er) {}
      try { if (mainWindow && mainWindow.webContents) mainWindow.webContents.send('download-video-complete', { ok: false, error: String(e), log: logPath }) } catch (er) {}
      return { error: 'download-video-unexpected', detail: String(e), log: logPath }
    }
  } catch (e) {
    console.error('[Main][download-video] error:', e)
    return { error: String(e) }
  }
})