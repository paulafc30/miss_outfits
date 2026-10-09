// Cliente compartido de Groq para las Edge Functions de IA.
//
// El plan gratuito de Groq tiene un limite de tokens/minuto compartido por
// todas las llamadas (daily-outfits + suggest-outfit + chat-stylist). Si se
// alcanza, Groq responde 429 e indica cuanto esperar en el propio mensaje de
// error (p.ej. "Please try again in 1.3725s"). En vez de fallar directamente,
// esperamos ese tiempo y reintentamos una vez.
export const GROQ_MODEL = 'openai/gpt-oss-120b'

export async function callGroqWithRetry(body: Record<string, unknown>): Promise<Response> {
  const doFetch = () => fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('GROQ_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  let res = await doFetch()
  if (res.status === 429) {
    const errText = await res.text()
    const match = errText.match(/try again in ([\d.]+)s/i)
    const waitMs = match ? Math.ceil(parseFloat(match[1]) * 1000) + 200 : 2000
    await new Promise((resolve) => setTimeout(resolve, Math.min(waitMs, 10000)))
    res = await doFetch()
  }
  return res
}
