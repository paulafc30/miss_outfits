import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { authErrorMessage } from '@/lib/authErrors'
import HangerIcon from '@/components/shared/HangerIcon'
import PasswordInput from '@/components/shared/PasswordInput'
import GoogleSignInButton from '@/components/shared/GoogleSignInButton'
import { startDemoSession } from '@/lib/demo'
import { useCaptcha } from '@/hooks/useCaptcha'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [demoLoading, setDemoLoading] = useState(false)
  const { captcha, getToken } = useCaptcha()

  async function handleDemo() {
    setError(null)
    setDemoLoading(true)
    try {
      await startDemoSession(await getToken())
      navigate('/armario', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se ha podido iniciar la demo.')
    } finally {
      setDemoLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const captchaToken = await getToken()
      const { error } = await supabase.auth.signInWithPassword({ email, password, options: { captchaToken } })
      if (error) return setError(authErrorMessage(error))
      navigate('/armario', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se ha podido iniciar sesión.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Bienvenida de vuelta" subtitle="Entra para gestionar tu armario.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" required autoComplete="email"
            value={email} onChange={(e) => setEmail(e.target.value)}
            className="input" placeholder="tu@email.com" />
        </div>
        <div>
          <label className="label" htmlFor="password">Contraseña</label>
          <PasswordInput
            id="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Entrando…' : <>Entrar <ArrowRight className="w-4 h-4" /></>}
        </button>

        <div className="flex items-center justify-between text-sm pt-1">
          <Link to="/recuperar" className="text-muted hover:text-brand-700 transition">¿Olvidaste tu contraseña?</Link>
          <Link to="/registro" className="text-brand-700 font-semibold hover:underline">Crear cuenta</Link>
        </div>

        <GoogleSignInButton />

        <div className="pt-3 border-t border-line">
          <button type="button" onClick={handleDemo} disabled={demoLoading || loading} className="btn-secondary w-full">
            {demoLoading ? 'Preparando la demo…' : <><Sparkles className="w-4 h-4" /> Ver demo sin registrarme</>}
          </button>
          <p className="text-xs text-muted text-center mt-2">Entra con datos de ejemplo. No hace falta cuenta.</p>
        </div>
        {captcha}
      </form>
    </AuthLayout>
  )
}

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10 relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-[420px] bg-hero-glow pointer-events-none" />
      <div className="w-full max-w-sm relative animate-scale-in">
        <div className="flex flex-col items-center mb-7">
          <div className="w-16 h-16 rounded-2xl bg-brand-gradient text-white flex items-center justify-center shadow-lift">
            <HangerIcon className="w-8 h-8" />
          </div>
          <h1 className="heading-xl mt-5 text-center">{title}</h1>
          {subtitle && <p className="text-sm text-muted mt-2 text-center max-w-xs">{subtitle}</p>}
        </div>

        <div className="card-glass p-6 rounded-3xl">
          {children}
        </div>
      </div>
    </div>
  )
}
