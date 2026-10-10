import { useEffect, useState } from 'react'
import { LogOut, User, Mail, Lock, Sun, Moon, Monitor, Info, Sparkles, Trash2, Ruler, Download, MessageCircle } from 'lucide-react'
import { exportArmario } from '@/lib/exportArmario'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useProfile, useUpdateProfile } from '@/hooks/useProfile'
import { useTheme, ThemeChoice } from '@/lib/theme'
import { cx, getErrorMessage } from '@/lib/utils'
import { uploadAvatar, deleteAvatar } from '@/lib/images'
import { compressImage } from '@/lib/imageCompression'
import { useConfirm } from '@/components/shared/ConfirmModal'
import { calculateBodyType } from '@/lib/bodyType'
import SettingsRow, { SettingsSection } from '@/components/profile/SettingsRow'
import EditFieldModal from '@/components/profile/EditFieldModal'
import ProfileHeader from '@/components/profile/ProfileHeader'
import AvatarPickerModal from '@/components/profile/AvatarPickerModal'
import MeasurementsModal from '@/components/profile/MeasurementsModal'
import BodyTypeCard from '@/components/profile/BodyTypeCard'
import FeedbackModal from '@/components/profile/FeedbackModal'
import type { Profile as ProfileType } from '@/types/database'

type Field = 'username' | 'email' | 'password' | null

export default function Profile() {
  const { user } = useAuth()
  const [theme, setTheme] = useTheme()
  const confirm = useConfirm()
  const { data: profile } = useProfile()
  const updateProfile = useUpdateProfile()

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [avatarPath, setAvatarPath] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false)
  const [editing, setEditing] = useState<Field>(null)
  const [measurementsOpen, setMeasurementsOpen] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (!user) return
    setEmail(user.email ?? '')
  }, [user])

  useEffect(() => {
    if (!profile) return
    setUsername(profile.username ?? '')
    setAvatarUrl(profile.avatar_url ?? null)
    setAvatarPath(profile.avatar_path ?? null)
  }, [profile])

  const bodyType = calculateBodyType({
    bust_cm: profile?.bust_cm ?? null,
    waist_cm: profile?.waist_cm ?? null,
    hips_cm: profile?.hips_cm ?? null,
  })

  function showToast(kind: 'ok' | 'err', text: string) {
    setToast({ kind, text })
    setTimeout(() => setToast(null), 2500)
  }

  async function handleExport() {
    setExporting(true)
    try {
      await exportArmario()
      showToast('ok', 'Exportacion descargada (JSON + CSV)')
    } catch (err) {
      showToast('err', getErrorMessage(err, 'Error al exportar'))
    } finally {
      setExporting(false)
    }
  }

  async function handleAvatarPick(file: File) {
    if (!user) return
    setUploadingAvatar(true)
    try {
      const compressed = await compressImage(file, { maxSize: 480, quality: 0.85 })
      const { url, path } = await uploadAvatar(compressed, user.id)
      await updateProfile.mutateAsync({ avatar_url: url, avatar_path: path })
      if (avatarPath) await deleteAvatar(avatarPath).catch(() => null)
      setAvatarUrl(url)
      setAvatarPath(path)
      showToast('ok', 'Foto actualizada')
      setAvatarPickerOpen(false)
    } catch (err) {
      showToast('err', getErrorMessage(err, 'No se pudo subir la foto'))
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function handleAvatarPreset(url: string) {
    if (!user) return
    setUploadingAvatar(true)
    try {
      await updateProfile.mutateAsync({ avatar_url: url, avatar_path: null })
      // Solo borramos del storage si habia una foto real subida antes (los
      // avatares predisenados son archivos estaticos de /public, no viven
      // en el bucket, asi que nunca hay que "borrarlos").
      if (avatarPath) await deleteAvatar(avatarPath).catch(() => null)
      setAvatarUrl(url)
      setAvatarPath(null)
      showToast('ok', 'Avatar actualizado')
      setAvatarPickerOpen(false)
    } catch (err) {
      showToast('err', getErrorMessage(err, 'No se pudo actualizar el avatar'))
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function handleAvatarRemove() {
    // Antes exigia avatarPath, pero los avatares predisenados no tienen
    // path (no viven en el bucket) y con uno activo el boton no hacia nada.
    if (!user || !avatarUrl) return
    const ok = await confirm({
      title: 'Quitar foto de perfil',
      message: 'Volveras a la inicial coral por defecto. Puedes subir otra foto cuando quieras.',
      confirmText: 'Quitar',
      destructive: true,
    })
    if (!ok) return
    setUploadingAvatar(true)
    try {
      if (avatarPath) await deleteAvatar(avatarPath).catch(() => null)
      await updateProfile.mutateAsync({ avatar_url: null, avatar_path: null })
      setAvatarUrl(null)
      setAvatarPath(null)
      showToast('ok', 'Foto eliminada')
    } catch (err) {
      showToast('err', getErrorMessage(err, 'No se pudo quitar la foto'))
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function saveUsername(value: string) {
    if (!user) return { error: 'Sin sesion' }
    try {
      await updateProfile.mutateAsync({ username: value })
      setUsername(value)
      showToast('ok', 'Nombre actualizado')
    } catch (err) {
      return { error: getErrorMessage(err, 'Error al guardar') }
    }
  }

  async function saveEmail(value: string) {
    const { error } = await supabase.auth.updateUser({ email: value })
    if (error) return { error: error.message }
    return { info: 'Te enviamos un correo para confirmar el cambio.' }
  }

  async function savePassword(value: string) {
    const { error } = await supabase.auth.updateUser({ password: value })
    if (error) return { error: error.message }
    showToast('ok', 'Contrasena actualizada')
  }

  async function saveMeasurements(patch: Partial<ProfileType>) {
    try {
      await updateProfile.mutateAsync(patch)
      showToast('ok', 'Medidas guardadas')
    } catch (err) {
      return { error: getErrorMessage(err, 'Error al guardar medidas') }
    }
  }

  async function handleSignOut() {
    const ok = await confirm({
      title: 'Cerrar sesion',
      message: 'Tendras que volver a iniciar sesion para acceder a tu armario.',
      confirmText: 'Cerrar sesion',
      destructive: true,
    })
    if (!ok) return
    await supabase.auth.signOut()
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pb-6 space-y-6">
      <ProfileHeader
        username={username}
        email={email}
        avatarUrl={avatarUrl}
        uploading={uploadingAvatar}
        onOpenPicker={() => setAvatarPickerOpen(true)}
      />

      <AvatarPickerModal
        open={avatarPickerOpen}
        onClose={() => setAvatarPickerOpen(false)}
        onPickFile={handleAvatarPick}
        onPickPreset={handleAvatarPreset}
        currentAvatarUrl={avatarUrl}
        uploading={uploadingAvatar}
      />

      {toast && (
        <div className={cx(
          'p-3 rounded-xl text-sm text-center',
          toast.kind === 'ok'
            ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
            : 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300'
        )}>{toast.text}</div>
      )}

      <SettingsSection title="Tu cuerpo">
        <BodyTypeCard bodyType={bodyType} onEdit={() => setMeasurementsOpen(true)} />
      </SettingsSection>

      <SettingsSection title="Cuenta">
        <SettingsRow icon={User}  label="Nombre"     value={username || 'Sin nombre'} onClick={() => setEditing('username')} />
        <SettingsRow icon={Mail}  label="Email"      value={email}                    onClick={() => setEditing('email')} />
        <SettingsRow icon={Lock}  label="Contrasena" value="........"                  onClick={() => setEditing('password')} />
        <SettingsRow icon={Ruler} label="Medidas y tallas" value={profile?.bust_cm ? 'Configuradas' : 'Sin configurar'} onClick={() => setMeasurementsOpen(true)} />
        {avatarUrl && (
          <SettingsRow icon={Trash2} iconAccent="rose" label="Quitar foto de perfil" onClick={handleAvatarRemove} chevron={false} />
        )}
      </SettingsSection>

      <SettingsSection title="Apariencia" description={
        theme === 'system' ? 'Sigue el tema del sistema operativo.' :
        theme === 'dark'   ? 'Tema oscuro activado.' : 'Tema claro activado.'
      }>
        <div className="p-3">
          <ThemeSegmented value={theme} onChange={setTheme} />
        </div>
      </SettingsSection>

      <SettingsSection title="Datos" description="Exporta tu armario como copia de seguridad. Descarga un JSON completo y un CSV de tus prendas.">
        <SettingsRow
          icon={Download}
          label={exporting ? 'Exportando...' : 'Exportar armario'}
          value="JSON + CSV"
          onClick={handleExport}
          chevron={false}
        />
      </SettingsSection>

      <SettingsSection title="Ayuda">
        <SettingsRow
          icon={MessageCircle}
          iconAccent="brand"
          label="Sugerencias y fallos"
          value="Cuentanos"
          onClick={() => setFeedbackOpen(true)}
        />
      </SettingsSection>

      <SettingsSection title="Acerca de">
        <SettingsRow icon={Sparkles} label="Version" value="0.2.0" chevron={false} />
        <SettingsRow icon={Info}     label="Politica de privacidad" onClick={() => window.open('/privacidad', '_blank')} />
        <SettingsRow icon={Info}     label="Terminos de servicio" onClick={() => window.open('/terminos', '_blank')} />
      </SettingsSection>

      <div className="card overflow-hidden">
        <SettingsRow icon={LogOut} label="Cerrar sesion" destructive onClick={handleSignOut} chevron={false} />
      </div>

      <p className="text-center text-xs text-muted pb-2">
        Desarrollado por{' '}
        <a href="https://ferava.es" target="_blank" rel="noreferrer" className="font-semibold text-brand-700 hover:underline">
          Ferava Software
        </a>
      </p>

      <EditFieldModal
        open={editing === 'username'}
        onClose={() => setEditing(null)}
        title="Cambiar nombre"
        label="Nombre de usuario"
        initialValue={username}
        placeholder="Tu nombre"
        onSave={saveUsername}
      />
      <EditFieldModal
        open={editing === 'email'}
        onClose={() => setEditing(null)}
        title="Cambiar email"
        label="Nuevo email"
        type="email"
        initialValue={email}
        hint="Te enviaremos un correo de confirmacion al nuevo email."
        onSave={saveEmail}
      />
      <EditFieldModal
        open={editing === 'password'}
        onClose={() => setEditing(null)}
        title="Cambiar contrasena"
        label="Nueva contrasena"
        type="password"
        placeholder="Minimo 6 caracteres"
        minLength={6}
        onSave={savePassword}
      />
      <MeasurementsModal
        open={measurementsOpen}
        onClose={() => setMeasurementsOpen(false)}
        initial={profile ?? null}
        onSave={saveMeasurements}
      />
      <FeedbackModal
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
      />
    </div>
  )
}

function ThemeSegmented({ value, onChange }: { value: ThemeChoice; onChange: (v: ThemeChoice) => void }) {
  const options: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
    { value: 'light',  label: 'Claro',   icon: Sun },
    { value: 'dark',   label: 'Oscuro',  icon: Moon },
    { value: 'system', label: 'Sistema', icon: Monitor },
  ]
  return (
    <div className="grid grid-cols-3 gap-1 bg-surface-soft rounded-xl p-1">
      {options.map((o) => {
        const Icon = o.icon
        const active = value === o.value
        return (
          <button key={o.value} onClick={() => onChange(o.value)}
            className={cx(
              'flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition',
              active ? 'bg-surface text-ink shadow-soft' : 'text-muted hover:text-ink'
            )}>
            <Icon className="w-4 h-4" /> {o.label}
          </button>
        )
      })}
    </div>
  )
}
