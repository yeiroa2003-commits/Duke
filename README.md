# EMEL WASH

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
- PWA instalable y diseño responsive para teléfono, tablet y computadora.

## Persistencia

Esta primera versión es local-first: guarda la información en `localStorage` del navegador. Esto permite usarla inmediatamente sin configurar servidor ni base de datos.

Para sincronizar varios dispositivos o tener cuentas de usuario, la siguiente etapa es conectar una base de datos y autenticación.

## Desarrollo local

```bash
npm install
npm start
```

También puede abrirse con cualquier servidor estático.

## Estructura

- `index.html`: interfaz principal.
- `styles.css`: estilos responsive.
- `app.js`: lógica de clientes, empleados, lavados, pagos y comisiones.
- `manifest.webmanifest` y `sw.js`: instalación como aplicación web.
