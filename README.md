# MEMEL WASH

Sistema web administrativo para un lavadero de motos.

## Incluye

- Panel general con lavados del día, ingresos, cuentas por cobrar y comisiones por pagar.
- Registro de lavados con fecha, hora, cliente, moto, placa, tipo de servicio, empleado, monto y estado de pago.
- Cálculo automático de la comisión del trabajador.
- Administración independiente de empleados: crear, editar, activar/desactivar y definir porcentaje.
- Gestión de clientes con historial de visitas y facturación.
- Control de comisiones por empleado y opción para marcarlas como pagadas.
- Filtros de historial por búsqueda, estado de pago y fecha.
- Ajustes de nombre del negocio, moneda y comisión por defecto.
- Exportación e importación de respaldos JSON.
- PWA instalable y diseño responsive.

## Base de datos

MEMEL WASH reutiliza la conexión Neon que ya estaba configurada en el proyecto mediante `DATABASE_URL`.

La API `api/memel.js` crea automáticamente la tabla `public.memel_wash_state` y guarda allí la información administrativa compartida. El navegador conserva una copia local de respaldo para continuar operando si la conexión se interrumpe temporalmente.

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require
```

La cadena real debe permanecer como variable privada en Vercel y no debe publicarse en GitHub.

## Archivos principales

- `app.js`: arranque, conexión y sincronización con Neon.
- `legacy-app.js`: lógica administrativa de clientes, empleados, lavados, pagos y comisiones.
- `api/memel.js`: API serverless conectada a Neon.
- `index.html`: interfaz principal.
- `styles.css`: estilos responsive.
- `manifest.webmanifest` y `sw.js`: instalación como aplicación web.
