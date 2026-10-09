/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_HCAPTCHA_SITE_KEY?: string
  readonly VITE_FORMSPREE_FORM_ID?: string
  readonly VITE_VINTED_PROFILE_URL?: string
  readonly VITE_PINTEREST_CLIENT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
