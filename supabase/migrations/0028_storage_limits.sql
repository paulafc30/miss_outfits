-- =====================================================================
-- Miss Outfits - 0028: Limites de los buckets de Storage
-- =====================================================================
-- Limita tamaño y tipo de archivo en los buckets publicos para que nadie
-- (incluidas las cuentas de demo) pueda subir archivos enormes o que no
-- sean imagenes. Se excluye SVG a proposito: un SVG servido desde un bucket
-- publico puede llevar scripts.
--
-- El front ya comprime antes de subir (fotos de prenda: max 1600 px;
-- avatares: 480 px), asi que estos limites no afectan al uso normal.
-- Idempotente.
-- =====================================================================

update storage.buckets
   set file_size_limit = 5 * 1024 * 1024,   -- 5 MB
       allowed_mime_types = array[
         'image/jpeg', 'image/png', 'image/webp', 'image/gif',
         'image/avif', 'image/heic', 'image/heif'
       ]
 where id = 'clothes-images';

update storage.buckets
   set file_size_limit = 2 * 1024 * 1024,   -- 2 MB
       allowed_mime_types = array[
         'image/jpeg', 'image/png', 'image/webp', 'image/gif',
         'image/avif', 'image/heic', 'image/heif'
       ]
 where id = 'avatars';
