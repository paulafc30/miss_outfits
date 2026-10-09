import { useNavigate } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { isDemoUser } from '@/lib/demo'

/** Franja fija que avisa de que se está en modo demo y permite salir o crear cuenta. */
export default function DemoBanner() {
  const { user } = useAuth()
  const navigate = useNavigate()

  if (!isDemoUser(user)) return null

  async function leave(to: '/login' | '/registro') {
    await supabase.auth.signOut()
    navigate(to, { replace: true })
  }

  return (
    <div role="status" className="bg-brand-gradient text-white text-xs sm:text-sm safe-top">
      <div className="max-w-7xl mx-auto px-4 py-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <Sparkles className="w-4 h-4 shrink-0" aria-hidden />
        <span className="flex-1 min-w-[12rem]">
          Estás en <strong>modo demo</strong> con datos de ejemplo. Puedes tocar todo; los cambios se borran solos.
        </span>
        <button onClick={() => leave('/registro')} className="font-semibold underline underline-offset-2">
          Crear cuenta
        </button>
        <button onClick={() => leave('/login')} className="opacity-90 hover:opacity-100 underline underline-offset-2">
          Salir
        </button>
      </div>
    </div>
  )
}
