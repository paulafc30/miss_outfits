# Miss Outfits

[![CI](https://github.com/paulafc30/mi_armario/actions/workflows/ci.yml/badge.svg)](https://github.com/paulafc30/mi_armario/actions/workflows/ci.yml)

PWA para gestionar tu ropa: **armario digital**, **ropa a la venta** (Wallapop / Vinted), **lista de deseos**, **calendario de outfits** y una **estilista con IA** que sugiere looks según el armario y el clima.

**Demo en producción:** <https://miss-outfits.ferava.es> — pulsa **«Ver demo sin registrarme»** en la pantalla de inicio de sesión para entrar con datos de ejemplo, sin crear cuenta.

<!-- Añade aquí capturas: ![Armario](docs/screenshots/armario.png) -->

## Qué incluye

- **Armario:** prendas con varias fotos, categorías, temporadas, colores (con extracción automática), material, talla y marca. Outfits, «Completa tu look» y compartir un outfit como imagen.
- **IA:** sugerencias de outfit y outfits diarios según ocasión y clima (Groq + Open-Meteo), chat con estilista y «Prettify» (quitar fondo de la foto **en el navegador**, WASM).
- **Venta:** flujo Baúl → En Venta → Vendida → Archivada, generador de descripciones y compartir desde Wallapop/Vinted (Web Share Target). La sincronización por bookmarklets está **pausada** hasta decidir cómo implementarla bien.
- **Deseos e inspiración:** listas con vista previa automática por URL.
- **Calendario:** historial de looks, planificación y estadísticas.
- **Perfil:** medidas, tipo de silueta y ajuste por talla, tema claro/oscuro, exportación de datos (CSV/JSON).
- **PWA** instalable en iOS y Android.

## Stack

| Capa | Tecnología |
| --- | --- |
| Frontend | React 18, TypeScript (strict), Vite, Tailwind CSS (tokens semánticos + modo oscuro), React Router 6, TanStack Query, Zustand, Zod |
| Backend | Supabase: Auth, PostgreSQL con RLS, Storage y Edge Functions (Deno) |
| IA y servicios | Groq (`openai/gpt-oss-120b`), Open-Meteo, microlink.io, `@imgly/background-removal` |
| Calidad | Vitest, ESLint, GitHub Actions (lint + tipos + tests + build) |
| Despliegue | Vercel (auto-deploy desde `main`) + Supabase gestionado |

## Arquitectura en 30 segundos

```
src/
  pages/        rutas (una por pantalla)
  components/   UI por dominio: armario, venta, wishlist, calendario, profile, shared…
  hooks/        TODO el acceso a datos (React Query sobre Supabase); las páginas no llaman a Supabase
  lib/          funciones puras sin React (fáciles de testear)
  types/        tipos del esquema
supabase/
  migrations/   0001…0028, numeradas e idempotentes (RLS + GRANTs explícitos)
  functions/    Edge Functions: suggest-outfit, daily-outfits, chat-stylist (+ _shared/)
docs/           ARCHITECTURE, CODE_STYLE y ADRs (decisiones de diseño)
```

Las decisiones de diseño están razonadas en [`docs/adr/`](docs/adr/README.md) y la guía completa en [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Seguridad

- **RLS en todas las tablas**: cada usuaria solo ve sus filas. Los GRANTs son explícitos y mínimos.
- **Edge Functions**: autenticación por JWT, CORS limitado al dominio de producción, validación de entradas (ocasión, coordenadas, historial del chat…), **rate limit por usuario** (más estricto para cuentas de demo), errores genéricos al cliente y detalle solo en logs.
- **CSP y cabeceras** (`vercel.json`): `default-src 'self'`, sin `unsafe-eval`, `frame-ancestors 'none'`, etc.
- Las claves privadas (`GROQ_API_KEY`, `service_role`) viven **solo** en los secrets de Supabase; el frontend usa únicamente la clave `anon`, protegida por RLS.
- La entrada que llega por URL (bookmarklets, compartir) se valida con Zod y las URLs de usuario solo se enlazan si son `http(s)`.

## Puesta en marcha

Requisitos: Node 20+ y un proyecto de [Supabase](https://supabase.com).

```bash
git clone https://github.com/paulafc30/mi_armario.git miss-outfits
cd miss-outfits
npm install
cp .env.example .env      # y rellena las variables
npm run dev               # http://localhost:5174
```

### Variables de entorno (`.env`)

| Variable | Obligatoria | Descripción |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Sí | URL del proyecto (Settings → API) |
| `VITE_SUPABASE_ANON_KEY` | Sí | Clave `anon public` |
| `VITE_HCAPTCHA_SITE_KEY` | No | Site key (pública) de hCaptcha. Necesaria si activas CAPTCHA en Supabase Auth |
| `VITE_FORMSPREE_FORM_ID` | No | Formulario de Formspree para el feedback por email |
| `VITE_VINTED_PROFILE_URL` | No | Solo si se reactiva la sincronización con Vinted (pausada) |

### Base de datos

Ejecuta **en orden** los archivos de `supabase/migrations/` en el SQL Editor (o con `supabase db push`). Todas son idempotentes.

### Edge Functions y secretos

```bash
supabase link --project-ref <TU_REF>
supabase secrets set GROQ_API_KEY=<tu clave de Groq>
supabase functions deploy suggest-outfit daily-outfits chat-stylist
```

Si cambias de dominio, actualiza `APP_ORIGIN` en `supabase/functions/_shared/cors.ts`.

### Modo demo (opcional)

El botón «Ver demo» usa sesiones anónimas de Supabase Auth y la función SQL `seed_demo_data()` (migración `0027`):

1. Authentication → Sign In / Providers → activa **Allow anonymous sign-ins**.
   Recomendado: Authentication → Attack Protection → **hCaptcha** (pega el *secret* en Supabase y la *site key* en `VITE_HCAPTCHA_SITE_KEY`, también en Vercel). El front envía el `captchaToken` en login, registro, recuperar contraseña y demo.
2. Ejecuta la migración `0027_demo_seed.sql`.
3. Opcional: activa la extensión `pg_cron` para que `cleanup_demo_users()` borre a diario las demos de más de 3 días.

Detalles y alternativas descartadas en [ADR 0009](docs/adr/0009-demo-mode-anonymous-sessions.md).

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Typecheck + build de producción |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run test:run` | Tests (Vitest) una sola vez |

## Estado del proyecto

La integración con Pinterest está **pausada** (la API denegó el permiso); el código se conserva comentado y documentado para poder retomarla. Ver [`ROADMAP.md`](ROADMAP.md) para lo implementado y lo pendiente.
