import { useState, useEffect } from 'react'
import ThemeSelector from './ThemeSelector'
import LanguageSelector from './LanguageSelector'

export default function SettingsDrawer({ lang, onLangChange, theme, onThemeChange, locale }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function handleEscape(e) {
      if (e.key === 'Escape' && open) setOpen(false)
    }
    if (open) document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open])

  const t = locale || {
    settings_title: 'Configurações',
    label_language: 'Idioma',
    label_theme: 'Tema',
    label_appearance: 'Aparência',
    label_regional: 'Regional',
    hint_settings: 'Alterações salvas automaticamente'
  }

  return (
    <>
      <button 
        className="settings-drawer-btn"
        onClick={() => setOpen(!open)}
        title={t.settings_title}
        aria-label={t.settings_title}
      >
        ⚙️
      </button>

      {open && (
        <>
          <div className="settings-overlay" onClick={() => setOpen(false)} />
          <div className="settings-drawer">
            <div className="drawer-header">
              <h3>{t.settings_title}</h3>
              <button 
                className="drawer-close" 
                onClick={() => setOpen(false)}
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            <div className="drawer-body">
              <div className="drawer-group">
                <div className="group-label">{t.label_regional}</div>
                <LanguageSelector 
                  value={lang} 
                  onChange={(val) => {
                    onLangChange?.(val)
                    setOpen(false)
                  }} 
                  locale={locale} 
                />
              </div>

              <div className="drawer-group">
                <div className="group-label">{t.label_appearance}</div>
                <ThemeSelector 
                  value={theme} 
                  onChange={(t) => onThemeChange?.(t)} 
                  locale={locale} 
                />
              </div>
            </div>

            <div className="drawer-footer">
              <p>{t.hint_settings}</p>
            </div>
          </div>
        </>
      )}
    </>
  )
}
