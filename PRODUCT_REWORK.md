# PRODUCT_REWORK.md

Estado del plan de rework de MenuClick (Laterne). Leyenda: `[x]` terminado · `[ ]` pendiente · `[!]` bloqueado/limitado.

## FASE 1 — Estabilidad y base (aplicada en pasada previa)

- [x] 1a. Corregir `"use client"` en Estadísticas y errores de tipo en componentes del panel.
- [x] 1b. Hardening de assets y manejo de `UnknownHostError` en `app/[...path]/page.tsx` y `proxy.ts`.
- [x] 1c. Placeholders de imágenes por defecto y campos de landing condicionales con `showWhen` en `resource-manager.tsx`.

## FASE 2 — Pedidos y Cocina

- [x] Panel de pedidos con datos ricos: `branch`, `invoice`, `history` y resumen operativo.
- [x] Tablero de Cocina (`/admin/cocina`) con columnas de estados, acciones EMPEZAR/LISTO, tiempos y extras.
- [x] Registro de `cocina` en `lib/routes.ts`, link en `admin-shell.tsx` y ayuda en `lib/admin-help.ts`.

## FASE 3 — Reservas

- [x] `reservation-board.tsx` con alternancia Lista/Calendario y vistas Día, Semana y Mes.
- [x] Navegación prev/Hoy/siguiente y helpers de fecha locales (sin dependencias extra).

## FASE 4 — Facturación

- [x] Modelo `InvoiceSettings` + migración `20260813120000_invoice_settings` (emisor, CUIT, domicilio, condiciones).
- [x] API `app/api/admin/invoice-settings` (GET/PATCH con auditoría).
- [x] Panel de configuración del emisor en `invoice-manager.tsx`.
- [x] Detalle de comprobante con emisor, condiciones y CUIT.
- [x] Botón "Anular" en el detalle de pedido (anulación server-side del comprobante).

## FASE 5 — Inventario

- [x] Rediseño visual: tarjetas de resumen (total, con control, bajo mínimo, sin stock).
- [x] Agrupación por categoría en la tabla (encabezados con contadores).
- [x] Filtros: sucursal, categoría, estado (Normal / Bajo mínimo / Sin stock), control (Con control / Sin control) y búsqueda.
- [x] Existencias, mínimo, unidad y control activado por producto (ajustes rápidos en fila).
- [x] Registro de movimientos de stock con motivo (trazabilidad auditada) e historial de últimos 30.
- [x] Alertas de stock crítico (estados coloreados, "Solo alertas").

## FASE 6 — Variantes/agregados y Cupones

- [x] `product-options-manager.tsx` reescrito: UX simple con tabs Variantes/Agregados, contadores, grupos, edición y eliminación.
- [x] Límites de cupones en schema: `usageLimit`, `perCustomerLimit`, `usedCount` + modelo `PromotionUsage`.
- [x] Migración `20260813130000_coupon_usage_limits` aplicada.
- [x] Validación server-side en `app/api/orders/route.ts`: rechaza cupones agotados o superados por cliente, y registra el uso en transacción.
- [x] `lib/promotion-admin.ts` persiste `usageLimit`/`perCustomerLimit` al crear/editar cupones.
- [x] Tarjetas de promociones muestran tipo, código, `usados/restantes` con semáforo y vigencia (inicio → fin).
- [x] Tests unitarios actualizados (`lib/promotion.test.ts`).

## FASE 7 — Clientes 360 y Mesas QR

- [x] Clientes 360: modal con datos personales, pedidos recientes, movimientos de puntos, ajuste manual y WhatsApp.
- [x] API `GET /api/admin/customers/[id]` con pedidos + transacciones.
- [x] Mesas: regeneración de QR (`POST` en `app/api/admin/tables/[id]`) con chequeo de unicidad.
- [x] Descargar QR individual (PNG) e imprimir carteles (CSS `@media print` en `globals.css`).

## FASE 8 — Landing, navegación y ayuda

- [x] Editor visual de portada (`/admin/landing`): título, subtítulo e imagen de portada con drag/drop.
- [x] Campo `heroImageUrl` en `BrandSettings` + migración `20260813140000_landing_hero_image` aplicada.
- [x] API de marca extendida (PATCH/DELETE `heroImageUrl`) con validación de origen.
- [x] Vista previa en vivo con colores de marca y toggle Escritorio/Celular.
- [x] Búsqueda global (`/admin/busqueda`): productos, categorías, clientes, pedidos y reservas con permisos.
- [x] Dashboard consolidado con indicadores y "Atención operativa" (ya existente, sin regresiones).
- [x] Onboarding, Centro de ayuda y Centro de actividad existentes y navegables.
- [x] Link "Portada" y "Búsqueda global" en el sidebar + entradas de ayuda.

## FASE 9 — Validaciones

- [x] `PRODUCT_REWORK.md` actualizado.
- [x] `prisma validate` — schema válido.
- [x] `tsc --noEmit` — sin errores. Incluye tipar los builders de href de `lib/routes.ts` como `Route` para typed routes.
- [x] `npm run lint` — 0 errores / 0 warnings.
- [x] `npm run test:unit` — 67 tests en 15 archivos, todos pasan.
- [x] `npm run build` — compilación y type check de producción OK (77 páginas).
- [x] `git diff --check` — sin whitespace errors.

## Notas

- [!] El editor de landing cubre la portada (título/subtítulo/imagen). Las imágenes "por sección" del resto de la landing no tienen aún editor dedicado: la página pública usa la carta y promociones existentes para esas secciones.
- [!] `prisma migrate dev` no funciona en este entorno (P3006 en shadow DB por una migración previa). Se aplican migraciones manuales con `npx prisma migrate deploy`.
- [!] `prisma generate` falla con EPERM mientras el dev server corre (DLL en uso): detener el server, regenerar y relanzar una sola vez.
- [!] No se realizó commit: los cambios quedan en el working tree a la espera de revisión del cliente.
