import { useState, useRef, useEffect } from 'react'

const LANGUAGES = [
  { code: 'pt-BR', name: 'Português', flag: '🇧🇷', desc: 'Português Brasileiro' },
  { code: 'en-US', name: 'English', flag: '🇺🇸', desc: 'English (US)' }
]

export default function LanguageSelector({ value, onChange, locale = {} }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (!ref.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const current = LANGUAGES.find(l => l.code === value) || LANGUAGES[0]

  const handleSelect = (code) => {
    if (onChange) onChange(code)
    try {
      localStorage.setItem('uwt:language', code)
    } catch (e) { /* ignore */ }
    setOpen(false)
  }

  return (
    <div className="language-selector" ref={ref}>
      <button 
        className="lang-btn"
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={locale.label_language || 'Language'}
      >
        <span className="lang-flag">{current.flag}</span>
        <span className="lang-name">{current.name}</span>
        <span className="lang-arrow">▼</span>
      </button>

      {open && (
        <div className="lang-menu" role="listbox">
          {LANGUAGES.map(lang => (
            <button
              key={lang.code}
              className={`lang-item ${value === lang.code ? 'active' : ''}`}
              onClick={() => handleSelect(lang.code)}
              role="option"
              aria-selected={value === lang.code}
            >
              <span className="lang-flag">{lang.flag}</span>
              <div className="lang-info">
                <div className="lang-title">
                  <span>{lang.name}</span>
                  <span className="lang-code">{lang.code.split('-')[0].toUpperCase()}</span>
                </div>
                <div className="lang-desc">{lang.desc}</div>
              </div>
              {value === lang.code && <span className="lang-check">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
