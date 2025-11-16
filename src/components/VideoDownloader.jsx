import React, { useState, useEffect, useRef } from 'react'

export default function VideoDownloader({ locale = {} }) {
  const t = locale
  const [url, setUrl] = useState('')
  const [audioOnly, setAudioOnly] = useState(false)
  const [downloadPlaylist, setDownloadPlaylist] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [status, setStatus] = useState('')
  const [progress, setProgress] = useState({ percent: 0, speed: '', eta: '', total: '' })
  const logRef = useRef(null)
  const [showLogs, setShowLogs] = useState(false)
  const [logs, setLogs] = useState([])

  const handleDownload = async () => {
    if (!url.trim()) return alert('Cole uma URL válida')
    
    setDownloading(true)
    setStatus(t.video_downloading || 'Downloading video...')
    setLogs([])
    setProgress({ percent: 0, speed: '', eta: '', total: '' })
    
    try {
      const folder = await window.api.selectFolder()
      if (!folder) {
        setDownloading(false)
        setStatus('')
        return
      }

      // Send to main process to handle video download
      const res = await window.api.downloadVideo({
        url: url.trim(),
        audioOnly,
        downloadPlaylist,
        destination: folder
      })

      if (res && res.ok) {
        setStatus('✅ Download concluído!')
        setUrl('')
        setTimeout(() => setStatus(''), 3000)
      } else {
        const msg = (res?.error ? `${res.error}` : 'Erro desconhecido') + (res?.detail ? ` — ${res.detail.substring(0, 100)}` : '')
        setStatus('❌ ' + msg)
      }
    } catch (e) {
      setStatus('❌ Erro: ' + String(e))
    }
    setDownloading(false)
  }

  useEffect(() => {
    // register video download log listeners
    try {
      if (window.api && typeof window.api.onVideoDownloadProgress === 'function') {
        window.api.onVideoDownloadProgress((data) => {
          const line = (data && data.text) ? data.text : ''
          if (line) {
            setLogs(prev => {
              const newArr = prev.concat(line)
              return newArr.slice(-500)
            })
            // try to parse progress info from yt-dlp stdout
            try {
              const txt = String(line)
              const pctMatch = txt.match(/([0-9]{1,3}(?:\.[0-9]+)?)%/) || txt.match(/\[download\]\s+([0-9]{1,3}(?:\.[0-9]+)?)%/i)
              const etaMatch = txt.match(/ETA\s*([0-9:\.]+)/i)
              const speedMatch = txt.match(/at\s*([0-9\.A-Za-z\/]+\/s)/i)
              const totalMatch = txt.match(/of\s*([0-9\.]+\s*[KMGT]i?B)/i)
              setProgress(prev => ({
                percent: pctMatch ? Math.min(100, parseFloat(pctMatch[1])) : prev.percent,
                speed: speedMatch ? speedMatch[1] : prev.speed,
                eta: etaMatch ? etaMatch[1] : prev.eta,
                total: totalMatch ? totalMatch[1] : prev.total
              }))
            } catch (e) {}
          }
        })
      }
    } catch (e) {}

    try {
      if (window.api && typeof window.api.onVideoDownloadComplete === 'function') {
        window.api.onVideoDownloadComplete((data) => {
          if (data && data.ok) setStatus('✅ Download concluído!')
          else if (data && data.error) setStatus('❌ Erro: ' + (data.error || data.message || 'unknown'))
          setDownloading(false)
        })
      }
    } catch (e) {}
  }, [])

  useEffect(() => {
    if (logRef.current && showLogs) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [logs, showLogs])

  return (
    <div className="video-downloader-container">
      <div className="video-downloader-card">
        <h3>🎬 {t.video_downloader || 'Baixar Vídeo'}</h3>
        
        <input
          type="text"
          placeholder={t.paste_video_url || 'Cola a URL aqui (YouTube, TikTok, etc)'}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={downloading}
          className="video-url-input"
        />
        
        <div className="video-options-row">
          <label className="video-checkbox">
            <input
              type="checkbox"
              checked={audioOnly}
              onChange={(e) => setAudioOnly(e.target.checked)}
              disabled={downloading}
            />
            <span>🎵 {t.audio_only || 'Só áudio (MP3)'}</span>
          </label>
          
          <label className="video-checkbox">
            <input
              type="checkbox"
              checked={downloadPlaylist}
              onChange={(e) => setDownloadPlaylist(e.target.checked)}
              disabled={downloading}
            />
            <span>📋 {t.download_playlist || 'Playlist inteira'}</span>
          </label>
        </div>

        <button 
          onClick={handleDownload} 
          disabled={downloading || !url.trim()}
          className="btn btn-primary btn-lg"
        >
          {downloading ? '⏳ ' + (t.video_downloading || 'Baixando...') : '⬇️ Baixar'}
        </button>

        {status && (
          <div className={`video-status-box ${status.includes('✅') ? 'success' : 'error'}`}>
            {status}
          </div>
        )}

        {downloading && (
          <div className="video-progress-section">
            <div className="progress-container">
              <div className="progress-bar-bg">
                <div 
                  className="progress-bar-fill" 
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <div className="progress-text">
                <span className="percent">{progress.percent ? `${Math.round(progress.percent)}%` : '0%'}</span>
                {progress.speed && <span className="speed">{progress.speed}</span>}
                {progress.eta && <span className="eta">ETA: {progress.eta}</span>}
                {progress.total && <span className="total">{progress.total}</span>}
              </div>
            </div>
            
            <button 
              onClick={() => setShowLogs(!showLogs)}
              className="btn-toggle-logs"
            >
              {showLogs ? '🔽 Ocultar detalhes' : '🔼 Ver detalhes'}
            </button>

            {showLogs && (
              <div className="video-logs" ref={logRef}>
                {logs.length === 0 ? (
                  <div className="log-empty">Processando...</div>
                ) : (
                  logs.map((log, i) => (
                    <div key={i} className="log-line">
                      {log}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
