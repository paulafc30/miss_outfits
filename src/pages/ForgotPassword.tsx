import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { authErrorMessage } from '@/lib/authErrors'
import { AuthLayout } from './Login'
import { useCaptcha } from '@/hooks/useCaptcha'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [info, setInfo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { captcha, getToken } = useCaptcha()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null); setInfo(null); setLoading(true)
    try {
      const captchaToken = await getToken()
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/restablecer`,
        captchaToken,
      })
      if (error) return setError(authErrorMessage(error))
      setInfo('Revisa tu correo para el enlace de recuperación.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se ha podido enviar el enlace.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Recuperar contraseña" subtitle="Te enviamos un enlace por email.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" required value={email}
            onChange={(e) => setEmail(e.target.value)} className="input" placeholder="tu@email.com" />
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}
        {info && <p className="text-sm text-emerald-700 bg-emerald-50 rounded-xl px-3 py-2">{info}</p>}
        <button disabled={loading} className="btn-primary w-full">
          {loading ? 'Enviando…' : 'Enviar enlace'}
        </button>
        <p className="text-sm text-center text-muted">
          <Link to="/login" className="text-brand-700 font-semibold hover:underline">Volver al login</Link>
        </p>
        {captcha}
      </form>
    </AuthLayout>
  )
}
