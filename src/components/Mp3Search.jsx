import React, { useState } from 'react'
import Player from './Player'

export default function Mp3Search() {
  const [artist, setArtist] = useState('')
  const [song, setSong] = useState('')
  const [genre, setGenre] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  const handleSearch = async () => {
    setLoading(true)
    try {
      const res = await window.searchApi.searchMp3({ artist, song, genre })
      if (res.error) {
        alert('Error: ' + res.error)
        setResults([])
      } else {
        setResults(res.items || [])
      }
    } catch (e) {
      alert(String(e))
    }
    setLoading(false)
  }

  const handlePlay = (url) => {
    (async () => {
      try {
        // Probe the resource first to see if it's a direct audio file or an HTML page that needs interaction
        let probe = null
        try {
          probe = await window.api.probeResource({ url })
          console.log('[Mp3Search] Probe result:', probe)
        } catch (probeErr) {
          console.error('[Mp3Search] Probe error (will attempt direct play):', probeErr)
        }

        let playableUrl = url
        if (probe && !probe.error) {
          if (probe.type === 'audio' && probe.url) playableUrl = probe.url
          else if (probe.type === 'html' && probe.needsInteraction) {
            // Page likely requires clicking a "load" button — ask user to open externally or download
            if (confirm('This link appears to be a webpage that requires a "Load" button to initialize audio. Open the page in your browser to activate it? (Or cancel to download and play locally)')) {
              await window.api.openExternal(url)
              return
            } else {
              // user chose to download instead — download and play locally
              await handleDownloadAndPlay(playableUrl)
              return
            }
          }
        }

        const audio = new Audio()
        let handled = false

        const onError = (ev) => {
          if (handled) return
          handled = true
          console.error('Audio load/play error', ev)
          audio.pause()
          audio.src = ''
          if (confirm('Playback failed in the renderer (unsupported source or CORS). Download the file and play locally instead?')) {
            handleDownloadAndPlay(playableUrl)
          }
        }

        const onCanPlay = () => {
          audio.removeEventListener('error', onError)
        }

        audio.addEventListener('error', onError)
        audio.addEventListener('canplay', onCanPlay)
        audio.src = playableUrl
        const p = audio.play()
        if (p && p.catch) p.catch(err => {
          if (handled) return
          handled = true
          console.error('Playback promise rejected', err)
          if (confirm('Playback failed in the renderer. Download the file and play locally instead?')) {
            handleDownloadAndPlay(playableUrl)
          }
        })
      } catch (e) {
        console.error('Play error', e)
        if (confirm('Playback failed. Download the file and play locally instead?')) {
          handleDownloadAndPlay(url)
        }
      }
    })()
  }

  const handleDownloadAndPlay = async (url) => {
    // Enqueue the download and request play after completion
    const folder = await window.api.selectFolder()
    if (!folder) return
    const filename = url.split('/').pop()
    const id = `${Date.now()}_${Math.random().toString(36).slice(2,8)}`
    window.dispatchEvent(new CustomEvent('enqueue-download', { detail: { id, archived: url, folder, filename, playAfter: true } }))
    alert('Download queued and will play when complete')
  }

  const handleDownload = async (it) => {
    const folder = await window.api.selectFolder()
    if (!folder) return
    const filename = it.title || it.url.split('/').pop()
    const id = `${Date.now()}_${Math.random().toString(36).slice(2,8)}`
    // enqueue for UI
    window.dispatchEvent(new CustomEvent('enqueue-download', { detail: { id, archived: it.url, folder, filename } }))
    alert('Download queued (check status)')
  }

  return (
    <div className="mp3-search">
      <h3>MP3 Search</h3>
      <div className="controls">
        <input placeholder="Artist" value={artist} onChange={e => setArtist(e.target.value)} />
        <input placeholder="Song" value={song} onChange={e => setSong(e.target.value)} />
        <input placeholder="Genre" value={genre} onChange={e => setGenre(e.target.value)} />
        <button onClick={handleSearch} disabled={loading}>{loading ? 'Searching...' : 'Search'}</button>
      </div>

      <div className="results-list">
        <h4>Results ({results.length})</h4>
        <ul>
          {results.map((it, idx) => {
            // Try to show a short friendly URL and domain
            let display = it.url || ''
            try {
              const u = new URL(it.url)
              display = `${u.hostname}${u.pathname}`
            } catch (e) {}
            return (
              <li key={idx} className="mp3-item">
                <div className="res-left">
                  <div className="res-title"><a href="#" onClick={(e) => { e.preventDefault(); window.api.openExternal(it.url) }}>{it.title || display.split('/').pop() || 'Unknown'}</a></div>
                  <div className="res-meta" title={it.url}>{display}</div>
                </div>
                <div className="res-right">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Player src={it.url} />
                  </div>
                  <div className="res-actions">
                    <button onClick={() => handleDownload(it)}>Download</button>
                    <button className="site" onClick={() => window.api.openExternal(it.url)}>Site</button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
