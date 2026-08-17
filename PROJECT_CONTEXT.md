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
| Reportes (Resumen, Ventas, Productos, Compras, Sucursales, Ingeniería de menú) | FUNCIONAL |

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

## Pendientes
- Migración de analítica hacia dashboards de gestión comercial.
- Consolidación opcional de migraciones históricas (evaluar impacto en despliegues).
