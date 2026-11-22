import { ImageOff, MoreVertical } from 'lucide-react'
import type { Clothe, Category } from '@/types/database'

export default function ClotheCard({
  clothe,
  category,
  onClick,
}: {
  clothe: Clothe
  category?: Category
  onClick?: () => void
}) {
  return (
    <button onClick={onClick} className="card overflow-hidden text-left hover:shadow-md transition group">
      <div className="aspect-square bg-surface-soft relative">
        {clothe.image_url ? (
          <img decoding="async" src={clothe.image_url} alt={clothe.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center"><ImageOff className="w-8 h-8 text-muted/50" /></div>
        )}
        <div className="absolute top-2 right-2 p-1 rounded-full bg-surface/90 opacity-0 group-hover:opacity-100 transition">
          <MoreVertical className="w-4 h-4 text-ink/80" />
        </div>
      </div>
      <div className="p-2.5">
        <p className="text-sm font-medium truncate">{clothe.name}</p>
        {category && (
          <span className="chip mt-1 bg-surface-soft text-muted gap-1.5 font-medium">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: category.color }} />
            {category.name}
          </span>
        )}
      </div>
    </button>
  )
}
