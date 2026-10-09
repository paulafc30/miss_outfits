import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import { getErrorMessage } from '@/lib/utils'

const FORMSPREE_FORM_ID = import.meta.env.VITE_FORMSPREE_FORM_ID as string | undefined
const FORMSPREE_ENDPOINT = FORMSPREE_FORM_ID
  ? `https://formspree.io/f/${FORMSPREE_FORM_ID}`
  : undefined
const APP_NAME = 'Miss Outfits'
const APP_VERSION = '0.2.0'

const TYPE_LABELS: Record<string, string> = {
  suggestion: 'Sugerencia',
  bug: 'Bug',
  other: 'Feedback',
}

export interface FeedbackPayload {
  type: 'suggestion' | 'bug' | 'other'
  message: string
  email?: string
}

export function useSubmitFeedback() {
  const { user } = useAuth()

  return useMutation({
    mutationFn: async ({ type, message, email }: FeedbackPayload) => {
      if (!message?.trim()) throw new Error('El mensaje es obligatorio')

      const trimmed = message.trim()
      const replyEmail = email?.trim() || user?.email || null
      const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : null

      // 1. Guardar en Supabase (siempre)
      const { data: row, error } = await supabase
        .from('feedback')
        .insert({
          user_id: user?.id ?? null,
          type,
          message: trimmed,
          email: replyEmail,
          user_agent: userAgent,
          app_version: APP_VERSION,
        })
        .select()
        .single()

      if (error) throw error

      // 2. Enviar por email via Formspree (best-effort)
      let emailSent = false
      let emailError: string | null = null

      if (!FORMSPREE_ENDPOINT) {
        emailError = 'No hay VITE_FORMSPREE_FORM_ID configurada'
      } else {
        try {
          const typeLabel = TYPE_LABELS[type]
          const bodyText = [
            `Tipo: ${typeLabel}`,
            `Usuario: ${user?.email ?? 'anónimo'}`,
            replyEmail ? `Responder a: ${replyEmail}` : null,
            '',
            'Mensaje:',
            trimmed,
            '',
            '---',
            `User Agent: ${userAgent ?? 'n/a'}`,
            `Feedback ID: ${row?.id ?? 'n/a'}`,
          ]
            .filter(Boolean)
            .join('\n')

          const res = await fetch(FORMSPREE_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({
              _subject: `[${APP_NAME}] ${typeLabel}`,
              email: replyEmail || 'noreply@missoutfits.app',
              message: bodyText,
            }),
          })
          const json = await res.json().catch(() => ({}))
          emailSent = res.ok && json.ok !== false
          if (!emailSent) {
            emailError = json.errors?.map((e: { message?: string }) => e.message).join(', ') ?? `HTTP ${res.status}`
          }
        } catch (err) {
          emailError = getErrorMessage(err, 'Error de red')
        }
      }

      return { row, emailSent, emailError }
    },
  })
}
