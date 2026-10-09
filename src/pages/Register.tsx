import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { authErrorMessage, MIN_PASSWORD_LENGTH } from '@/lib/authErrors'
import { AuthLayout } from './Login'
import PasswordInput from '@/components/shared/PasswordInput'
import GoogleSignInButton from '@/components/shared/GoogleSignInButton'
import { useCaptcha } from '@/hooks/useCaptcha'

export default function Register() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { captcha, getToken } = useCaptcha()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null); setInfo(null)
    if (password.length < MIN_PASSWORD_LENGTH) return setError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`)
    setLoading(true)
    try {
      const captchaToken = await getToken()
      const { data, error } = await supabase.auth.signUp({ email, password, options: { captchaToken } })
      if (error) return setError(authErrorMessage(error))
      if (data.session) navigate('/armario', { replace: true })
      else setInfo('Te hemos enviado un email para confirmar tu cuenta.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se ha podido crear la cuenta.')
    } finally {
      setLoading(false)
    }
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
            minLength={MIN_PASSWORD_LENGTH}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
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
        {captcha}
      </form>
    </AuthLayout>
  )
}
