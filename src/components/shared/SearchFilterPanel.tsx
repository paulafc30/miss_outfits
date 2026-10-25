import { useSearchStore } from '@/store/search'
import { CLOTHING_COLORS } from '@/components/shared/ColorPicker'
import { SIZE_OPTIONS, MATERIAL_OPTIONS } from '@/lib/options'
import { cx } from '@/lib/utils'
import type { Location } from '@/types/database'

export const NO_LOCATION = '__none__'

interface Props {
  /** Marcas únicas extraídas de las prendas del usuario */
  brands: string[]
  /** Ubicaciones de la usuaria (armario, cómoda...) */
  locations?: Location[]
}

function PillButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'px-2.5 py-1 rounded-full text-xs font-medium border transition',
        active
          ? 'bg-brand-gradient text-white border-transparent shadow-lift'
          : 'bg-surface-soft border-line text-muted hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}

export default function SearchFilterPanel({ brands, locations = [] }: Props) {
  const { filtersOpen, filters, toggleFilter } = useSearchStore()

  if (!filtersOpen) return null

  return (
    <div className="bg-surface border border-line rounded-2xl p-4 space-y-4 animate-fade-in shadow-soft">
      {/* Colores */}
      <div>
        <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Color</p>
        <div className="flex flex-wrap gap-2">
          {CLOTHING_COLORS.map((c) => {
            const active = filters.colors.includes(c.name)
            const isMulti = c.hex === 'multicolor'
            return (
              <button
                key={c.name}
                type="button"
                onClick={() => toggleFilter('colors', c.name)}
                title={c.name}
                className={cx(
                  'w-7 h-7 rounded-full border-2 transition-transform hover:scale-110',
                  active ? 'border-brand-500 scale-110 shadow-lift' : c.border ? 'border-line' : 'border-transparent',
                )}
                style={{
                  background: isMulti
                    ? 'conic-gradient(from 0deg, #ef4444, #f59e0b, #10b981, #3b82f6, #8b5cf6, #ec4899, #ef4444)'
                    : c.hex,
                }}
              />
            )
          })}
        </div>
        {filters.colors.length > 0 && (
          <p className="text-[11px] text-muted mt-1">{filters.colors.join(', ')}</p>
        )}
      </div>

      {/* Tallas */}
      <div>
        <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Talla</p>
        <div className="flex flex-wrap gap-1.5">
          {SIZE_OPTIONS.map((s) => (
            <PillButton key={s} active={filters.sizes.includes(s)} onClick={() => toggleFilter('sizes', s)}>
              {s}
            </PillButton>
          ))}
        </div>
      </div>

      {/* Tejido */}
      <div>
        <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Tejido</p>
        <div className="flex flex-wrap gap-1.5">
          {MATERIAL_OPTIONS.map((m) => (
            <PillButton key={m} active={filters.materials.includes(m)} onClick={() => toggleFilter('materials', m)}>
              {m}
            </PillButton>
          ))}
        </div>
      </div>

      {/* Ubicación */}
      {locations.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Ubicación</p>
          <div className="flex flex-wrap gap-1.5">
            {locations.map((l) => (
              <PillButton key={l.id} active={filters.locations.includes(l.id)} onClick={() => toggleFilter('locations', l.id)}>
                {l.name}
              </PillButton>
            ))}
            <PillButton active={filters.locations.includes(NO_LOCATION)} onClick={() => toggleFilter('locations', NO_LOCATION)}>
              Sin ubicación
            </PillButton>
          </div>
        </div>
      )}

      {/* Marcas */}
      {brands.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Marca</p>
          <div className="flex flex-wrap gap-1.5">
            {brands.map((b) => (
              <PillButton key={b} active={filters.brands.includes(b)} onClick={() => toggleFilter('brands', b)}>
                {b}
              </PillButton>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
