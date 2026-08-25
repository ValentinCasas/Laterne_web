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
- Driver: `/t/{tenantSlug}/driver/...`; `/admin/driver` es únicamente un acceso visible que redirige al panel canónico del repartidor autenticado, sin duplicar la superficie ni permitir suplantación. Sub-rutas: `/driver/recorridos` (historial con filtros y paginación), `/driver/recorridos/{routeId}` (detalle histórico con mapa, paradas, timeline y métricas), `/driver/entregas` (historial de entregas), `/driver/incidencias` (incidencias del repartidor).
- Helpers canónicos: `lib/routes.ts`
- Delivery operativo: `/api/admin/delivery/provider` configura el proveedor cartográfico por tenant; `/api/admin/drivers/positions` recibe GPS propio y expone solo las últimas posiciones autorizadas; `/api/admin/deliveries/[id]/geocode` ofrece geocodificación opcional y desacoplada.

## Desarrollo
```bash
npm run dev
# http://localhost:3000
```
Docker NO obligatorio para desarrollo.
En `next dev`, las IPv4 de red del equipo se agregan automáticamente a `allowedDevOrigins` y las rutas canónicas conservan el origen LAN solicitado. Esto permite abrir Login/Admin/Driver desde otro dispositivo de la misma red con `http://{IP_DEL_EQUIPO}:3000/t/{tenantSlug}/...` sin redirigirlo a `localhost`; el GPS real del navegador móvil sigue requiriendo un origen HTTPS seguro.
La geocodificación de Delivery está desactivada por defecto. Puede conectarse a un servicio Nominatim-compatible mediante `DELIVERY_GEOCODING_PROVIDER`, `DELIVERY_GEOCODING_ENDPOINT` y `DELIVERY_GEOCODING_USER_AGENT`; las coordenadas manuales siguen disponibles sin proveedor externo.

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
- Las barras principales de sitio público, Admin, Driver, Platform y marketing usan posición fija con compensación de contenido; no deben desaparecer al hacer scroll.
- La experiencia móvil común se valida entre 320–430 px: barras y drawers respetan `safe-area`, los overlays bloquean el scroll de fondo, los controles operativos críticos ofrecen blancos táctiles de al menos 44 px y los avisos globales no cubren la navegación inferior de Driver ni el carrito de Carta.
- Definición centralizada: `lib/admin-navigation.ts`.
- Delivery es un grupo propio con Centro de delivery, Repartidores, Panel del repartidor, Recorridos y acceso directo a `Integraciones#delivery-map`. Cualquier usuario con membresía tenant activa puede abrir la vista personal; todas sus consultas y acciones resuelven exclusivamente el `DriverProfile` vinculado al usuario autenticado, sin suplantación. El panel del repartidor incluye navegación inferior (bottom nav) con accesos a Operación, Recorridos, Historial e Incidencias.
- Modos de navegación: `TOP` (mega menú barra superior) y `SIDEBAR` (sidebar dual-tier rail + panel contextual). Persistidos en `localStorage` via `hooks/use-navigation-mode.ts`.
- Toggle de modo en `ProfileMenu` y en la barra inferior del sidebar.
- Componentes: `ProfileMenu` (`components/admin/profile-menu.tsx`), `SidebarNavigation` (`components/admin/sidebar-navigation.tsx`), `AdminShellSidebar` (`components/admin/admin-shell-sidebar.tsx`).

## Módulos
| Módulo | Estado |
|--------|--------|
| Admin (Inicio) | FUNCIONAL |
| Operación (Pedidos, Cocina, Salón, Mesas, Reservas, Entregas, Delivery, Repartidores, Cobros) | FUNCIONAL |
| Productos (Catálogo, Producción, Inventario) | FUNCIONAL |
| Compras (Pedidos, Recepciones, Facturas, Gastos) | FUNCIONAL |
| Geofencing de pedidos de mesa | FUNCIONAL |
| Finanzas (Cuentas, Movimientos, Flujo de caja, Cuentas a cobrar/pagar, Estado de resultados) | FUNCIONAL |
| Facturación | PARCIAL |
| Fidelización | FUNCIONAL |
| Administración (Marca, Landing, Integraciones, Notificaciones, Datos) | FUNCIONAL |
| Recepcionista IA (Base de conocimiento, intents, configuración) | PREPARADO |
| Estadísticas/Analítica | PARCIAL |
| Reportes (Resumen, Ventas, Productos, Compras, Sucursales, Consolidado, Ingeniería de menú) | FUNCIONAL |

## Modelos importantes
- **Tenant / Branch / TenantMembership / AuthSession**: multi-tenancy, sucursales, acceso.
- **CustomerOrder / OrderItem / OrderStatusHistory**: pedidos, líneas, trazabilidad.
- **OrderDelivery / OrderDeliveryItem / CustomerPayment**: entregas y pagos de clientes.
- **DeliveryRoute**: recorrido operativo del repartidor que agrupa entregas en secuencia ordenada con inicio, progreso, métricas y estados (PREPARING, IN_PROGRESS, COMPLETED, CANCELLED).
- **InvoiceRecord / InvoiceRecordItem**: comprobantes (facturas) y sus líneas snapshot inmutables.
- **Product / Category / ProductPrice / ProductVariant / ProductExtra**: catálogo y precios.
- **RecipeIngredient / IngredientCostHistory / UnitConversion**: recetas y costos históricos.
- **PurchaseOrder / PurchaseReceipt / PurchaseInvoice / PurchaseInvoiceItem**: ciclo de compras.
- **Supplier / SupplierBranch / SupplierLedgerEntry**: proveedores y cuenta corriente.
- **FinancialAccount / FinancialMovement / FinancialTransfer**: finanzas operativas.
- **InventoryStock / StockMovement / InventoryCountSession**: inventario.
- **TableSession / TableSessionEvent / DiningTable / TableSector**: salón y mesas.
- **KitchenStation / PrintArea / PrintJob / PrintDestination**: KDS e impresión.
- **AnalyticsEvent**: eventos anónimos de actividad.
- **ReceptionKnowledge / ConversationSession / ConversationMessage**: recepcionista IA (base de conocimiento por tenant, sesiones de conversación, mensajes con trazabilidad de intents).
- **UserPreference**: preferencias individuales de usuario dentro de un tenant (key/value, unique por userId+key).

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
- 58 migraciones incrementales en `prisma/migrations/`.
- `20260824000000_add_delivery_fee_to_orderdelivery` está marcada como aplicada manualmente porque la columna `deliveryFee` ya existía en MariaDB antes de aplicar el historial versionado.
- Estrategia: incremental, nunca `prisma migrate reset`.
- `prisma/bootstrap.sql` es dump histórico (phpMyAdmin, 2023); NO usado por migraciones actuales.
- Para modificar schema: migración incremental segura + `prisma generate`.

## Inventario de vistas admin (tipología)
- Dashboard: `/admin` (inicio), `/admin/finanzas` (dashboard financiero), `/admin/estadisticas` (analytics)
- Lista: `/admin/clientes` (DataTable), `/admin/entregas` (DataTable), `/admin/auditoria`, `/admin/errores`, `/admin/repartidores`, `/admin/facturacion`, `/admin/oportunidades`, `/admin/planes`, `/admin/recetas`, `/admin/testimonios`, `/admin/archivos`, `/admin/gastos`, `/admin/impresion`, `/admin/integraciones`, `/admin/notificaciones`, `/admin/cuenta`, `/admin/datos`, `/admin/marca`, `/admin/landing`, `/admin/carta`, `/admin/configuracion/comprobantes/plantillas`, `/admin/onboarding`, `/admin/opciones-producto`, `/admin/mesas`
- Ficha/Documento: `/admin/recetas/[id]`, `/admin/recetas/[id]/ficha`, `/admin/facturacion/[id]` (ficha tipo BC con líneas propias), `/admin/entregas/[id]` (remito tipo BC), modales de compras (`OrderDetailModal`, `InvoiceDetailModal`, `SupplierDetailModal`), ficha de cliente (`CustomerMaster` detail)
- Board operativo: `/admin/pedidos` (kanban), `/admin/cocina` (KDS), `/admin/salon` (mesas), `/admin/delivery` (seguimiento), `/admin/reservas` (kanban/estados), `/admin/productos` (grid/lista)
- Configuración: `/admin/integraciones`, `/admin/notificaciones`, `/admin/marca`, `/admin/landing`, `/admin/cuenta`, `/admin/datos`, `/admin/impresion`, `/admin/configuracion/comprobantes/plantillas`, `/admin/onboarding`, `/admin/opciones-producto`, `/admin/recepcionista-ia`
- Reporte: `/admin/reportes` (shell multi-tab), `/admin/reportes/ventas`, `/admin/reportes/productos`, `/admin/reportes/compras`, `/admin/reportes/sucursales`, `/admin/reportes/consolidado`, `/admin/reportes/ingenieria-menu`
- Entidades genéricas (ResourceManager): categorías, eventos, horarios, testimonios, usuarios, negocio, promociones, legales, ayuda, casos, sucursales, seo, redirecciones

## Módulos rediseñados (parcial)
- Operación: Pedidos, Cocina, Salón, Mesas, Reservas, Entregas, Delivery Center, Repartidores, Cobros
- Productos/Inventario: Productos, Ingredientes, Recetas, Inventario, Variantes/Extras
- Clientes: CustomerMaster (tabla + ficha)
- Compras/Gastos: ExpensesManager, PurchasesManager (parcial)
- Finanzas: dashboard, cuentas, movimientos, flujo de caja, cuentas cobrar/pagar, estado de resultados
- Reportes: shell, tabla genérica, filtros
- Administración: notification-center, notification-settings, integration-manager, brand-manager, landing-editor, data-portability, account-security, document-template-manager, onboarding-wizard, plan-manager, lead-board, support-board, testimonial-board, media-library, print-config-board, error-log-manager, rewards-manager, reception-assistant-config, admin-shell (parcial: dual-tier sidebar + mega menú)
- Modelo documental: ficha de pedido (cantidades pedida/entregada/pendiente + documentos relacionados), ficha de remito (`/admin/entregas/[id]`), ficha de factura con líneas snapshot (`/admin/facturacion/[id]`), vínculo factura↔remito.
- Ubicación en checkout: el geofencing de mesa se valida server-side (Haversine) en `/api/orders`. Para pedidos Delivery, el cliente debe confirmar explícitamente el destino usando su ubicación actual (el permiso GPS se solicita solo tras su clic) o eligiendo otro punto en MapLibre; la dirección escrita sigue siendo obligatoria y las coordenadas confirmadas se guardan en `OrderDelivery`. La configuración por sucursal conserva radio + mapa en `sucursales`; `LocationPicker` dibuja el radio como círculo azul proyectado a píxeles cuando existe `geofenceRadius`.
- Carta pública mobile-first: la navegación horizontal de categorías junto con búsqueda/filtros permanece sticky debajo del navbar fijo en celular y escritorio, conserva targets con margen de scroll y evita overflow global entre 320–430 px.
- Checkout de mesa: el formulario de pedido carga las mesas activas de la sucursal y las ofrece en un `<select>` (por `code`, etiqueta = nombre); si no hay mesas, cae a input libre. Valida con "Elegí la mesa desde la que vas a pedir.".
- Iconografía: set SVG `components/admin/ui/icons.tsx` (`Icon` + `IconName`) reemplaza todos los emoticonos/emojis de la UI.
- Vista de listas: sistema de 4 vistas (tarjeta, tarjeta compacta, lista, lista compacta) persistido por pantalla (`useViewMode`/`ViewModeToggle`), integrado en `DataTable` (con `viewStorageKey`), `CardGrid`, catálogo de productos, inventario y clientes frecuentes.
- Navegación: grupos por proceso (Inicio, Atención, Salón, Delivery, Productos, Compras, Finanzas, Reportes, Administración); Administración incluye Sucursales/Usuarios/Licencias (superadmin).

## Decisiones arquitectónicas
- URLs canónicas con tenant slug/GUID; el host solo es para superficies públicas.
- Contexto de sucursal en URL cuando aplica; nunca solo por query param.
- Costo histórico de venta: `OrderItem.costSnapshot` (snapshot inmutable).
- Historial de costos de ingredientes: `IngredientCostHistory`.
- Delivery propio: `OrderDelivery` + `OrderDeliveryItem` + `ExternalOrder`. OpenFreeMap es el proveedor cartográfico predeterminado, sin API key y sin requerir un registro previo; `DeliveryProviderConfig` permite desactivarlo por tenant desde Integraciones. El mapa MapLibre se centra en la sucursal autorizada y muestra local, destinos y la última `DriverPosition` de cada repartidor. `DriverProfile.locationSharingEnabled` persiste la preferencia de GPS separada del watcher y de la última posición: el panel reinicia `watchPosition` automáticamente si el permiso ya está concedido, o solicita una nueva interacción si corresponde; al pausar detiene el watcher y guarda `false`. El envío conserva el control de tiempo/distancia, solo permite publicar la posición del perfil vinculado al usuario y el admin actualiza marcadores sin reconstruir el mapa. La app Driver es mobile-first, con home operativo, detalle en drawer, historial agrupado por entrega e incidencias separadas entre activas e históricas; su mapa de recorrido numera destinos con coordenadas, permite ordenar paradas antes de iniciar el recorrido (estado `PREPARING`) y durante el recorrido (reordenamiento de pendientes), y dibuja una línea orientativa, con acceso externo a navegación por calles. Las entregas sin punto confirmado nunca reciben coordenadas simuladas y quedan fuera de la ruta con una advertencia visible; desde el detalle de Admin se puede marcar y confirmar el destino directamente en MapLibre o cargar latitud/longitud. La geocodificación de destinos es opcional, server-side y Nominatim-compatible, permanece desactivada por defecto para no enviar direcciones a terceros y exige confirmar un candidato. El historial `OrderDeliveryStatusLog` y la estructura del equipo siguen visibles solo con los permisos correspondientes. El repartidor puede ver sus recorridos históricos en `/driver/recorridos` con filtros por período y estado, paginación, y detalle completo en `/driver/recorridos/{routeId}` con mapa histórico, paradas, timeline y métricas (solo lectura). El detalle muestra si una parada fue reordenada (orden original vs real). Si el repartidor intenta entregar una parada fuera del orden planificado, se muestra una confirmación profesional; al confirmar, el servidor reordena las paradas pendientes y registra el cambio en el historial. El orden planificado (`plannedOrder`) se conserva para auditoría. Las entregas fuera de orden se detectan comparando la parada objetivo contra la próxima pendiente por `routeOrder`. El admin puede ver recorridos de repartidores en `/admin/delivery/recorridos` con filtros y paginación, respetando el aislamiento por sucursal.
- Impresión declarativa: `PrintArea` + `PrintDestination` + `PrintJob`.
- Finanzas: movimientos inmutables; corrección por reversión.
- Reportes: `ReportsShell` es Client Component y maneja filtros URL-driven internamente; las páginas Server Components solo pasan defaults serializables y datos iniciales. No se pasan callbacks desde Server a Client.
- Navegación admin: `adminLinkMatchScore` compara por prefijo de segmentos (límites `/`) y soporta URLs canónicas con GUID/slug.
- Multi-sucursal: `ConsolidadoShell` y `MultiBranchSelector` en `components/admin/multi-branch/`. La página `/admin/reportes/consolidado` carga KPIs, comparativa, stock crítico, promociones, usuarios/acceso y licencias. Reutiliza `computeBranchComparison`, `computeVentasKpis`, `computeEvolution`, `computeByChannel`, `computeBySource` desde `lib/reports/`. No duplica lógica de analytics.
- Sistema visual común: componentes base en `components/admin/ui/` (`PageHeader`, `SectionHeader`, `Toolbar`, `FiltersBar`, `SearchBox`, `ActionMenu`, `DataTable` con densidad, vistas y paginación 25/50/100, `Pagination`, `Timeline`, `CardGrid`, `KanbanBoard`, `EmptyState`, `StatusBadge`, `KpiCard`, `Tabs`, `confirmModal`, `FormSection`, `ViewOptions`, `DocumentHeader`, `DocumentLines`, `RelatedDocuments`, `FactBox`, `SplitView`, `Drawer`, `ActiveFilterChip`, `FilterPanel`, `Icon`). Se aplicó de forma consistente en Pedidos, Entregas, Clientes, Delivery y resto de secciones admin reemplazando `AdminPageHeader` por `PageHeader`.
- Filtros compactos: barra de comandos con `SearchBox` + selects compactos + filtros avanzados en `Drawer`/panel. Filtros activos como `ActiveFilterChip`.
- AdminShell: `BranchSwitcher` siempre visible (no oculto en mobile) para que el contexto de sucursal sea siempre claro.
- Documentos tipo BC: Pedidos, Remitos y Facturas usan `DocumentHeader` + secciones (`FormSection`/`FactBox`) + `DocumentLines` + `RelatedDocuments` en lugar de modales chios.
- Listas tipo BC: se prioriza `DataTable` con densidad (compacta/normal/cómoda), paginación común 25/50/100, columnas configurables, orden y las cuatro vistas (tarjeta, tarjeta compacta, lista, lista compacta) donde corresponda. En celular, `DataTable` en modo lista apila cada fila como tarjeta (label:valor); las tablas densas usan scroll horizontal (`overflow-x-auto`). Clientes, Archivos y Pedidos de compra usan paginación server-side; Productos, Delivery y Repartidores limitan el montaje por página a 25/50/100 registros.
- Compras: las líneas estructurales solo se reemplazan en Borrador; tras enviar el pedido se conservan IDs y acumulados, pero siguen editables las cantidades de trabajo `quantityToReceive`/`quantityToInvoice`. Las recepciones recalculan el estado sobre todas las líneas y no limpian la preparación de facturación. Listado, detalle y mutaciones validan tenant y sucursales accesibles server-side.
- Concurrencia de pedidos: `PATCH /api/admin/orders/[id]` acepta `expectedStatus`, conserva el guard atómico por estado y responde conflictos reales con `code: ORDER_STATE_CONFLICT` y el pedido fresco. `GET /api/admin/orders/[id]` permite refrescar únicamente la tarjeta afectada. Pedidos y Cocina bloquean mutaciones simultáneas propias por `orderId`.
- Board operativo: `KanbanBoard` para estados; `SplitView` para lista+detalle; `Drawer` para edición lateral.
- Modelo documental: Pedido → OrderDelivery (remito) → InvoiceRecord (factura). `OrderDeliveryItem` es la línea de remito; `InvoiceRecordItem` es la línea snapshot de factura (vinculable a orderItem o deliveryItem). La API de facturas permite emitir desde un remito (`deliveryId`) usando las cantidades efectivamente despachadas.
- Geofencing: campos en `Branch` (`latitude`/`longitude` Decimal, `geofenceRadius` default 150, `geofenceEnabled` default false) + `lib/geofence.ts` (Haversine y tolerancia por precisión GPS acotada a 500 m). El servidor valida en `/api/orders` para `dine_in` con geofence habilitado; el checkout solicita `getCurrentPosition` y el formulario de sucursales permite configurar radio y ubicación.
- Sin emojis en UI: se usa iconografía SVG profesional (`Icon` desde `components/admin/ui/icons.tsx`) en `SearchBox`, `ActionMenu`, tablas, estados vacíos, repartidor, carta pública, checkout y demás superficies.
- Recepcionista IA (preparación): contrato `ReceptionAssistantProvider` en `lib/reception-assistant/types.ts`, base de conocimiento configurable por tenant (`ReceptionKnowledge`), clasificador de intents por regex (`lib/reception-assistant/intents.ts`), carga de knowledge desde Prisma (`lib/reception-assistant/knowledge.ts`). La API `/api/reception-assistant` usa `getDefaultTenant()` y `buildDefaultResponse()`. La configuración admin está en `/admin/recepcionista-ia` con CRUD en `/api/admin/reception-assistant`. No implementa IA real, WhatsApp ni chat funcional.

## Pendientes
- Migración de analítica hacia dashboards de gestión comercial.
- Consolidación opcional de migraciones históricas (evaluar impacto en despliegues).

## Estado actual DB
- MariaDB activa en localhost:3306.
- Datos reales conservados: tenant Laterne (id 1) con 22 pedidos, 103 entregas, 3 repartidores, 3 recorridos; tenant Cafetería (id 5) también presente.
- Usuarios y membresías intactos; sin borrados ni resets.
- Migración `20260824000000_add_delivery_fee_to_orderdelivery` resuelta manualmente porque la columna `deliveryFee` ya existía en MariaDB.
