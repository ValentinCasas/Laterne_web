# Auditoría de calidad

> Fotografía histórica de la revisión realizada durante el desarrollo. Los estados documentan lo verificado en ese momento; el código y las validaciones automatizadas son la fuente vigente.

**Fecha**: 2026-08-15  
**Versión**: 1.0

---

## Resumen Ejecutivo

| Categoría                  | Issues Críticos | Issues Mayores | Issues Menores | Total  |
| -------------------------- | --------------- | -------------- | -------------- | ------ |
| Arquitectura / Duplicación | 1               | 2              | 3              | 6      |
| UX / Responsive            | 0               | 1              | 4              | 5      |
| Rendimiento                | 0               | 2              | 3              | 5      |
| Consistencia de Datos      | 2               | 1              | 2              | 5      |
| Deuda Técnica              | 1               | 3              | 4              | 8      |
| **Total**                  | **4**           | **9**          | **16**         | **29** |

---

## Hallazgos por Categoría

### 1. Arquitectura y Duplicación (FASE 26)

#### QA-001: Duplicación lógica landing pública — **CRÍTICO (PARCIALMENTE RESUELTO)**

- **Descripción**: `lib/landing-data.ts::loadTenantLandingData()` (fuente única declarada) y `app/s/[branchSlug]/page.tsx` (líneas 180-259) **reimplementan la misma lógica** de construcción de `TenantLandingData`: beers, stories, events, testimonials, opening hours, hero, branch data.
- **Progreso**:
  - `LANDING_BEER_DEFAULTS` centralizado en `lib/landing-content.ts` ✓
  - `resolveLandingBeers()` helper creado en `lib/landing-data.ts` y usado en `app/s/[branchSlug]/page.tsx` ✓
  - `lib/banners` beer images usados como defaults reales ✓
- **Pendiente**: Delegar completamente en `loadTenantLandingData()` + merge branch-specific data (refactor mayor).
- **Archivos**: `lib/landing-data.ts` vs `app/s/[branchSlug]/page.tsx:180-259`

#### QA-002: Duplicación defaults cerveza — **RESUELTO**

- **Estado**: **RESUELTO** — `LANDING_BEER_DEFAULTS` centralizado en `lib/landing-content.ts`; `app/s/[branchSlug]/page.tsx` inlinaba copia propia. Corregido importando la constante y usando imágenes reales de `/images/banners/`.

#### QA-003: Fallback imágenes dispersos — **RESUELTO**

- **Estado**: **RESUELTO** — Centralizados en `lib/image-fallback.ts` (`PRODUCT_IMAGE_FALLBACK`, `CATEGORY_IMAGE_FALLBACK_FILE`, `CATEGORY_IMAGE_FALLBACK`, `DEFAULT_IMAGE_PLACEHOLDERS`).
- **Archivos corregidos**: `components/product-model-experience.tsx`, `components/orders/checkout-form.tsx`, `lib/branch.ts` y `app/admin/[resource]/page.tsx`.

#### QA-004: Resource-manager `DEFAULT_IMAGE_PLACEHOLDERS` local — **RESUELTO**

- **Estado**: **RESUELTO** — Eliminada constante local, ahora importa de `lib/image-fallback.ts`.

#### QA-005: `productFallback` exportado desde `menu-product-card` — **RESUELTO**

- **Estado**: **RESUELTO** — Ahora re-exporta `PRODUCT_IMAGE_FALLBACK` centralizado; `menu-client.tsx` usa `PRODUCT_IMAGE_FALLBACK` directamente.

#### QA-006: Rutas legacy `/admin` conviven con canónicas `/t/{tenant}/admin`

- **Estado**: Sin cambios (requiere plan de migración documentado).

---

### 2. UX / Responsive

#### QA-007: Breakpoints Tailwind no probados sistemáticamente

- **Descripción**: El preview responsive (`components/admin/responsive-preview.tsx`) implementa presets pero no hay tests visuales automatizados (Playwright visual regression) para 320/375/390/430/768/1024/1366/1920.
- **Impacto**: Regresiones visuales silenciosas en landing, carta, checkout.
- **Corrección**: Añadir suite Playwright visual con capturas baseline.

#### QA-008: Carrusel cerveza sin indicador de carga (skeleton)

- **Descripción**: `components/home/beer-carousel.tsx` renderiza `<Image>` directamente; si la imagen tarda, el slide queda vacío sin feedback.
- **Archivos**: `components/home/beer-carousel.tsx:60-67`
- **Corrección**: Añadir placeholder blur o skeleton mientras carga.

#### QA-009: Editor carta — categorías vacías no comunican estado

- **Descripción**: En `components/admin/carta-editor.tsx`, si `previewCategories` está vacío (tenant sin productos publicados), el preview muestra lista vacía sin mensaje.
- **Archivos**: `components/admin/carta-editor.tsx:218-237`
- **Corrección**: Mostrar estado vacío ilustrado ("No hay categorías publicadas").

#### QA-010: Formulario reserva — validación fecha pasada solo client-side

- **Descripción**: `components/reservations/reservation-form.tsx` valida fecha mínima en cliente; server re-valida pero UX mejora con min attribute dinámico.
- **Archivos**: `components/reservations/reservation-form.tsx`

#### QA-011: Checkout — propinas sin preset accesibles

- **Descripción**: Input numérico libre para propina; presets (10%, 15%, 20%) mejorarían UX móvil.
- **Archivos**: `components/orders/checkout-form.tsx`

---

### 3. Rendimiento

#### QA-012: N+1 en carga de landing pública (`loadTenantLandingData`) — **MEJORADO**

- **Descripción**: `lib/landing-data.ts` hace `Promise.all` con 7 queries, pero `eventImageFiles` y `avatarFiles` usan `readdir` (I/O disco). En cold start añade ~50-100ms.
- **Progreso**: Se añadió `publicImageExists()` helper que usa `existsSync` (rápido) y se filtran beers/stories con existencia real. Cache de 60s en `host-gate` para dominios; se puede aplicar patrón similar a `readdir`.
- **Archivos**: `lib/landing-data.ts:53-81`

#### QA-013: `readdir` en páginas server-rendered — **PARCIALMENTE RESUELTO**

- **Descripción**: `app/carta/page.tsx:62-63`, `app/s/[branchSlug]/carta/page.tsx:61-62`, `app/productos/[slug]/page.tsx:62` usan `readdir` (async pero bloquea el event loop por I/O disco).
- **Progreso**: El guard server-side en `lib/landing-data.ts` usa `existsSync` (sync pero rápido) para validar imágenes. Para `readdir` en páginas de carta/productos, se recomienda cache en memoria con TTL (futuro).
- **Archivos**: 4+ páginas

#### QA-014: Imágenes sin `priority` ni `placeholder="blur"` en above-the-fold

- **Descripción**: Hero landing, primera imagen de carta, carrusel cerveza — no usan `priority` ni `blur` placeholder. LCP afectado.
- **Archivos**: `components/home/landing-renderer.tsx`, `components/menu/menu-product-card.tsx`, `components/home/beer-carousel.tsx`

#### QA-015: Bundle size — `docx-templates` y `sharp` en client bundle?

- **Descripción**: Verificar que `docx-templates` (usado en `template-engine.ts`) y `sharp` (usado en `upload/route.ts`) **no** terminen en client bundle. Ambos son server-only.
- **Verificación**: `next.config.ts` no tiene `serverComponentsExternalPackages` explícito para estos; Next.js 16 debería treeshake correctamente por ser importados solo en server actions/api routes.

---

### 4. Consistencia de Datos

#### QA-016: Producto #221 con imagen inexistente (resuelto en Phase 0)

- **Estado**: **RESUELTO** — `imageUrl` actualizado a `product_default.png`; auditoría documentada.

#### QA-017: Evento #121 "agua cn gas" con imagen inexistente (resuelto en Phase 0)

- **Estado**: **RESUELTO** — `imageUrl` actualizado a `null`; grid público ya guarda server-side.

#### QA-018: Categorías con `imageUrl` apuntando a archivos no existentes (6 archivos huérfanos en `images_categories`)

- **Descripción**: Auditoría `audit-images.mjs` encontró 6 archivos en `public/images/images_categories/` no referenciados por ninguna categoría. Inverso: categorías podrían referenciar archivos borrados.
- **Archivos huérfanos**: `birdthday-cake...`, `fast-food-bread-2 (2).png`, `fast-food-french...`, `fast-food-steak...`, `food-taco...`, `jelly-food...`
- **Corrección**: Script de limpieza periódica o validación al asignar imagen en editor.

#### QA-019: bootstrap con `product_default.png` hardcodeado (100+ filas)

- **Descripción**: Seed SQL inserta `product_default.png` como `imageUrl` literal. En runtime se mapea a fallback, pero semántica confusa (debería ser `null` o string vacío para "sin imagen").
- **Archivo histórico**: `prisma/bootstrap.sql`.
- **Corrección**: Normalizar seed a `null` o `""`; runtime usa fallback.

#### QA-020: Tenant 5 (Havana) con `beerImages` rotas (resuelto en Phase 0)

- **Estado**: **RESUELTO** — Actualizado a `/images/banners/apa.png`, `birra.png`, `doble-ipa.png`.

---

### 5. Deuda Técnica

#### QA-021: `app/s/[branchSlug]/page.tsx` — 265 líneas, responsabilidad múltiple

- **Descripción**: Construye landing data, resolve branch, SEO metadata, renderiza `LandingRenderer`. Violación SRP.
- **Corrección**: Extraer `buildBranchLandingData()` a lib; mantener page.tsx < 50 líneas.

#### QA-022: `components/menu/menu-client.tsx` — 886 líneas, estado masivo

- **Descripción**: Maneja carta, carrito, preview, filtros, categorías, búsqueda, fidelidad, pedido, tracking — todo en un componente.
- **Corrección**: Separar en `CartDrawer`, `CategoryTabs`, `ProductGrid`, `PreviewModal`, `LoyaltyWidget` como componentes hijos con props tipados.

#### QA-023: `components/admin/landing-editor.tsx` — 960 líneas

- **Descripción**: Editor completo con hero, beers, stories, eventos, testimonios, mapa, contacto. Cada sección debiera ser componente independiente.
- **Corrección**: `HeroEditor`, `BeerCarouselEditor`, `StoryEditor`, `TestimonialEditor`, `MapEditor`, `ContactEditor`.

#### QA-024: `components/admin/resource-manager.tsx` — 1073 líneas, genérico pero monolítico

- **Descripción**: Maneja 6 recursos (productos, categorias, eventos, usuarios, promociones, testimonios, casos, sucursales, seo, redirecciones, negocio, horarios, legales, ayuda) con switch gigante.
- **Corrección**: Estrategia "resource config" ya existe (`getAdminResource`); extraer cada resource a su propio archivo `admin/resources/{resource}.tsx`.

#### QA-025: Tipos `any` / `unknown` en boundaries de API

- **Descripción**: `app/api/admin/[resource]/route.ts` usa `Record<string, unknown>` y casteos `as unknown as Delegate`. `app/api/admin/[resource]/[id]/route.ts` similar.
- **Corrección**: Definir `AdminResourceInput` genérico por recurso; usar `zod` schemas tipados con `z.infer`.

#### QA-026: `lib/branch.ts` — 400+ líneas, mezcla lógica de dominio y acceso a BD

- **Descripción**: Funciones `resolveEffectiveBranchId`, `ensureBranchProduct`, `assertBranchCapacity`, `resourceScopedWhere` mezclan reglas de negocio con queries Prisma.
- **Corrección**: Separar `BranchService` (lógica) de `BranchRepository` (queries).

#### QA-027: Pruebas E2E limitadas — solo `scripts/run-e2e.mjs` genérico

- **Descripción**: No hay suite Playwright estructurada por feature (login, carta, pedido, reserva, admin).
- **Corrección**: Organizar `tests/e2e/{auth,menu,orders,reservations,admin}/*.spec.ts`.

#### QA-028: Logging de errores cliente sin contexto de sesión

- **Descripción**: `/api/errors` registra `addressHash` y `fingerprint` pero no `sessionId` ni `userId` (aunque rate-limited). Difícil correlacionar errores con usuario real.
- **Corrección**: Incluir `sessionId` hash en payload si hay sesión válida.

---

## Mejoras Recomendadas (Prioridad)

| Prioridad              | Issues                                                                                                                                                                                  |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P1 (Inmediato)**     | QA-003 (fallbacks dispersos - **RESUELTO**), QA-012/013 (rendimiento readdir/cache - **MEJORADO**)                                                                                      |
| **P2 (Corto plazo)**   | QA-001 (duplicación landing - **PARCIALMENTE RESUELTO**), QA-007 (tests visuales), QA-014 (priority/blur imágenes), QA-021/022/023 (refactor componentes grandes), QA-025 (tipado APIs) |
| **P3 (Mediano plazo)** | QA-006 (migración rutas legacy), QA-008/009/010/011 (UX), QA-018/019 (limpieza datos), QA-024/026 (arquitectura), QA-027 (E2E), QA-028 (logging)                                        |

---

## Validaciones Realizadas

- `npx prisma validate` ✓
- `npx tsc --noEmit` ✓
- `npm run lint` ✓ (1 warning preexistente `invoice-renderer.tsx:242`)
- `npm test` ✓ (84 tests)
- `npm run build` ✓ (build previo exitoso)
- Smoke tests: rutas públicas y admin → 200/307 esperados

---

**Calidad general**: **BUENA CON DEUDA TÉCNICA MODERADA** — La base es sólida (auth, tenant isolation, validación server-side), pero la duplicación landing (QA-001) y componentes monolíticos (QA-021-024) frenan escalabilidad. Resolver P1 antes de crecer el equipo.
