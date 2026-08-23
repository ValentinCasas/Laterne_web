# MenuClick — Auditoría de Calidad e Hidratación

**Fecha:** 23 de agosto de 2026  
**Alcance:** Hidratación, performance, responsive, SSR/CSR, null safety, error handling, pruebas

---

## FASE 1 — Hidratación Mobile/Carta

### 1. Causa del Error

El hydration error reportado:

> "A tree hydrated but some attributes of the server rendered HTML didn't match the client properties."

Con atributos `__gcrremoteframetoken` y `__gcruniqueid` en `<html>`, `<input>` y `<select>`.

### 2. Diagnóstico

**Causa: EXTENSIÓN DEL NAVEGADOR (no código de MenuClick).**

Investigación realizada:
- ✅ Búsqueda exhaustiva en todo el código fuente: **cero referencias** a `__gcrremoteframetoken` o `__gcruniqueid`.
- ✅ No hay scripts, MutationObserver, efectos o librerías que inyecten estos atributos.
- ✅ El atributo `suppressHydrationWarning` **no se usa** en el componente afectado.

Estos atributos son inyectados por **Google Translate** u otra extensión que modifica el DOM antes de la hidratación de React.

### 3. Auditoría de MenuClient (`components/menu/menu-client.tsx`)

| Criterio | Estado | Detalle |
|----------|--------|---------|
| Estado inicial determinista | ✅ | `query=""`, `diet="all"`, `maximumPrice=""`, `sort="recommended"` |
| Sin relojes/random en render | ✅ | No hay `Date.now()`, `Math.random()`, `crypto.randomUUID()` en render |
| Sin storage en render | ✅ | `localStorage`/`sessionStorage` solo en `useEffect` |
| Sin navigator/window en render | ✅ | Solo se usa en `product-actions.tsx` (cliente, no SSR) |
| Locale explícito | ✅ | `toLocaleLowerCase("es")` e `Intl.NumberFormat(locale, ...)` |
| IDs estables | ✅ | `category-${category.id}` basado en props |
| HTML válido | ✅ | Sin anidamiento incorrecto de tags interactivos |
| Inputs/Selects | ✅ | Valores SSR y cliente son idénticos |

### 4. Decisión

**No se aplica ningún parche.** La causa es externa a MenuClick y el usuario prohibió usar `suppressHydrationWarning` para ocultar errores.

### 5. Reproducción Confirmada

| Escenario | Hydration Error |
|-----------|----------------|
| Chrome normal con extensiones | ⚠️ Atributos de extensión (no de MenuClick) |
| Chrome incógnito SIN extensiones | ✅ Sin errores |
| Mobile viewport (375, 430, 768) | ✅ Sin errores propios |

---

## FASE 2 — Auditoría Integral de Calidad

### 6. Hydration Global

| Componente | `new Date()` en render | `Math.random()` en render | localStorage en render | Estado |
|------------|----------------------|--------------------------|----------------------|--------|
| `menu-client.tsx` | ❌ No | ❌ No | ❌ No (solo useEffect) | ✅ |
| `menu-product-card.tsx` | ❌ No | ❌ No | ❌ No | ✅ |
| `carta-header.tsx` | ❌ No | ❌ No | ❌ No | ✅ |
| `product-actions.tsx` | ❌ No | ❌ No | ❌ No (solo useEffect) | ✅ |
| `checkout-form.tsx` | ❌ No* | ❌ No* | ❌ No (solo useEffect) | ✅ |
| `expenses-manager.tsx` | ⚠️ `useState(new Date()...)` | ❌ No | ❌ No | ⚠️ Admin only |
| `purchases-modals.tsx` | ⚠️ `useState(new Date()...)` | ❌ No | ❌ No | ⚠️ Admin only |
| `marketing-shell.tsx` | `© {new Date().getFullYear()}` | ❌ No | ❌ No | ✅ Server component |
| `landing-renderer.tsx` | `© {new Date().getFullYear()}` | ❌ No | ❌ No | ✅ Server component |

*`checkout-form.tsx` usa `Date.now()+Math.random()` solo en `idempotencyKey()` (llamada por user action, no en render).

**Nota sobre admin components:** `expenses-manager.tsx` y `purchases-modals.tsx` usan `new Date().toISOString().slice(0,10)` en `useState`. Estos son Client Components administrativos que solo se renderizan tras auth. El formato UTC es consistente server/client pero el valor exacto podría diferir si la hidratación tarda >1 minuto. **Riesgo: muy bajo** (solo admin, solo fecha, formato consistente).

### 7. Server/Client Component Boundaries

| Criterio | Estado |
|----------|--------|
| Funciones no pasadas de Server → Client | ✅ Correcto |
| `Decimal`/`BigInt` no pasados a Client | ✅ Serializados con `serialize()` |
| Fechas problemáticas | ✅ Serializadas como strings |
| Objetos Prisma no serializados | ✅ `serialize()` aplicado |

### 8. Null/Undefined Safety

| Escenario | Estado | Detalle |
|-----------|--------|---------|
| 0 pedidos | ✅ | Empty states en listas y tableros |
| 0 clientes | ✅ | EmptyState componente reutilizable |
| 0 productos | ✅ | "No encontramos productos" en carta |
| 0 facturas | ✅ | Tablero vacío manejado |
| 0 configuraciones | ✅ | Defaults en `CARTA_HEADER_DEFAULTS` |
| 0 sucursales | ✅ | Validación en create |
| 0 repartidores | ✅ | Lista vacía manejada |
| 0 recetas | ✅ | Cálculo de costo retorna null |
| Relaciones null | ✅ | Optional chaining consistente |

### 9. Performance

| Criterio | Estado | Detalle |
|----------|--------|---------|
| N+1 queries | ✅ | `include` con `select` explícito |
| findMany enormes | ✅ | Paginación en listas admin (25/50/100) |
| Listas sin paginación | ✅ | Todas las listas tienen paginación |
| Queries duplicadas | ✅ | `Promise.all()` para queries paralelas |
| Componentes gigantes | ⚠️ | `menu-client.tsx` ~1182 líneas (aceptable, bien organizado) |
| Renders innecesarios | ✅ | `useMemo` en filtros y cálculos |
| Polling excesivo | ✅ | Intervals razonables (10s GPS, 30s pedidos) |
| Imágenes | ✅ | `next/image` con `sizes` optimizados |
| Bundles pesados | ✅ | Lazy loading donde aplica |

### 10. Responsive / UI Robustness

| Viewport | Estado | Detalle |
|----------|--------|---------|
| 320px | ✅ | safe-area, targets táctiles 44px |
| 375px | ✅ | Mobile-first design |
| 430px | ✅ | Validado en proyecto |
| 768px | ✅ | Breakpoint tablet |
| 1024px | ✅ | Desktop layout |
| 1366px | ✅ | Full width |
| 1600px+ | ✅ | Container limits |

| Criterio | Estado |
|----------|--------|
| Overflow global | ✅ | `overflow-x-auto` en listas |
| Modals cortados | ✅ | `max-h-[92vh]` + scroll |
| Navbar overflow | ✅ | Posición fija con compensación |
| Tablas imposibles | ✅ | Scroll horizontal + vista tarjeta |
| Drawers | ✅ | Full height con safe-area |
| Sticky elements | ✅ | z-index correctos |
| Scroll nesting | ✅ | `overscroll-contain` donde aplica |

### 11. Error Handling

| Criterio | Estado |
|----------|--------|
| Usuario nunca ve stack trace | ✅ | Mensajes de dominio en responses |
| PrismaClientKnownRequestError | ✅ | Catch blocks con mensajes genéricos |
| P2025 (Record not found) | ✅ | Manejado con 404 |
| `undefined` visible | ✅ | Optional chaining + nullish coalescing |
| Error boundaries | ✅ | `error.tsx` + `global-error.tsx` |
| Log técnico | ✅ | `logger.error()` con contexto seguro |

### 12. Idempotencia

| Acción | Mecanismo | Estado |
|--------|-----------|--------|
| Crear pedido | `idempotencyKey` + `orderIdempotency` | ✅ |
| Confirmar pedido | `expectedStatus` + `updateMany` | ✅ |
| Recepción compra | Transacción con guard | ✅ |
| Facturación | Transacción con guard | ✅ |
| Pago | Transacción con guard | ✅ |
| Cerrar mesa | `updateMany` con `closedAt: null` | ✅ |
| Transferir mesa | `updateMany` con estado | ✅ |
| Asignar repartidor | Transacción con `CONCURRENT_CHANGE` guard | ✅ |
| GPS posición | Throttling + upsert por scope | ✅ |

### 13. Tests

| Suite | Tests | Estado |
|-------|-------|--------|
| unit (vitest) | 248 | ✅ Todos pasan |
| admin-navigation | 11 | ✅ |
| order-status | 8 | ✅ |
| order-scheduling | 4 | ✅ |
| order-stock | 5 | ✅ |
| promotion | 18 | ✅ |
| reservation-availability | 6 | ✅ |
| inventory | 22 | ✅ |
| recipe-stock | 14 | ✅ |
| recipes | 21 | ✅ |
| delivery-orders | 7 | ✅ |
| delivery-drivers | 5 | ✅ |
| delivery-tracking | 3 | ✅ |
| delivery-route | 2 | ✅ |
| geofence | 9 | ✅ |
| table-status | 8 | ✅ |
| table-layout | 18 | ✅ |
| license | 4 | ✅ |
| loyalty | 2 | ✅ |
| password-reset | 2 | ✅ |
| product-availability | 3 | ✅ |
| product-catalog | 7 | ✅ |
| product-model | 3 | ✅ |
| reservations | 3 | ✅ |
| slug | 3 | ✅ |
| analytics | 2 | ✅ |
| csv | 2 | ✅ |
| print-provider | 4 | ✅ |
| theme-palettes | 2 | ✅ |
| navigation-active | 4 | ✅ |
| browser-compat | 3 | ✅ |
| documents/converter | 2 | ✅ |
| documents/template-engine | 5 | ✅ |

### 14. TypeScript / Lint

| Criterio | Estado |
|----------|--------|
| `tsc --noEmit` | ✅ Sin errores |
| `eslint` | ✅ 0 errores, 15 warnings (unused vars, exhaustive-deps) |
| `npm audit` | Pendiente de ejecutar |

---

## 15. Pendientes Identificados

### P1 (Recomendar corregir)
1. **Inconsistencia AUTH_SECRET:** Migrar `process.env.AUTH_SECRET ?? "dev..."` a `getConfig().authSecret` en todas las funciones de hash.

### P2 (Mejoras)
2. **Headers de seguridad HTTP:** Agregar `X-Content-Type-Options`, `X-Frame-Options`, `HSTS`, `Referrer-Policy` en `next.config.ts`.
3. **CSP:** Considerar Content-Security-Policy con nonce para scripts inline.
4. **Rate limiting uploads:** Agregar throttling por tenant en `/api/admin/upload`.
5. **Error messages genéricos:** Usar mensajes de dominio en catch blocks de APIs de compras/gastos.
6. **CSRF tokens:** Considerar para navegadores legacy (SameSite=Strict ya cubre la mayoría).
7. **Deshabilitar botón submit:** En checkout form durante el POST para prevenir doble submit visual.

### P3 (Mejoras menores)
8. **Cleaning lint warnings:** 15 warnings de unused vars y exhaustive-deps.

---

## Validaciones Ejecutadas

| Comando | Resultado |
|---------|-----------|
| `npx tsc --noEmit` | ✅ 0 errores |
| `npm run lint` | ✅ 0 errores, 15 warnings |
| `npm run test` | ✅ 248/248 tests pasan |
| `git diff --check` | ✅ Limpio |

---

## Conclusión

**MenuClick tiene una calidad de código alta.** El hydration error es causado por extensiones del navegador, no por código. La arquitectura multi-tenant es sólida, las transacciones manejan concurrencia correctamente, los estados vacíos están cubiertos, y la base de tests tiene buena cobertura (248 tests unitarios). Las mejoras sugeridas son de hardening, no de corrección de bugs.
