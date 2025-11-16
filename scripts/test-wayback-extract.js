const fetch = require('node-fetch')
const cheerio = require('cheerio')

const input = process.argv[2]
if (!input) {
  console.error('Usage: node test-wayback-extract.js <wayback-url>')
  process.exit(1)
}

function parseWaybackInput(input) {
  try {
    const u = new URL(input)
    if (u.hostname.includes('web.archive.org')) {
      const m = (u.pathname || '').match(/^\/web\/([^/]+)\/(.+)$/)
      if (m) {
        const stamp = m[1] === '*' ? null : m[1]
        let rest = m[2]
        rest = rest.startsWith('http') ? rest : 'http://' + rest
        return { original: rest, stamp }
      }
    }
    return { original: input, stamp: null }
  } catch (e) {
    return { original: input, stamp: null }
  }
}

async function probeHead(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', timeout: 8000 })
    if (res && res.ok) {
      const ct = res.headers.get('content-type')
      if (ct) return { url, status: res.status, contentType: ct }
      // fallback to GET if HEAD didn't provide content-type
    }
  } catch (e) {
    // HEAD failed or blocked — we'll try GET below
  }
  try {
    const r2 = await fetch(url, { method: 'GET', timeout: 10000 })
    if (!r2.ok) return { url, status: r2.status, contentType: null }
    return { url, status: r2.status, contentType: r2.headers.get('content-type') }
  } catch (e) {
    return { url, status: null, contentType: null, error: String(e) }
  }
}

async function extract(waybackUrl) {
  const { original, stamp } = parseWaybackInput(waybackUrl)
  if (!stamp) {
    console.error('Please provide a Wayback URL with a timestamp')
    process.exit(2)
  }
  const archivedPage = `https://web.archive.org/web/${stamp}/${original}`
  console.log('Fetching archived page:', archivedPage)
  const res = await fetch(archivedPage, { timeout: 20000 })
  console.log('Status:', res.status)
  const text = await res.text()
  const $ = cheerio.load(text)

  const candidates = new Set()
  const push = (link) => { try { const abs = new URL(link, original).toString(); candidates.add(abs) } catch(e){} }

  $('img[src], img[data-src]').each((i, el) => push($(el).attr('src') || $(el).attr('data-src')))
  $('audio source[src], audio[src], video source[src], video[src]').each((i, el) => push($(el).attr('src')))
  $('a[href]').each((i, el) => {
    const href = $(el).attr('href')
    if (!href) return
    const lower = href.toLowerCase()
    if (lower.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg|mp3|ogg|m4a|wav|mp4|mov)(\?|$)/) || lower.includes('media') || lower.includes('files')) {
      push(href)
    }
  })
  $('[data-src], [data-href], [data-url]').each((i, el) => push($(el).attr('data-src') || $(el).attr('data-href') || $(el).attr('data-url')))
  $('*[style]').each((i, el) => {
    const st = $(el).attr('style') || ''
    const m = st.match(/background-image:\s*url\(['"]?([^'\")]+)['"]?\)/i)
    if (m && m[1]) push(m[1])
  })

  const arr = Array.from(candidates)
  console.log('Found', arr.length, 'candidate URLs')
  if (arr.length > 0) {
    console.log('Candidates:')
    arr.forEach((u) => console.log('-', u))
  }

  // Normalize candidates to Wayback archived URLs (prefer any embedded stamp)
  const normalizeToArchived = (cand) => {
    try {
      // If already a web.archive.org URL, return as-is
      if (cand.includes('web.archive.org')) return cand
      // Try to extract embedded /web/<stamp>.../<original> pattern
      const m = cand.match(/\/web\/(\d+)[^\/]*\/(https?:\/\/.+)$/)
      if (m) {
        return `https://web.archive.org/web/${m[1]}/${m[2]}`
      }
      // Otherwise, if we have the main stamp, use it
      if (stamp && stamp !== '*') {
        return `https://web.archive.org/web/${stamp}/${cand}`
      }
      // Fallback: use wildcard capture on web.archive.org
      return `https://web.archive.org/web/*/${cand}`
    } catch (e) {
      return `https://web.archive.org/web/*/${cand}`
    }
  }

  const archivedCandidates = arr.map(a => normalizeToArchived(a))
  console.log('Archived candidates:')
  archivedCandidates.forEach(u => console.log('-', u))

  // Probe first 150 (or all if fewer)
  const toProbe = archivedCandidates.slice(0, 150)
  const concurrency = 6
  const results = []
  for (let i=0;i<toProbe.length;i+=concurrency) {
    const slice = toProbe.slice(i, i+concurrency)
    const resArr = await Promise.all(slice.map(u => probeHead(u)))
    results.push(...resArr)
  }

  console.log('\nProbe results:')
  results.forEach(r => console.log('-', r.status, r.contentType, r.url, r.error ? `ERR:${r.error}` : ''))

  // Only keep those with content-type image/audio/video
  const keep = results.filter(r => r && r.contentType && /(image|audio|video)\//.test(r.contentType))
  console.log('\nConfirmed media items:', keep.length)
  for (const k of keep) console.log(k.contentType, k.url)
}

extract(input).catch(e=>{console.error(e); process.exit(3)})
