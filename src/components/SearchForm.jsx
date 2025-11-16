import { useState } from 'react'

export default function SearchForm({ locale, loading, onSearch }) {
  const [link, setLink] = useState('')
  const [type, setType] = useState('images')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const handleSearch = () => {
    if (!link.trim()) {
      alert(locale.paste_link)
      return
    }
    onSearch(link, type, { from: fromDate, to: toDate })
  }

  return (
    <div className="search-form">
      <div className="controls">
        <input
          type="text"
          placeholder={locale.placeholder}
          value={link}
          onChange={(e) => setLink(e.target.value)}
          disabled={loading}
        />
        <select value={type} onChange={(e) => setType(e.target.value)} disabled={loading}>
          <option value="images">{locale.type_images}</option>
          <option value="media">{locale.type_media}</option>
          <option value="documents">{locale.type_documents}</option>
          <option value="all">{locale.type_all}</option>
        </select>
        <button onClick={handleSearch} disabled={loading}>
          {loading ? locale.searching : locale.search}
        </button>
        <button onClick={() => setShowFilters(!showFilters)} className="filter-btn">
          {locale.filters}
        </button>
      </div>

      {showFilters && (
        <div className="filters">
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} placeholder={locale.from_date} />
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} placeholder={locale.to_date} />
        </div>
      )}
    </div>
  )
}