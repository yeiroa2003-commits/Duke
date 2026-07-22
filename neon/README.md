# Duke con Neon

## Archivo que debes ejecutar

Ejecuta `schema.sql` en **Neon Console → SQL Editor → New query → Run**.

El script crea:

- usuarios y contraseñas cifradas;
- sesiones;
- espacios privados limitados a dos personas;
- chat, reacciones y mensajes leídos;
- recuerdos y fechas especiales;
- juegos sincronizados;
- llamadas y notificaciones;
- presencia en línea y actividad diaria.

## Importante

Neon es PostgreSQL y no incluye por sí solo el login, almacenamiento de imágenes ni sincronización en tiempo real del navegador.

La aplicación no debe conectarse directamente a `DATABASE_URL`, porque esa contraseña quedaría expuesta. Duke necesita una API segura, por ejemplo mediante Vercel Functions, que se conecte a Neon.

Las imágenes y audios deben guardarse en un servicio como Vercel Blob, Cloudinary o UploadThing; Neon guardará únicamente sus URL.

## Variables recomendadas para Vercel

```env
DATABASE_URL=postgresql://...
SESSION_SECRET=una_clave_larga_y_aleatoria
```

Nunca coloques `DATABASE_URL` dentro de `app.js`, HTML ni variables públicas que comiencen por `NEXT_PUBLIC_`.
