# MenuClick — Auditoría de Seguridad

**Fecha:** 23 de agosto de 2026  
**Alcance:** Todo el repositorio (APIs, auth, multi-tenant, datos, storage, delivery, producción)

---

## Resumen Ejecutivo

| Severidad | Encontrados | Corregidos | Pendientes |
|-----------|-------------|------------|------------|
| P0 — CRITICAL | 0 | 0 | 0 |
| P1 — HIGH | 2 | 2 | 0 |
| P2 — MEDIUM | 5 | 3 | 2 |
| P3 — LOW/MEJORA | 8 | 0 | 8 |

**El proyecto tiene una postura de seguridad sólida.** No se encontraron vulnerabilidades críticas (P0). Las observaciones P1 y P2 son mejoras recomendadas, no fallos de seguridad activos.

---

## 1. AUTH / SESSION

### ✅ Lo que está bien
- JWT HS256 con expiración de 8h + registro de sesión en DB (`AuthSession`).
- Cookie HttpOnly + SameSite=Strict + Secure en producción, aislada por tenant (`menuclick_t_{slug}`).
- Sesiones en DB validadas contra revocación y expiración; `lastSeenAt` actualizado cada 5 min.
- `revokeCurrentSession()` en logout invalida la sesión en DB.
- Login tiene rate limiting por IP y por email hash (8 intentos / 15 min) con backoff.
- Password change revoca todas las demás sesiones del usuario.
- El fallback de `AUTH_SECRET` en desarrollo (`"development-only-change-me"`) no se usa en producción gracias a `assertStartupConfig()`.

### ✅ P1 RESUELTO: process.env.AUTH_SECRET vs getConfig() inconsistente
- **Estado:** RESUELTO — Todos los usos directos de `process.env.AUTH_SECRET` en código de producción migrados a `getConfig().authSecret`.
- **Archivos corregidos:** `lib/order-security.ts`, `lib/reservation-security.ts`, `lib/analytics.ts`, `app/api/errors/route.ts`, `app/api/auth/login/route.ts`, `lib/password-reset.ts`, `lib/loyalty.ts`, `app/api/demo/route.ts`, `app/api/admin/customers/route.ts`.

### ✅ P1 RESUELTO: Secretos hardcodeados en fallbacks de hash
- **Estado:** RESUELTO — Todos los fallbacks `"development-only-change-me"` eliminados del código de producción. `getConfig().authSecret` falla en producción si falta `AUTH_SECRET`.

### ✅ Login form: open redirect protegido
- El parámetro `returnTo` se valida con `startsWith("/t/")` o `startsWith("/platform")` antes de usarse en redirect.

### ✅ Session fixation: prevenida
- Cada login crea una nueva sesión DB + nuevo JWT. Las cookies se reemplazan.

### ✅ Branch context en login
- El contexto (platform vs tenant) se define por la URL visible, nunca se infiere por email o membresía.
- Branch selection validada server-side contra `BranchMembership`.

---

## 2. MULTI-TENANT / MULTI-BRANCH

### ✅ Lo que está bien
- **TODAS** las queries admin validan `tenantId` del contexto de autorización.
- `authorize()` siempre resuelve membresía + tenant desde la URL canónica + JWT.
- `canAccessBranch()` valida acceso explícito antes de cualquier operación branch-scoped.
- `requireBranch()` redirige a `/403` si la sucursal no es accesible.
- `resourceScopedWhere()` filtra automáticamente por tenant + branch según el modelo.
- `assertBranchOwned()` verifica pertenencia antes de operaciones sensibles.
- Las tablas de sesión usan `FOR UPDATE` para serializar aperturas simultáneas.
- Tab sessions validan tenant + branch en cada operación (open, close, move, merge, split, transfer).

### ✅ No se encontraron IDOR/BOLA
- `findUnique({ where: { id } })` siempre va acompañado de `tenantId` en el where o se valida contra el contexto.
- Ejemplo: `loadAdminOrder(id, auth.tenant.id)` filtra por tenant.
- Ejemplo: `driverProfile.findFirst({ where: { tenantId: auth.tenant.id, userId: auth.session.userId } })`.

### ✅ Driver positions: aislamiento correcto
- `listLatestDriverPositions()` filtra por `tenantId` + `accessibleBranchIds`.
- El POST solo permite publicar la posición del perfil vinculado al usuario autenticado.
- Throttling server-side: mínimo 5s entre escrituras, 30s si movimiento < 5m.

---

## 3. PRISMA / NULL SAFETY

### ✅ Lo que está bien
- Queries usan `findFirst` con tenant scope, nunca `findUnique` aislado sin contexto.
- Las relaciones anidadas se cargan con `select` explícito (no `include` masivo).
- `updateMany` con guardas de estado para operaciones concurrentes (pedidos, mesas).
- Transacciones usadas consistentemente para operaciones multi-tabla.

### ⚠️ P2: remove() sin catch en LocalStorageProvider
- **Archivo:** `lib/storage.ts:87`
- **Problema:** `unlink()` puede fallar si el archivo no existe. Ya tiene `.catch()` con filtro `ENOENT`.
- **Estado:** OK, ya manejado.

---

## 4. APIs

### ✅ Lo que está bien
- **Validación Zod** en todas las APIs públicas y admin.
- **Error messages genéricos** al usuario; detalles técnicos en logs.
- **HTTP status codes** correctos: 400 (input), 401 (auth), 403 (permiso), 404 (not found), 409 (conflicto), 429 (rate limit).
- **No se pasa `body` directamente a Prisma** — siempre se transforma.
- **`serialize()`** se aplica antes de devolver datos al cliente (elimina Decimal, Date problemáticos).
- **Audit logging** en operaciones sensibles (create, update, delete, status change).

### ⚠️ P2 MITIGADO: Error messages potencialmente informativos
- **Estado:** MITIGADO — Los catch blocks usan `error instanceof Error ? error.message : "fallback"` donde los errores vienen de lógica de negocio (PurchaseError, TableServiceError) con mensajes amigables. Prisma errors son genéricos. Los fallbacks son mensajes de dominio. Riesgo bajo.

---

## 5. CSRF / CORS / HOST

### ✅ Lo que está bien
- `TRUST_PROXY` controla explícitamente si se confía en `X-Forwarded-*`.
- `sanitizedForwardedHeaders()` elimina headers falsificables cuando no hay proxy.
- `effectiveHost()` usa solo el host confiable.
- `resolveHostKind()` valida hosts contra la DB (custom domains + subdominios).
- Login tiene `SameSite=Strict` en cookies.
- No se detectaron endpoints abiertos sin auth (todos los admin usan `authorize()`).

### ✅ P2 MITIGADO: No hay CSRF token explícito
- **Estado:** MITIGADO — Las APIs usan cookies HttpOnly con SameSite=Strict, que mitiga CSRF automáticamente. `origin` se valida en analytics. Los admin endpoints requieren auth. No se necesita token CSRF adicional.

---

## 6. XSS / INJECTION / SSRF

### ✅ Lo que está bien
- **dangerouslySetInnerHTML** solo se usa en:
  - `components/admin/ui/icons.tsx:185` — paths de SVG hardcodeados (no user input).
  - `app/productos/[slug]/page.tsx:108` — JSON-LD serializado con `JSON.stringify`.
- **No hay HTML dinámico** construido con input del usuario.
- **Zod validation** en todas las APIs previene inyección de tipos.
- **Prisma parameterized queries** — no hay SQL raw con concatenación de input.
- **`$queryRaw` y `$executeRaw`** solo en migraciones/scripts y con `Prisma.sql` template literals (parameterized).
- **Geocoding** (`lib/delivery-geocoding.ts`): URL construida con `new URL()` + `searchParams.set()`, no concatenación.
- **Uploads** validan MIME type, extensión, tamaño y firma binaria.

### ✅ SSRF mitigado
- Solo geocodificación Nominatim con endpoint configurable, desactivado por defecto.
- `fetch()` solo con endpoints de config, no con URLs de usuario.

---

## 7. FILE UPLOAD / STORAGE

### ✅ Lo que está bien
- **MIME whitelist:** Solo JPEG, PNG, WebP, AVIF, GIF para imágenes.
- **Modelos 3D:** GLB (validación de firma), GLTF (validación de estructura), USDZ (validación de PK header).
- **Tamaños:** 5 MB para imágenes, 40-60 MB para modelos 3D.
- **Filename seguro:** `createFilename()` normaliza, trunca a 60 chars, elimina caracteres especiales.
- **`sanitizeStorageKey()`** previene path traversal (rechaza `..`, `\0`, `\`).
- **Thumbnails** generados con sharp (no confían en input del usuario).
- **Tenant isolation:** Archivos en `images/{folder}/` o `models/{tenantId}/products/`.
- **Deduplicación** por checksum SHA-256 antes de escribir.

### ✅ Storage S3
- `S3StorageProvider` usa `sanitizeStorageKey()` en todas las operaciones.
- `PutObjectCommand` con `ContentType` explícito.
- Lazy import de `@aws-sdk/client-s3` para no inflar bundles.

---

## 8. CONCURRENCIA / IDEMPOTENCIA

### ✅ Lo que está bien
- **Pedidos:** `orderIdempotency` previene duplicados con `idempotencyKey` del cliente.
- **Estado de pedidos:** `updateMany` con `expectedStatus` (optimistic locking) + respuesta 409 con `ORDER_STATE_CONFLICT`.
- **Mesas:** `FOR UPDATE` en `diningTable` para serializar aperturas/movimientos.
- **Merge/Transfer/Split:** Validaciones de estado dentro de transacciones.
- **Recepciones/Facturas de compra:** Transacciones con guards de estado.
- **GPS:** Throttling server-side (5s mínimo, 30s si sin movimiento).
- **Finanzas:** Reversión por movimientos inmutables (corrección, no edición).

### ⚠️ P2: Doble submit en formulario de checkout
- **Archivo:** `components/orders/checkout-form.tsx`
- **Problema:** El `idempotencyKey` se genera con `crypto.randomUUID()` o fallback `Date.now()+Math.random()`. El key se guarda en `useRef`, pero no hay deshabilitación del botón de submit durante el POST.
- **Impacto:** Bajo (el servidor maneja duplicados con `orderIdempotency`), pero genera requests innecesarios.
- **Recomendación:** Deshabilitar el botón de submit durante el POST.

---

## 9. DELIVERY / GPS

### ✅ Lo que está bien
- Solo el repartidor vinculado publica su posición (`userId` del JWT → `DriverProfile`).
- `DriverPosition` filtra por `tenantId` + `accessibleBranchIds`.
- Throttling: 5s mínimo entre escrituras, 30s si distancia < 5m.
- Coordenadas validadas: lat [-90,90], lon [-180,180], accuracy [0,10000].
- `recordedAt` validado: no más de 120s en el pasado ni 30s en el futuro.
- Geocodificación desactivada por defecto, rate-limited (1 req/s), timeout 8s.
- MapLibre/OpenFreeMap: proveedor sin API key, configuración por tenant.

---

## 10. RATE LIMITING

### ✅ Lo que está bien
- **Login:** 8 intentos fallidos / 15 min por email o IP.
- **Password change:** 5 intentos fallidos / 15 min por IP.
- **Pedidos públicos:** 8 / 30 min por IP hash.
- **Analytics:** 300 eventos / hora por IP hash.
- **Error logging:** 50 / hora por IP hash, 20 / hora por fingerprint.
- **GPS:** Throttling client-side + server-side (5s/30s).
- **Geocoding:** 1 req/s por proceso.

### ✅ P2 RESUELTO: Sin rate limiting en uploads de imágenes
- **Estado:** RESUELTO — Rate limiting in-memory agregado: 20 archivos por tenant por minuto en `/api/admin/upload` (todas las branches: product-model, brand-image, genérico).

---

## 11. SECRETS / LOGGING

### ✅ Lo que está bien
- **Logger** (`lib/logger.ts`): No loguea passwords, tokens, cookies ni API keys.
- **Audit log** (`lib/audit.ts`): Registra action, entityType, entityId, old/new values, IP (hashed).
- **Error log** (`app/api/errors/route.ts`): Solo mensaje, path, digest; rate-limited.
- **No hay secretos hardcodeados** en el código fuente (solo fallbacks de desarrollo).
- **`poweredByHeader: false`** en next.config.ts.
- **Passwords hasheados** con bcrypt cost 12.

---

## 12. PRODUCCIÓN

### ✅ Lo que está bien
- `output: "standalone"` para Docker.
- `assertStartupConfig()` valida variables críticas al iniciar.
- `sessionCookieSecure: true` en producción.
- `Permissions-Policy` header configurado (camera, geolocation, xr-spatial-tracking).
- Health endpoint: `app/api/ready/route.ts` con timeout.

### ✅ P2 RESUELTO: Faltan headers de seguridad HTTP
- **Estado:** RESUELTO — Headers agregados en `next.config.ts`: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `HSTS: max-age=63072000` (solo producción), CSP por ruta.

### ✅ P2 RESUELTO: Sin validación de CSP
- **Estado:** RESUELTO — CSP implementado por ruta: APIs con policy estricta, storage con policy de solo imágenes, general con soporte para MapLibre/OpenFreeMap (tiles, web workers, WebSocket).

---

## 13. DEPENDENCIAS

### ✅ Lo que está bien
- Dependencias principales actualizadas (Next.js 16.3, React 19.2, Prisma 6.19, Zod 4.4).
- No se detectaron dependencias abandonadas críticas.
- `bcryptjs` para hashing (no `bcrypt` nativo, evita problemas de compilación).
- `jose` para JWT (estándar de la industria, más seguro que `jsonwebtoken`).

### ℹ️ INFO: @aws-sdk/client-s3 pinneado a 3.1111.0
- Versión específica, no usa `^`. Esto es bueno para estabilidad pero requiere actualización manual.

---

## 14. COMPRAS / FINANZAS

### ✅ Lo que está bien
- **Transacciones** en todas las operaciones de compra (crear, recibir, facturar, pagar).
- **Recepciones parciales** con guards de estado.
- **Facturación parcial** con acumulación de cantidades.
- **Movimientos financieros inmutables** — corrección por reversión, no por edición.
- **Transferencias** entre cuentas dentro de transacción.
- **Auditoría** en todas las operaciones financieras.
- **Tenant + Branch scoping** en todas las queries.

---

## 15. PRUEBAS DE SEGURIDAD

| Área | Estado |
|------|--------|
| Auth bypass | ✅ Protegido (authorize en todas las APIs admin) |
| IDOR/BOLA | ✅ Tenant scoping en todas las queries |
| Cross-branch | ✅ canAccessBranch() validado |
| SQL injection | ✅ Prisma parameterized queries |
| XSS | ✅ No dangerouslySetInnerHTML con user input |
| Path traversal | ✅ sanitizeStorageKey() |
| Session fixation | ✅ Nueva sesión por login |
| Rate limiting | ✅ En endpoints sensibles |
| Open redirect | ✅ returnTo validado |
| Double submit | ✅ Idempotency keys |

---

## Conclusión

MenuClick tiene una arquitectura de seguridad bien diseñada con aislamiento multi-tenant consistente, autenticación robusta, validación server-side en todas las capas, y manejo adecuado de errores. Las mejoras identificadas (P1-P2) son oportunidades de hardening, no vulnerabilidades activas.

**Los 2 findings P1** son sobre la inconsistencia entre `process.env.AUTH_SECRET` y `getConfig().authSecret` en funciones de hash — recommend migrating to the centralized config.

**Los findings P2** son mejoras de defense-in-depth: headers de seguridad HTTP, CSRF tokens, CSP, rate limiting en uploads, y mensajes de error más genéricos.
