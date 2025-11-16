import { useState, useRef, useEffect } from 'react'
import ThemeSelector from './ThemeSelector'
import LanguageSelector from './LanguageSelector'

export default function HeaderSettings({ lang, onLangChange, theme, onThemeChange, locale }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function onDoc(e) {
      if (!ref.current) return
      if (!ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const t = locale || { 
    settings_title: 'Settings', 
    label_language: 'Language', 
    label_theme: 'Theme', 
    settings_button_title: 'Settings',
    label_appearance: 'Appearance',
    label_regional: 'Regional'
  }

  return (
    <div className="header-settings" ref={ref}>
      <button 
        className="settings-btn" 
        onClick={() => setOpen(v => !v)} 
        aria-haspopup="true" 
        aria-expanded={open} 
        title={t.settings_button_title}
      >
        ⚙️
      </button>

      {open && (
        <div className="settings-panel-v2" role="dialog" aria-label={t.settings_title}>
          <div className="settings-header">
            <h3>{t.settings_title}</h3>
            <button 
              className="settings-close" 
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="settings-section">
            <h4 className="settings-section-title">{t.label_regional || 'Regional'}</h4>
            <div className="settings-item">
              <label className="settings-item-label">{t.label_language}</label>
              <div className="settings-item-content">
                <LanguageSelector 
                  value={lang} 
                  onChange={(val) => onLangChange && onLangChange(val)} 
                  locale={locale} 
                />
              </div>
            </div>
          </div>

          <div className="settings-section">
            <h4 className="settings-section-title">{t.label_appearance || 'Appearance'}</h4>
            <div className="settings-item">
              <label className="settings-item-label">{t.label_theme}</label>
              <div className="settings-item-content">
                <ThemeSelector 
                  value={theme} 
                  onChange={(t) => onThemeChange && onThemeChange(t)} 
                  locale={locale} 
                />
              </div>
            </div>
          </div>

          <div className="settings-footer">
            <p className="settings-hint">{locale?.hint_settings || 'Changes are saved automatically'}</p>
          </div>
        </div>
      )}
    </div>
  )
}
