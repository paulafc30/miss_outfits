import { useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Shirt, Tag, Heart, ExternalLink } from 'lucide-react'
import SettingsRow, { SettingsSection } from '@/components/profile/SettingsRow'
import { storeSharedPayload, ShareTarget, extractUrl } from '@/lib/sharedItem'
import { safeHttpUrl } from '@/lib/utils'

export default function Share() {
  const [params] = useSearchParams()
  const navigate = useNavigate()

  const { title, text, url } = useMemo(() => {
    const t = params.get('title') ?? ''
    const x = params.get('text') ?? ''
    const u = params.get('url') ?? extractUrl(x)
    return { title: t.trim(), text: x.trim(), url: u.trim() }
  }, [params])

  // Si no llega nada útil, volver al armario
  useEffect(() => {
    if (!title && !text && !url) {
      navigate('/armario', { replace: true })
    }
  }, [title, text, url, navigate])

  function pick(target: ShareTarget) {
    storeSharedPayload({ target, title, text, url })
    navigate(`/${target}`, { replace: true })
  }

  // Preferimos el título; si no hay, el primer trozo de texto; si no, la URL
  const headline = title || text.split('\n')[0] || url || 'Contenido compartido'

  return (
    <div className="max-w-md mx-auto px-4 pb-6 space-y-6">
      <div>
        <h1 className="heading-xl">¿Dónde lo guardo?</h1>
        <p className="text-sm text-muted mt-1">Has compartido algo a Miss Outfits.</p>
      </div>

      <div className="card p-4 space-y-2">
        <p className="text-sm font-medium text-ink line-clamp-3">{headline}</p>
        {url && (
          <a
            href={safeHttpUrl(url) ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-brand-700 hover:underline truncate"
          >
            <ExternalLink className="w-3 h-3 shrink-0" />
            <span className="truncate">{url}</span>
          </a>
        )}
      </div>

      <SettingsSection title="Elige destino">
        <SettingsRow
          icon={Shirt}
          label="Añadir al armario"
          value="Como prenda nueva"
          onClick={() => pick('armario')}
        />
        <SettingsRow
          icon={Tag}
          iconAccent="amber"
          label="Añadir a la venta"
          value="Empieza en Baúl"
          onClick={() => pick('venta')}
        />
        <SettingsRow
          icon={Heart}
          iconAccent="rose"
          label="Guardar en deseos"
          value="Para más tarde"
          onClick={() => pick('wishlist')}
        />
      </SettingsSection>

      <button onClick={() => navigate('/armario')} className="btn-ghost w-full">
        Cancelar
      </button>
    </div>
  )
}
