import { useState } from 'react'
import ThemeSelector from './ThemeSelector'
import LanguageSelector from './LanguageSelector'

export default function Settings({ lang, onLangChange, theme, onThemeChange, locale, isActive }) {
  const t = locale || {
    label_language: 'Idioma',
    label_theme: 'Tema',
    hint_settings: 'Alterações salvas automaticamente'
  }

  return (
    <div className="settings-view">
      <div className="section-header">
        <h1>Configurações</h1>
        <p>Personalize sua experiência</p>
      </div>

      <div className="settings-sections">
        <div className="settings-card">
          <div className="card-header">
            <h3>🌐 {t.label_language}</h3>
          </div>
          <div className="card-body">
            <LanguageSelector 
              value={lang} 
              onChange={(val) => onLangChange?.(val)} 
              locale={locale} 
            />
          </div>
        </div>

        <div className="settings-card">
          <div className="card-header">
            <h3>🎨 {t.label_theme}</h3>
          </div>
          <div className="card-body">
            <ThemeSelector 
              value={theme} 
              onChange={(t) => onThemeChange?.(t)} 
              locale={locale} 
            />
          </div>
        </div>
      </div>

      <div className="settings-footer">
        <div className="hint-box">
          <p>{t.hint_settings}</p>
        </div>
      </div>
    </div>
  )
}
