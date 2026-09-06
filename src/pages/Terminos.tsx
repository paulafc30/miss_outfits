export default function Terminos() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
      <div>
        <h1 className="heading-xl">Términos de servicio</h1>
        <p className="text-sm text-muted mt-1">Miss Outfits — última actualización: septiembre de 2026.</p>
      </div>

      <div className="card p-5 space-y-5 text-sm text-ink leading-relaxed">
        <section className="space-y-1.5">
          <h2 className="font-semibold text-ink">Aceptación</h2>
          <p className="text-muted">
            Al crear una cuenta y usar Miss Outfits aceptas estos términos y la{' '}
            <a href="/privacidad" className="text-brand-700 hover:underline">política de privacidad</a>.
            Si no estás de acuerdo, no debes usar la aplicación.
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="font-semibold text-ink">Qué es el servicio</h2>
          <p className="text-muted">
            Miss Outfits es una herramienta personal de gestión de armario (registro de prendas,
            outfits, calendario de looks, venta de ropa de segunda mano y sugerencias de estilismo
            asistidas por IA), desarrollada y operada por Desarrollos Ferava. Se ofrece "tal cual",
            sin garantía de disponibilidad continua ni de ausencia de errores.
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="font-semibold text-ink">Tu cuenta</h2>
          <p className="text-muted">
            Eres responsable de mantener la confidencialidad de tus credenciales de acceso y de
            toda la actividad que ocurra en tu cuenta. Debes proporcionar datos veraces al
            registrarte y notificarnos si detectas un uso no autorizado de tu cuenta.
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="font-semibold text-ink">Contenido que subes</h2>
          <p className="text-muted">
            Las fotos, textos y datos de prendas, outfits y listas de deseos que subas son de tu
            propiedad. Nos concedes únicamente el permiso necesario para almacenarlos y mostrártelos
            dentro de la app. No debes subir contenido ilegal, de terceros sin permiso, ni intentar
            usar la app para actividades distintas a su propósito (gestión de armario personal).
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="font-semibold text-ink">Servicios de terceros</h2>
          <p className="text-muted">
            Algunas funciones dependen de servicios externos (Supabase, Groq, Pinterest, Vinted,
            Wallapop, Open-Meteo, Microlink) que tienen sus propios términos. No somos responsables
            de la disponibilidad, contenido o cambios en dichos servicios de terceros.
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="font-semibold text-ink">Uso indebido</h2>
          <p className="text-muted">
            No está permitido intentar vulnerar la seguridad de la app, acceder a datos de otras
            cuentas, saturar los servicios con peticiones automatizadas, ni realizar ingeniería
            inversa del código con fines maliciosos. Nos reservamos el derecho de suspender cuentas
            que incumplan estos términos.
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="font-semibold text-ink">Cambios y cancelación</h2>
          <p className="text-muted">
            Podemos actualizar estos términos o la app en cualquier momento; los cambios relevantes
            se reflejarán aquí con su fecha. Puedes dejar de usar el servicio y solicitar la
            eliminación de tu cuenta y datos en cualquier momento (ver política de privacidad).
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="font-semibold text-ink">Contacto</h2>
          <p className="text-muted">
            Para cualquier duda sobre estos términos, escribe a{' '}
            <a href="mailto:missoutfitsapp@gmail.com" className="text-brand-700 hover:underline">
              missoutfitsapp@gmail.com
            </a>.
          </p>
        </section>
      </div>
    </div>
  )
}
