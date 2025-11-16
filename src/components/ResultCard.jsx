import { useState } from 'react'
import Player from './Player'
import Modal from './Modal'

export default function ResultCard({ item, isSelected, onToggle, locale }) {
  const [showPreview, setShowPreview] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [modalImgLoaded, setModalImgLoaded] = useState(false)
  const [modalImgError, setModalImgError] = useState(false)
  const isImage = item.mimetype?.startsWith('image/')
  const isAudio = item.mimetype?.startsWith('audio/')
  const isVideo = item.mimetype?.startsWith('video/')

  const handleOpen = (url) => {
    try { window.api.openExternal(url) } catch (e) { window.open(url, '_blank') }
  }

  const handleDownload = async () => {
    try {
      const folder = await window.api.selectFolder()
      if (!folder) return
      const filename = `${item.timestamp || Date.now()}_${item.original.split('/').pop()}`
      const id = `${Date.now()}_${Math.random().toString(36).slice(2,8)}`
      window.dispatchEvent(new CustomEvent('enqueue-download', { detail: { id, archived: item.archived, folder, filename, groupTitle: item.groupTitle, groupYear: item.groupYear } }))
      alert('Download queued (check status)')
    } catch (e) {
      alert('Download failed: ' + String(e))
    }
  }

  return (
    <div className={`result-card ${isSelected ? 'selected' : ''}`}>
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onToggle}
        className="checkbox"
      />

      {isImage && (
        <>
          {!imgLoaded && !imgError && (
            <div className="thumbnail-placeholder" />
          )}
          {imgError && (
            <div className="thumbnail-placeholder broken">Preview unavailable</div>
          )}

          <img
            src={item.archived}
            alt="thumbnail"
            className="thumbnail"
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
            onClick={() => { if (!imgError) { setModalImgLoaded(false); setModalImgError(false); setShowPreview(true); } }}
          />
        </>
      )}

      {(isAudio || isVideo) && (
        <div className="media-preview">
          {isAudio && (
            <Player src={item.archived} />
          )}
          {isVideo && (
            <video controls style={{ width: '100%', height: '140px' }}>
              <source src={item.archived} type={item.mimetype} />
            </video>
          )}
        </div>
      )}

      <div className="card-title">{item.mimetype || 'unknown'} — {item.original.slice(-50)}</div>
      <div className="card-date">{item.timestamp}</div>

      <div className="card-actions">
        <button onClick={handleDownload}>Download</button>
        <button onClick={() => handleOpen(item.archived)}>Site</button>
      </div>

      {showPreview && isImage && (
        <Modal onClose={() => setShowPreview(false)}>
          <div style={{ minWidth: 200, minHeight: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {!modalImgLoaded && !modalImgError && (
              <div className="modal-spinner">Loading…</div>
            )}
            {modalImgError && (
              <div style={{ color: 'var(--muted)' }}>Failed to load image</div>
            )}
            <img
              src={item.archived}
              alt="full-size"
              style={{ maxWidth: '90vw', maxHeight: '90vh', display: modalImgLoaded ? 'block' : 'none' }}
              onLoad={() => setModalImgLoaded(true)}
              onError={() => setModalImgError(true)}
            />
          </div>
        </Modal>
      )}
    </div>
  )
}