import { useEffect, useRef, useState } from 'react'
import { X, Send, MapPin, RefreshCw, Shirt, ThumbsUp, ThumbsDown, RotateCcw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cx, getErrorMessage } from '@/lib/utils'

interface ReferencedClothe {
  id: string
  name: string
  image_url: string | null
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  referenced_clothes?: ReferencedClothe[]
  feedback?: 'positive' | 'negative'
  isError?: boolean
  isRateLimit?: boolean
  retryText?: string
  occasionHint?: string
}

const RATE_LIMIT_PHRASE = 'Demasiadas peticiones'
const RETRY_DELAY = 10 // segundos

const QUICK_QUESTIONS = [
  'Que me pongo hoy?',
  'Que me pongo para una cena de empresa?',
  'Busco un look casual para el fin de semana',
  'Que me pongo si llueve?',
  'Sugereme un look de verano',
]

function RobotChatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="24" y1="4" x2="24" y2="11" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="24" cy="3.5" r="2" fill="currentColor" />
      <rect x="8" y="11" width="32" height="22" rx="9" fill="currentColor" />
      <path d="M14 33 L10 42 L22 36" fill="currentColor" />
      <circle cx="18" cy="22" r="3" fill="white" />
      <circle cx="30" cy="22" r="3" fill="white" />
    </svg>
  )
}

function useGeolocation() {
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null)
  const [asked, setAsked] = useState(false)

  function request() {
    setAsked(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => setCoords(null),
    )
  }

  return { coords, asked, request }
}

function ClothesPreview({
  clothes,
  onZoom,
}: {
  clothes: ReferencedClothe[]
  onZoom: (c: ReferencedClothe) => void
}) {
  if (clothes.length === 0) return null
  return (
    <div className="flex gap-2 mt-2.5 flex-wrap">
      {clothes.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onZoom(c)}
          className="flex flex-col items-center gap-1 w-16 group"
          title={c.name}
        >
          <div className="w-16 h-16 rounded-xl overflow-hidden bg-surface border border-line shrink-0 group-hover:ring-2 group-hover:ring-brand-500 transition">
            {c.image_url ? (
              <img src={c.image_url} alt={c.name} className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Shirt className="w-5 h-5 text-muted/40" />
              </div>
            )}
          </div>
          <p className="text-[9px] text-muted text-center leading-tight line-clamp-2 w-full">{c.name}</p>
        </button>
      ))}
    </div>
  )
}

function FeedbackButtons({
  given,
  onFeedback,
}: {
  given?: 'positive' | 'negative'
  onFeedback: (r: 'positive' | 'negative') => void
}) {
  if (given) {
    return (
      <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-line/60">
        {given === 'positive' ? (
          <span className="flex items-center gap-1 text-xs text-emerald-600">
            <ThumbsUp className="w-3.5 h-3.5" /> Gracias por tu valoracion
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-muted">
            <ThumbsDown className="w-3.5 h-3.5" /> Tomado en cuenta para la proxima
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-line/60">
      <span className="text-xs text-muted flex-1">Te sirve esta sugerencia?</span>
      <button
        type="button"
        onClick={() => onFeedback('positive')}
        className="p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-muted hover:text-emerald-600 transition"
        title="Me gusta"
      >
        <ThumbsUp className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => onFeedback('negative')}
        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-muted hover:text-red-500 transition"
        title="No me convence"
      >
        <ThumbsDown className="w-4 h-4" />
      </button>
    </div>
  )
}

function ClotheZoom({ clothe, onClose }: { clothe: ReferencedClothe; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative bg-surface rounded-2xl overflow-hidden shadow-2xl max-w-xs w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-black/40 text-white hover:bg-black/60 transition"
        >
          <X className="w-4 h-4" />
        </button>
        {clothe.image_url ? (
          <img src={clothe.image_url} alt={clothe.name} className="w-full aspect-square object-cover" />
        ) : (
          <div className="w-full aspect-square flex items-center justify-center bg-surface-soft">
            <Shirt className="w-16 h-16 text-muted/30" />
          </div>
        )}
        <div className="p-3">
          <p className="text-sm font-semibold text-ink text-center">{clothe.name}</p>
        </div>
      </div>
    </div>
  )
}

function extractOccasion(messages: Message[]): string {
  const userMessages = messages.filter((m) => m.role === 'user').slice(-3)
  return userMessages.map((m) => m.content).join(' ').slice(0, 100)
}

// Countdown que auto-retries cuando llega a 0
function RateLimitCountdown({
  onRetry,
  disabled,
}: {
  onRetry: () => void
  disabled: boolean
}) {
  const [secs, setSecs] = useState(RETRY_DELAY)

  useEffect(() => {
    if (secs <= 0) {
      onRetry()
      return
    }
    const t = setTimeout(() => setSecs((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [secs])

  return (
    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-amber-200 dark:border-amber-500/30 text-xs text-amber-700 dark:text-amber-400">
      {secs > 0 ? (
        <span className="flex-1">Reintentando en {secs}s...</span>
      ) : (
        <span className="flex-1">Reintentando...</span>
      )}
      <button
        type="button"
        onClick={onRetry}
        disabled={disabled || secs <= 0}
        className="flex items-center gap-1 font-medium hover:opacity-70 disabled:opacity-40 transition"
      >
        <RotateCcw className="w-3.5 h-3.5" /> Ya
      </button>
    </div>
  )
}

export default function StylistChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [weather, setWeather] = useState('')
  const [zoomedClothe, setZoomedClothe] = useState<ReferencedClothe | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { coords, asked, request: requestLocation } = useGeolocation()

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: 'Hola! Soy Ada, tu asesora de moda personal. Preguntame que ponerte hoy, para una ocasion especial, o cualquier duda sobre tu armario.',
      }])
    }
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  function getSuggestedIds(msgs: Message[]): string[] {
    const ids = new Set<string>()
    msgs.forEach((m) => {
      if (m.role === 'assistant' && m.referenced_clothes) {
        m.referenced_clothes.forEach((c) => ids.add(c.id))
      }
    })
    return Array.from(ids)
  }

  async function send(text: string, currentMessages = messages) {
    const userMsg = text.trim()
    if (!userMsg || loading) return

    setInput('')
    const history = currentMessages
      .filter((m) => !m.isError)
      .map((m) => ({ role: m.role, content: m.content }))
    const suggested_ids = getSuggestedIds(currentMessages)

    setMessages((prev) => {
      const last = prev[prev.length - 1]
      if (last?.role === 'user' && last.content === userMsg) return prev
      return [...prev, { role: 'user', content: userMsg }]
    })
    setLoading(true)

    try {
      const res = await supabase.functions.invoke('chat-stylist', {
        body: {
          message: userMsg,
          lat: coords?.lat ?? null,
          lon: coords?.lon ?? null,
          history,
          suggested_ids,
        },
      })

      const data = res.data as {
        reply?: string
        referenced_clothes?: ReferencedClothe[]
        weather?: string
        error?: string
      } | null

      if (res.error || data?.error) {
        const errMsg = data?.error ?? res.error?.message ?? 'Error desconocido'
        const isRateLimit = errMsg.includes(RATE_LIMIT_PHRASE)
        setMessages((prev) => [...prev, {
          role: 'assistant',
          content: isRateLimit
            ? 'Groq tiene un limite de peticiones por minuto. Reintentando automaticamente...'
            : errMsg,
          isError: true,
          isRateLimit,
          retryText: userMsg,
        }])
        return
      }

      const { reply = '', referenced_clothes, weather: w } = data!
      if (w && !weather) setWeather(w)
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: reply,
        referenced_clothes: referenced_clothes ?? [],
      }])
    } catch (err) {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: getErrorMessage(err, 'Hubo un problema al conectar con el asistente.'),
        isError: true,
        retryText: userMsg,
      }])
    } finally {
      setLoading(false)
    }
  }

  async function retry(msgIndex: number) {
    const retryMsg = messages[msgIndex]?.retryText
    if (!retryMsg) return
    const withoutError = messages.filter((_, i) => i !== msgIndex)
    setMessages(withoutError)
    await send(retryMsg, withoutError)
  }

  async function handleFeedback(msgIndex: number, rating: 'positive' | 'negative') {
    const msg = messages[msgIndex]
    if (!msg || msg.role !== 'assistant') return

    setMessages((prev) => prev.map((m, i) =>
      i === msgIndex ? { ...m, feedback: rating } : m
    ))

    const occasion = extractOccasion(messages.slice(0, msgIndex))
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('stylist_feedback').insert({
      user_id: user.id,
      reply_text: msg.content,
      clothe_ids: (msg.referenced_clothes ?? []).map((c) => c.id),
      rating,
      occasion: occasion || null,
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    send(input)
  }

  function reset() {
    setMessages([{
      role: 'assistant',
      content: 'Hola de nuevo! En que te puedo ayudar?',
    }])
    setWeather('')
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cx(
          'fixed bottom-24 right-4 z-30 rounded-full shadow-lift flex items-center justify-center transition-all',
          'bg-brand-gradient text-white hover:scale-110 active:scale-95',
          open && 'hidden',
        )}
        style={{ width: '56px', height: '56px' }}
        title="Ada - Asesora de moda"
      >
        <RobotChatIcon className="w-8 h-8" />
      </button>

      {zoomedClothe && (
        <ClotheZoom clothe={zoomedClothe} onClose={() => setZoomedClothe(null)} />
      )}

      {open && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center sm:p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />

          <div className="relative w-full sm:max-w-md h-[85vh] sm:h-[600px] bg-page rounded-t-3xl sm:rounded-3xl flex flex-col shadow-2xl overflow-hidden">

            <div className="flex items-center gap-3 px-4 py-3 border-b border-line bg-surface shrink-0">
              <div className="w-9 h-9 rounded-full bg-brand-gradient flex items-center justify-center shrink-0">
                <RobotChatIcon className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-ink text-sm">Ada</p>
                <p className="text-xs text-muted truncate">
                  {weather || 'Asesora de moda personal'}
                </p>
              </div>
              <div className="flex gap-1">
                {!asked && (
                  <button
                    onClick={requestLocation}
                    className="p-2 rounded-lg hover:bg-surface-soft text-muted hover:text-brand-700 transition"
                    title="Activar ubicacion para recomendaciones por tiempo"
                  >
                    <MapPin className="w-4 h-4" />
                  </button>
                )}
                {coords && (
                  <span className="flex items-center gap-1 text-xs text-emerald-600 px-2 py-1 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg">
                    <MapPin className="w-3 h-3" /> Ubicacion activa
                  </span>
                )}
                <button onClick={reset} className="p-2 rounded-lg hover:bg-surface-soft text-muted transition" title="Nueva conversacion">
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button onClick={() => setOpen(false)} className="p-2 rounded-lg hover:bg-surface-soft text-muted transition">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {messages.map((msg, i) => {
                const hasClothes = msg.role === 'assistant'
                  && !msg.isError
                  && (msg.referenced_clothes?.length ?? 0) > 0
                return (
                  <div key={i} className={cx('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                    <div className={cx(
                      'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                      msg.role === 'user'
                        ? 'bg-brand-gradient text-white rounded-br-sm'
                        : msg.isRateLimit
                          ? 'bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-300 rounded-bl-sm'
                          : msg.isError
                            ? 'bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-300 rounded-bl-sm'
                            : 'bg-surface border border-line text-ink rounded-bl-sm',
                    )}>
                      {msg.content}
                      {msg.isRateLimit && msg.retryText && (
                        <RateLimitCountdown
                          onRetry={() => retry(i)}
                          disabled={loading}
                        />
                      )}
                      {msg.isError && !msg.isRateLimit && msg.retryText && (
                        <button
                          type="button"
                          onClick={() => retry(i)}
                          disabled={loading}
                          className="flex items-center gap-1.5 mt-2 pt-2 border-t border-red-200 dark:border-red-500/30 text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-800 disabled:opacity-50 transition"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Reintentar
                        </button>
                      )}
                      {hasClothes && (
                        <>
                          <ClothesPreview
                            clothes={msg.referenced_clothes!}
                            onZoom={(c) => setZoomedClothe(c)}
                          />
                          <FeedbackButtons
                            given={msg.feedback}
                            onFeedback={(r) => handleFeedback(i, r)}
                          />
                        </>
                      )}
                    </div>
                  </div>
                )
              })}

              {loading && (
                <div className="flex justify-start">
                  <div className="bg-surface border border-line rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1.5 items-center">
                    {[0, 150, 300].map((d) => (
                      <span key={d} className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce" style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {messages.length <= 1 && (
              <div className="px-4 pb-2 flex gap-2 overflow-x-auto no-scrollbar shrink-0">
                {QUICK_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    className="shrink-0 text-xs bg-surface border border-line rounded-full px-3 py-1.5 text-muted hover:text-ink hover:border-brand-400 transition whitespace-nowrap"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex gap-2 px-4 py-3 border-t border-line bg-surface shrink-0">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Pregunta algo..."
                className="input flex-1 text-sm"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="btn-primary p-2.5 shrink-0 disabled:opacity-40"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
