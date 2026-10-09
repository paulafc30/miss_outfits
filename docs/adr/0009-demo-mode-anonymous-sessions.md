# ADR 0009 — Modo demo con sesiones anónimas y seeder SQL

- **Estado:** aceptado
- **Fecha:** 2026-10-09

## Contexto

Quien evalúa el proyecto (p. ej. en un proceso de selección) debería poder probar la app sin registrarse ni recibir credenciales. La app tiene datos privados por usuaria (RLS) y endpoints de IA con coste (Groq).

## Decisión

El botón «Ver demo sin registrarme» del login:

1. Crea una **sesión anónima** de Supabase Auth (`signInAnonymously`). Cada visitante tiene su propio espacio aislado por RLS.
2. Llama a la función SQL `seed_demo_data()` (migración `0027`), que rellena prendas, outfits, calendario, deseos e inspiración de ejemplo. Es `SECURITY DEFINER`, **solo ejecutable por cuentas anónimas** (comprueba el claim `is_anonymous` del JWT) e idempotente.
3. Las imágenes de ejemplo son SVG propios en `public/demo/` (sin Storage).
4. Una franja en `AppShell` avisa del modo demo y ofrece «Crear cuenta» / «Salir».
5. Las Edge Functions de IA aplican un **límite más estricto a cuentas anónimas** (por minuto y tope diario).
6. `cleanup_demo_users()` borra las cuentas anónimas antiguas (en cascada, con sus datos); se programa con `pg_cron` si está disponible.

## Alternativas descartadas

- **Cuenta de demo compartida con credenciales en el código:** todos los visitantes pisarían los datos de los demás y las credenciales quedarían públicas.
- **Modo demo solo en el cliente (datos en memoria):** no ejercitaría RLS, hooks ni Edge Functions, es decir, no demostraría la app real.

## Consecuencias

- Hay que activar «Allow anonymous sign-ins» en Supabase (y conviene un CAPTCHA para evitar abuso).
- Un visitante anónimo podría subir fotos a Storage; las cuentas se borran, pero los archivos no. Mitigación: límites de tamaño/tipo en los buckets y revisión periódica.
