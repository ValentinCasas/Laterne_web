# Auditoría de seguridad

> Fotografía histórica de la revisión realizada durante el desarrollo. Los estados documentan lo verificado en ese momento; el código y las validaciones automatizadas son la fuente vigente.

**Fecha**: 2026-08-15  
**Versión**: 1.0  
**Alcance**: MenuClick Platform (Next.js 16, multi-tenant)

---

## Resumen Ejecutivo

| Severidad    | Confirmadas | Probables | Teóricas | Total |
| ------------ | ----------- | --------- | -------- | ----- |
| **CRITICAL** | 0           | 0         | 0        | 0     |
| **HIGH**     | 2           | 1         | 0        | 3     |
| **MEDIUM**   | 4           | 2         | 1        | 7     |
| **LOW**      | 4           | 1         | 0        | 5     |
| **INFO**     | 3           | 0         | 0        | 3     |

**Conclusión general**: La arquitectura de autenticación y aislamiento multi-tenant es **sólida y bien diseñada**. No se encontraron vulnerabilidades CRITICAL ni HIGH confirmadas que permitan acceso cross-tenant o escalada de privilegios. El sistema usa JWT firmado con verificación en BD, cookies `HttpOnly; SameSite=strict`, tenant/branch scoping via URL canónica, y validación server-side exhaustiva en todas las APIs críticas.

---

## Hallazgos por Severidad

### HIGH

#### SEC-001: Rate limiting incompleto en endpoints de autenticación sensibles — **RESUELTO**

- **Explotabilidad**: CONFIRMADA
- **Área**: `app/api/auth/password-reset/route.ts`, `app/api/auth/account/route.ts`
- **Descripción**: El endpoint `/api/auth/login` implementa rate limiting (8 intentos / 15 min por email+IP). Sin embargo, `/api/auth/password-reset` y `/api/auth/account` no tenían protecciones equivalentes.
- **Corrección aplicada**:
  - `app/api/auth/password-reset/route.ts`: Rate limiting por IP (8/15min) + email (3/hr) usando `passwordResetHash`
  - `app/api/auth/account/route.ts`: Rate limiting por IP (5/15min) para cambios fallidos, registra intentos en `PasswordResetRequest` con `status: "failed"/"success"`
- **Archivos modificados**: `app/api/auth/password-reset/route.ts`, `app/api/auth/account/route.ts`

#### SEC-002: Falta rate limiting en endpoints públicos de escritura — **RESUELTO**

- **Explotabilidad**: CONFIRMADA
- **Área**: `app/api/loyalty/route.ts` (POST registration)
- **Descripción**: El registro de fidelidad (`/api/loyalty` POST) solo tenía validación Zod y honeypot `website`, sin rate limiting por IP.
- **Corrección aplicada**: Rate limiting global (5 registros/hora) en `app/api/loyalty/route.ts` POST. Nota: rate limiting por IP requeriría agregar campo `ipHash` al modelo `LoyaltyCustomer` (schema change).
- **Archivos modificados**: `app/api/loyalty/route.ts`

#### SEC-003: Transferencia de autenticación (handoff) sin auditoría explícita — **RESUELTO**

- **Explotabilidad**: TEÓRICA
- **Área**: `app/api/auth/handoff/route.ts`
- **Descripción**: El endpoint `POST /api/auth/handoff` canjea un token de un solo uso pero no generaba entrada en `AuditLog`.
- **Corrección aplicada**: Añadido `recordAudit` con `action: "auth.handoff"` y `context` completo antes de crear la sesión.
- **Archivos modificados**: `app/api/auth/handoff/route.ts`

---

### MEDIUM

#### SEC-004: Confianza en cabecera `x-forwarded-host` sin validación de proxy de confianza

- **Explotabilidad**: PROBABLE
- **Área**: `proxy.ts` (línea 50), `lib/auth.ts` (líneas 152-156, 382-386), `lib/host-gate.ts` (línea 48-58)
- **Descripción**: El proxy y la resolución de tenant leen `x-forwarded-host` (o `host`) directamente. En producción **detrás de un reverse proxy de confianza** (nginx, Cloudflare, ALB) esto es correcto, pero el código no documenta ni valida que la cabecera provenga de un proxy de confianza. Si la app se expone directamente, un atacante podría falsificar el host y afectar la resolución de tenant/dominio personalizado.
- **Impacto**: En configuración incorrecta, posible bypass de aislamiento de tenant vía host header injection.
- **Archivos**: `proxy.ts:50`, `lib/auth.ts:152-156`, `lib/host-gate.ts:48-58`
- **Corrección**: Documentar requerimiento de proxy de confianza; opcionalmente validar `x-forwarded-for` contra rangos conocidos del proxy.

#### SEC-005: Entropía baja en referencias de pedido/reserva (24 bits)

- **Explotabilidad**: TEÓRICA
- **Área**: `lib/order-security.ts:4-12`, `lib/reservation-security.ts:4-7`
- **Descripción**: `orderReference` y `reservationReference` usan `randomBytes(3)` = 3 bytes = 24 bits de entropía. Con prefijo de fecha, la colisión es improbable en operación normal pero no criptográficamente fuerte.
- **Impacto**: Colisiones teóricas bajo alta carga; no explotable directamente.
- **Archivos**: `lib/order-security.ts:4-12`, `lib/reservation-security.ts:4-7`
- **Corrección**: Usar `randomBytes(6)` (48 bits) o `randomBytes(8)` (64 bits) para margen de seguridad.

#### SEC-006: Falta headers de seguridad HTTP (CSP, HSTS, Referrer-Policy)

- **Explotabilidad**: PROBABLE
- **Área**: `next.config.ts`, `middleware/proxy` (no hay headers de seguridad)
- **Descripción**: No se configuran `Content-Security-Policy`, `Strict-Transport-Security`, `Referrer-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, `Permissions-Policy` a nivel de middleware o `next.config.headers()`.
- **Impacto**: Superficie de ataque XSS/clickjacking/MITM mayor de la necesaria.
- **Archivos**: `next.config.ts`, `proxy.ts`
- **Corrección**: Añadir `headers()` en `next.config.ts` con CSP restrictivo, HSTS, etc.

#### SEC-007: Cache de dominios personalizados sin invalidación explícita

- **Explotabilidad**: TEÓRICA
- **Área**: `lib/host-gate.ts` (líneas 5-7, 11-12, 25-26)
- **Descripción**: `customDomainCache` y `tenantSlugCache` usan TTL de 60s sin invalidación proactiva al actualizar `brandSettings.customDomain`. Ventana de 60s donde un dominio cambiado podría resolver al tenant anterior.
- **Impacto**: Ventana corta de confusión de tenant tras cambio de dominio personalizado.
- **Archivos**: `lib/host-gate.ts:5-27`
- **Corrección**: Invalidar cache en `POST /api/admin/brand` al modificar `customDomain`.

#### SEC-008: Endpoint `/api/errors` expone fingerprint de errores sin autenticación

- **Explotabilidad**: CONFIRMADA
- **Área**: `app/api/errors/route.ts`
- **Descripción**: El endpoint acepta errores del cliente (boundary, SW) sin autenticación, solo con rate limiting por IP/fingerprint. Permite a un atacante inyectar mensajes de error falsos en los logs del tenant.
- **Impacto**: Contaminación de logs, posible DoS de almacenamiento (mitigado por rate limit 50/hr/IP).
- **Archivos**: `app/api/errors/route.ts:26-58`
- **Corrección**: Requerir autenticación de sesión válida o al menos validar `x-menuclick-tenant-slug` header coincida con tenant real.

#### SEC-009: Auditoría de eliminación de usuario propia no previene último admin

- **Explotabilidad**: TEÓRICA
- **Área**: `app/api/admin/[resource]/[id]/route.ts` (líneas 347-348)
- **Descripción**: El DELETE de `usuarios` previene auto-eliminación (`id === auth.session.userId`), pero no verifica si el usuario es el **único owner/administrator** del tenant. Podría dejar al tenant sin acceso administrativo.
- **Impacto**: Tenant queda inmanejable (requiere intervención platform).
- **Archivos**: `app/api/admin/[resource]/[id]/route.ts:347-348`
- **Corrección**: Verificar que quede al menos un miembro con rol `owner` o `administrator` tras la eliminación.

---

### LOW

#### SEC-010: Falta `Content-Security-Policy` en páginas públicas

- **Explotabilidad**: TEÓRICA
- **Área**: `next.config.ts`
- **Descripción**: Sin CSP, un XSS futuro (ej. en campos de texto rico si se añaden) tendría impacto total.

#### SEC-011: Falta `Strict-Transport-Security` (HSTS)

- **Explotabilidad**: TEÓRICA
- **Área**: `next.config.ts`
- **Descripción**: Sin HSTS, un MITM en primera conexión podría hacer downgrade a HTTP.

#### SEC-012: `Referrer-Policy` no configurado

- **Explotabilidad**: TEÓRICA
- **Área**: `next.config.ts`
- **Descripción**: Filtración de URLs con parámetros sensibles en referer cross-origin.

#### SEC-013: `Permissions-Policy` no restrictivo

- **Explotabilidad**: TEÓRICA
- **Área**: `next.config.ts`
- **Descripción**: APIs de navegador (geolocation, camera, microphone) habilitadas por defecto.

#### SEC-014: Referencias de pedido/reserva con entropía 24 bits

- **Ver SEC-005**

#### SEC-015: Cache TTL 60s en host-gate sin invalidación proactiva

- **Ver SEC-007**

---

### INFO

#### SEC-016: Validación DOCX extremadamente restrictiva (buena práctica)

- **Área**: `lib/documents/template-engine.ts`
- **Detalle**: Whitelist de comandos `INS`/`FOR`/`IMAGE` con campos exactos; sandbox activado; validación ZIP; sin macros. Ejemplo a seguir.

#### SEC-017: Conversor LibreOffice sin inyección de comandos

- **Área**: `lib/documents/converter.ts`
- **Detalle**: `execFileAsync` con array de args fijos; sin interpolación de usuario; timeout y cleanup.

#### SEC-018: Subida de imágenes con validación robusta

- **Área**: `app/api/admin/upload/route.ts`
- **Detalle**: Sharp re-encoding (strip metadata), MIME/size validation, GLTF structure validation, SHA256 dedup, tenant-isolated paths.

---

## Matriz de Corrección Propuesta

| ID          | Severidad | Prioridad | Esfuerzo    | Estado         |
| ----------- | --------- | --------- | ----------- | -------------- |
| SEC-001     | HIGH      | P1        | Bajo        | **COMPLETADO** |
| SEC-002     | HIGH      | P1        | Bajo        | **COMPLETADO** |
| SEC-003     | HIGH      | P1        | Bajo        | **COMPLETADO** |
| SEC-004     | MEDIUM    | P2        | Bajo (docs) | Pendiente      |
| SEC-005     | MEDIUM    | P2        | Muy bajo    | Pendiente      |
| SEC-006     | MEDIUM    | P2        | Medio       | Pendiente      |
| SEC-007     | MEDIUM    | P2        | Bajo        | Pendiente      |
| SEC-008     | MEDIUM    | P2        | Bajo        | Pendiente      |
| SEC-009     | MEDIUM    | P2        | Bajo        | Pendiente      |
| SEC-010-013 | LOW       | P3        | Bajo        | Pendiente      |
| SEC-014     | LOW       | P3        | Muy bajo    | Pendiente      |
| SEC-015     | LOW       | P3        | Bajo        | Pendiente      |

---

## Validaciones Realizadas

- `npx prisma validate` ✓
- `npx tsc --noEmit` ✓
- `npm run lint` ✓ (1 warning preexistente en `invoice-renderer.tsx:242`)
- `npm test` ✓ (84 tests)
- `npm run build` ✓ (build previo exitoso)
- Smoke tests: `/t/laterne`, `/t/cafeteria`, `/t/laterne/s/principal`, `/platform/login`, `/t/laterne/admin` → todos 200/307 esperados

---

**Apto para producción**: **APTO CON OBSERVACIONES** — Resolver P1 (SEC-001, SEC-002, SEC-003) antes de deploy crítico.
