<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# MenuClick — Reglas permanentes para agentes

1. Leer `PROJECT_CONTEXT.md` antes de trabajar.
2. Inspeccionar solamente las áreas relacionadas con la tarea.
3. Evitar exploraciones generales innecesarias del repositorio.
4. Reutilizar código existente.
5. No duplicar helpers/modelos/componentes.
6. No cambiar stack.
7. No commit/push salvo pedido explícito.
8. No `prisma migrate reset`.
9. No borrar datos.
10. Migraciones incrementales y seguras.
11. Mantener aislamiento tenant + branch.
12. Validar server-side tenant, branch, permisos y licencias.
13. Mantener `localhost:3000` con `npm run dev`.
14. Docker no obligatorio para desarrollo.
15. Mantener compatibilidad de producción/multi-réplica.
16. JSDoc `@summary` EN ESPAÑOL en lógica nueva/importante.
17. UI responsive y consistente.
18. Mega menú únicamente por CLICK.
19. Compilar correctamente NO significa automáticamente que una funcionalidad esté terminada.
20. Probar los flujos/rutas afectados cuando sea posible.

## Actualizar SSOT

Al finalizar una tarea que cambie de manera permanente:

- arquitectura;
- modelos Prisma;
- migraciones;
- rutas;
- módulos;
- permisos;
- licencias;
- infraestructura;
- decisiones arquitectónicas;
- pendientes importantes;

el agente DEBE actualizar `PROJECT_CONTEXT.md`.

NO actualizar `PROJECT_CONTEXT.md` por:

- fixes pequeños;
- cambios cosméticos;
- logs;
- resultados de tests;
- refactors internos;
- información temporal.

`PROJECT_CONTEXT.md` representa el ESTADO ACTUAL. NO es un changelog.
