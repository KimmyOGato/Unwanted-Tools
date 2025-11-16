import React, { useState, useRef } from 'react'
import '../styles/YouTubeVideoFinder.css'

export default function YouTubeVideoFinder({ locale }) {
  const t = locale || {}
  const [searchTerm, setSearchTerm] = useState('')
  const [searchType, setSearchType] = useState('video') // 'video', 'channel', 'term'
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedResult, setSelectedResult] = useState(null)
  const resultsRef = useRef(null)

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      setError(t.youtube_error_empty_search || 'Por favor insira o que procura')
      return
    }

    setLoading(true)
    setError('')
    setResults([])

    try {
      console.log('[YouTubeVideoFinder] Searching for:', searchTerm, 'type:', searchType)
      
      let response
      if (searchType === 'video') {
        // Busca por ID de vídeo específico
        response = await window.api.findDeletedYoutubeVideo(searchTerm.trim())
      } else {
        // Busca por termo genérico (nome, canal, etc)
        response = await window.api.searchYoutubeByTerm(searchTerm.trim(), searchType)
      }
      
      if (response.error) {
        setError(response.error)
        setResults([])
      } else if (response.videos && response.videos.length > 0) {
        setResults(response.videos)
        console.log('[YouTubeVideoFinder] Found', response.videos.length, 'video(s)')
      } else {
        setError(t.youtube_no_results || 'Nenhum vídeo encontrado')
        setResults([])
      }
    } catch (err) {
      setError(t.youtube_search_error || 'Erro ao buscar: ' + err.message)
      console.error('[YouTubeVideoFinder] Error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const handleDownload = async (videoData) => {
    try {
      setError('')
      console.log('[YouTubeVideoFinder] Downloading from:', videoData.url.substring(0, 80))
      
      const response = await window.api.downloadYoutubeVideo(videoData.url, videoData.title || 'video')
      
      if (response.error) {
        setError(response.error)
      } else {
        setError(t.youtube_download_success || 'Download iniciado: ' + response.path)
        setTimeout(() => setError(''), 5000)
      }
    } catch (err) {
      setError(t.youtube_download_error || 'Erro ao baixar: ' + err.message)
      console.error('[YouTubeVideoFinder] Download error:', err)
    }
  }

  return (
    <div className="youtube-video-finder">
      <div className="yvf-header">
        <h2>{t.youtube_finder_title || '🎥 Encontrar Vídeos Deletados'}</h2>
        <p className="yvf-subtitle">{t.youtube_finder_subtitle || 'Procure por vídeos do YouTube deletados na Wayback Machine'}</p>
      </div>

      <div className="yvf-search-section">
        <div className="yvf-search-options">
          <label className="yvf-option">
            <input
              type="radio"
              value="term"
              checked={searchType === 'term'}
              onChange={(e) => setSearchType(e.target.value)}
            />
            <span>{t.youtube_search_by_name || 'Por Nome/Termo'}</span>
          </label>
          <label className="yvf-option">
            <input
              type="radio"
              value="channel"
              checked={searchType === 'channel'}
              onChange={(e) => setSearchType(e.target.value)}
            />
            <span>{t.youtube_search_by_channel || 'Por Canal'}</span>
          </label>
          <label className="yvf-option">
            <input
              type="radio"
              value="video"
              checked={searchType === 'video'}
              onChange={(e) => setSearchType(e.target.value)}
            />
            <span>{t.youtube_search_by_id || 'Por ID de Vídeo'}</span>
          </label>
        </div>

        <div className="yvf-input-group">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={
              searchType === 'video' 
                ? t.youtube_placeholder_id || 'ID do vídeo (11 caracteres)...'
                : searchType === 'channel'
                ? t.youtube_placeholder_channel || 'Nome do canal...'
                : t.youtube_placeholder || 'Nome ou termo do vídeo...'
            }
            className="yvf-input"
            disabled={loading}
          />
          <button
            onClick={handleSearch}
            className="yvf-search-btn"
            disabled={loading}
          >
            {loading ? (t.youtube_searching || 'Procurando...') : (t.youtube_search || 'Procurar')}
          </button>
        </div>

        {error && (
          <div className={`yvf-alert ${error.includes('sucesso') || error.includes('success') ? 'success' : 'error'}`}>
            {error}
          </div>
        )}
      </div>

      {results.length > 0 && (
        <div className="yvf-results-section" ref={resultsRef}>
          <h3>{t.youtube_results || 'Resultados'} ({results.length})</h3>
          
          <div className="yvf-results-grid">
            {results.map((video, idx) => (
              <div
                key={idx}
                className={`yvf-result-card ${selectedResult === idx ? 'active' : ''}`}
                onClick={() => setSelectedResult(idx)}
              >
                <div className="yvf-card-thumbnail">
                  {video.thumbnail ? (
                    <img src={video.thumbnail} alt={video.title} />
                  ) : (
                    <div className="yvf-no-thumbnail">
                      <span>📹</span>
                    </div>
                  )}
                </div>

                <div className="yvf-card-content">
                  <h4>{video.title || 'Vídeo sem título'}</h4>
                  
                  {video.channel && (
                    <p className="yvf-channel">👤 {video.channel}</p>
                  )}

                  {video.upload_date && (
                    <p className="yvf-date">
                      📅 {new Date(video.upload_date).toLocaleDateString()}
                    </p>
                  )}

                  {video.description && (
                    <p className="yvf-description">{video.description.substring(0, 100)}...</p>
                  )}

                  <div className="yvf-card-actions">
                    {video.url && (
                      <>
                        <a
                          href={video.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="yvf-link-btn"
                        >
                          {t.youtube_view || 'Ver no Wayback'}
                        </a>
                        <button
                          onClick={() => handleDownload(video)}
                          className="yvf-download-btn"
                        >
                          {t.youtube_download || 'Baixar'}
                        </button>
                      </>
                    )}
                  </div>

                  {video.source && (
                    <p className="yvf-source">
                      🌐 {video.source}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && results.length === 0 && !error && (
        <div className="yvf-empty-state">
          <div className="yvf-empty-icon">🔍</div>
          <p>{t.youtube_empty_state || 'Procure por um nome, canal ou ID de vídeo para encontrar cópias arquivadas'}</p>
        </div>
      )}

      {loading && (
        <div className="yvf-loading-state">
          <div className="yvf-spinner"></div>
          <p>{t.youtube_loading || 'Procurando na Wayback Machine...'}</p>
        </div>
      )}
    </div>
  )
}
