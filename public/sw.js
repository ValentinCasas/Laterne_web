const CACHE_VERSION = "menuclick-routing-v4";
const OFFLINE_URL = "/sin-conexion";
const STATIC_URLS = [
  OFFLINE_URL,
  "/images/banners/brand.png",
  "/images/image_defect/product_default.png",
];

/** @summary Indica si una navegación pertenece a una superficie privada que nunca debe cachearse. */
function isPrivatePath(pathname) {
  return (
    pathname === "/platform" ||
    pathname.startsWith("/platform/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/superadmin" ||
    pathname.startsWith("/superadmin/") ||
    /^\/t\/[^/]+\/admin(?:\/|$)/.test(pathname)
  );
}

/** @summary Guarda únicamente recursos públicos genéricos; tenant y branch permanecen en la URL del request. */
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll(STATIC_URLS)));
  self.skipWaiting();
});

/** @summary Elimina versiones antiguas del caché al activar una actualización de routing. */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))),
      ),
  );
  self.clients.claim();
});

/** @summary Usa la URL canónica completa como clave y nunca intercepta admin ni APIs sensibles. */
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    isPrivatePath(url.pathname)
  )
    return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match(OFFLINE_URL))),
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/images/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
});
