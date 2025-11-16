import { useState, useEffect, useRef } from 'react'

const THEME_IDS = [
  { id: 'preto-total', label: 'Preto Total', accent: '#60a5fa', icon: '◆' },
  { id: 'preto', label: 'Preto', accent: '#1e40af', icon: '◇' },
  { id: 'roxo-escuro', label: 'Roxo Escuro', accent: '#7c3aed', icon: '●' },
  { id: 'verde', label: 'Verde', accent: '#6ee7b7', icon: '▲' },
  { id: 'azul', label: 'Azul', accent: '#60a5fa', icon: '■' },
  { id: 'vermelho-escuro', label: 'Vermelho Escuro', accent: '#ef4444', icon: '★' },
  { id: 'rosa', label: 'Rosa', accent: '#ec4899', icon: '♥' }
]

const THEME_GROUPS = [
  { name: 'Temas Escuros', themes: THEME_IDS.slice(0, 4) },
  { name: 'Temas Vibrantes', themes: THEME_IDS.slice(4) }
]

export default function ThemeSelector({ value, onChange, locale = {} }) {
  const [selected, setSelected] = useState(value || 'preto')
  const [showGrid, setShowGrid] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (value) setSelected(value)
  }, [value])

  useEffect(() => {
    function handleClick(e) {
      if (!ref.current?.contains(e.target)) setShowGrid(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const pick = (id) => {
    setSelected(id)
    try {
      localStorage.setItem('uwt:theme', id)
    } catch (e) { /* ignore */ }
    if (onChange) onChange(id)
    setShowGrid(false)
  }

  const currentTheme = THEME_IDS.find(t => t.id === selected)

  return (
    <div className="theme-selector-v2" ref={ref}>
      <button 
        className="theme-display-btn"
        onClick={() => setShowGrid(!showGrid)}
        aria-haspopup="dialog"
        aria-expanded={showGrid}
        title={locale.label_theme || 'Theme'}
      >
        <span className="theme-icon">{currentTheme?.icon}</span>
        <span className="theme-label">{currentTheme?.label || 'Theme'}</span>
        <span className="theme-arrow">▼</span>
      </button>

      {showGrid && (
        <div className="theme-picker" role="dialog" aria-label="Theme Selector">
          {THEME_GROUPS.map((group, idx) => (
            <div key={idx} className="theme-group">
              <div className="theme-group-label">{group.name}</div>
              <div className="theme-grid">
                {group.themes.map(theme => (
                  <button
                    key={theme.id}
                    className={`theme-option ${selected === theme.id ? 'active' : ''}`}
                    onClick={() => pick(theme.id)}
                    title={theme.label}
                    style={{ '--accent-preview': theme.accent }}
                  >
                    <span className="theme-preview">
                      <span className="theme-swatch" style={{ backgroundColor: theme.accent }} />
                    </span>
                    <span className="theme-name">{theme.label}</span>
                    {selected === theme.id && <span className="theme-selected">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
