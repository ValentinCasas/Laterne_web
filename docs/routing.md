# Routing canónico de MenuClick

## Regla principal

La URL visible es la fuente de verdad del contexto. El tenant y la sucursal no se deducen de una cookie de navegación ni de `?branchId=`.

- Tenant: `/t/{tenantSlug}`
- Sucursal pública: `/t/{tenantSlug}/s/{branchSlug}`
- Administración tenant: `/t/{tenantSlug}/admin`
- Administración de sucursal: `/t/{tenantSlug}/admin/s/{branchSlug}`
- Plataforma MenuClick: `/platform`

## Ejemplos en desarrollo

Todo funciona en `http://localhost:3000`:

```text
MenuClick                 http://localhost:3000/
Platform                  http://localhost:3000/platform
Clientes Platform         http://localhost:3000/platform/clientes

Laterne                   http://localhost:3000/t/laterne
Carta Laterne             http://localhost:3000/t/laterne/carta
Admin Laterne             http://localhost:3000/t/laterne/admin

Principal / Productos     http://localhost:3000/t/laterne/admin/s/principal/productos
Principal / Pedidos       http://localhost:3000/t/laterne/admin/s/principal/pedidos
Laterne 2 / Pedidos       http://localhost:3000/t/laterne/admin/s/laterne-2/pedidos

Landing Laterne 2         http://localhost:3000/t/laterne/s/laterne-2
Carta Laterne 2           http://localhost:3000/t/laterne/s/laterne-2/carta

SODERIA                   http://localhost:3000/t/soderia
Admin SODERIA             http://localhost:3000/t/soderia/admin
```

## API

Las llamadas del navegador también expresan el contexto:

```text
/api/platform/...
/api/t/laterne/admin/...
/api/t/laterne/admin/s/principal/...
/api/t/laterne/...
/api/t/laterne/s/principal/...
```

El gateway (`proxy.ts`) traduce temporalmente esas URLs a los Route Handlers físicos existentes. Esto permite corregir el routing sin cambiar Next.js, React, TypeScript, Prisma ni MySQL.

## Multi-tab

Estas pestañas son independientes porque la sucursal está en cada URL:

```text
/t/laterne/admin/s/principal/pedidos
/t/laterne/admin/s/laterne-2/pedidos
/t/soderia/admin
```

Cambiar la sucursal con el selector navega a otra URL; no muta una `activeBranchId` global de sesión.

## Reglas de seguridad

1. El tenant de una ruta canónica se valida contra la membresía autenticada.
2. El branch se busca dentro de ese tenant y debe pertenecer a los accesos del usuario.
3. Un branch explícito inexistente o no permitido no hace fallback a Principal.
4. Los endpoints públicos de pedidos y reservas toman el branch explícito de la ruta antes que valores legacy enviados por body/query.
5. Cada tenant tiene una cookie de sesión propia incluso compartiendo el host administrativo fijo.
6. Platform utiliza una cookie distinta de las sesiones tenant.

## Producción

El diseño objetivo usa hosts fijos:

```text
https://menu-click.app/t/laterne/...
https://app.menu-click.app/t/laterne/admin/...
https://app.menu-click.app/platform/...
```

Los dominios personalizados públicos se conservan. Los subdominios tenant antiguos y `/superadmin` se mantienen únicamente como aliases de transición hacia la URL canónica.

## Login y sesiones

```text
Platform login            http://localhost:3000/platform/login
Laterne login             http://localhost:3000/t/laterne/login
SODERIA login             http://localhost:3000/t/soderia/login
```

En el host administrativo fijo cada tenant usa una cookie distinta. Por eso Laterne y SODERIA pueden permanecer abiertas en pestañas distintas sin que el login/logout de una cambie la sesión de la otra.

## Módulos tenant-level y branch-level

Las secciones que pertenecen al tenant completo (por ejemplo usuarios, sucursales, marca, negocio, SEO o integraciones) no conservan un `/s/{branch}` decorativo. Si se intenta abrir uno, el gateway normaliza la URL.

Las secciones operativas que sí pueden variar por sucursal (productos, categorías, pedidos, reservas, inventario, mesas, estadísticas, archivos, auditoría, importación de datos, etc.) conservan `/s/{branch}` y usan esa sucursal como fuente de verdad.

Una escritura branch-scoped desde una vista consolidada no hace fallback silencioso a la sucursal Principal: debe elegirse explícitamente una sucursal.

## Dominios personalizados

Los dominios propios del cliente continúan usando paths planos porque el host ya identifica al tenant:

```text
https://laterne.com/
https://laterne.com/carta
https://laterne.com/s/laterne-2/carta
```

El panel administrativo nunca vive en el dominio personalizado. Un acceso legacy a `/admin` o `/login` desde ese dominio se redirige al host administrativo fijo con el tenant explícito en la URL.
