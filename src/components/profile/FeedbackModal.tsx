import { useState } from 'react';
import {
  Lightbulb,
  Bug,
  Mail,
  CheckCircle2,
  MailWarning,
  AlertTriangle,
} from 'lucide-react';
import Modal from '@/components/shared/Modal';
import { useSubmitFeedback, type FeedbackPayload } from '@/hooks/useFeedback';
import { useAuth } from '@/hooks/useAuth';
import { cx, getErrorMessage } from '@/lib/utils';

const SUPPORT_EMAIL = 'contacto@ferava.es';

const TYPES: {
  value: FeedbackPayload['type'];
  label: string;
  icon: typeof Bug;
  placeholder: string;
}[] = [
  {
    value: 'suggestion',
    label: 'Sugerencia',
    icon: Lightbulb,
    placeholder: '¿Qué mejorarías o añadirías?',
  },
  {
    value: 'bug',
    label: 'Fallo',
    icon: Bug,
    placeholder: 'Describe qué ocurre, en qué pantalla y qué esperabas…',
  },
  {
    value: 'other',
    label: 'Otro',
    icon: Mail,
    placeholder: 'Cuéntanos lo que necesites…',
  },
];

type Result = { emailSent: boolean; emailError: string | null };

export default function FeedbackModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const submit = useSubmitFeedback();
  const [type, setType] = useState<FeedbackPayload['type']>('suggestion');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState(user?.email ?? '');
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  function handleClose() {
    onClose();
    // Reset con delay para que no se vea el flash al cerrar
    setTimeout(() => {
      setType('suggestion');
      setMessage('');
      setEmail(user?.email ?? '');
      setFormError(null);
      setResult(null);
    }, 300);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    try {
      const res = await submit.mutateAsync({ type, message, email });
      setResult({ emailSent: res.emailSent, emailError: res.emailError });
    } catch (err) {
      setFormError(getErrorMessage(err, 'No se pudo enviar'));
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Sugerencias y fallos">
      {result ? (
        <div className="space-y-4">
          {result.emailSent ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 p-6 text-center border border-emerald-200 dark:border-emerald-500/20">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="font-semibold text-ink">
                  ¡Gracias por tu mensaje!
                </p>
                <p className="text-sm text-muted mt-1">
                  Lo revisaremos pronto. Si dejaste tu email, te respondemos.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-2xl bg-amber-50 dark:bg-amber-500/10 p-6 text-center border border-amber-200 dark:border-amber-500/20">
              <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center">
                <MailWarning className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="font-semibold text-ink">Mensaje guardado</p>
                <p className="text-sm text-muted mt-1">
                  Guardado correctamente, pero el email no pudo enviarse. Lo
                  veremos igualmente.
                </p>
              </div>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="inline-flex items-center gap-1.5 text-xs text-brand-700 hover:underline">
                <Mail className="w-3.5 h-3.5" /> {SUPPORT_EMAIL}
              </a>
              {result.emailError && (
                <p className="text-[11px] text-muted">
                  Detalle: {result.emailError}
                </p>
              )}
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setResult(null)}
              className="btn-secondary flex-1">
              Enviar otro
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="btn-primary flex-1">
              Cerrar
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-muted">
            ¿Has detectado un fallo o se te ocurre una mejora? Lo guardamos y
            llega al equipo automáticamente.
          </p>

          {/* Tipo */}
          <div>
            <span className="label">Tipo</span>
            <div className="grid grid-cols-3 gap-2 mt-1.5">
              {TYPES.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setType(value)}
                  className={cx(
                    'flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-xs font-medium border transition',
                    type === value
                      ? 'bg-brand-gradient text-white border-transparent shadow-lift'
                      : 'bg-surface-soft text-muted border-line hover:text-ink',
                  )}>
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Mensaje */}
          <div>
            <label className="label">Mensaje</label>
            <textarea
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              maxLength={2000}
              placeholder={TYPES.find((t) => t.value === type)?.placeholder}
              className="input w-full resize-none mt-1.5"
            />
            <div className="flex justify-end mt-1">
              <span className="text-[11px] text-muted">
                {message.length}/2000
              </span>
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="label">
              Email para responderte{' '}
              <span className="font-normal text-muted">(opcional)</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className="input w-full mt-1.5"
            />
          </div>

          {formError && (
            <div className="flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 p-3 text-sm text-red-700 dark:text-red-300">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <p>{formError}</p>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleClose}
              className="btn-secondary flex-1">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submit.isPending || !message.trim()}
              className="btn-primary flex-1">
              {submit.isPending ? 'Enviando…' : 'Enviar'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
