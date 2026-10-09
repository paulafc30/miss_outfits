# Arquitectura

Visión técnica de cómo se conectan los módulos y por dónde fluye la información.

## Vista de alto nivel

```
                     ┌─────────────────────────┐
                     │    Usuaria (móvil/web)  │
                     └────────────┬────────────┘
                                  │ HTTPS
                                  ▼
                        ┌─────────────────┐
                        │ Vercel (static) │  ← bundle Vite (React + Tailwind)
                        │ + Service Worker│  ← PWA + Web Share Target
                        └────────┬────────┘
                                 │
                supabase-js (anon key + JWT por sesión)
                                 │
                                 ▼
            ┌─────────────────────────────────────────┐
            │                Supabase                  │
            ├──────────────┬───────────────┬───────────┤
            │  Auth (JWT)  │ PostgREST API │  Storage  │
            └──────┬───────┴───────┬───────┴─────┬─────┘
                   │               │             │
                   ▼               ▼             ▼
              users table     RLS-protected   2 buckets:
              (Supabase)      tables (public  clothes-images
                              schema) + RLS    avatars
```

Sin backend propio. Todo lo que necesita lógica server-side se hace dentro de Supabase (RLS, triggers, funciones SQL). La única "API externa" que llamamos desde el cliente es `microlink.io` para previews de URLs.

## Stack por capa

| Capa | Tecnología | Por qué |
|---|---|---|
| Build | Vite | Arranque rápido, HMR instantáneo, sin SSR (no lo necesitamos). |
| Tipos | TypeScript strict | Refactors seguros, autocompletado en formularios. |
| UI | React 18 + functional components + hooks | Estándar de facto, equipo de 1. |
| Estilos | TailwindCSS + CSS variables | Modo oscuro semántico sin `dark:` por todos lados. |
| Routing | React Router 6 | Rutas anidadas con `ProtectedRoute` + `AppShell`. |
| Datos | React Query | Cache, refetch al focus, invalidación por queryKey. |
| Estado UI ligero | Zustand | Solo para el query del buscador global. |
| Auth + datos | Supabase (Postgres + Auth + Storage) | RLS resuelve aislamiento por usuaria sin backend. |
| Tests | Vitest | Mismo runner que Vite, ergonómico. |
| Despliegue | Vercel + Supabase managed | Auto-deploy en push a main, no infra que mantener. |
| PWA | manifest + service worker | Instalable + Web Share Target. |

## Módulos del frontend

```
pages/        →  rutas declaradas en App.tsx
   │
   ├─ usa →  components/  (UI específica por sección)
   │            │
   │            └─ usa →  components/shared/  (UI reutilizable)
   │
   ├─ usa →  hooks/      (datos y mutaciones via Supabase)
   │            │
   │            └─ usa →  lib/supabase.ts  (cliente Supabase singleton)
   │
   └─ usa →  lib/        (funciones puras, helpers, business logic)
```

Reglas:
- **Las páginas no hablan con Supabase directamente.** Siempre vía un hook.
- **Los componentes no hacen `fetch`.** Reciben datos por props o vía hook.
- **`lib/` no conoce React.** Solo funciones puras (Tipo de cuerpo, fit, descripción, compresión, etc.) → testeables con Vitest.

## Flujos de datos clave

### 1. Auth y sesión

```
Usuaria abre /armario
    │
    ▼
ProtectedRoute → useAuth() → supabase.auth.getSession()
    │
    ├─ session.user existe → renderiza <AppShell><Outlet/></AppShell>
    └─ no hay session → <Navigate to="/login" replace />
```

`supabase.auth.onAuthStateChange` mantiene el state sincronizado. La sesión se guarda automáticamente en `localStorage` por supabase-js. JWT incluye `auth.uid()` que usan las políticas RLS en cada query.

### 2. Lectura de datos con cache

```
Componente monta
    │
    ▼
useClothes(['closet']) → useQuery con queryKey=['clothes', ['closet']]
    │
    ├─ cache HIT → devuelve data inmediato
    └─ cache MISS o stale → fetch a Supabase → guarda en cache → re-render
```

`queryKey` conventions:
- `['clothes', statuses[]]` — prendas por estado(s)
- `['clothes', 'all']` — todas
- `['outfits']` — todos los outfits con sus items + imágenes
- `['wears', startISO, endISO]` — wears en rango
- `['wishlist', folderId ?? 'all']`
- `['inspirations', kind ?? 'all']`
- `['profile', userId]`

Cualquier mutación invalida los queryKeys relacionados con `qc.invalidateQueries({ queryKey: [...] })`.

### 3. Upload de imágenes

```
Usuaria selecciona archivo en MultiImagePicker
    │
    ▼
compressImage(file, { maxSize: 1600, quality: 0.82 })
    │
    ▼
uploadImage(compressed, userId) → bucket "clothes-images"
    │  path: <user_id>/<uuid>.jpg
    │  URL pública (bucket es public)
    ▼
INSERT INTO clothe_images (clothe_id, user_id, url, path, position)
    │
    ▼
Trigger PostgreSQL: clothe_images_sync_cover
    │
    ▼
UPDATE clothes SET image_url = <primera imagen> WHERE id = clothe_id
```

La compresión es **client-side antes del upload** para ahorrar cuota de Supabase y acelerar (típicamente 4MB → 250-400KB). Si falla, se sube el original como fallback.

Mismo patrón para `outfit_images` con su propio trigger `sync_outfit_cover_image` que actualiza `outfits.cover_image_url`.

### 4. Web Share Target

```
Usuaria comparte desde Wallapop/Vinted/Zara/etc.
    │
    ▼
OS muestra Miss Outfits en el chooser (gracias a manifest.share_target)
    │
    ▼
Navegador abre /share?title=…&text=…&url=…
    │
    ▼
Share.tsx parsea params → muestra chooser de destino
    │
    ├─ Armario → storeSharedPayload → navigate('/armario')
    ├─ Venta   → idem → navigate('/venta')
    └─ Deseos  → idem → navigate('/wishlist')
        │
        ▼
    Página destino: consumeSharedPayload(target) en useEffect mount
        │
        ▼
    Si Wallapop/Vinted: detectSalePlatform(url) + extractTitleFromShareText(text)
        │
        ▼
    setPrefill({...}) → abre ClotheForm/WishlistForm pre-rellenado
        │
        ▼
    Form: fetchUrlPreview(url) → microlink → og:image + og:title + og:description + og:price
```

`sessionStorage` se usa para pasar el payload entre Share.tsx y la página destino. Sobrevive a la navegación pero no a un cierre completo del navegador.

### 5. Operaciones destructivas

```
Click en "Eliminar prenda"
    │
    ▼
const ok = await confirm({ title, message, destructive: true })
    │
    ├─ ok === true   → ejecuta mutación
    └─ ok === false  → no-op
```

`useConfirm()` viene del `ConfirmProvider` montado en `main.tsx` (z-index 40, encima de cualquier Modal). Sistema basado en promesas para que el flujo sea lineal con `async/await` y no callbacks anidados. Detalles → [`adr/0003-custom-confirm-modal.md`](./adr/0003-custom-confirm-modal.md).

### 6. Modo oscuro

```
applyTheme(getStoredTheme()) en main.tsx (antes del render)
    │
    ▼
Añade clase .dark a <html> si toca
    │
    ▼
CSS variables semánticas en :root y .dark:
    --c-page, --c-surface, --c-ink, --c-muted, --c-line, --c-brand-soft
    │
    ▼
Tailwind config expone esas vars como colores:
    bg-page, bg-surface, text-ink, text-muted, border-line, …
    │
    ▼
Componentes usan las clases semánticas → flip automático al cambiar tema
```

Cero variantes `dark:` en componentes. La paleta entera vive en `src/index.css`. Razón → [`adr/0002-semantic-css-vars-dark-mode.md`](./adr/0002-semantic-css-vars-dark-mode.md).

## Esquema de base de datos

Tablas en orden de dependencia:

```
auth.users  (gestionado por Supabase)
    │
    ▼
profiles  (1:1 con auth.users, trigger handle_new_user crea fila)
    │ avatar, medidas (bust/waist/hips/...), tallas habituales
    │
    ├─→ categories  (defaults creados via trigger al crearse profile)
    │
    ├─→ clothes  (prendas)
    │       │ status (closet|baul|en_venta|vendida|archivada)
    │       │ colors[] (multi-color hasta 3 en UI)
    │       │ listed_at, sold_at (timestamps de transición)
    │       │
    │       ├─→ clothe_images  (1:N, trigger sincroniza clothes.image_url)
    │       │
    │       └─→ outfit_items  (N:M con outfits)
    │
    ├─→ outfits
    │       │
    │       ├─→ outfit_images  (1:N, trigger sincroniza outfits.cover_image_url)
    │       └─→ outfit_items
    │
    ├─→ wishlists  (folders/listas, defaults via trigger)
    │       │
    │       └─→ wishlist  (items, FK opcional a wishlists)
    │
    ├─→ wears  (calendario, planned=true/false)
    │
    └─→ inspirations  (Pinterest + tiendas favoritas)
```

Todas las tablas:
- Tienen `user_id` con FK a `auth.users(id) ON DELETE CASCADE`.
- Tienen RLS activado.
- Política `"<tabla> all own"` que filtra por `auth.uid() = user_id`.
- GRANTs explícitos a `anon`, `authenticated`, `service_role` (preparado para el cambio de Supabase del 30-oct-2026).

Buckets de Storage:
- `clothes-images` (público) → fotos de prendas y outfits, organizadas en `<user_id>/<uuid>.<ext>`.
- `avatars` (público) → fotos de perfil, misma estructura.

Las políticas de Storage limitan escritura/borrado a la carpeta del propio usuario (`(storage.foldername(name))[1] = auth.uid()::text`).

## Triggers PostgreSQL relevantes

| Trigger | Tabla | Cuándo | Qué hace |
|---|---|---|---|
| `on_auth_user_created` | `auth.users` | AFTER INSERT | Inserta en `profiles`. |
| `profiles_create_default_categories` | `profiles` | AFTER INSERT | Crea 6 categorías por defecto. |
| `profiles_create_default_wishlist` | `profiles` | AFTER INSERT | Crea lista "Mis deseos". |
| `clothes_set_updated_at` | `clothes` | BEFORE UPDATE | Actualiza `updated_at`. |
| `clothe_images_sync_cover` | `clothe_images` | AFTER INSERT/UPDATE/DELETE | Sincroniza `clothes.image_url` con la primera imagen. |
| `outfit_images_sync_cover` | `outfit_images` | AFTER INSERT/UPDATE/DELETE | Sincroniza `outfits.cover_image_url`. |

## PWA

- `public/manifest.webmanifest` → nombre, iconos, theme_color, start_url, **share_target**.
- `public/sw.js` → service worker con cache `miss-outfits-v6`. Estrategia: network-first con fallback a cache. Solo cachea requests same-origin.
- Cuando hay cambios visuales grandes (favicon, manifest, colores), se **bumpea** la versión del cache en `sw.js` para forzar refresh.

## Decisiones técnicas con su porqué

Cada decisión arquitectónica importante tiene su propio archivo en [`adr/`](./adr/). Lectura recomendada para entender por qué algo se hizo así y no de otra forma.
