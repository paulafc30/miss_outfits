// Tipos generados manualmente que reflejan supabase/migrations/0001_initial_schema.sql.
// Si cambias el esquema, actualiza también estos tipos (o usa `supabase gen types`).

export type ClothesStatus =
  | 'closet'
  | 'baul'
  | 'en_venta'
  | 'vendida'
  | 'archivada'

export interface Profile {
  id: string
  username: string | null
  avatar_url: string | null
  avatar_path: string | null
  // Medidas (todas opcionales)
  height_cm: number | null
  bust_cm: number | null
  waist_cm: number | null
  hips_cm: number | null
  shoulder_cm: number | null
  weight_kg: number | null
  top_size: string | null
  bottom_size: string | null
  shoe_size: string | null
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  user_id: string
  name: string
  color: string
  created_at: string
}

export interface Location {
  id: string
  user_id: string
  name: string
  created_at: string
}

export interface Season {
  id: string
  user_id: string | null  // null = global
  name: string
  icon: string
  color: string
  is_global: boolean
  sort_order: number
  created_at: string
}

export interface Clothe {
  id: string
  user_id: string
  name: string
  category_id: string | null
  /** Ubicación física de la prenda (armario, cómoda...). */
  location_id: string | null
  image_url: string | null
  image_path: string | null
  notes: string | null
  tags: string[]
  status: ClothesStatus
  on_wallapop: boolean
  on_vinted: boolean
  price: number | null
  sold_at: string | null
  listed_at: string | null
  brand: string | null
  size: string | null
  /** @deprecated usar `colors` (array). Se mantiene para legacy/backfill. */
  color: string | null
  colors: string[]
  /** Hex exacto elegido con el slider de tono, alineado por índice con `colors`. */
  color_hexes: string[]
  material: string | null
  created_at: string
  updated_at: string
}

export interface ClotheImage {
  id: string
  clothe_id: string
  user_id: string
  url: string
  path: string | null
  position: number
  created_at: string
}

export interface Outfit {
  id: string
  user_id: string
  name: string
  cover_image_url: string | null
  created_at: string
}

export interface OutfitItem {
  outfit_id: string
  clothe_id: string
}

export interface OutfitImage {
  id: string
  outfit_id: string
  user_id: string
  url: string
  path: string | null
  position: number
  created_at: string
}

export interface Wear {
  id: string
  user_id: string
  clothe_id: string | null
  outfit_id: string | null
  wear_date: string // YYYY-MM-DD
  notes: string | null
  /** true = planeado a futuro (recordatorio). false = ya llevado / histórico. */
  planned: boolean
  created_at: string
}

export type InspirationKind = 'pinterest' | 'store'

export interface Inspiration {
  id: string
  user_id: string
  kind: InspirationKind
  title: string | null
  url: string
  image_url: string | null
  position: number
  created_at: string
}

export interface WishlistFolder {
  id: string
  user_id: string
  name: string
  color: string
  created_at: string
}

export interface WishlistItem {
  id: string
  user_id: string
  wishlist_id: string | null
  url: string
  name: string | null
  price: number | null
  image_url: string | null
  notes: string | null
  created_at: string
}

// Database type para tipar el cliente de supabase (mínimo viable)
export type Database = {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile> & { id: string }; Update: Partial<Profile> }
      categories: { Row: Category; Insert: Omit<Category, 'id' | 'created_at'> & { id?: string }; Update: Partial<Category> }
      clothes: { Row: Clothe; Insert: Omit<Clothe, 'id' | 'created_at' | 'updated_at'> & { id?: string }; Update: Partial<Clothe> }
      outfits: { Row: Outfit; Insert: Omit<Outfit, 'id' | 'created_at'> & { id?: string }; Update: Partial<Outfit> }
      outfit_items: { Row: OutfitItem; Insert: OutfitItem; Update: Partial<OutfitItem> }
      wishlist: { Row: WishlistItem; Insert: Omit<WishlistItem, 'id' | 'created_at'> & { id?: string }; Update: Partial<WishlistItem> }
    }
  }
}
