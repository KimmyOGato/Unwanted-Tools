import React from 'react'

export default function DownloadStatusBar({ downloads, locale = {} }) {
  const t = locale || {}

  if (!downloads || Object.keys(downloads).length === 0) {
    return null
  }

  const downloadEntries = Object.entries(downloads)
  const totalDownloads = downloadEntries.length
  const completedDownloads = downloadEntries.filter(([_, d]) => d.status === 'completed').length
  const failedDownloads = downloadEntries.filter(([_, d]) => d.status === 'failed').length
  const activeDownloads = downloadEntries.filter(([_, d]) => d.status === 'downloading').length

  return (
    <div className="download-status-bar">
      <div className="download-status-container">
        {/* Summary */}
        <div className="download-summary">
          <div className="summary-item">
            <span className="label">{t.active || 'Active'}:</span>
            <span className="value active">{activeDownloads}</span>
          </div>
          <div className="summary-item">
            <span className="label">{t.completed || 'Completed'}:</span>
            <span className="value completed">{completedDownloads}</span>
          </div>
          {failedDownloads > 0 && (
            <div className="summary-item">
              <span className="label">{t.failed || 'Failed'}:</span>
              <span className="value failed">{failedDownloads}</span>
            </div>
          )}
        </div>

        {/* Individual Downloads */}
        <div className="downloads-list">
          {downloadEntries.map(([id, download]) => (
            <div key={id} className={`download-item ${download.status}`}>
              <div className="download-info">
                <div className="download-name">{download.name}</div>
                <div className="download-details">
                  {download.status === 'downloading' && (
                    <>
                      <span className="status-text">{download.progress || 0}%</span>
                      <span className="divider">•</span>
                      <span className="speed">{download.speed || ''}</span>
                      {download.eta && (
                        <>
                          <span className="divider">•</span>
                          <span className="eta">{download.eta}</span>
                        </>
                      )}
                    </>
                  )}
                  {download.status === 'completed' && (
                    <span className="status-text success">✓ {t.completed || 'Completed'}</span>
                  )}
                  {download.status === 'failed' && (
                    <span className="status-text error">✗ {t.failed || 'Failed'}</span>
                  )}
                </div>
              </div>

              {download.status === 'downloading' && (
                <div className="progress-bar-wrapper">
                  <div className="progress-bar-bg">
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${Math.min(100, download.progress || 0)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
