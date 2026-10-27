import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

/**
 * Pinterest redirige aquí tras la autorización OAuth.
 * URL: /pinterest-callback?code=CODE&state=STATE
 * Intercambia el code por un access_token via Edge Function y redirige a /inspiracion.
 */
export default function PinterestCallback() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<'loading' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const error = params.get('error')

    if (error || !code) {
      setErrorMsg(error === 'access_denied' ? 'Cancelaste la conexión con Pinterest.' : 'Error en la autorización de Pinterest.')
      setStatus('error')
      return
    }

    const redirectUri = `${window.location.origin}/pinterest-callback`

    async function exchange() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        navigate('/login')
        return
      }

      const { error: fnError } = await supabase.functions.invoke('pinterest-token', {
        body: { code, redirect_uri: redirectUri },
      })

      if (fnError) {
        setErrorMsg('No se pudo conectar Pinterest. Intenta de nuevo.')
        setStatus('error')
        return
      }

      navigate('/inspiracion?pinterest=connected')
    }

    exchange()
  }, [navigate])

  if (status === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-red-600 font-medium">{errorMsg}</p>
        <button onClick={() => navigate('/inspiracion')} className="btn-secondary">
          Volver a Inspiracion
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3">
      <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-muted">Conectando Pinterest...</p>
    </div>
  )
}
