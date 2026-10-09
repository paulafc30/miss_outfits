import { useEffect, useState } from 'react'

export type ThemeChoice = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'miss-outfits-theme'
// Clave de la versión anterior de la app ("Mi Armario"): se lee una vez para no perder la preferencia.
const LEGACY_STORAGE_KEY = 'mi-armario-theme'

/** Lee la preferencia guardada o "system" por defecto. */
export function getStoredTheme(): ThemeChoice {
  if (typeof window === 'undefined') return 'system'
  const t = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_STORAGE_KEY)
  if (t === 'light' || t === 'dark' || t === 'system') return t
  return 'system'
}

/** Aplica el tema al <html> (añade/quita la clase .dark). */
export function applyTheme(theme: ThemeChoice) {
  if (typeof document === 'undefined') return
  const resolved = resolveTheme(theme)
  const root = document.documentElement
  if (resolved === 'dark') root.classList.add('dark')
  else root.classList.remove('dark')
  // Actualiza la meta theme-color para que el navegador pinte la barra superior coherente
  const meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null
  if (meta) meta.content = resolved === 'dark' ? '#120a0c' : '#ef3a59'
}

function resolveTheme(theme: ThemeChoice): 'light' | 'dark' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return theme
}

/** Hook: devuelve [theme, setTheme] con persistencia y aplicación inmediata. */
export function useTheme(): [ThemeChoice, (next: ThemeChoice) => void] {
  const [theme, setThemeState] = useState<ThemeChoice>(() => getStoredTheme())

  const setTheme = (next: ThemeChoice) => {
    setThemeState(next)
    try { window.localStorage.setItem(STORAGE_KEY, next) } catch { /* ignore */ }
    applyTheme(next)
  }

  // Si el usuario está en "system", reacciona a cambios de preferencia del SO
  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])

  return [theme, setTheme]
}
