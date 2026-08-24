import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { AuthLayout } from './Login'
import PasswordInput from '@/components/shared/PasswordInput'
import GoogleSignInButton from '@/components/shared/GoogleSignInButton'

export default function Register() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null); setInfo(null)
    if (password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.')
    setLoading(true)
    const { data, error } = await supabase.auth.signUp({ email, password })
    setLoading(false)
    if (error) return setError(error.message)
    if (data.session) navigate('/armario', { replace: true })
    else setInfo('Te hemos enviado un email para confirmar tu cuenta.')
  }

  return (
    <AuthLayout title="Crea tu armario" subtitle="Organiza tu ropa y véndela cuando quieras.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" required value={email}
            onChange={(e) => setEmail(e.target.value)} className="input" placeholder="tu@email.com" />
        </div>
        <div>
          <label className="label" htmlFor="password">Contraseña</label>
          <PasswordInput
            id="password"
            required
            value={password}
            minLength={6}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres"
          />
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}
        {info && <p className="text-sm text-emerald-700 bg-emerald-50 rounded-xl px-3 py-2">{info}</p>}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Creando…' : <>Crear cuenta <ArrowRight className="w-4 h-4" /></>}
        </button>

        <p className="text-sm text-center text-muted pt-1">
          ¿Ya tienes cuenta? <Link to="/login" className="text-brand-700 font-semibold hover:underline">Entra</Link>
        </p>

        <GoogleSignInButton />
      </form>
    </AuthLayout>
  )
}
