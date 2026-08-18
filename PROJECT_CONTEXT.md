# MenuClick — Project Context

## Stack
- Next.js 16.3.0 + React 19.2.8 + TypeScript 6.0.3
- Prisma 6.19.3 + MySQL/MariaDB
- Tailwind CSS 4.3.3 + Zod 4.4.3
- jose (JWT), sharp, three, sweetalert2

## Arquitectura
- SaaS multi-tenant con aislamiento por tenant en URL y DB.
- Multi-sucursal: cada tenant puede tener múltiples `Branch`; acceso controlado por `BranchMembership`.
- Autenticación: JWT HttpOnly (8h) + `AuthSession` en DB. Cookie aislada por tenant.
- Sesiones: `AuthSession` con `membershipId`, `branchId`, `context` (tenant/platform).
- Prisma/MySQL: `DATABASE_URL` con `connection_limit` y `pool_timeout` para multi-réplica.
- Storage: local por defecto; S3-compatible cuando `STORAGE_DRIVER=s3`.
- Producción: `output: "standalone"`, trusted proxy, deployment versioning, graceful shutdown.

## Routing
- Admin canónico: `/t/{tenantSlug}/admin[/s/{branchSlug}]/...`
- Admin por GUID: `/t/{tenantGuid}/{tenantSlug}/admin[/s/{branchSlug}]/...`
- Público: `/t/{tenantSlug}/...` y `/t/{tenantSlug}/s/{branchSlug}/...`
- Platform: `/platform/...`
- Driver: `/t/{tenantSlug}/driver/...`
- Helpers canónicos: `lib/routes.ts`

## Desarrollo
```bash
npm run dev
# http://localhost:3000
```
Docker NO obligatorio para desarrollo.

## Producción
- Standalone (`next start`).
- Docker disponible (`Dockerfile`, `docker-compose.production.example.yml`).
- Health/readiness: `app/api/ready/route.ts`.
- Trusted proxy: `lib/trusted-headers.ts`.
- Storage local/S3 según `STORAGE_DRIVER`.
- Configuración por entorno: `lib/config.ts` + `.env`.
- Multi-réplica: pool Prisma acotado por `connection_limit`.

## Seguridad
- Tenant scoping obligatorio en toda query.
- Branch scoping cuando la sección lo requiere (`BRANCH_ADMIN_SECTIONS`).
- Validación server-side de tenant, branch, permisos y licencias en `lib/auth.ts`.
- Owner/Administrator tienen regla privilegiada para `finance.*`.
- Platform vs Tenant: sesiones separadas (`PLATFORM_SESSION_COOKIE`).

## Navegación
- Mega menú en `AdminShell` (`components/admin/admin-shell.tsx`).
- Apertura únicamente por CLICK.
- Cierre: click afuera, Escape, Tab-out.
- Definición centralizada: `lib/admin-navigation.ts`.

## Módulos
| Módulo | Estado |
|--------|--------|
| Admin (Inicio) | FUNCIONAL |
| Operación (Pedidos, Cocina, Salón, Mesas, Reservas, Entregas, Delivery, Repartidores, Cobros) | FUNCIONAL |
| Productos (Catálogo, Producción, Inventario) | FUNCIONAL |
| Compras (Pedidos, Recepciones, Facturas, Gastos) | FUNCIONAL |
| Finanzas (Cuentas, Movimientos, Flujo de caja, Cuentas a cobrar/pagar, Estado de resultados) | FUNCIONAL |
| Facturación | PARCIAL |
| Fidelización | FUNCIONAL |
| Administración (Marca, Landing, Integraciones, Notificaciones, Datos) | FUNCIONAL |
| Estadísticas/Analítica | PARCIAL |
| Reportes (Resumen, Ventas, Productos, Compras, Sucursales, Consolidado, Ingeniería de menú) | FUNCIONAL |

## Modelos importantes
- **Tenant / Branch / TenantMembership / AuthSession**: multi-tenancy, sucursales, acceso.
- **CustomerOrder / OrderItem / OrderStatusHistory**: pedidos, líneas, trazabilidad.
- **OrderDelivery / OrderDeliveryItem / CustomerPayment**: entregas y pagos de clientes.
- **Product / Category / ProductPrice / ProductVariant / ProductExtra**: catálogo y precios.
- **RecipeIngredient / IngredientCostHistory / UnitConversion**: recetas y costos históricos.
- **PurchaseOrder / PurchaseReceipt / PurchaseInvoice / PurchaseInvoiceItem**: ciclo de compras.
- **Supplier / SupplierBranch / SupplierLedgerEntry**: proveedores y cuenta corriente.
- **FinancialAccount / FinancialMovement / FinancialTransfer**: finanzas operativas.
- **InventoryStock / StockMovement / InventoryCountSession**: inventario.
- **TableSession / TableSessionEvent / DiningTable / TableSector**: salón y mesas.
- **KitchenStation / PrintArea / PrintJob / PrintDestination**: KDS e impresión.
- **AnalyticsEvent**: eventos anónimos de actividad.

## Permisos
- Clave/valor globales (`permission.key`).
- Roles por tenant (`role.key` + `rolePermission`).
- Roles default: `owner`, `administrator`, `menu_editor`, `moderator`, `reservation_manager`, `order_manager`, `driver`, `analyst`, `viewer`.
- `owner`/`administrator` tienen `*` (todos excepto `plan.manage`, `lead.manage`).
- Regla privilegiada finance en `lib/auth.ts`.

## Licencias
- `Plan` + `PlanPrice` + `PlanFeature`: planes públicos.
- `TenantSubscription`: suscripción del tenant.
- `BranchLicense`: licencia operativa por sucursal (capacidad de usuarios).
- Capacidad de sucursal = suma de cupos de licencias activas vigentes.

## Migraciones
- 49 migraciones incrementales en `prisma/migrations/`.
- Estrategia: incremental, nunca `prisma migrate reset`.
- `prisma/bootstrap.sql` es dump histórico (phpMyAdmin, 2023); NO usado por migraciones actuales.
- Para modificar schema: migración incremental segura + `prisma generate`.

## Inventario de vistas admin (tipología)
- Dashboard: `/admin` (inicio), `/admin/finanzas` (dashboard financiero), `/admin/estadisticas` (analytics)
- Lista: `/admin/clientes` (DataTable), `/admin/entregas` (DataTable), `/admin/auditoria`, `/admin/errores`, `/admin/repartidores`, `/admin/facturacion`, `/admin/oportunidades`, `/admin/planes`, `/admin/recetas`, `/admin/testimonios`, `/admin/archivos`, `/admin/gastos`, `/admin/impresion`, `/admin/integraciones`, `/admin/notificaciones`, `/admin/cuenta`, `/admin/datos`, `/admin/marca`, `/admin/landing`, `/admin/carta`, `/admin/configuracion/comprobantes/plantillas`, `/admin/onboarding`, `/admin/opciones-producto`, `/admin/mesas`
- Ficha/Documento: `/admin/recetas/[id]`, `/admin/recetas/[id]/ficha`, `/admin/facturacion/[id]`, modales de compras (`OrderDetailModal`, `InvoiceDetailModal`, `SupplierDetailModal`), ficha de cliente (`CustomerMaster` detail)
- Board operativo: `/admin/pedidos` (kanban), `/admin/cocina` (KDS), `/admin/salon` (mesas), `/admin/delivery` (seguimiento), `/admin/reservas` (kanban/estados), `/admin/productos` (grid/lista)
- Configuración: `/admin/integraciones`, `/admin/notificaciones`, `/admin/marca`, `/admin/landing`, `/admin/cuenta`, `/admin/datos`, `/admin/impresion`, `/admin/configuracion/comprobantes/plantillas`, `/admin/onboarding`, `/admin/opciones-producto`
- Reporte: `/admin/reportes` (shell multi-tab), `/admin/reportes/ventas`, `/admin/reportes/productos`, `/admin/reportes/compras`, `/admin/reportes/sucursales`, `/admin/reportes/consolidado`, `/admin/reportes/ingenieria-menu`
- Entidades genéricas (ResourceManager): categorías, eventos, horarios, testimonios, usuarios, negocio, promociones, legales, ayuda, casos, sucursales, seo, redirecciones

## Módulos rediseñados (parcial)
- Operación: Pedidos, Cocina, Salón, Mesas, Reservas, Entregas, Delivery Center, Repartidores, Cobros
- Productos/Inventario: Productos, Ingredientes, Recetas, Inventario, Variantes/Extras
- Clientes: CustomerMaster (tabla + ficha)
- Compras/Gastos: ExpensesManager, PurchasesManager (parcial)
- Finanzas: dashboard, cuentas, movimientos, flujo de caja, cuentas cobrar/pagar, estado de resultados
- Reportes: shell, tabla genérica, filtros
- Administración: notification-center, notification-settings, integration-manager, brand-manager, landing-editor, data-portability, account-security, document-template-manager, onboarding-wizard, plan-manager, lead-board, support-board, testimonial-board, media-library, print-config-board, error-log-manager, rewards-manager, admin-shell (parcial)
- Pendiente: Navbar completo, Geofencing/Prisma, Modelo documental (InvoiceRecordItem)

## Decisiones arquitectónicas
- URLs canónicas con tenant slug/GUID; el host solo es para superficies públicas.
- Contexto de sucursal en URL cuando aplica; nunca solo por query param.
- Costo histórico de venta: `OrderItem.costSnapshot` (snapshot inmutable).
- Historial de costos de ingredientes: `IngredientCostHistory`.
- Delivery propio: `OrderDelivery` + `OrderDeliveryItem` + `ExternalOrder`.
- Impresión declarativa: `PrintArea` + `PrintDestination` + `PrintJob`.
- Finanzas: movimientos inmutables; corrección por reversión.
- Reportes: `ReportsShell` es Client Component y maneja filtros URL-driven internamente; las páginas Server Components solo pasan defaults serializables y datos iniciales. No se pasan callbacks desde Server a Client.
- Navegación admin: `adminLinkMatchScore` compara segmentos desde el final para soportar URLs canónicas con GUID/slug.
- Multi-sucursal: `ConsolidadoShell` y `MultiBranchSelector` en `components/admin/multi-branch/`. La página `/admin/reportes/consolidado` carga KPIs, comparativa, stock crítico, promociones, usuarios/acceso y licencias. Reutiliza `computeBranchComparison`, `computeVentasKpis`, `computeEvolution`, `computeByChannel`, `computeBySource` desde `lib/reports/`. No duplica lógica de analytics.
- Sistema visual común: componentes base en `components/admin/ui/` (`PageHeader`, `SectionHeader`, `Toolbar`, `FiltersBar`, `SearchBox`, `ActionMenu`, `DataTable` con densidad y columnas configurables, `CardGrid`, `KanbanBoard`, `EmptyState`, `StatusBadge`, `KpiCard`, `Tabs`, `confirmModal`, `FormSection`, `ViewOptions`, `DocumentHeader`, `DocumentLines`, `RelatedDocuments`, `FactBox`, `SplitView`, `Drawer`, `ActiveFilterChip`, `FilterPanel`). Se aplicó de forma consistente en Pedidos, Entregas, Clientes, Delivery y resto de secciones admin reemplazando `AdminPageHeader` por `PageHeader`.
- Filtros compactos: barra de comandos con `SearchBox` + selects compactos + filtros avanzados en `Drawer`/panel. Filtros activos como `ActiveFilterChip`.
- AdminShell: `BranchSwitcher` siempre visible (no oculto en mobile) para que el contexto de sucursal sea siempre claro.
- Documentos tipo BC: Pedidos y Entregas usan `DocumentHeader` + secciones (`FormSection`/`FactBox`) + `DocumentLines` + `RelatedDocuments` en lugar de modales chios.
- Listas tipo BC: se prioriza `DataTable` con densidad (compacta/normal/cómoda), columnas configurables, orden y vista Card/List donde corresponda.
- Board operativo: `KanbanBoard` para estados; `SplitView` para lista+detalle; `Drawer` para edición lateral.
- Modelo documental: Pedido → OrderDelivery (remito) → InvoiceRecord (factura). OrderDeliveryItem es la línea de remito. Se agregará InvoiceRecordItem como línea de factura para snapshots históricos.
- Geofencing: se agregará modelo `BranchGeofence` por sucursal con lat/lng/radio y validación server-side en pedidos tipo mesa.
- Sin emojis en UI: se usa iconografía SVG profesional en `SearchBox`, `ActionMenu`, etc.

## Pendientes
- Migración de analítica hacia dashboards de gestión comercial.
- Consolidación opcional de migraciones históricas (evaluar impacto en despliegues).
