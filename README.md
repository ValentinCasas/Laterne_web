# Laterne Web

Plataforma gastronómica construida con Next.js, React, TypeScript, Tailwind CSS y Prisma. Conserva la base MySQL del sistema original y suma una base multiempresa para evolucionar el producto sin mezclar información entre clientes.

## Funcionalidades actuales

### Experiencia pública

- Landing del negocio con eventos, horarios, testimonios, ubicación y productos destacados.
- Carta virtual responsive con categorías, búsqueda, pedido local y envío por WhatsApp.
- Fichas individuales de producto con URL amigable, metadatos sociales y datos estructurados.
- Favoritos locales, compartir productos, etiquetas alimentarias y precios promocionales.
- Landing comercial para negocios, catálogo de planes y comparador de funcionalidades.
- Formulario de solicitud de demo con persistencia, protección antispam y continuación por WhatsApp.
- Sitemap, robots.txt, manifest y página 404 personalizada.

### Administración

- Gestión de productos, categorías, eventos, horarios, testimonios, negocio y usuarios.
- Gestión comercial de planes, precios y funcionalidades sin modificar componentes.
- Tablero de oportunidades con búsqueda, detalle, estados y movimiento entre columnas.
- Roles y permisos por empresa.
- Sesiones revocables y rutas administrativas protegidas.
- Auditoría de operaciones con usuario, entidad, IP y valores anteriores/nuevos.
- Gestor de imágenes con validación por recurso.

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
3. Ajustar `DATABASE_URL`, `NEXT_PUBLIC_SITE_URL` y generar un valor seguro para `AUTH_SECRET`.
4. Ejecutar `npm install`.
5. Ejecutar `npx prisma migrate deploy` para aplicar las migraciones pendientes.
6. Ejecutar `npm run dev`.

En producción, `AUTH_SECRET` es obligatorio. Debe ser largo, aleatorio y mantenerse fuera del repositorio.

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

Antes de aplicar migraciones en un entorno real se recomienda crear un respaldo de MySQL. En despliegues se debe usar `npx prisma migrate deploy`; `prisma db push` no reemplaza el historial de migraciones.

## Migración tecnológica

La versión 2 reemplaza Express, Pug, Sequelize, Bootstrap, jQuery y el JavaScript imperativo anterior por una aplicación React unificada. Prisma conserva mediante `@@map` y `@map` los nombres históricos de tablas y columnas, incluida la columna heredada `availavility`.

## Alcance de esta etapa

Esta entrega cubre la base de la Fase 1: profesionalización comercial, producto individual, seguridad, roles, auditoría, SEO, accesibilidad y preparación multiempresa. El visor 3D/AR, reservas, promociones, pedidos persistidos y estadísticas avanzadas pertenecen a las siguientes fases y deben implementarse sobre esta base, con almacenamiento externo y credenciales definidos antes de habilitarlos en producción.
