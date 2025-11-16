import React from 'react'

export default function Menu({ mode, onSelect, theme, onToggleTheme, locale = {} }) {
  const t = locale || { title: 'Unwanted Tools', menu_wayback: 'Wayback Search', menu_mp3: 'MP3 Search', menu_soulseek: 'Soulseek', menu_credits: 'Credits', menu_settings: 'Configurações' }
  return (
    <aside className={`side-menu ${theme}`}>
      <h2>{t.title || 'Unwanted Tools'}</h2>
      <nav>
        <button className={mode === 'wayback' ? 'active' : ''} onClick={() => onSelect('wayback')}>🕰️ {t.menu_wayback}</button>
        <button className={mode === 'wayback-deep' ? 'active' : ''} onClick={() => onSelect('wayback-deep')}>🔎 {t.menu_wayback_deep || 'Deep Search'}</button>
        <button className={mode === 'mp3' ? 'active' : ''} onClick={() => onSelect('mp3')}>🎵 {t.menu_mp3}</button>
        <button className={mode === 'soulseek' ? 'active' : ''} onClick={() => onSelect('soulseek')}>🔗 {t.menu_soulseek}</button>
        <button className={mode === 'video' ? 'active' : ''} onClick={() => onSelect('video')}>🎬 {t.video_downloader || 'Video'}</button>
        <button className={mode === 'youtube' ? 'active' : ''} onClick={() => onSelect('youtube')}>🎥 {t.menu_youtube || 'YouTube'}</button>
        <button className={mode === 'statistics' ? 'active' : ''} onClick={() => onSelect('statistics')}>📊 {t.statistics || 'Stats'}</button>
        <button className={mode === 'credits' ? 'active' : ''} onClick={() => onSelect('credits')}>✨ {t.menu_credits}</button>
        <hr className="menu-divider" />
        <button className={mode === 'settings' ? 'active' : ''} onClick={() => onSelect('settings')}>⚙️ {t.menu_settings}</button>
      </nav>

      <div className="menu-footer">
      </div>
    </aside>
  )
}

