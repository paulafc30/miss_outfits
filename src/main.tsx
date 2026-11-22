import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { ConfirmProvider } from './components/shared/ConfirmModal'
import { applyTheme, getStoredTheme } from './lib/theme'
import './index.css'

// Si el navegador/app instalada arranca en "modo escritorio" (página de ~980 px en un móvil de
// ~400 px), intenta forzar el ancho real del dispositivo. Solo actúa en pantallas táctiles
// estrechas cuando la página es mucho más ancha que la pantalla.
try {
  const screenW = Math.min(window.screen.width, window.screen.height)
  if ('ontouchstart' in window && screenW > 0 && screenW < 600 && window.innerWidth > screenW * 1.5) {
    document
      .querySelector('meta[name="viewport"]')
      ?.setAttribute('content', `width=${screenW}, initial-scale=1, minimum-scale=1, viewport-fit=cover`)
  }
} catch {
  // sin acceso a screen: no hacemos nada
}

// Aplicar tema antes de renderizar para evitar parpadeo (flash of unstyled theme)
applyTheme(getStoredTheme())

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ConfirmProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ConfirmProvider>
    </QueryClientProvider>
  </React.StrictMode>
)

// Registrar el service worker para que la app sea instalable como PWA
// (solo en producción, así no interfiere con el dev server)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('Service worker registration failed:', err)
    })
  })
}
