import { useCallback, useRef, type ReactNode } from 'react'
import HCaptcha from '@hcaptcha/react-hcaptcha'

const SITE_KEY = import.meta.env.VITE_HCAPTCHA_SITE_KEY

/**
 * hCaptcha invisible para los flujos de Supabase Auth (login, registro,
 * recuperar contraseña y demo). Supabase exige un `captchaToken` en esas
 * llamadas cuando el CAPTCHA está activado en el Dashboard.
 *
 * Si `VITE_HCAPTCHA_SITE_KEY` no está definida (p. ej. en desarrollo local sin
 * CAPTCHA), no se renderiza nada y `getToken()` devuelve `undefined`.
 *
 * Uso: renderiza `{captcha}` dentro del formulario y llama a `await getToken()`
 * justo antes de la petición. Cada token es de un solo uso.
 */
export function useCaptcha(): { captcha: ReactNode; getToken: () => Promise<string | undefined> } {
  const ref = useRef<HCaptcha>(null)

  const getToken = useCallback(async (): Promise<string | undefined> => {
    if (!SITE_KEY) return undefined
    try {
      const res = await ref.current?.execute({ async: true })
      return res?.response
    } catch (err) {
      // hCaptcha rechaza con un código (p. ej. 'invalid-data', 'rate-limited',
      // 'challenge-closed'). Se deja en consola para poder diagnosticar.
      console.warn('[hCaptcha]', err)
      throw new Error('No se ha podido completar la verificación anti-bots. Inténtalo de nuevo.')
    } finally {
      ref.current?.resetCaptcha()
    }
  }, [])

  const captcha = SITE_KEY ? <HCaptcha ref={ref} sitekey={SITE_KEY} size="invisible" /> : null
  return { captcha, getToken }
}
