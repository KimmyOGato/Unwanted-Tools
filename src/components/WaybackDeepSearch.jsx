import React, { useState, useEffect } from 'react'
import ResultsGrid from './ResultsGrid'
import ResultCard from './ResultCard'

export default function WaybackDeepSearch({ locale: localeProp }) {
  const locale = localeProp || {
    deep_search_title: 'Wayback Deep Search',
    deep_search_subtitle: 'Search for any term across the entire Wayback Machine archive. Find all related images, videos, and audio.',
    search_term_placeholder: 'Enter search term (e.g., "Pulse Ultra", "Brand Name", "Project Name")',
    search_term_hint: 'The search will crawl multiple Wayback captures and find ALL matching content',
    search: 'Search',
    searching: 'Searching...',
    results_label: 'Results',
    no_results_msg: 'No results found. Try a different search term.',
    download_selected_text: 'Download Selected',
    select_all: 'Select all',
    deselect_all: 'Deselect all',
    export_json: 'Export JSON',
    export_csv: 'Export CSV',
    progress_searching: 'Searching captures ({current}/{total})...',
    content_type_all: 'All Content',
    content_type_images: 'Images Only',
    content_type_videos: 'Videos Only',
    content_type_audio: 'Audio Only',
    content_type_media: 'Videos & Audio',
    sort_relevance: 'Most Relevant',
    sort_newest: 'Newest First',
    sort_oldest: 'Oldest First'
  }

  const [searchTerm, setSearchTerm] = useState('')
  const [contentType, setContentType] = useState('all') // all, images, videos, audio, media
  const [sortBy, setSortBy] = useState('relevance')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [progress, setProgress] = useState(null)
  const [searchHistory, setSearchHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [maxResults, setMaxResults] = useState(100)

  // Load search history
  useEffect(() => {
    const saved = localStorage.getItem('wayback-deep-search-history')
    if (saved) {
      try {
        setSearchHistory(JSON.parse(saved))
      } catch (e) {}
    }
  }, [])

  // Listen for progress events
  useEffect(() => {
    const handleProgress = (e) => {
      console.log('[WaybackDeepSearch] Progress:', e.detail)
      setProgress(e.detail)
    }
    window.addEventListener('search-progress', handleProgress)
    return () => window.removeEventListener('search-progress', handleProgress)
  }, [])

  const saveToHistory = (term) => {
    const updated = [term, ...searchHistory.filter(s => s !== term)].slice(0, 15)
    setSearchHistory(updated)
    localStorage.setItem('wayback-deep-search-history', JSON.stringify(updated))
  }

  const handleSearch = async (term = null) => {
    const searchInput = (term || searchTerm).trim()
    if (!searchInput) return alert('Please enter a search term')

    setLoading(true)
    setProgress(null)
    if (term) setSearchTerm(term)
    saveToHistory(searchInput)

    try {
      console.log(`[WaybackDeepSearch] Deep searching for: "${searchInput}"`)
      
      const res = await window.api.deepSearchWayback(searchInput, {
        contentType,
        maxResults,
        sortBy
      })

      if (res.error) {
        alert('Error: ' + res.error)
        setResults([])
      } else {
        let filtered = res.items || []
        console.log(`[WaybackDeepSearch] Raw results: ${filtered.length} items`)

        // Apply content type filter
        if (contentType === 'images') {
          filtered = filtered.filter(it => it.mimetype && it.mimetype.startsWith('image/'))
        } else if (contentType === 'videos') {
          filtered = filtered.filter(it => it.mimetype && it.mimetype.startsWith('video/'))
        } else if (contentType === 'audio') {
          filtered = filtered.filter(it => it.mimetype && it.mimetype.startsWith('audio/'))
        } else if (contentType === 'media') {
          filtered = filtered.filter(it => it.mimetype && (it.mimetype.startsWith('video/') || it.mimetype.startsWith('audio/')))
        }

        // Apply sorting
        if (sortBy === 'newest') {
          filtered.sort((a, b) => (b.timestamp || '0') - (a.timestamp || '0'))
        } else if (sortBy === 'oldest') {
          filtered.sort((a, b) => (a.timestamp || '0') - (b.timestamp || '0'))
        } else if (sortBy === 'relevance') {
          // Sort by priority score if available
          filtered.sort((a, b) => {
            const aPriority = (a.qualityHints && a.qualityHints.priority) || 0
            const bPriority = (b.qualityHints && b.qualityHints.priority) || 0
            return bPriority - aPriority
          })
        }

        setResults(filtered)
        setSelected(new Set())
      }
    } catch (e) {
      alert('Error: ' + String(e))
    }
    setLoading(false)
    setProgress(null)
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !loading) handleSearch()
  }

  const handleDownloadSelected = async () => {
    if (selected.size === 0) return alert('Select at least one item')

    const toDownload = Array.from(selected).map(idx => results[idx])
    try {
      const folder = await window.api.selectFolder()
      if (!folder) return

      for (const item of toDownload) {
        try {
          await window.api.downloadResource({
            url: item.archived || item.original,
            destFolder: folder,
            filename: item.original.split('/').pop() || 'download',
            groupTitle: item.groupTitle,
            groupYear: item.groupYear
          })
        } catch (e) {
          console.log('[WaybackDeepSearch] download error:', e.message)
        }
      }
      alert('Downloads requested for ' + toDownload.length + ' items')
    } catch (e) {
      console.log('[WaybackDeepSearch] notification error:', e.message)
    }
    alert('Downloads requested for ' + toDownload.length + ' items')
  }

  const handleSelectAll = () => {
    setSelected(new Set(results.map((_, idx) => idx)))
  }

  const handleDeselectAll = () => {
    setSelected(new Set())
  }

  const exportResults = (format) => {
    if (results.length === 0) return alert('No results to export')

    let content, filename, type
    if (format === 'json') {
      content = JSON.stringify(results, null, 2)
      filename = `wayback-deep-search-${searchTerm.replace(/\s+/g, '-')}-${Date.now()}.json`
      type = 'application/json'
    } else if (format === 'csv') {
      const headers = ['timestamp', 'original', 'archived', 'mimetype', 'groupTitle', 'groupYear', 'source']
      const rows = results.map(it => headers.map(h => {
        const val = it[h] || ''
        return `"${String(val).replace(/"/g, '""')}"`
      }).join(','))
      content = [headers.map(h => `"${h}"`).join(','), ...rows].join('\n')
      filename = `wayback-deep-search-${searchTerm.replace(/\s+/g, '-')}-${Date.now()}.csv`
      type = 'text/csv'
    }

    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    alert('Results exported successfully')
  }

  return (
    <div className="wayback-deep-search">
      <h3>{locale.deep_search_title}</h3>
      <p>{locale.deep_search_subtitle}</p>

      <div className="search-controls">
        <div className="search-input-wrapper">
          <input
            type="text"
            placeholder={locale.search_term_placeholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={handleKeyPress}
            onFocus={() => setShowHistory(true)}
            disabled={loading}
            className="deep-search-input"
          />
          <div className="search-hint">{locale.search_term_hint}</div>
          {showHistory && searchHistory.length > 0 && (
            <div className="search-history-dropdown">
              <div className="history-list">
                {searchHistory.map((item, idx) => (
                  <div key={idx} className="history-item" onClick={() => handleSearch(item)}>
                    🔍 {item}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <button onClick={() => handleSearch()} disabled={loading} className="btn">
          {loading ? (locale.searching || 'Searching...') : (locale.search || 'Search')}
        </button>
      </div>

      {progress && (
        <div className="progress-indicator">
          <div className="progress-text">
            {locale.progress_searching.replace('{current}', progress.current).replace('{total}', progress.total)}
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${(progress.current / progress.total) * 100}%` }}></div>
          </div>
        </div>
      )}

      <div className="filter-section">
        <details>
          <summary>🎬 Content Type Filter</summary>
          <div className="content-filter">
            <select value={contentType} onChange={(e) => setContentType(e.target.value)} disabled={loading}>
              <option value="all">{locale.content_type_all}</option>
              <option value="images">{locale.content_type_images}</option>
              <option value="videos">{locale.content_type_videos}</option>
              <option value="audio">{locale.content_type_audio}</option>
              <option value="media">{locale.content_type_media}</option>
            </select>
          </div>
        </details>

        <details>
          <summary>🔀 Sort & Limit</summary>
          <div className="sort-filter">
            <div className="filter-group">
              <label>Sort By:</label>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} disabled={loading}>
                <option value="relevance">{locale.sort_relevance}</option>
                <option value="newest">{locale.sort_newest}</option>
                <option value="oldest">{locale.sort_oldest}</option>
              </select>
            </div>
            <div className="filter-group">
              <label>Max Results:</label>
              <select value={maxResults} onChange={(e) => setMaxResults(Number(e.target.value))} disabled={loading}>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
                <option value={500}>500 (All)</option>
              </select>
            </div>
          </div>
        </details>
      </div>

      <div className="results-section">
        <div className="results-header">
          <h4>{locale.results_label} ({results.length})</h4>
          {results.length > 0 && (
            <div className="results-actions">
              <button onClick={handleSelectAll} className="bulk-btn" title={locale.select_all}>
                {locale.select_all}
              </button>
              <button onClick={handleDeselectAll} className="bulk-btn" title={locale.deselect_all}>
                {locale.deselect_all}
              </button>
              <button onClick={() => exportResults('json')} className="export-btn" title={locale.export_json}>
                {locale.export_json}
              </button>
              <button onClick={() => exportResults('csv')} className="export-btn" title={locale.export_csv}>
                {locale.export_csv}
              </button>
              <button onClick={handleDownloadSelected} disabled={selected.size === 0} className="download-selected-btn">
                {locale.download_selected_text} ({selected.size})
              </button>
            </div>
          )}
        </div>
        {results.length > 0 ? (
          <div className="results-grid">
            {results.map((item, idx) => (
              <div key={idx} className="result-item-wrapper">
                <ResultCard
                  item={item}
                  isSelected={selected.has(idx)}
                  onToggle={() => {
                    const newSelected = new Set(selected)
                    if (newSelected.has(idx)) newSelected.delete(idx)
                    else newSelected.add(idx)
                    setSelected(newSelected)
                  }}
                  locale={{}}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="no-results">{loading ? (locale.searching || 'Searching...') : (locale.no_results_msg || 'No results yet. Enter a search term and search.')}</p>
        )}
      </div>
    </div>
  )
}
