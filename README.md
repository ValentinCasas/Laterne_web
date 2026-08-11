# Laterne Web

Plataforma gastronómica construida con Next.js, React, TypeScript, Tailwind CSS y Prisma. Conserva la base MySQL del sistema original y suma una base multiempresa para evolucionar el producto sin mezclar información entre clientes.

## Funcionalidades actuales

### Experiencia pública

- Landing del negocio con eventos, horarios, testimonios, ubicación y productos destacados.
- Carta responsive con búsqueda, filtros alimentarios, precio máximo, ordenamiento y categorías fijas al recorrer.
- Carrito persistente con variantes, agregados, notas, cupones, propina, mesa, retiro y entrega.
- Pedidos guardados en MySQL con referencia privada, seguimiento de estado e historial.
- Selección de sucursal, entrega, horario, costo de envío, propina y control de stock al confirmar.
- Fichas de producto con URL amigable, SEO, favoritos, compartir y datos estructurados.
- Visor 3D interactivo con controles de cámara, pantalla completa y captura de imagen.
- Realidad aumentada real mediante WebXR, Scene Viewer y Quick Look cuando el dispositivo es compatible.
- Reservas, promociones, programa de puntos, QR por mesa y casos de éxito.
- Ayuda, soporte y documentos legales administrables.
- PWA instalable con experiencia sin conexión, aviso de actualización y páginas de error cuidadas.
- Analítica propia respetuosa del consentimiento, sin depender de cookies publicitarias.
- Moneda, idioma/región y zona horaria administrables para precios, formatos y disponibilidad pública.

### Administración

- Gestión visual de productos, categorías, eventos, horarios, testimonios, promociones y contenido legal.
- Publicación inmediata, borradores y programación de contenido.
- Modelos 3D GLB/GLTF y USDZ, escala, dimensiones, rotación, ubicación y vista previa del modelo actual.
- Tableros operativos de pedidos, reservas, soporte y testimonios con estados claros.
- Mesas con códigos QR imprimibles y descarga individual.
- Sucursales con ubicación, contacto, pedido mínimo, costo de entrega y mesas asociadas.
- Inventario opcional por producto y sucursal, descuento automático, mínimos y movimientos auditables.
- Comprobantes internos imprimibles vinculados a pedidos, preparados para un proveedor fiscal externo.
- SEO por página, redirecciones administrables y medición externa activada solo con consentimiento.
- Clientes frecuentes, niveles, puntos, movimientos e historial de pedidos.
- Estadísticas del recorrido público con filtros y exportación CSV.
- Importación validada de productos y exportación de productos, pedidos, reservas y clientes.
- Biblioteca de medios con texto alternativo, compresión, miniaturas, recortes no destructivos, detección de duplicados y eliminación protegida por uso.
- Personalización centralizada de nombre, logotipo, favicon, colores, tipografía, tarjetas y botones.
- Centro de notificaciones y preferencias por evento y canal.
- Onboarding guiado que detecta la configuración completada.
- Roles, permisos, sesiones revocables, cambio de contraseña y auditoría de operaciones.
- Recuperación segura de acceso con token de un solo uso, vencimiento y limitación de solicitudes.
- Backups portables del contenido principal y restauración controlada dentro del mismo negocio.
- Registro reducido de errores técnicos con seguimiento administrativo.
- Paleta de comandos con `Ctrl/⌘ + K` y navegación adaptable a escritorio y celular.

### Plataforma multiempresa

- Resolución de negocios por dominio personalizado, subdominio o tenant predeterminado.
- Superadministración separada para crear, suspender y asignar planes a negocios.
- Suscripciones, límites aplicados a productos, usuarios y almacenamiento, funciones habilitadas, vencimientos, observaciones y registro administrativo de pagos.
- Datos, permisos, contenido, métricas y archivos aislados por empresa.

## Stack

- Next.js 16 con App Router y React Server Components.
- React 19 y TypeScript estricto.
- Tailwind CSS 4.
- Prisma ORM 6 con MySQL.
- Zod para validación de entradas.
- JWT firmado en cookie `httpOnly` y sesiones persistidas en base de datos.
- SweetAlert2 para confirmaciones administrativas.
- Vitest para pruebas unitarias y Playwright para flujos de navegador.
- ESLint y Prettier para calidad y formato.

## Requisitos

- Node.js 20.9 o superior.
- MySQL 8 o MariaDB compatible.
- Google Chrome para ejecutar las pruebas E2E configuradas.

## Configuración local

1. Importar `laterne.sql` en una base MySQL llamada `laterne` si se parte de una instalación limpia.
2. Copiar `.env.example` como `.env`.
3. Ajustar `DATABASE_URL`, `NEXT_PUBLIC_SITE_URL`, `ROOT_DOMAIN`, `DEV_ROOT_DOMAIN`, `DEV_TENANT_SLUG` y generar un valor seguro para `AUTH_SECRET`.
4. Ejecutar `npm install`.
5. Ejecutar `npx prisma migrate deploy` para aplicar las migraciones pendientes.
6. Ejecutar `npm run dev`.

En producción, `AUTH_SECRET` es obligatorio. Debe ser largo, aleatorio y mantenerse fuera del repositorio. `ROOT_DOMAIN` debe contener únicamente el dominio base real, sin protocolo. `DEV_ROOT_DOMAIN` se usa únicamente con `next dev` y debe ser un dominio reservado para desarrollo, como `menu-click.test`. Los dominios personalizados deben apuntar al mismo despliegue.

`EMAIL_WEBHOOK_URL` permite conectar recuperación de acceso con un proveedor de correo sin acoplar el sistema a una marca. El endpoint debe usar HTTPS en producción y aceptar una solicitud JSON autenticada mediante `EMAIL_API_KEY`. Si no se configura, la solicitud queda registrada de forma segura y el panel recibe una notificación, pero no se envía el enlace por correo.

La realidad aumentada requiere HTTPS fuera de `localhost`. Android utiliza WebXR o Scene Viewer; iPhone y iPad usan archivos USDZ mediante Quick Look. Si el dispositivo no es compatible, la ficha mantiene disponible el visor 3D y explica la limitación sin romper la página.

## Comandos

- `npm run dev`: inicia el entorno de desarrollo.
- `npm run build`: genera Prisma y compila para producción.
- `npm start`: inicia la compilación de producción.
- `npm run typecheck`: valida todos los tipos.
- `npm run lint`: ejecuta ESLint.
- `npm run format`: formatea TypeScript, CSS, JSON y Prisma.
- `npm run format:check`: comprueba el formato sin modificar archivos.
- `npm run test`: ejecuta las pruebas unitarias.
- `npm run test:e2e`: ejecuta los flujos públicos en escritorio y celular.
- `npm run db:generate`: regenera Prisma Client.
- `npm run db:pull`: inspecciona la estructura de la base desde Prisma.
- `npm run db:studio`: abre el administrador visual de Prisma.

## Estructura

```text
app/          Páginas, layouts y endpoints de Next.js
components/   Componentes React reutilizables
e2e/          Pruebas funcionales con navegador
lib/          Autenticación, tenant, auditoría, Prisma y utilidades
prisma/       Esquema y migraciones seguras de MySQL
public/       Imágenes y recursos estáticos
```

## Modelo multiempresa

Los registros del negocio incluyen un `tenantId`. El acceso administrativo resuelve la membresía activa del usuario y verifica permisos antes de leer o modificar datos. Las consultas de productos, categorías, eventos, horarios, testimonios y configuración se aíslan por empresa.

La instalación existente se migra a un tenant inicial llamado `Laterne`, preservando los identificadores y relaciones anteriores. Los planes comerciales pertenecen a la plataforma y no se escriben directamente en las vistas.

## Migraciones

- `20250809000000_baseline`: punto de partida compatible con la base histórica.
- `20260810003000_phase_one_foundations`: tenants, roles, permisos, sesiones, auditoría, planes, oportunidades y mejoras de productos.
- `20260810010000_backfill_friendly_slugs`: genera direcciones amigables para productos y categorías existentes.
- `20260810020000_login_attempt_protection`: limita intentos de acceso mediante identificadores anónimos y temporales.
- `20260810030000_product_spatial_experience`: modelos 3D y configuración de realidad aumentada por producto.
- `20260810040000_promotions_and_reservations`: promociones, disponibilidad y reservas persistentes.
- `20260810050000_orders_tables_analytics`: pedidos, opciones, mesas QR, fidelización y analítica propia.
- `20260810060000_product_platform_modules`: marca, archivos, notificaciones, soporte, onboarding y plataforma multiempresa.
- `20260810070000_success_cases`: casos de éxito administrables para la landing comercial.
- `20260810080000_scheduled_publication`: publicación programada para el contenido público.
- `20260810100000_operations_expansion`: sucursales, inventario, comprobantes, integraciones, SEO, redirecciones, recuperación de acceso y errores técnicos.
- `20260810101000_tenant_timezone`: zona horaria por negocio para disponibilidad y reportes coherentes en cualquier servidor.

Antes de aplicar migraciones en un entorno real se recomienda crear un respaldo de MySQL. En despliegues se debe usar `npx prisma migrate deploy`; `prisma db push` no reemplaza el historial de migraciones.

## Migración tecnológica

La versión 2 reemplaza Express, Pug, Sequelize, Bootstrap, jQuery y el JavaScript imperativo anterior por una aplicación React unificada. Prisma conserva mediante `@@map` y `@map` los nombres históricos de tablas y columnas, incluida la columna heredada `availavility`.

## Integraciones externas

El núcleo funcional trabaja de forma autónoma con MySQL. En **Administración → Integraciones** se puede revisar la preparación de email, WhatsApp, web push, almacenamiento y Mercado Pago. Las credenciales se leen exclusivamente desde variables de entorno y el panel solo conserva configuración pública y estados operativos. Mercado Pago permanece intencionalmente desactivado: el pedido se registra y administra sin cobrar en línea hasta completar una implementación y homologación separadas.

Los comprobantes incluidos son documentos operativos internos, no facturas fiscales. Para emitir comprobantes fiscales válidos se debe conectar un proveedor autorizado y adaptar el flujo a las obligaciones de la jurisdicción correspondiente.

## Verificación antes de publicar

Ejecutar `npm run format:check`, `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run test:e2e`, `npm run build` y `npm audit --audit-level=high`. En producción también se deben ejecutar las migraciones con `npx prisma migrate deploy`, configurar HTTPS y conservar un respaldo reciente de MySQL.
