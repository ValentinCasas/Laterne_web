import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { getStorage, localStoragePath, sanitizeStorageKey, storageContentType } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sirve assets de uploads cuando el almacenamiento es remoto.
 *
 * El contenedor no depende del disco local para la información persistente:
 * en modo `s3` las URLs públicas `/images/...` y `/models/...` se reescriben
 * hacia esta ruta, que primero intenta con el archivo empaquetado en `public/`
 * (assets de la aplicación) y luego lee el objeto del bucket.
 *
 * En modo `local` no hay rewrite: los archivos se sirven estáticamente como
 * siempre y esta ruta queda inactiva.
 */
async function serve(request: Request) {
  const segments = new URL(request.url).pathname.split("/").filter(Boolean);
  const rawKey = segments.slice(1).join("/");
  if (!rawKey) return new NextResponse("Not Found", { status: 404 });

  let key: string;
  try {
    key = sanitizeStorageKey(rawKey);
  } catch {
    return new NextResponse("Not Found", { status: 404 });
  }

  const localPath = localStoragePath(key);
  if (existsSync(localPath)) {
    const bytes = new Uint8Array(await readFile(localPath));
    return new Response(bytes, {
      headers: {
        "content-type": storageContentType(key),
        "cache-control": "public, max-age=86400, stale-while-revalidate=86400",
      },
    });
  }

  const remote = await getStorage().read(key);
  if (!remote) return new NextResponse("Not Found", { status: 404 });
  return new Response(remote as BodyInit, {
    headers: {
      "content-type": storageContentType(key),
      "cache-control": "public, max-age=86400, stale-while-revalidate=86400",
    },
  });
}

export async function GET(request: Request) {
  return serve(request);
}

export async function HEAD(request: Request) {
  const response = await serve(request);
  return new Response(null, {
    status: response.status,
    headers: response.headers,
  });
}