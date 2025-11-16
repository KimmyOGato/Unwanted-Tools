export default function DownloadStatus({ queue, status, locale }) {
  return (
    <div className="download-status">
      <h3>{locale.status}</h3>
      <div className="queue">
        {queue.map((item) => {
          const s = status[item.filename] || { status: 'queued' }
          return (
            <div key={item.id} className={`queue-item ${s.status}`}>
              <div className="queue-filename">{item.filename}</div>
              <div className="queue-status">{locale[s.status] || s.status}</div>
              {s.status === 'downloading' && s.total > 0 && (
                <div className="queue-progress">
                  <div className="progress-bar" style={{ width: `${(s.received / s.total) * 100}%` }} />
                  <span className="progress-text">{Math.round((s.received / s.total) * 100)}%</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}