/**
 * Regla de resaltado del sidebar de MenuClick Platform.
 *
 * Un enlace queda activo por coincidencia exacta o prefijo de segmento, salvo
 * que la ruta continúe con el segmento `nuevo` (formularios de alta), que se
 * excluye de la marca activa. Ejemplo: `/platform/clientes/{guid}/{slug}` deja
 * "Clientes" activo, pero `/platform/clientes/nuevo` no.
 */
export function isPlatformLinkActive(href: string, pathname: string): boolean {
  if (href === "/platform") return pathname === href;
  if (pathname === href || pathname.startsWith(`${href}/`)) {
    if (href === "/platform/clientes") {
      const nextSegment = pathname.slice(`${href}/`.length).split("/")[0];
      return nextSegment !== "nuevo";
    }
    return true;
  }
  return false;
}