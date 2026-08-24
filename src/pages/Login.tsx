import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import HangerIcon from '@/components/shared/HangerIcon'
import PasswordInput from '@/components/shared/PasswordInput'
import GoogleSignInButton from '@/components/shared/GoogleSignInButton'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) return setError(error.message)
    navigate('/armario', { replace: true })
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
