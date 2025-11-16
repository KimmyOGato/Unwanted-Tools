import React, { useEffect, useState } from 'react'

export default function UpdaterPrompt({ locale = {} }) {
  const [availableInfo, setAvailableInfo] = useState(null)
  const [downloadedInfo, setDownloadedInfo] = useState(null)
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState({ percent: 0, transferred: 0, total: 0 })
  const [checking, setChecking] = useState(false)
  const [autoCheckDone, setAutoCheckDone] = useState(false)

  useEffect(() => {
    if (!window.updater) return
    const onAvail = (info) => setAvailableInfo(info)
    const onDownloaded = (info) => setDownloadedInfo(info)
    const onError = (err) => setError(err)
    const onProgress = (p) => {
      const percent = Math.round((p.percent || 0) * 100) / 100
      const transferred = p.transferred || 0
      const total = p.total || 0
      const bytesPerSecond = p.bytesPerSecond || p.bytesPerSecond === 0 ? p.bytesPerSecond : null
      const eta = (bytesPerSecond && total > transferred) ? Math.round((total - transferred) / bytesPerSecond) : null
      setProgress({ percent, transferred, total, bytesPerSecond, eta })
    }

    window.updater.onUpdateAvailable(onAvail)
    window.updater.onUpdateDownloaded(onDownloaded)
    window.updater.onUpdateError(onError)
    if (window.updater.onUpdateDownloadProgress) window.updater.onUpdateDownloadProgress(onProgress)

    // Auto-check for updates on app start
    if (!autoCheckDone) {
      setAutoCheckDone(true)
      setTimeout(() => {
        checkNow()
      }, 2000) // Check after 2 seconds to let app load first
    }

    return () => {
      // no-op: preload listeners are simple and not removed here
    }
  }, [autoCheckDone])

  const checkNow = async () => {
    if (!window.updater) return
    setChecking(true)
    try {
      await window.updater.checkForUpdates()
    } catch (e) {
      console.log('Check for updates error (may be normal in dev):', e)
    }
    setChecking(false)
  }

  const doDownload = async () => {
    if (!window.updater) return
    try {
      await window.updater.downloadUpdate()
    } catch (e) {
      setError(String(e))
    }
  }

  const doCancel = async () => {
    if (!window.updater || !window.updater.cancelDownload) {
      setError('Cancel not supported on this platform')
      return
    }
    try {
      const res = await window.updater.cancelDownload()
      if (res && res.ok) {
        // reset progress and dismiss available prompt
        setProgress({ percent: 0, transferred: 0, total: 0 })
        setAvailableInfo(null)
      } else {
        setError(res && res.error ? res.error : 'Cancel failed')
      }
    } catch (e) {
      setError(String(e))
    }
  }

  const doInstall = async () => {
    if (!window.updater) return
    try {
      // Backup user data before updating
      const backup = await window.updater.backupUserData()
      console.log('[UpdaterPrompt] User data backed up:', backup)
      // Now install - data will be restored automatically by the new app version
      await window.updater.installUpdate()
    } catch (e) {
      setError(String(e))
    }
  }

  const t = locale
  return (
    <div>
      {/* Check for updates button - header position */}
      <div className="updater-check-button">
        <button 
          onClick={checkNow} 
          disabled={checking}
          className="btn-check-updates"
          title={t.check_updates_button || 'Check for updates'}
        >
          {checking ? '⟳ ' : '🔄 '}{t.check_updates_button || 'Check for updates'}
        </button>
      </div>

      {/* Modal: update available */}
      {availableInfo && !downloadedInfo && (
        <div className="update-modal-overlay">
          <div className="update-modal-card">
            <div className="update-modal-header">
              <h3>📦 {t.update_available_title || 'Nova versão disponível'}</h3>
              <button 
                className="modal-close-btn"
                onClick={() => setAvailableInfo(null)}
              >
                ✕
              </button>
            </div>
            
            <div className="update-modal-body">
              <p className="update-version-text">
                {t.update_available_message ? t.update_available_message.replace('{version}', availableInfo?.version) : `Versão ${availableInfo?.version} está disponível!`}
              </p>
              
              {progress && progress.total > 0 && (
                <div className="update-progress-container">
                  <div className="update-progress-bar">
                    <div 
                      className="update-progress-fill" 
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                  <div className="update-progress-text">
                    <span>{progress.percent}%</span>
                    <span>{Math.round(progress.transferred/1024)} KB / {Math.round(progress.total/1024)} KB</span>
                    {progress.bytesPerSecond && <span>{Math.round(progress.bytesPerSecond/1024)} KB/s</span>}
                    {progress.eta && <span>ETA: {progress.eta}s</span>}
                  </div>
                </div>
              )}
            </div>

            <div className="update-modal-footer">
              <button 
                className="btn btn-primary"
                onClick={doDownload}
                disabled={progress.percent > 0 && progress.percent < 100}
              >
                {progress.percent > 0 && progress.percent < 100 ? '⬇️ Baixando...' : '⬇️ Baixar'}
              </button>
              {progress.transferred > 0 && progress.percent < 100 && (
                <button 
                  className="btn btn-secondary"
                  onClick={doCancel}
                >
                  ⛔ Cancelar
                </button>
              )}
              <button 
                className="btn btn-ghost"
                onClick={() => setAvailableInfo(null)}
              >
                Depois
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: downloaded and ready to install */}
      {downloadedInfo && (
        <div className="update-modal-overlay">
          <div className="update-modal-card update-ready">
            <div className="update-modal-header">
              <h3>✅ {t.update_ready_title || 'Atualização pronta'}</h3>
            </div>
            
            <div className="update-modal-body">
              <p className="update-version-text">
                {t.update_ready_message ? t.update_ready_message.replace('{version}', downloadedInfo?.version) : `Versão ${downloadedInfo?.version} foi baixada e está pronta para instalar.`}
              </p>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', marginTop: '12px' }}>
                O aplicativo será reiniciado para completar a atualização.
              </p>
            </div>

            <div className="update-modal-footer">
              <button 
                className="btn btn-primary"
                onClick={doInstall}
              >
                🚀 Instalar e Reiniciar
              </button>
              <button 
                className="btn btn-ghost"
                onClick={() => setDownloadedInfo(null)}
              >
                Depois
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error notification */}
      {error && (
        <div className="update-error-notification">
          <span>⚠️ Erro:</span> {String(error)}
        </div>
      )}
    </div>
  )
}
