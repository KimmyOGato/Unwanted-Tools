import React, { useState } from 'react'

export default function Navigation({ mode, onSelect, theme, onToggleTheme, locale = {} }) {
  const t = locale || {}
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [themeMenuOpen, setThemeMenuOpen] = useState(false)

  const menuItems = [
    { id: 'wayback', label: t.menu_wayback || 'Wayback', icon: '🕰️' },
    { id: 'mp3', label: t.menu_mp3 || 'MP3 Search', icon: '🎵' },
    { id: 'soulseek', label: t.menu_soulseek || 'Soulseek', icon: '🔗' },
    { id: 'video', label: t.video_downloader || 'Video', icon: '🎬' },
    { id: 'statistics', label: t.statistics || 'Stats', icon: '📊' },
    { id: 'credits', label: t.menu_credits || 'Credits', icon: '✨' }
  ]

  const themes = [
    { id: 'preto-total', label: 'Preto Total' },
    { id: 'preto', label: 'Preto' },
    { id: 'roxo-escuro', label: 'Roxo' },
    { id: 'vermelho-escuro', label: 'Vermelho' },
    { id: 'rosa', label: 'Rosa' },
    { id: 'azul', label: 'Azul' },
    { id: 'verde', label: 'Verde' },
    { id: 'light', label: 'Light' }
  ]

  const changeTheme = (newTheme) => {
    onToggleTheme(newTheme)
    setThemeMenuOpen(false)
  }

  return (
    <nav className={`navbar ${theme}`}>
      <div className="navbar-container">
        {/* Logo/Title */}
        <div className="navbar-brand">
          <h1>{t.title || 'Unwanted Tools'}</h1>
        </div>

        {/* Menu Items */}
        <div className={`navbar-menu ${mobileMenuOpen ? 'active' : ''}`}>
          {menuItems.map(item => (
            <button
              key={item.id}
              className={`nav-item ${mode === item.id ? 'active' : ''}`}
              onClick={() => {
                onSelect(item.id)
                setMobileMenuOpen(false)
              }}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </div>

        {/* Right Section */}
        <div className="navbar-right">
          {/* Theme Selector Dropdown */}
          <div className="theme-dropdown">
            <button
              className="btn-theme"
              onClick={() => setThemeMenuOpen(!themeMenuOpen)}
              title="Select theme"
            >
              🎨
            </button>
            {themeMenuOpen && (
              <div className="theme-dropdown-menu">
                {themes.map(t => (
                  <button
                    key={t.id}
                    className={`theme-option ${theme === t.id ? 'active' : ''}`}
                    onClick={() => changeTheme(t.id)}
                  >
                    <span className={`theme-dot ${t.id}`}></span>
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {/* Mobile Menu Toggle */}
          <button
            className="menu-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            ☰
          </button>
        </div>
      </div>
    </nav>
  )
}
