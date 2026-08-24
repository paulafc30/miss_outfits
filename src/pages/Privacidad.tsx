export default function Privacidad() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
      <div>
        <h1 className="heading-xl">Política de privacidad</h1>
        <p className="text-sm text-muted mt-1">Miss Outfits — última actualización: agosto de 2026.</p>
      </div>

      <div className="card p-5 space-y-5 text-sm text-ink leading-relaxed">
        <section className="space-y-1.5">
          <h2 className="font-semibold text-ink">¿Qué es Miss Outfits?</h2>
          <p className="text-muted">
            Miss Outfits es una aplicación personal de gestión de armario (registro de prendas,
            outfits, calendario de looks y venta de ropa de segunda mano) desarrollada y operada
            por Desarrollos Ferava. No es un servicio comercial abierto al público: el acceso está
            restringido a la persona propietaria de la cuenta.
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="font-semibold text-ink">Datos que se almacenan</h2>
          <p className="text-muted">
            La aplicación guarda, en una base de datos privada (Supabase, con acceso restringido
            por autenticación y políticas de seguridad a nivel de fila):
          </p>
          <ul className="list-disc list-inside text-muted space-y-1 mt-1">
            <li>Correo electrónico y credenciales de acceso (gestionadas por Supabase Auth).</li>
            <li>Fotos y datos de las prendas, outfits y listas de deseos que la usuaria introduce.</li>
            <li>Preferencias de la app (medidas, tipo de cuerpo, tema visual, etc.).</li>
            <li>
              Si se conecta la integración con Pinterest: un token de acceso OAuth, usado
              únicamente para leer los tableros y pines de la propia cuenta conectada (no se
              publica, modifica ni comparte contenido en Pinterest).
            </li>
          </ul>
        </section>

        <section className="space-y-1.5">
          <h2 className="font-semibold text-ink">Cómo se usan los datos</h2>
          <p className="text-muted">
            Los datos se usan exclusivamente para el funcionamiento de la app: mostrar el armario,
            generar sugerencias de outfits (incluyendo, opcionalmente, mediante un modelo de IA de
            terceros al que se envían descripciones de las prendas, nunca las fotos ni datos
            personales identificativos) y mostrar el clima local a partir de la ubicación que el
            navegador comparte de forma puntual. No se venden ni ceden datos a terceros con fines
            publicitarios.
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="font-semibold text-ink">Servicios de terceros utilizados</h2>
          <ul className="list-disc list-inside text-muted space-y-1">
            <li>Supabase (base de datos, autenticación y almacenamiento de imágenes).</li>
            <li>Groq (generación de sugerencias de outfit mediante IA).</li>
            <li>Open-Meteo (datos de clima, sin necesidad de cuenta ni identificación).</li>
            <li>Pinterest API (solo si la usuaria conecta voluntariamente su cuenta).</li>
          </ul>
        </section>

        <section className="space-y-1.5">
          <h2 className="font-semibold text-ink">Control sobre tus datos</h2>
          <p className="text-muted">
            Puedes exportar tus datos en cualquier momento desde Perfil → Exportar datos, revocar
            el acceso a Pinterest desde la sección Ideas, o solicitar la eliminación completa de tu
            cuenta y datos escribiendo a{' '}
            <a href="mailto:missoutfitsapp@gmail.com" className="text-brand-700 hover:underline">
              missoutfitsapp@gmail.com
            </a>.
          </p>
        </section>

        <section className="space-y-1.5">
          <h2 className="font-semibold text-ink">Contacto</h2>
          <p className="text-muted">
            Para cualquier duda sobre esta política o sobre el tratamiento de tus datos, escribe a{' '}
            <a href="mailto:missoutfitsapp@gmail.com" className="text-brand-700 hover:underline">
              missoutfitsapp@gmail.com
            </a>.
          </p>
        </section>
      </div>
    </div>
  )
}
