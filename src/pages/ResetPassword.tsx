import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { authErrorMessage, MIN_PASSWORD_LENGTH } from '@/lib/authErrors'
import { AuthLayout } from './Login'
import PasswordInput from '@/components/shared/PasswordInput'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sessionReady, setSessionReady] = useState<boolean | null>(null)

  // Cuando la usuaria llega desde el enlace del email, supabase-js procesa
  // el token automáticamente (detectSessionInUrl está activo). Comprobamos
  // si hay sesión de recuperación: si no la hay, mostramos aviso porque
  // updateUser fallaría.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessionReady(!!data.session)
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < MIN_PASSWORD_LENGTH) return setError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`)
    if (password !== confirm) return setError('Las contraseñas no coinciden.')
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) return setError(authErrorMessage(error))
    navigate('/armario', { replace: true })
  }

  return (
    <AuthLayout title="Nueva contraseña" subtitle="Define una contraseña nueva para tu cuenta.">
      {sessionReady === false ? (
        <div className="space-y-3">
          <p className="text-sm text-red-700 bg-red-50 dark:bg-red-500/10 dark:text-red-300 rounded-xl px-3 py-3">
            Este enlace de recuperación ha caducado o ya se usó. Pide uno nuevo desde la pantalla de login.
          </p>
          <button onClick={() => navigate('/recuperar')} className="btn-secondary w-full">
            Volver a pedir enlace
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="new-password">Nueva contraseña</label>
            <PasswordInput
              id="new-password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
            />
          </div>
          <div>
            <label className="label" htmlFor="confirm-password">Confirmar contraseña</label>
            <PasswordInput
              id="confirm-password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repítela"
            />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-500/10 rounded-xl px-3 py-2">{error}</p>}

          <button disabled={loading || sessionReady === null} className="btn-primary w-full">
            {loading ? 'Guardando…' : 'Guardar contraseña'}
          </button>
        </form>
      )}
    </AuthLayout>
  )
}
