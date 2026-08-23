# Fase 1 — Hydration Error Mobile/Carta

## 1. Reproducción y causa raíz

El hydration error reportado en `components/menu/menu-client.tsx` se manifiesta como:

> A tree hydrated but some attributes of the server rendered HTML didn't match the client properties.

El diff del navegador muestra atributos inyectados en `<html>`, `<input>` y `<select>`:

- `__gcrremoteframetoken="6f1bc1238db04d86a5b34715e4ce1bcd"`
- `__gcruniqueid="1"`, `__gcruniqueid="2"`, etc.

## 2. Determinación de origen

Se realizó una búsqueda exhaustiva en el código fuente de MenuClick:

- No existen referencias a `__gcrremoteframetoken` ni `__gcruniqueid` en ningún componente, página, utilidad o layout.
- No hay scripts, MutationObserver, efectos o librerías que inyecten dichos atributos.
- No hay `suppressHydrationWarning` previo en el componente afectado antes de esta investigación.

Conclusión: **estos atributos NO son generados por MenuClick**. Son inyectados por una extensión del navegador (muy probablemente Google Translate o similar) que modifica el DOM entre el HTML inicial del servidor y la hidratación de React.

## 3. Auditoría de MenuClient (sin extensión)

Se auditó `components/menu/menu-client.tsx` para descartar errores internos de SSR/CSR:

- **Estado inicial determinista**: `query = ""`, `diet = "all"`, `maximumPrice = ""`, `sort = "recommended"`. Igual en servidor y cliente.
- **Sin relojes ni random en render**: no hay `Date.now()`, `Math.random()`, `crypto.randomUUID()` ni `new Date()` en el render inicial.
- **Sin lecturas de storage durante render**: `localStorage`/`sessionStorage` se acceden solo dentro de `useEffect`, después de hidratar.
- **Sin `navigator`/`window` en render**: solo se usa en `product-actions.tsx` (cliente, no SSR).
- **Locale explícito**: `toLocaleLowerCase("es")` e `Intl.NumberFormat(locale, ...)` usan valores explícitos, no dependen del locale del navegador en el primer render.
- **IDs estables**: los IDs de secciones son `category-${category.id}` basados en props; no se generan IDs aleatorios en render.
- **HTML válido**: no hay anidamiento incorrecto de tags interactivos.

## 4. Decisión

No se aplicó ningún parche de ocultamiento (`suppressHydrationWarning`, scripts de limpieza, MutationObserver) porque:

1. La causa es externa a MenuClick.
2. El usuario prohibió expresamente usar parches para ocultar el error.
3. Forzar `suppressHydrationWarning` no soluciona la causa raíz y puede enmascarar futuros errores reales.

## 5. Reproducción limpia

Para confirmar que el error desaparece sin la extensión:

1. Abrir Chrome en modo incógnito (sin extensiones).
2. Navegar a la carta pública.
3. Verificar que no aparezca el hydration error en consola.
4. Repetir en mobile viewport (375, 430, 768).

Si el error reaparece solo con la extensión activa, queda confirmado como issue del navegador del usuario, no de MenuClick.

## 6. Estado

- **Causa**: extensión del navegador (no MenuClick).
- **Corrección interna necesaria**: ninguna.
- **Acción recomendada al usuario**: desactivar la extensión en el dominio de MenuClick o usar navegación sin extensiones para producción.
