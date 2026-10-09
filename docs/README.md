# Miss Outfits — Documentación

Bienvenida al hub de documentación del proyecto. Este directorio es **la guía de supervivencia** del repo. Si alguien (humano o IA) llega nuevo, leer estos cuatro archivos cubre el 80% de las preguntas.

## Mapa de la documentación

| Archivo | Para qué sirve |
|---|---|
| [`README.md`](./README.md) — *estás aquí* | Visión general y atajos. |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Cómo se conectan los módulos, flujos de datos, dependencias clave. |
| [`CODE_STYLE.md`](./CODE_STYLE.md) | Convenciones de código, naming, comentarios, patrones de UI. |
| [`adr/`](./adr/) | Decisiones técnicas con su porqué (Architecture Decision Records). |
| [`../ROADMAP.md`](../ROADMAP.md) | Estado vivo: lo implementado, en curso, pendiente y backlog. |
| [`../.cursorrules`](../.cursorrules) | Reglas para que las IAs editen código respetando convenciones. |

## Qué es Miss Outfits

App web personal para **organizar la ropa, gestionar lo que pones a la venta en Wallapop/Vinted, mantener una lista de deseos y planificar outfits**. Pensada para uso individual (no SaaS multiusuario), aunque la arquitectura es multi-tenant gracias a Row Level Security de Supabase.

Las cinco secciones son:

- **Armario** (sección) — galería de prendas con categorías, outfits y un calendario de "qué llevé / qué llevaré hoy".
- **A la Venta** — flujo Baúl → En Venta → Vendida → Archivada con toggles Wallapop/Vinted y tracker de días publicada.
- **Lista de Deseos** — items organizados en listas (Verano, Regalos, Rebajas…), con preview automático de URL.
- **Ideas** (Inspiración) — atajos a boards de Pinterest y secciones de novedades de tiendas favoritas.
- **Perfil** — auth, medidas + test de silueta, modo claro/oscuro/sistema, foto de perfil.

## Stack rápido

```
Frontend:  React 18 + Vite + TypeScript + TailwindCSS
State:     Zustand (búsqueda global) + React Query (cache de datos)
Routing:   React Router v6
UI:        Custom (sin shadcn ni Material) + lucide-react para iconos
Backend:   Supabase (Auth + PostgreSQL + Storage)
Despliegue: Vercel (frontend) + Supabase managed (backend)
PWA:       manifest + service worker, instalable iOS y Android
Tests:     Vitest sobre lib/ pura
```

## Quick start

```bash
git clone <repo>
cd miss-outfits
npm install
cp .env.example .env   # rellena VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm run dev            # http://localhost:5174
```

Y en Supabase ejecuta en orden las migraciones de `supabase/migrations/0001_*.sql` hasta la última. Para el detalle completo de setup (URLs de auth, bucket de imágenes, etc.) → [`../README.md`](../README.md) en la raíz.

## Estructura clave

```
src/
├── components/
│   ├── armario/       # CRUD prendas, outfits, categorías, share collage
│   ├── venta/         # Cards de venta, descripción AI, iconos plataformas
│   ├── wishlist/      # CRUD items + gestión de listas
│   ├── inspiracion/   # Form para boards de Pinterest y tiendas
│   ├── calendario/    # Grid mensual, stats, day detail modal
│   ├── profile/       # Settings rows, modales de edición, medidas
│   ├── auth/          # ProtectedRoute
│   └── shared/        # Modal, ConfirmModal, MultiImagePicker, ColorPicker, etc.
├── pages/             # Una por ruta: Armario, Venta, Wishlist, Inspiracion, Perfil, Share, Login...
├── hooks/             # useAuth, useClothes, useOutfits, useWears, useProfile...
├── lib/               # supabase, theme, description, bodyType, sizeFit, options, calendar, images...
├── store/             # search (Zustand)
└── types/             # database.ts (Profile, Clothe, Outfit, Wear, Inspiration...)
supabase/migrations/   # 28 migraciones numeradas 0001-0028, idempotentes
public/                # favicon, iconos PWA, manifest, service worker, vercel.json
docs/                  # esta carpeta
```

## Comandos principales

```bash
npm run dev          # arranca Vite en puerto 5174
npm run build        # compila para producción (tsc + vite build)
npm run preview      # sirve el build local
npm run lint         # ESLint
npm test             # Vitest en modo watch
npm run test:run     # Vitest single pass (CI)
```

## Para retomar el proyecto tras semanas sin tocarlo

1. `git pull` y `npm install` (por si hay nuevas dependencias).
2. Revisa migraciones nuevas en `supabase/migrations/` y ejecuta las que falten.
3. Lee la sección **"En curso / pendiente inmediato"** de `ROADMAP.md` para saber qué se quedó a medias.
4. `npm run dev` → http://localhost:5174.

## Cuándo actualizar qué

| Cambio | Documentación a tocar |
|---|---|
| Nueva feature implementada | `ROADMAP.md` (mover de backlog a hecho). |
| Decisión técnica relevante | Nuevo archivo en `docs/adr/`. |
| Nueva convención de código | `CODE_STYLE.md`. |
| Nuevo flujo de datos | `ARCHITECTURE.md`. |
| Cambio de stack / setup | `../README.md` raíz. |
