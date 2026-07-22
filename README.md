# Duke 💜

**Duke** es una PWA privada para parejas. Permite conversar en tiempo real, hacer llamadas de voz o video, jugar, guardar recuerdos, compartir estados de ánimo y registrar fechas especiales.

## Funciones incluidas

- Dos cuentas privadas por cada espacio Duke.
- Creación de pareja mediante código de invitación y PIN.
- Chat en tiempo real con texto, imágenes y respuestas.
- Llamadas de voz y videollamadas integradas con Jitsi Meet.
- Estados de ánimo y presencia reciente.
- Contador de días juntos, mensajes, recuerdos y racha.
- Recuerdos con imagen, descripción y fecha.
- Calendario de fechas especiales.
- Tres en raya sincronizado.
- Preguntas para parejas con respuestas ocultas hasta que ambos respondan.
- Ruleta de actividades.
- Diseño adaptable a teléfonos y computadoras.
- Instalación como aplicación PWA.
- Modo demostración sin base de datos.
- Seguridad mediante Supabase Auth y Row Level Security.

## Paleta visual

- Negro: `#05040A`
- Morado: `#8B5CF6`
- Azul: `#2F80ED`
- Blanco: `#FFFFFF`

## Configuración completa

### 1. Crear Supabase

1. Crea un proyecto gratuito en Supabase.
2. Abre **SQL Editor**.
3. Copia y ejecuta todo el contenido de [`supabase/schema.sql`](supabase/schema.sql).
4. En **Authentication → Providers → Email**, deja activo el acceso por correo y contraseña.
5. Para probar con rapidez puedes desactivar temporalmente la confirmación de correo. Para uso real es mejor mantenerla activa.

### 2. Conectar Duke

1. Publica este repositorio en Vercel, Netlify o GitHub Pages.
2. Abre Duke.
3. Pulsa **Configurar conexión Supabase**.
4. En Supabase abre **Project Settings → API**.
5. Copia `Project URL` y `anon public key`.
6. Pégalos en Duke y guarda.

La clave anónima es pública por diseño. Los datos quedan protegidos por las políticas RLS del archivo SQL.

### 3. Crear el espacio de pareja

1. La primera persona crea su cuenta.
2. Elige **Crear nuestro espacio**.
3. Define nombre, fecha de relación y un PIN privado.
4. Comparte el código `DUKE-XXXXXX` y el PIN por un canal seguro.
5. La segunda persona crea su cuenta y elige **Unirme con código**.

Cada cuenta solo puede pertenecer a un espacio y cada espacio admite como máximo dos personas.

## Publicar en Vercel

El proyecto es completamente estático y no requiere compilación:

- Framework preset: **Other**
- Build command: vacío
- Output directory: `.`

El archivo `vercel.json` ya contiene las rutas y cabeceras necesarias.

## Desarrollo local

No abras `index.html` directamente con `file://`, porque las PWA y algunos módulos del navegador necesitan HTTP.

```bash
python3 -m http.server 8080
```

Después abre `http://localhost:8080`.

## Privacidad

- Las tablas usan Row Level Security.
- Solo integrantes del mismo espacio pueden leer mensajes, recuerdos, fechas y juegos.
- Las imágenes se guardan en un bucket privado.
- El PIN se transforma con SHA-256 antes de enviarse a la base de datos.
- No se incluyen claves privadas ni `service_role` en el frontend.

## Nota sobre llamadas

Las llamadas se ofrecen mediante la instancia pública de Jitsi Meet. Para una instalación totalmente privada y controlada, se puede sustituir por un servidor Jitsi propio o por una implementación WebRTC con TURN.
