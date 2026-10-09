# Architecture Decision Records (ADR)

Cada archivo de esta carpeta documenta **una decisión técnica importante** con su contexto, alternativas consideradas y consecuencias.

## ¿Por qué ADRs?

- Cuando alguien (yo en 6 meses, o una IA leyendo el repo) pregunta "¿por qué se hizo así?", la respuesta está aquí.
- Evitar revisitar decisiones ya tomadas sin nuevo contexto.
- Documentar restricciones que parecen invisibles en el código.

## Formato

Cada ADR sigue esta estructura:

```markdown
# ADR-NNNN: Título corto

**Estado:** propuesto | aceptado | reemplazado por ADR-XXXX
**Fecha:** YYYY-MM-DD

## Contexto
Qué situación motivó la decisión.

## Decisión
Qué se decidió, en una o dos frases claras.

## Alternativas consideradas
Lo que NO se eligió y por qué.

## Consecuencias
Lo bueno, lo malo y lo que esto implica a futuro.
```

## Índice

| # | Decisión | Estado |
|---|---|---|
| [0001](./0001-stack-react-vite-supabase.md) | Stack: React + Vite + Supabase (sin Next.js, sin Firebase) | aceptado |
| [0002](./0002-semantic-css-vars-dark-mode.md) | Modo oscuro vía CSS variables semánticas, no `dark:` variants | aceptado |
| [0003](./0003-custom-confirm-modal.md) | Sistema custom de confirmaciones con `useConfirm()` basado en promesas | aceptado |
| [0004](./0004-multi-image-via-separate-table-trigger.md) | Multi-imagen por prenda vía tabla separada + trigger de portada | aceptado |
| [0005](./0005-explicit-grants-for-supabase.md) | GRANTs explícitos en todas las tablas | aceptado |
| [0006](./0006-client-side-image-compression.md) | Compresión de imágenes client-side antes del upload | aceptado |
| [0007](./0007-web-share-target-with-sessionstorage.md) | Web Share Target + handoff vía sessionStorage | aceptado |
| [0008](./0008-microlink-for-url-previews.md) | microlink.io como servicio externo para previews de URL | aceptado |
| [0009](./0009-demo-mode-anonymous-sessions.md) | Modo demo con sesiones anónimas y seeder SQL | aceptado |

## Cómo añadir un ADR nuevo

1. Crea el archivo siguiente: `adr/NNNN-titulo-en-kebab-case.md` (incremental, padded a 4 dígitos).
2. Rellena las cinco secciones (Estado, Fecha, Contexto, Decisión, Alternativas, Consecuencias).
3. Añade la fila al índice de arriba.
4. Si esta decisión deprecia una anterior, marca la antigua como "reemplazado por ADR-NNNN".
