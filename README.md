# Anita Gourmet

App web (PWA, pensada para celular) para la cafetería de Anita Gourmet: ventas, pedidos abiertos, clientes con cuenta y abonos.

- **Frontend:** React + Vite, publicado como sitio estático en Cloudflare (Workers con assets).
- **Datos e inicio de sesión:** Supabase (Postgres con RLS).

## Fase 1 (esta versión)

- Vender: catálogo por categorías (importado del Excel), búsqueda, productos con opciones y notas para cocina.
- Pedido: cliente con cuenta, ocasional con nombre provisional o crear cuenta en el momento. Guardar pedido o cobrar ahora.
- Cobro: ahora, a la cuenta o mixto. Medios: efectivo, Nequi y Llave Bre-B. Ocasionales y cuentas bloqueadas pagan de contado.
- Pedidos abiertos y cerrados hoy; la administradora puede anular con motivo (queda registrado).
- Clientes: saldo, movimientos, abonos y resumen por WhatsApp (se abre WhatsApp con el mensaje listo).
- Más: disponibilidad del día y precios, empleados (solo administradora), cambiar contraseña.

## Desarrollo

```bash
cp .env.example .env.local   # URL y clave pública de Supabase
npm install
npm run dev
```

## Base de datos

Las migraciones están en `supabase/migrations/` y se aplican en orden. La función `supabase/functions/crear-empleado` crea usuarios de empleados (requiere la clave de servicio, que Supabase inyecta en la función).

Para dar acceso a alguien como personal, su correo debe estar en `staff_invites`; al crearse el usuario queda enlazado automáticamente.

## Publicar en Cloudflare

```bash
npm run build
npx wrangler deploy
```
