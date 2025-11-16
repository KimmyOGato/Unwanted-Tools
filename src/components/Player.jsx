import React, { useEffect, useRef, useState } from 'react'

export default function Player({ src, autoPlay = false }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!audioRef.current) audioRef.current = new Audio()
    const audio = audioRef.current
    audio.src = src || ''
    audio.preload = 'metadata'
    setError(null)

    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onTime = () => setCurrent(audio.currentTime || 0)
    const onDur = () => setDuration(audio.duration || 0)
    const onEnded = () => setPlaying(false)
    const onError = () => {
      console.error('[Player] Audio error:', audio.error)
      setError('Cannot play this audio')
      setPlaying(false)
    }

    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('durationchange', onDur)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)

    if (autoPlay) {
      audio.play().catch((e) => {
        console.error('[Player] Autoplay failed:', e)
        setError('Autoplay failed')
      })
    }

    return () => {
      audio.pause()
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('durationchange', onDur)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
    }
  }, [src, autoPlay])

  const toggle = () => {
    const a = audioRef.current
    if (!a || error) return
    if (playing) a.pause()
    else a.play().catch((e) => {
      console.error('[Player] Play failed:', e)
      setError('Playback failed')
    })
  }

  const downloadAndPlay = async () => {
    try {
      const folder = await window.api.selectFolder()
      if (!folder) return
      const url = src || ''
      const filename = `${Date.now()}_${url.split('/').pop()}`
      const id = `${Date.now()}_${Math.random().toString(36).slice(2,8)}`
      window.dispatchEvent(new CustomEvent('enqueue-download', { detail: { id, archived: url, folder, filename, playAfter: true } }))
      // give user quick feedback
      alert('Download queued and will play when complete')
    } catch (e) {
      console.error('[Player] downloadAndPlay error:', e)
      alert('Failed to queue download: ' + String(e))
    }
  }

  const format = (t) => {
    if (!isFinite(t) || t <= 0) return '0:00'
    const s = Math.floor(t % 60).toString().padStart(2, '0')
    const m = Math.floor(t / 60)
    return `${m}:${s}`
  }

  const onSeek = (e) => {
    const a = audioRef.current
    if (!a) return
    const val = parseFloat(e.target.value)
    a.currentTime = val
    setCurrent(val)
  }

  return (
    <div className="player">
      <button className="player-btn" onClick={toggle} disabled={error}>{error ? '✕' : (playing ? '⏸' : '▶')}</button>
      <div className="player-time">{error ? error : `${format(current)} / ${format(duration)}`}</div>
      <input className="player-seek" type="range" min={0} max={duration || 0} step={0.1} value={current} onChange={onSeek} disabled={error} />
      {/* Duplicate action buttons removed — Download / Open are available in item actions */}
    </div>
  )
}
