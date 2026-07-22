# Duke 💜💙

**Duke** es una PWA privada para dos personas. Incluye chat, videollamadas, juegos, recuerdos, fechas especiales, estados de ánimo y notificaciones como “Te extraño”.

## Tecnología

- Frontend PWA: HTML, CSS y JavaScript.
- Backend privado: Vercel Functions.
- Base de datos: Neon PostgreSQL.
- Videollamadas: Jitsi Meet.
- Sesiones: cookies `HttpOnly`, `Secure` y tokens almacenados con hash.

La conexión de Neon **nunca se envía al navegador**. Solo la función de servidor puede leer `DATABASE_URL`.

## Privacidad y acceso

Duke tiene dos barreras:

1. **Enlace privado:** sin el parámetro secreto del enlace, la página muestra una pantalla bloqueada y no permite entrar ni registrarse.
2. **Máximo dos cuentas:** la API y la propia base de datos impiden registrar una tercera persona.

Después de abrir el enlace privado correctamente, Duke guarda una autorización segura en ese navegador. La persona todavía debe iniciar sesión con su propia cuenta.

## Funciones incluidas

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

## 1. Preparar Neon

En **Neon Console → SQL Editor**:

### Instalación nueva

Ejecuta primero:

```text
neon/schema.sql
```

Después ejecuta:

```text
neon/migration-private-access.sql
```

### Si ya ejecutaste el esquema anteriormente

Ejecuta solamente:

```text
neon/migration-private-access.sql
```

La migración agrega el límite de dos usuarios y garantiza que exista un solo espacio Duke activo.

## 2. Configurar Vercel

Importa este repositorio en Vercel y agrega la variable privada:

```text
Nombre: DATABASE_URL
Valor: la cadena de conexión PostgreSQL de Neon
```

Ruta en Vercel:

```text
Project → Settings → Environment Variables
```

Actívala para **Production**, **Preview** y **Development**. Después realiza un nuevo despliegue.

No escribas la conexión real en `app.js`, `index.html`, `.env.example` ni en GitHub.

## 3. Abrir el enlace privado

El primer acceso debe hacerse mediante el enlace privado entregado al propietario del proyecto:

```text
https://TU-DOMINIO.vercel.app/?duke=CLAVE-PRIVADA
```

Una vez abierto correctamente, el navegador recibe una autorización segura. Desde **Perfil y enlace** puede copiarse el enlace para compartirlo únicamente con la pareja.

## 4. Crear las dos cuentas

1. La primera persona abre el enlace privado y crea su cuenta.
2. Crea el espacio Duke, define la fecha y un PIN de 4 a 8 números.
3. Comparte con su pareja el enlace privado, el código `DUKE-XXXXXX` y el PIN.
4. La segunda persona abre el enlace privado, crea la segunda cuenta y se une con el código y el PIN.
5. Después de las dos cuentas, cualquier registro adicional queda bloqueado.

## Archivos principales

- `api/duke.js`: API segura y conexión a Neon.
- `src/core.js`: estado, sincronización y renderizado.
- `src/events.js`: formularios, botones, juegos y llamadas.
- `neon/schema.sql`: esquema completo.
- `neon/migration-private-access.sql`: límite de dos usuarios y un solo espacio.
- `vercel.json`: configuración de funciones y cabeceras de seguridad.
- `.env.example`: ejemplo sin credenciales.

## Desarrollo local

Instala dependencias:

```bash
npm install
```

Para probar las Vercel Functions localmente se necesita Vercel CLI y una variable `DATABASE_URL` en un archivo local no versionado.

## Seguridad importante

- Nunca publiques la cadena real de Neon.
- Si una credencial fue compartida en un chat, captura o lugar público, rota la contraseña en Neon y actualiza `DATABASE_URL` en Vercel.
- El enlace privado debe compartirse solamente entre las dos personas autorizadas.
- Las imágenes pequeñas se comprimen y se guardan en PostgreSQL para esta versión privada; para archivos grandes conviene integrar almacenamiento de objetos.
