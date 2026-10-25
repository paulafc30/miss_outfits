import { create } from 'zustand'

export interface SearchFilters {
  colors: string[]
  sizes: string[]
  materials: string[]
  brands: string[]
  /** IDs de ubicación; '__none__' = prendas sin ubicación. */
  locations: string[]
}

const EMPTY_FILTERS: SearchFilters = {
  colors: [],
  sizes: [],
  materials: [],
  brands: [],
  locations: [],
}

interface SearchState {
  query: string
  setQuery: (q: string) => void
  filtersOpen: boolean
  setFiltersOpen: (open: boolean) => void
  /**
   * El botón de filtro vive en la barra de búsqueda global (AppShell), visible
   * en todas las páginas, pero el panel de filtros solo existe en el DOM
   * dentro de la tab "Prendas" de Armario. Sin este flag, el botón parecía
   * "no desplegarse" en cualquier otra página/tab porque no había nada que
   * mostrar. Cada página que renderiza el panel debe activarlo mientras esté
   * montado (y desactivarlo al desmontarse).
   */
  filtersEnabled: boolean
  setFiltersEnabled: (enabled: boolean) => void
  filters: SearchFilters
  toggleFilter: (key: keyof SearchFilters, value: string) => void
  clearFilters: () => void
  hasFilters: boolean
}

export const useSearchStore = create<SearchState>((set, get) => ({
  query: '',
  setQuery: (query) => set({ query }),

  filtersOpen: false,
  setFiltersOpen: (filtersOpen) => set({ filtersOpen }),

  filtersEnabled: false,
  setFiltersEnabled: (filtersEnabled) => set(filtersEnabled ? { filtersEnabled } : { filtersEnabled, filtersOpen: false }),

  filters: EMPTY_FILTERS,
  toggleFilter: (key, value) => {
    const current = get().filters[key]
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value]
    const filters = { ...get().filters, [key]: next }
    const hasFilters = Object.values(filters).some((arr) => arr.length > 0)
    set({ filters, hasFilters })
  },
  clearFilters: () => set({ filters: EMPTY_FILTERS, hasFilters: false }),
  hasFilters: false,
}))
