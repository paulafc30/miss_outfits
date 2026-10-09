# Miss Outfits — Roadmap y notas

> Documento vivo. Aquí queda registrado **todo** lo que se ha construido,
> lo que está en curso, lo que está pendiente y las ideas para el futuro.

Última actualización: 2026-10-09

---

## 0. Stack y arquitectura

- **Frontend:** Vite + React + TypeScript + TailwindCSS + Zustand + React Query + React Router + lucide-react.
- **Backend:** Supabase (Auth + PostgreSQL + Storage + Edge Functions).
- **Despliegue:** Vercel (frontend) + Supabase managed (backend).
- **PWA:** manifest + service worker, instalable en iOS y Android.
- **Localhost:** puerto **5174**.
- **Versión actual:** 0.2.0

---

## 1. Implementado ✅

### Auth y perfil
- Registro / login / recuperación de contraseña.
- Perfil estilo iOS: avatar, nombre, email, contraseña, tema claro/oscuro/sistema.
- Medidas corporales + tipo de silueta + fit check por prenda.

### Armario
- CRUD de prendas: nombre, categoría, temporada, marca, talla, colores (hasta 3), material, etiquetas, notas, precio.
- **MultiImagePicker**: galería multi-foto con drag-reorder, compresión automática, URL, cámara.
- **Prettify** (IA client-side): elimina el fondo de la foto con `@imgly/background-removal` (WASM, sin API key). Estilos: estudio blanco, crema, recorte PNG transparente. Botón deshacer (volver al original).
- Categorías editables con colores personalizables.
- **Temporadas**: Primavera/Verano/Otoño/Invierno como base global + temporadas custom (Feria, Navidad…). Una prenda puede pertenecer a varias temporadas (many-to-many via `clothe_seasons`).
- Outfits: colecciones de prendas con previsualización en mosaico y fotos propias.
- **Sugerencias de outfit con IA**: Edge Function Groq (`openai/gpt-oss-120b`) + Open-Meteo (clima). Clasifica prendas por tipo (top/bottom/fullbody/outerwear…), filtra por ocasión y temperatura, valida estructura outfit en servidor.
- Compartir outfit como imagen PNG (canvas collage 1080×1080).
- Búsqueda global filtrando por nombre, marca, color, talla, etiquetas, categoría.
- Calendario mensual: wears diarios, stats del mes, planeador de looks futuros.
- Reconocimiento automático de color dominante en la primera foto.

### Ropa a la Venta
- Flujo Baúl → En Venta → Vendida → Archivada.
- Toggles Wallapop / Vinted.
- Tracker de días publicada (badge ámbar si >30 días).
- Generador de descripciones automáticas (Wallapop + Vinted).
- **(PAUSADO, oculto en la UI)** Sync desde Wallapop/Vinted: bookmarklets JavaScript que escanean el perfil de la usuaria en cada plataforma y redirigen a la app con los datos en base64. Upsert por `vinted_id`/`wallapop_id` para evitar duplicados.
- Web Share Target: compartir desde Wallapop/Vinted/tiendas directamente a la app.

### Lista de Deseos
- CRUD con preview automático de URL (microlink.io).
- Múltiples listas con colores personalizables.

### Inspiración
- Atajos a boards de Pinterest y secciones de novedades de tiendas favoritas.
- Autorellenar título + imagen vía microlink al pegar URL.

### Infra
- RLS en todas las tablas + GRANTs explícitos.
- Buckets `clothes-images` y `avatars` con políticas por usuario.
- PWA instalable (iOS + Android).
- 28 migraciones numeradas (0001–0028).
- Tests unitarios (Vitest): bodyType, sizeFit, description, importParse, utils, sharedItem, authErrors, clotheType.
- CI en GitHub Actions: lint, typecheck, tests y build.
- **Modo demo**: sesiones anónimas + `seed_demo_data()` (ver ADR 0009).
- **Endurecimiento (oct-2026)**: rate limit por usuario en las Edge Functions, CSP, validación de entradas, GRANTs mínimos (migración 0026).

---

## 2. Pendiente inmediato 🔧

### Pinterest (pausado)
- La API denegó el permiso. El código está comentado (ruta, `usePinterest`, función `pinterest-token`, migración 0018) para retomarlo si se concede.

### Stats de ventas
- Dashboard: total ganado, invertido, neto recuperado.
- Prenda con mejor margen. Plataforma más eficaz (Wallapop vs Vinted).
- Necesita: campo `purchase_price` opcional en `clothes`.

### Stats avanzadas del calendario
- Prendas no usadas en X días → sugerencia de mover a Baúl.
- Histograma de looks por mes.
- Calor por día de la semana.

---

## 3. Backlog / ideas futuras 💡

- Escáner inteligente de prendas con IA (requiere API de visión de pago).
- Notificaciones push (recordatorios, prendas en venta sin movimiento).
- Tests E2E con Playwright.
- Tests de hooks de React Query.
- Exportar a PDF estilo lookbook.

---

## 4. Decisiones técnicas clave

- Sin Tailwind dark variants → CSS variables semánticas (surface, ink, muted, line).
- Storage: dos buckets públicos con políticas de escritura por carpeta de usuario.
- Compresión client-side antes de subir (1600px máx, JPEG 0.82).
- Sin Next.js → Vite puro (no necesitamos SSR).
- Prettify excluido del optimizador de Vite (`optimizeDeps.exclude`) por WASM.
- Bookmarklet encoding: `String.fromCharCode(8364)` para el símbolo euro (evita truncación UTF-8 en las herramientas de edición).
- Seasons: tabla global para las 4 estaciones base (user_id NULL) + custom por usuaria; relación many-to-many via `clothe_seasons`.
- Outfit suggestions: validación doble (prompt + filtro servidor) para garantizar top+bottom o fullbody en cada outfit.
- **Seguridad**: las API keys (GROQ_API_KEY) van SOLO en Supabase Dashboard → Edge Functions → Secrets. Nunca en el código ni en el chat.

---

## 5. Cómo retomar el proyecto

1. `git pull` + `npm install`.
2. Ejecutar migraciones nuevas en `supabase/migrations/`.
3. Variables de entorno: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (ver `.env.example`).
4. Secrets en Supabase: `GROQ_API_KEY`.
5. `npm run dev` → http://localhost:5174.
