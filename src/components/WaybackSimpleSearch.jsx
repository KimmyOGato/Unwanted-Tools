import React, { useState, useEffect } from 'react'
import ResultsGrid from './ResultsGrid'
import ResultCard from './ResultCard'

export default function WaybackSimpleSearch({ locale: localeProp }) {
  const locale = localeProp || { wayback_title: 'Wayback Machine Search', wayback_subtitle: 'Search for archived versions of any website or domain.', enter_url_placeholder: 'Enter URL or domain (e.g., example.com or http://example.com)', all_types: 'All Types', images: 'Images', media: 'Audio/Video', documents: 'Documents', date_filters: 'Date Filters (Optional)', captures_label: 'Captures:', results_label: 'Results', no_results_msg: 'No results yet. Enter a URL and search.', download_selected_text: 'Download Selected', search_history: 'Search history', clear_history: 'Clear history', no_history: 'No search history', select_all: 'Select all', deselect_all: 'Deselect all', export_json: 'Export JSON', export_csv: 'Export CSV', progress_searching: 'Searching pages ({current}/{total})...' }
  const [url, setUrl] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [type, setType] = useState('all')
  const [captureLimit, setCaptureLimit] = useState(12)
  const [deepSearch, setDeepSearch] = useState(false)
  const [qualityFilter, setQualityFilter] = useState('all') // all, high-quality, exclude-thumbnails
  const [minImageSize, setMinImageSize] = useState('all') // all, 800x600, 1024x768, 1920x1080
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [collapsedGroups, setCollapsedGroups] = useState({})
  const [searchHistory, setSearchHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [progress, setProgress] = useState(null)
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)

  // Load search history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('wayback-search-history')
    if (saved) {
      try {
        setSearchHistory(JSON.parse(saved))
      } catch (e) {}
    }
  }, [])

  // Listen for progress events from main process
  useEffect(() => {
    if (window.api && window.api.onSearchProgress) {
      window.api.onSearchProgress((data) => {
        console.log('[WaybackSimpleSearch] Progress:', data)
        setProgress(data)
      })
    }
  }, [])

  // Listen for progress events from custom event
  useEffect(() => {
    const handleProgress = (e) => {
      console.log('[WaybackSimpleSearch] Custom event progress:', e.detail)
      setProgress(e.detail)
    }
    window.addEventListener('search-progress', handleProgress)
    return () => window.removeEventListener('search-progress', handleProgress)
  }, [])

  // Save search to history
  const saveToHistory = (searchUrl) => {
    const updated = [searchUrl, ...searchHistory.filter(s => s !== searchUrl)].slice(0, 10)
    setSearchHistory(updated)
    localStorage.setItem('wayback-search-history', JSON.stringify(updated))
  }

  const clearHistory = () => {
    setSearchHistory([])
    localStorage.removeItem('wayback-search-history')
    setShowHistory(false)
  }

  const handleSearch = async (searchUrl = null) => {
    const searchInput = searchUrl || url.trim()
    if (!searchInput) return alert('Please enter a URL, domain, or Wayback link')
    
    setLoading(true)
    setProgress(null)
    if (searchUrl) setUrl(searchUrl)
    saveToHistory(searchInput)
    
    try {
      // Check if it's a Wayback link or a simple URL
      const isWaybackLink = searchInput.includes('web.archive.org')
      
      let fetchUrl = searchInput
      let filters = {}
      
      // If it's not a Wayback link, treat it as a domain search with date filters
      if (!isWaybackLink) {
        filters = { from: fromDate, to: toDate, limit: captureLimit }
      }
      // If it's a Wayback link, pass it as-is for parsing
      
      console.log(`[WaybackSimpleSearch] Input type: ${isWaybackLink ? 'Wayback link' : 'Domain/URL'}`)
      console.log(`[WaybackSimpleSearch] Fetching resources from: ${fetchUrl}`)
      
      const res = await window.api.fetchResources(fetchUrl, filters)
      if (res.error) {
        alert('Error: ' + res.error)
        setResults([])
      } else {
        let filtered = res.items || []
        console.log(`[WaybackSimpleSearch] Raw results: ${filtered.length} items`)
        
        // Apply type filter
        if (type === 'images') {
          filtered = filtered.filter(it => {
            const mime = (it.mimetype || '').toLowerCase()
            return mime.startsWith('image/')
          })
          console.log(`[WaybackSimpleSearch] After image filter: ${filtered.length} items`)
        } else if (type === 'media') {
          filtered = filtered.filter(it => {
            const mime = (it.mimetype || '').toLowerCase()
            return mime.startsWith('audio/') || mime.startsWith('video/')
          })
          console.log(`[WaybackSimpleSearch] After media filter: ${filtered.length} items`)
        } else if (type === 'documents') {
          filtered = filtered.filter(it => {
            const mime = (it.mimetype || '').toLowerCase()
            return mime.includes('pdf') || mime.startsWith('text/')
          })
          console.log(`[WaybackSimpleSearch] After documents filter: ${filtered.length} items`)
        }

        // Apply quality filter
        if (qualityFilter === 'exclude-thumbnails') {
          filtered = filtered.filter(it => {
            return !(it.qualityHints && it.qualityHints.isThumbnail)
          })
          console.log(`[WaybackSimpleSearch] After quality filter (exclude thumbnails): ${filtered.length} items`)
        } else if (qualityFilter === 'high-quality') {
          // Prioritize high-quality items by priority score
          filtered.sort((a, b) => {
            const aPriority = (a.qualityHints && a.qualityHints.priority) || 0
            const bPriority = (b.qualityHints && b.qualityHints.priority) || 0
            return bPriority - aPriority
          })
          console.log(`[WaybackSimpleSearch] After quality sort (high-quality first): ${filtered.length} items`)
        }

        // Apply minimum image size filter
        if (minImageSize !== 'all' && type === 'images') {
          const sizeMap = {
            '800x600': { minW: 800, minH: 600 },
            '1024x768': { minW: 1024, minH: 768 },
            '1920x1080': { minW: 1920, minH: 1080 }
          }
          const sizeReq = sizeMap[minImageSize]
          if (sizeReq) {
            filtered = filtered.filter(it => {
              // Parse resolution from qualityHints
              if (it.qualityHints && it.qualityHints.resolution) {
                const [w, h] = it.qualityHints.resolution.split('x').map(Number)
                return w >= sizeReq.minW && h >= sizeReq.minH
              }
              return true // Keep if resolution unknown
            })
            console.log(`[WaybackSimpleSearch] After size filter (${minImageSize}): ${filtered.length} items`)
          }
        }
        
        // Log sample mimetypes to debug
        console.log('[WaybackSimpleSearch] Sample mimetypes:', filtered.slice(0, 5).map(it => it.mimetype))
        
        setResults(filtered)
        setSelected(new Set())
      }
    } catch (e) {
      alert('Error: ' + String(e))
    }
    setLoading(false)
    setProgress(null)
    setShowHistory(false)
  }

  const handleDownloadSelected = async () => {
    if (selected.size === 0) return alert('Select at least one item')
    const folder = await window.api.selectFolder()
    if (!folder) return
    const toDownload = Array.from(selected).map(idx => results[idx]).filter(Boolean)
    for (const it of toDownload) {
      const filename = `${it.timestamp || ''}_${it.original.split('/').pop()}`
      const id = `${Date.now()}_${Math.random().toString(36).slice(2,8)}`
      window.dispatchEvent(new CustomEvent('enqueue-download', { detail: { id, archived: it.archived, folder, filename, groupTitle: it.groupTitle, groupYear: it.groupYear } }))
      // Send desktop notification (safe call)
      try {
        if (window.api && window.api.sendNotification) {
          window.api.sendNotification({ title: 'Download', body: `Queued: ${filename}` })
        }
      } catch (e) { console.log('[WaybackSimpleSearch] notification error:', e.message) }
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
      filename = `wayback-results-${Date.now()}.json`
      type = 'application/json'
    } else if (format === 'csv') {
      const headers = ['timestamp', 'original', 'archived', 'mimetype', 'size', 'groupTitle', 'groupYear']
      const rows = results.map(it => headers.map(h => {
        const val = it[h] || ''
        // Escape CSV values
        return `"${String(val).replace(/"/g, '""')}"`
      }).join(','))
      content = [headers.map(h => `"${h}"`).join(','), ...rows].join('\n')
      filename = `wayback-results-${Date.now()}.csv`
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
    alert(locale.exported_success || 'Results exported successfully')
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !loading) handleSearch()
  }

  return (
    <div className="wayback-simple-search">
      <h3>{locale.wayback_title}</h3>
      <p>{locale.wayback_subtitle}</p>

      <div className="search-controls">
        <div className="search-input-wrapper">
          <input
            type="text"
            placeholder={locale.enter_url_placeholder}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyPress={handleKeyPress}
            onFocus={() => setShowHistory(true)}
            disabled={loading}
          />
          {showHistory && searchHistory.length > 0 && (
            <div className="search-history-dropdown">
              <div className="history-header">
                <span>{locale.search_history}</span>
                <button onClick={clearHistory} className="clear-btn">{locale.clear_history}</button>
              </div>
              <div className="history-list">
                {searchHistory.map((item, idx) => (
                  <div key={idx} className="history-item" onClick={() => handleSearch(item)}>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          )}
          {showHistory && searchHistory.length === 0 && (
            <div className="search-history-dropdown">
              <div className="no-history">{locale.no_history}</div>
            </div>
          )}
        </div>
        <select value={type} onChange={(e) => setType(e.target.value)} disabled={loading}>
          <option value="all">{locale.all_types}</option>
          <option value="images">{locale.images}</option>
          <option value="media">{locale.media}</option>
          <option value="documents">{locale.documents}</option>
        </select>
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
          <summary>🔍 {locale.date_filters}</summary>
          <div className="date-filters">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              placeholder="From"
              disabled={loading}
            />
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              placeholder="To"
              disabled={loading}
            />
          </div>
        </details>
        <details>
          <summary>⚙️ Advanced Filters</summary>
          <div className="advanced-filters">
            <div className="filter-group">
              <label>
                <input
                  type="checkbox"
                  checked={deepSearch}
                  onChange={(e) => setDeepSearch(e.target.checked)}
                  disabled={loading}
                />
                Deep Search (Fetch up to 200+ captures)
              </label>
            </div>
            <div className="filter-group">
              <label>Quality Filter:</label>
              <select value={qualityFilter} onChange={(e) => setQualityFilter(e.target.value)} disabled={loading}>
                <option value="all">All Items</option>
                <option value="exclude-thumbnails">Exclude Thumbnails</option>
                <option value="high-quality">High Quality First</option>
              </select>
            </div>
            {type === 'images' && (
              <div className="filter-group">
                <label>Minimum Image Size:</label>
                <select value={minImageSize} onChange={(e) => setMinImageSize(e.target.value)} disabled={loading}>
                  <option value="all">Any Size</option>
                  <option value="800x600">800x600 or larger</option>
                  <option value="1024x768">1024x768 or larger</option>
                  <option value="1920x1080">1920x1080 or larger (HD)</option>
                </select>
              </div>
            )}
          </div>
        </details>
        <div className="capture-control" style={{ marginTop: 8 }}>
          <label>{locale.captures_label}</label>
          <select value={captureLimit} onChange={(e) => setCaptureLimit(Number(e.target.value))} disabled={loading}>
            <option value={5}>5</option>
            <option value={12}>12 (Default)</option>
            <option value={30}>30</option>
            <option value={50}>50</option>
            <option value={100}>100 (Deep)</option>
          </select>
        </div>
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
          <div className="results-strip">
            {results.map((item, idx) => {
              // Group by timestamp to show group headers
              const showHeader = idx === 0 || results[idx - 1].timestamp !== item.timestamp
              return (
                <React.Fragment key={`${item.timestamp}_${idx}`}>
                  {showHeader && (
                    <div className="strip-group-header">
                      <strong>{item.groupTitle || `${item.timestamp || 'Misc'}`}</strong>
                      {item.groupYear && <span className="strip-group-year"> {item.groupYear}</span>}
                    </div>
                  )}
                  <div className="strip-container">
                    <ResultCard
                      key={`card_${item.timestamp}_${idx}`}
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
                </React.Fragment>
              )
            })}
          </div>
        ) : (
          <p className="no-results">{loading ? (locale.searching || 'Searching...') : (locale.no_results_msg || 'No results yet. Enter a URL and search.')}</p>
        )}
      </div>
    </div>
  )
}
