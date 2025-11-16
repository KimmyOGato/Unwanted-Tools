import React, { useState } from 'react'
import { useLocale } from '../locales'

function humanSize(bytes) {
  if (!bytes && bytes !== 0) return ''
  const b = Number(bytes)
  if (b < 1024) return b + ' B'
  const units = ['KB', 'MB', 'GB']
  let i = -1
  let value = b
  while (value >= 1024 && i < units.length - 1) {
    value = value / 1024
    i++
  }
  return value.toFixed(i < 0 ? 0 : 1) + ' ' + (units[i] || 'GB')
}

function humanSpeed(sp) {
  if (!sp && sp !== 0) return ''
  // slsk reports speed as number; convert to KiB/s if big
  const n = Number(sp)
  if (n >= 1024) return (n / 1024).toFixed(2) + ' KiB/s'
  return n + ' B/s'
}

// Convert ISO country code (e.g. 'US', 'BR') to regional indicator emoji flag
function countryCodeToEmoji(code) {
  if (!code || typeof code !== 'string') return null
  const cc = code.trim().toUpperCase()
  if (cc.length !== 2) return null
  // Regional indicator symbols start at 0x1F1E6 for 'A'
  const first = cc.charCodeAt(0) - 0x41 + 0x1F1E6
  const second = cc.charCodeAt(1) - 0x41 + 0x1F1E6
  try {
    return String.fromCodePoint(first, second)
  } catch (e) {
    return null
  }
}

// Generate a small inline SVG data URL as a local "flag" for the country code.
// This avoids external CDN/CORS issues. The SVG is a simple colored rectangle
// with the 2-letter code overlaid. If you prefer real flags, replace with
// local PNG/SVG assets under `build/flags/` and map codes accordingly.
function getLocalFlagDataUrl(code) {
  if (!code || typeof code !== 'string') return null
  const cc = code.trim().toUpperCase().slice(0,2)
  if (cc.length !== 2) return null
  // Derive a stable hue from the two letters
  const h = (cc.charCodeAt(0) * 31 + cc.charCodeAt(1) * 17) % 360
  const bg = `hsl(${h} 60% 36%)`
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='16' viewBox='0 0 24 16'>` +
    `<rect width='24' height='16' fill='${bg}' rx='2'/>` +
    `<text x='50%' y='50%' font-family='Segoe UI, Roboto, Arial' font-size='9' fill='#fff' text-anchor='middle' dominant-baseline='central'>${cc}</text>` +
    `</svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

export default function SoulseekSearch({ locale: localeProp }) {
  const locale = localeProp || useLocale('pt-BR')
  const [host, setHost] = useState('server.slsknet.org')
  const [port, setPort] = useState(2242)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [credsLoaded, setCredsLoaded] = useState(false)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [results, setResults] = useState([])
  const [itemStatus, setItemStatus] = useState({})
  const [geoMap, setGeoMap] = useState({}) // map index -> country code
  const geoCacheRef = React.useRef({}) // ip -> country code cache
  const handedOffRef = React.useRef(new Set()) // filenames handed to Downloads UI
  // debug helpers removed for production

  // listen for download progress from main
  React.useEffect(() => {
    if (window.soulseekEvents && window.soulseekEvents.onDownloadProgress) {
      window.soulseekEvents.onDownloadProgress(({ filename, received }) => {
        // If this filename was handed off to the Downloads UI, ignore local updates
        if (handedOffRef.current.has(filename)) return
        // find index by filename
        const idx = results.findIndex(r => renderFilename(r) === filename)
        if (idx >= 0) {
          setItemStatus(s => ({ ...s, [idx]: { ...(s[idx] || {}), status: 'downloading', received } }))
        }
      })
    }
  }, [results])

  // Load saved Soulseek credentials from localStorage on mount
  React.useEffect(() => {
    ;(async () => {
      try {
        if (window.soulseek && window.soulseek.getCreds) {
          const res = await window.soulseek.getCreds()
          if (res && res.ok && res.creds) {
            const obj = res.creds
            if (obj.host) setHost(obj.host)
            if (obj.port) setPort(obj.port)
            if (obj.username) setUsername(obj.username)
            if (obj.password) setPassword(obj.password)
          }
        }
      } catch (e) {
        console.warn('[Soulseek] failed to load saved creds', e)
      } finally {
        setCredsLoaded(true)
      }
    })()
  }, [])

  // Persist credentials automatically when they change
  React.useEffect(() => {
    // wait until initial load to avoid overwriting
    if (!credsLoaded) return
    try {
      if (window.soulseek && window.soulseek.storeCreds) {
        const obj = { host, port, username, password }
        try {
          window.soulseek.storeCreds(obj).catch?.(() => {})
        } catch (e) {
          // ignore
        }
      }
    } catch (e) {
      console.warn('[Soulseek] failed to save creds', e)
    }
  }, [host, port, username, password, credsLoaded])

  const check = async () => {
    setStatus('Checking server...')
    const res = await window.soulseek.checkServer({ host, port })
    if (res && res.ok) setStatus('Server reachable')
    else setStatus('Server not reachable: ' + (res && res.error ? res.error : 'unknown'))
  }

  // Guess plausible registration URLs for the given host
  // Username checking and automatic registration helpers removed — unreliable across environments.

  // Account creation option removed — not supported reliably by clients.

  const doSearch = async () => {
    setStatus('Searching...')
    setResults([])
    setItemStatus({})
    try {
      const res = await window.soulseek.search({ host, port, username, password, query })
      if (res && res.items) {
        setResults(res.items)
        setStatus(`Found ${res.items.length} items`)
        // kick off geo resolution for results
        resolveGeoForResults(res.items)
      } else if (res && res.error) {
        setStatus('Error: ' + res.error + (res.message ? ' - ' + res.message : ''))
      } else setStatus('No results')
    } catch (e) {
      setStatus('Search failed: ' + String(e))
    }
  }

  // Resolve geo (country code) for items — use explicit fields or GeoIP lookup by IP
  const resolveGeoForResults = async (items) => {
    if (!Array.isArray(items) || items.length === 0) return
    const newMap = {}
    for (let i = 0; i < items.length; i++) {
      const r = items[i]
      const code = r.country || r.countryCode || r.country_code || r.cc || (r.location && r.location.countryCode)
      if (code && typeof code === 'string' && code.length >= 2) {
        newMap[i] = String(code).trim().toUpperCase().slice(0,2)
        continue
      }
      // try IP-like fields
      const ip = r.ip || r.peer || r.host || r.address || r.hostname || (r.location && r.location.ip)
      if (ip && typeof ip === 'string') {
        // check cache
        const cached = geoCacheRef.current[ip]
        if (cached) {
          newMap[i] = cached
          continue
        }
        // fetch country via ipapi.co (public, rate-limited)
        try {
          const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, { timeout: 8000 })
          if (res && res.ok) {
            const j = await res.json()
            const cc = j && (j.country || j.country_code || j.country_code_iso3 || j.country_name) ? (j.country || j.country_code || j.country_code_iso3) : null
            if (cc && typeof cc === 'string' && cc.length >= 2) {
              const cc2 = cc.trim().toUpperCase().slice(0,2)
              geoCacheRef.current[ip] = cc2
              newMap[i] = cc2
              continue
            }
          }
        } catch (e) {
          // ignore geo lookup failures
        }
      }
      // no code found — leave undefined
    }
    // merge into state
    setGeoMap(prev => ({ ...prev, ...newMap }))
  }

  const startDownload = async (item, idx) => {
    setItemStatus(s => ({ ...s, [idx]: { status: 'starting' } }))
    try {
      // Ask the user where to save the file
      const folder = await window.api.selectFolder()
      if (!folder) {
        setItemStatus(s => ({ ...s, [idx]: { status: 'cancelled' } }))
        return
      }

      // Build destination including filename. Detect path separator from folder.
      const filename = renderFilename(item) || `slsk_${Date.now()}`
      const sep = folder.includes('\\') ? '\\' : '/'
      const destination = folder.replace(/[\\/]+$/, '') + sep + filename

      // Enqueue the download so the Downloads tab shows the item.
      try {
        const id = `soulseek_${Date.now()}_${Math.floor(Math.random()*10000)}`
        window.dispatchEvent(new CustomEvent('enqueue-download', { detail: { id, archived: 'soulseek', folder, filename, external: true } }))
        // mark as handed off so the Soulseek UI does not show duplicate progress/errors
        handedOffRef.current.add(filename)
        setItemStatus(s => ({ ...s, [idx]: { status: 'handed-off' } }))
      } catch (e) { /* best-effort, continue */ }

      // Provide the full search-result object under `fileId` so the main
      // handler can normalize it reliably. The actual transfer is handled
      // by the main process (P2P); we keep the Downloads UI in sync via
      // emitted progress/complete events.
      const res = await window.soulseek.download({ fileId: item, destination, creds: { host, port, username, password } })
      if (res && res.ok) {
        setItemStatus(s => ({ ...s, [idx]: { status: 'completed', path: res.path || '', raw: res } }))
      } else {
        setItemStatus(s => ({ ...s, [idx]: { status: 'error', message: (res && res.message) || res.error || 'unknown', log: res && res.log, raw: res } }))
      }
    } catch (e) {
      setItemStatus(s => ({ ...s, [idx]: { status: 'error', message: String(e), raw: e } }))
    }
  }

  const renderFilename = (file) => {
    if (!file) return ''
    const raw = (file.file || file.path || file.name || '').toString()
    // remove leading @@ or @@user prefix
    return raw.replace(/^@@?/, '').split(/[\\/]/).pop()
  }

  return (
    <div className="soulseek-search">
      <div className="soulseek-header">
        <h3>Soulseek</h3>
        <div className="soulseek-conn">
          <input className="ss-input" value={host} onChange={(e) => setHost(e.target.value)} placeholder="host" />
          <input className="ss-input ss-port" value={port} onChange={(e) => setPort(Number(e.target.value || 0))} placeholder="port" />
        </div>
        <div className="soulseek-creds">
          <input className="ss-input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" />
          <input className="ss-input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="password" type="password" />
          {/* Username check removed */}
        </div>
        <div className="soulseek-searchbar">
          <input className="ss-input ss-query" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="search query" />
          <div className="soulseek-actions">
            <button className="btn" onClick={doSearch}>Search</button>
            <button className="btn btn-ghost" onClick={check}>Check</button>
          </div>
        </div>
        <div className="soulseek-status"><strong>Status:</strong> <span className="status-text">{status}</span></div>
      </div>

      <div className="soulseek-results">
        <table className="soulseek-table">
          <thead>
            <tr>
              <th>User</th>
              <th className="col-speed">Speed</th>
              <th className="col-slots">Slots</th>
              <th className="col-size">Size</th>
              <th>Filename</th>
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => (
              <tr key={i} className="soulseek-row">
                <td className="td-user">
                  {/* show flag image if resolved, fallback to emoji */}
                  {(() => {
                    const ccExplicit = r.country || r.countryCode || r.country_code || r.cc || (r.location && r.location.countryCode)
                    const ccState = geoMap[i]
                    const code = (ccExplicit && String(ccExplicit).trim().toUpperCase().slice(0,2)) || ccState || null
                    if (code) {
                      // prefer a local inline SVG data URL (stable, no external requests)
                      const dataUrl = getLocalFlagDataUrl(code)
                      if (dataUrl) {
                        return <img src={dataUrl} alt={code} className="flag-img" />
                      }
                    }
                    const emoji = countryCodeToEmoji(code)
                    return emoji ? <span className="flag-icon" aria-hidden>{emoji}</span> : null
                  })()}
                  <span className="user-name">{r.user || r.username || ''}</span>
                </td>
                <td className="td-speed">{humanSpeed(r.speed || r.upload || '')}</td>
                <td className="td-slots">{r.slots ? 'Yes' : 'No'}</td>
                <td className="td-size">{humanSize(r.size)}</td>
                <td className="td-file">{renderFilename(r)}</td>
                <td className="td-actions">
                  <div className="action-wrap">
                    {/* Determine availability: prefer explicit flags, fallback to slots truthiness */}
                    {(() => {
                      const avail = !!(r.available || r.open || (typeof r.slots !== 'undefined' && !!r.slots))
                      return (
                        <div className={`availability ${avail ? 'available' : 'unavailable'}`} title={avail ? (locale.available || 'Available for download') : (locale.unavailable || 'Not available') }>
                          <span className="avail-dot" />
                          <span className="avail-text">{avail ? (locale.available || 'Available') : (locale.unavailable || 'Unavailable')}</span>
                        </div>
                      )
                    })()}

                    <button className="btn" onClick={() => startDownload(r, i)} disabled={!(r.available || r.open || (typeof r.slots !== 'undefined' && !!r.slots))}>Download</button>
                    <div className="item-status">{(itemStatus[i] && itemStatus[i].status && itemStatus[i].status !== 'handed-off') ? itemStatus[i].status : ''}{itemStatus[i] && itemStatus[i].message ? ` — ${itemStatus[i].message}` : ''}</div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Debug modal removed in production build */}
    </div>
  )
}

// Debug modal component appended to module
function DebugModal({ open, payload, onClose }) {
  if (!open) return null
  return (
    <div style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div style={{ width: '80%', maxHeight: '80%', overflow: 'auto', background: '#111', color: '#eee', padding: 16, borderRadius: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <strong>Debug</strong>
          <button onClick={onClose}>Close</button>
        </div>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{JSON.stringify(payload, null, 2)}</pre>
      </div>
    </div>
  )
}


// Debug modal rendered at end of file
