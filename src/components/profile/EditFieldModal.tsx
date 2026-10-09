import { useEffect, useState } from 'react'
import Modal from '@/components/shared/Modal'
import PasswordInput from '@/components/shared/PasswordInput'
import { getErrorMessage } from '@/lib/utils'

export default function EditFieldModal({
  open,
  onClose,
  title,
  label,
  initialValue = '',
  type = 'text',
  placeholder,
  hint,
  minLength,
  onSave,
}: {
  open: boolean
  onClose: () => void
  title: string
  label: string
  initialValue?: string
  type?: 'text' | 'email' | 'password'
  placeholder?: string
  hint?: string
  minLength?: number
  onSave: (value: string) => Promise<{ error?: string; info?: string } | void>
}) {
  const [value, setValue] = useState(initialValue)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setValue(initialValue)
    setError(null)
    setInfo(null)
  }, [open, initialValue])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null); setInfo(null)
    if (minLength && value.length < minLength) {
      setError(`Mínimo ${minLength} caracteres.`); return
    }
    setSubmitting(true)
    try {
      const res = await onSave(value)
      if (res?.error) { setError(res.error); return }
      if (res?.info) { setInfo(res.info); return }
      onClose()
    } catch (err) {
      setError(getErrorMessage(err, 'Error al guardar'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">{label}</label>
          {type === 'password' ? (
            <PasswordInput
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={placeholder}
              autoFocus
              required
              autoComplete="new-password"
            />
          ) : (
            <input
              type={type}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={placeholder}
              className="input"
              autoFocus
              required
            />
          )}
          {hint && <p className="text-xs text-muted mt-1.5">{hint}</p>}
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-500/10 rounded-xl px-3 py-2">{error}</p>}
        {info && <p className="text-sm text-emerald-700 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl px-3 py-2">{info}</p>}

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button type="submit" disabled={submitting} className="btn-primary flex-1">
            {submitting ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
