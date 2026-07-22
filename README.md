# Duke 💜💙

**Duke** es una PWA privada para dos personas. Incluye chat, videollamadas, juegos, recuerdos, fechas especiales, estados de ánimo y notificaciones como “Te extraño”.

## Acceso sencillo

La página normal de Duke muestra primero una pantalla para escribir un código compartido.

Código predeterminado:

```text
2003
```

Tú y tu pareja escriben **2003** en sus respectivos teléfonos. Si el código coincide, Duke abre el inicio de sesión.

No se necesita ningún enlace especial con parámetros. Solo se usa la dirección normal que entrega Vercel, por ejemplo:

```text
https://tu-proyecto.vercel.app
```

Después del código, cada persona entra con su propia cuenta. La instalación permite máximo dos cuentas.

## Tecnología

- Frontend PWA: HTML, CSS y JavaScript.
- Backend privado: Vercel Functions.
- Base de datos: Neon PostgreSQL.
- Videollamadas: Jitsi Meet.
- Sesiones: cookies `HttpOnly`, `Secure` y tokens almacenados con hash.

La conexión de Neon nunca se envía al navegador. Solo la función de servidor puede leer `DATABASE_URL`.

## Funciones incluidas

- Código compartido de entrada.
- Registro e inicio de sesión para máximo dos cuentas.
- Un único espacio de pareja con código `DUKE-XXXXXX` y PIN.
- Chat con texto, imágenes comprimidas y respuestas.
- Estados de ánimo, presencia reciente y botón “Te extraño”.
- Llamadas de voz y videollamadas.
- Contador de días juntos, mensajes, recuerdos y racha.
- Álbum de recuerdos y calendario compartido.
- Tres en raya, preguntas para parejas y ruleta.
- Diseño adaptable e instalación como aplicación PWA.
- Paleta morado, azul, negro y blanco.

## Preparar Neon

En **Neon Console → SQL Editor**, ejecuta:

```text
neon/schema.sql
```

Después ejecuta:

```text
neon/migration-private-access.sql
```

## Configurar Vercel

En **Project → Settings → Environment Variables**, agrega:

```text
DATABASE_URL = tu conexión de Neon
```

El código `2003` funciona automáticamente. Opcionalmente puedes agregar:

```text
DUKE_ACCESS_CODE = 2003
```

Puedes cambiar ese valor por otro código de 4 a 8 números y volver a desplegar.

Activa las variables para **Production**, **Preview** y **Development**. Luego realiza un nuevo despliegue.

## Cómo usar Duke

1. Abre la dirección normal de Vercel.
2. Escribe `2003`.
3. La primera persona crea su cuenta.
4. Crea el espacio Duke y define un PIN.
5. Comparte con su pareja el código `DUKE-XXXXXX` y el PIN.
6. La pareja abre la misma página, escribe `2003`, crea la segunda cuenta y se une.
7. Después de las dos cuentas, cualquier registro adicional queda bloqueado.

## Archivos principales

- `api/access.js`: valida el código compartido.
- `api/duke.js`: API segura y conexión a Neon.
- `src/core.js`: estado, sincronización y renderizado.
- `src/events.js`: formularios, botones, juegos y llamadas.
- `neon/schema.sql`: esquema completo.
- `neon/migration-private-access.sql`: límite de dos usuarios y un solo espacio.

## Seguridad

El código de cuatro números es una barrera sencilla pensada para una aplicación privada de pareja. Las cuentas siguen protegidas con correo, contraseña y sesiones seguras. Nunca publiques la cadena real de Neon en GitHub.
