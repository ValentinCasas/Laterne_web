# Plan histórico de mejoras de producto

> Registro histórico de trabajo completado. No define la arquitectura vigente ni reemplaza al `README.md` o a `docs/routing.md`; algunos nombres de archivo pueden haber cambiado durante la limpieza posterior.

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

- [x] El plan de mejoras quedó actualizado.
- [x] `prisma validate` — schema válido.
- [x] `tsc --noEmit` — sin errores. Incluye tipar los builders de href de `lib/routes.ts` como `Route` para typed routes.
- [x] `npm run lint` — 0 errores / 0 warnings.
- [x] `npm run test:unit` — 67 tests en 15 archivos, todos pasan.
- [x] `npm run build` — compilación y type check de producción OK (77 páginas).
- [x] `git diff --check` — sin whitespace errors.

## FASE 10 — Segunda pasada integral

### P0 · Guardado de portada

- [x] Causa raíz corregida: el zod del PATCH de marca exigía `fontFamily`, `buttonStyle`, `cardStyle`, `defaultCurrency`, `locale` y `timeZone` aunque el editor de landing no los enviara → 400. Ahora todos son opcionales y la API escribe solo los campos provistos (actualización parcial).
- [x] La landing pública consumía una imagen de portada hardcodeada. Ahora usa `BrandSettings.heroImageUrl` real (con fallback de gradiente elegante si no hay imagen).

### Editor de landing completo

- [x] Preview vertical seleccionable con todas las secciones reales: Portada, Eventos, Productos, Historia y Testimonios.
- [x] Toggle Escritorio/Celular, drag/drop y reordenamiento de imágenes (`pickFile`), textos editables, tarjetas de historia (título/subtítulo/imagen) y defaults de fondo derivados de la paleta de marca.
- [x] Persistencia en un único JSON `landingSections` en `BrandSettings` + migración `20260813150000_second_pass_models`.

### Cocina

- [x] Cards ricas: referencia, cliente, modalidad (Mesa/Retiro/Delivery), hora, tiempo transcurrido, cantidad de ítems, estado y nota truncada.
- [x] Modal de detalle con productos/variantes/extras/observaciones, modalidad, cliente, timeline de estados y acciones grandes EMPEZAR / LISTO.

### Reservas

- [x] Edición desde el detalle: fecha, hora, personas, sector y notas (`ReservationEditForm`) vía PATCH extendido en `app/api/admin/reservations/[id]`.
- [x] Drag & drop para mover reservas entre franjas del Día y entre días de Semana/Mes, con confirmación y persistencia server-side.
- [x] Verificación de capacidad por franja (409 si la franja no admite más personas).

### Mesas QR responsive

- [x] Grilla `grid-cols-1` base con `min-w-0` (sin desbordes) y componente `TableActions`: botones en desktop, menú desplegable "Acciones ⋯" en móvil.

### Testimonios

- [x] Búsqueda por texto/id/fecha y columnas más anchas (`lg:grid-cols-3`).

### Fidelización

- [x] Modelo `LoyaltyReward` + API `/api/admin/loyalty-rewards` (GET/POST) y `/[id]` (PUT/DELETE) con auditoría y permiso `customer.manage`.
- [x] Panel `/admin/fidelizacion` con `rewards-manager.tsx`: KPIs, alta/edición/eliminación, pausa/activación y orden.
- [x] Vista pública: `GET /api/loyalty` devuelve recompensas activas + progreso + próxima recompensa; el portal muestra barra de progreso hacia la próxima y tarjetas de recompensas alcanzadas.
- [x] Item "Fidelización" en el sidebar (grupo Operación).

### Inventario responsive

- [x] Vista Lista/Tarjetas con persistencia en localStorage (`ViewModeToggle` reutilizable).
- [x] Categorías plegables con "Expandir todas / Contraer todas" y contadores.
- [x] KPIs superiores clickeables (aplican el filtro correspondiente).
- [x] Modo lectura por fila + botón "Ajustar" que abre edición inline (motivo obligatorio para trazar).
- [x] "Ver movimientos" por producto (modal con historial filtrado por producto).

### Variantes/agregados guiados

- [x] Flujo paso a paso para crear un grupo: Modo de elección (elegir una / elegir varias) → Nombre → Reglas, con "Configuración avanzada" plegable para mín/máx.
- [x] Los extras/agregados se mantienen como lista simple con opción de agruparlos.

### Comprobantes con diseño

- [x] `InvoiceSettings.templatePreset` + `design` (JSON) en schema y en la API `invoice-settings`.
- [x] Editor de diseño en `invoice-manager.tsx`: presets Compacto/Clásico/Moderno, color de acento, tipografía y toggles (logo, domicilio, CUIT, QR, columnas, subtotal, descuentos, envío, total, observaciones, pie) con vista previa en vivo.
- [x] El detalle imprimible (`/admin/facturacion/[id]`) aplica el diseño real: colores, fuente, QR generado, filas condicionales y pie personalizado.
- [x] Helpers centralizados en `lib/invoice-design.ts` (`resolveInvoiceDesign`, presets, clases de fuente).

### Consistencia

- [x] `ViewModeToggle` + `useViewMode` reutilizables con persistencia por pantalla (`components/admin/view-mode-toggle.tsx`); aplicados en Inventario y Clientes frecuentes.
- [x] Migración `20260813150000_second_pass_models` aplicada con `migrate deploy` (se corrigió la PRIMARY KEY de `loyaltyreward` tras un fallo P3018/1075) y `prisma generate` regenerado.
- [x] Dev server reiniciado una sola vez tras el `prisma generate` (EPERM de DLL).
- [x] Validaciones finales: `prisma validate`, `tsc --noEmit`, `npm run lint` (0/0), `npm run test:unit` (67/67), `npm run build` (78 páginas) y `git diff --check` limpios.

## Notas

- [!] La visualización de puntos de fidelidad requiere el perfil frecuente creado por el cliente (token local). Las recompensas son canjeables en mostrador: el sistema las registra, pero la redención operativa se confirma manualmente por el negocio (sin flujo de canje automático aún).
- [!] El editor de diseño de comprobantes aplica al documento imprimible interno. No afecta la integración fiscal (pendiente de conectar a un proveedor autorizado).
- [!] `prisma migrate dev` no funciona en este entorno (P3006 en shadow DB por una migración previa). Se aplican migraciones manuales con `npx prisma migrate deploy`.
- [!] `prisma generate` falla con EPERM mientras el dev server corre (DLL en uso): detener el server, regenerar y relanzar una sola vez.
- [!] No se realizó commit: los cambios quedan en el working tree a la espera de revisión del cliente.
