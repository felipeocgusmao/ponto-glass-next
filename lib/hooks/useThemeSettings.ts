'use client'

import { useEffect, useState } from 'react'

interface UseThemeSettingsOptions {
  /** Called when the user picks an explicit theme (not 'system'). Use to persist to server. */
  onThemeChange?: (mode: 'dark' | 'light') => void
}

// Apply the theme attribute AND keep the iOS browser-bar tint in step: Safari
// paints its bottom/top bars with <meta name="theme-color">, so a meta stuck on
// the dark value leaves a black bar under the app when the theme is light.
// Values mirror --bg in tokens.css.
function applyThemeAttr(t: 'dark' | 'light') {
  document.documentElement.setAttribute('data-theme', t)
  const c = t === 'dark' ? '#08090b' : '#fafafa'
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => {
    m.removeAttribute('media')
    m.setAttribute('content', c)
  })
}

export function useThemeSettings({ onThemeChange }: UseThemeSettingsOptions = {}) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [isSystemTheme, setIsSystemTheme] = useState(false)
  const [accent, setAccentState] = useState('indigo')
  const [font, setFontState] = useState('inter')

  useEffect(() => {
    const saved = localStorage.getItem('pg.theme') as 'dark' | 'light' | null
    const mq = window.matchMedia('(prefers-color-scheme: dark)')

    const applyTheme = (t: 'dark' | 'light') => {
      setTheme(t)
      applyThemeAttr(t)
    }

    if (saved) {
      applyTheme(saved)
      setIsSystemTheme(false)
    } else {
      applyTheme(mq.matches ? 'dark' : 'light')
      setIsSystemTheme(true)
    }

    const handleColorScheme = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem('pg.theme')) applyTheme(e.matches ? 'dark' : 'light')
    }
    mq.addEventListener('change', handleColorScheme)

    const savedAccent = localStorage.getItem('pg.accent')
    if (savedAccent) {
      setAccentState(savedAccent)
      document.documentElement.setAttribute('data-accent', savedAccent)
    }

    const savedFont = localStorage.getItem('pg.font')
    if (savedFont) setFontState(savedFont)

    return () => mq.removeEventListener('change', handleColorScheme)
  }, [])

  const selectTheme = (mode: 'dark' | 'light' | 'system') => {
    if (mode === 'system') {
      localStorage.removeItem('pg.theme')
      setIsSystemTheme(true)
      const sysDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      const next = sysDark ? 'dark' : 'light'
      setTheme(next)
      applyThemeAttr(next)
    } else {
      setIsSystemTheme(false)
      setTheme(mode)
      applyThemeAttr(mode)
      localStorage.setItem('pg.theme', mode)
      onThemeChange?.(mode)
    }
  }

  const toggleTheme = () => selectTheme(theme === 'dark' ? 'light' : 'dark')

  const changeAccent = (a: string) => {
    setAccentState(a)
    document.documentElement.setAttribute('data-accent', a)
    localStorage.setItem('pg.accent', a)
  }

  const changeFont = (f: string) => {
    setFontState(f)
    if (f === 'inter') document.documentElement.removeAttribute('data-font')
    else document.documentElement.setAttribute('data-font', f)
    localStorage.setItem('pg.font', f)
  }

  /** Call after loading a user profile to apply the server-stored theme preference. */
  const syncFromServer = (serverTheme: 'dark' | 'light') => {
    setTheme(serverTheme)
    applyThemeAttr(serverTheme)
  }

  return { theme, isSystemTheme, accent, font, selectTheme, toggleTheme, changeAccent, changeFont, syncFromServer }
}
