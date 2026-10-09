import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { AlertTriangle, Info } from 'lucide-react'
import { cx } from '@/lib/utils'

/**
 * Sistema de confirmación basado en promesas. Sustituye al `window.confirm`
 * nativo del navegador con un modal que respeta la estética de la app.
 *
 * Uso:
 *
 *   const confirm = useConfirm()
 *   const ok = await confirm({
 *     title: 'Eliminar prenda',
 *     message: 'Esta acción no se puede deshacer.',
 *     confirmText: 'Eliminar',
 *     destructive: true,
 *   })
 *   if (!ok) return
 *   // … acción
 */

export interface ConfirmOptions {
  title: string
  message?: string
  confirmText?: string
  cancelText?: string
  /** Si true, el botón confirmar es rojo (acción destructiva) y se enfoca Cancelar. */
  destructive?: boolean
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

interface QueueItem {
  options: ConfirmOptions
  resolve: (value: boolean) => void
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<QueueItem[]>([])

  const confirm: ConfirmFn = useCallback((options) => {
    return new Promise<boolean>((resolve) => {
      setQueue((q) => [...q, { options, resolve }])
    })
  }, [])

  const current = queue[0]

  function close(value: boolean) {
    setQueue((q) => {
      const [first, ...rest] = q
      first?.resolve(value)
      return rest
    })
  }

  // Cerrar con Escape, bloquear scroll del body mientras está abierto
  useEffect(() => {
    if (!current) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false)
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [current])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {current && (
        <ConfirmModalUI
          options={current.options}
          onConfirm={() => close(true)}
          onCancel={() => close(false)}
        />
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm debe usarse dentro de <ConfirmProvider>')
  return ctx
}

function ConfirmModalUI({
  options,
  onConfirm,
  onCancel,
}: {
  options: ConfirmOptions
  onConfirm: () => void
  onCancel: () => void
}) {
  const { title, message, confirmText, cancelText, destructive } = options
  const Icon = destructive ? AlertTriangle : Info

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center px-3 sm:px-6 animate-fade-in">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-surface rounded-t-3xl sm:rounded-3xl w-full sm:max-w-sm overflow-hidden shadow-2xl border border-line-soft animate-scale-in safe-bottom">
        <div className="p-5 sm:p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className={cx(
              'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
              destructive
                ? 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300'
                : 'bg-brand-soft text-brand-700'
            )}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="flex-1 pt-0.5 min-w-0">
              <h2 className="heading-md mb-1 break-words">{title}</h2>
              {message && (
                <p className="text-sm text-muted whitespace-pre-line break-words">{message}</p>
              )}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="btn-secondary flex-1"
              autoFocus={!!destructive}
            >
              {cancelText ?? 'Cancelar'}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className={cx('flex-1', destructive ? 'btn-danger' : 'btn-primary')}
              autoFocus={!destructive}
            >
              {confirmText ?? 'Confirmar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
