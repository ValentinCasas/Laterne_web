import { existsSync } from "node:fs";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { getConfig } from "@/lib/config";

/**
 * Proveedor de almacenamiento para uploads generados en runtime.
 *
 * - `local`: escribe dentro de `public/` (comportamiento histórico). Ideal para
 *   desarrollo y despliegues de una sola instancia con disco persistente.
 * - `s3`: escribe en un bucket S3-compatible (AWS S3, Cloudflare R2, DigitalOcean
 *   Spaces, MinIO, etc.). Necesario para correr varias réplicas detrás de un
 *   load balancer sin depender del disco local del contenedor.
 *
 * Las claves son siempre rutas relativas públicas (ej. `images/images_product/x.webp`).
 * El driver S3 se importa de forma diferida para no inflar las imágenes `local`.
 */

export interface StorageProvider {
  readonly kind: "local" | "s3";
  write(key: string, data: Uint8Array, contentType: string): Promise<void>;
  read(key: string): Promise<Uint8Array | null>;
  remove(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

/** @summary Rechaza claves con segmentos inseguros para evitar path traversal. */
export function sanitizeStorageKey(key: string) {
  const normalized = key.replace(/^\/+/, "").replace(/\\/g, "/");
  if (!normalized || normalized.includes("..") || normalized.includes("\0")) {
    throw new Error("Clave de almacenamiento inválida");
  }
  return normalized;
}

/** @summary Resuelve el Content-Type a partir de la extensión de la clave. */
export function storageContentType(key: string) {
  const extension = path.extname(key).toLocaleLowerCase("en");
  const types: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".avif": "image/avif",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".glb": "model/gltf-binary",
    ".gltf": "model/gltf+json",
    ".usdz": "model/vnd.usdz+zip",
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".json": "application/json",
  };
  return types[extension] ?? "application/octet-stream";
}

/** @summary Ruta absoluta en disco para una clave del modo local. */
export function localStoragePath(key: string) {
  return path.join(process.cwd(), "public", sanitizeStorageKey(key));
}

class LocalStorageProvider implements StorageProvider {
  readonly kind = "local" as const;

  async write(key: string, data: Uint8Array) {
    const destination = localStoragePath(key);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, data);
  }

  async read(key: string) {
    const file = localStoragePath(key);
    if (!existsSync(file)) return null;
    return new Uint8Array(await readFile(file));
  }

  async remove(key: string) {
    await unlink(localStoragePath(key)).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }

  async exists(key: string) {
    return existsSync(localStoragePath(key));
  }
}

type S3RuntimeConfig = {
  bucket: string;
  region: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
};

type S3Module = typeof import("@aws-sdk/client-s3");

class S3StorageProvider implements StorageProvider {
  readonly kind = "s3" as const;
  private readonly runtime: S3RuntimeConfig;
  private readonly modulePromise: Promise<S3Module>;

  constructor(runtime: S3RuntimeConfig) {
    this.runtime = runtime;
    this.modulePromise = import("@aws-sdk/client-s3");
  }

  private async client(): Promise<InstanceType<S3Module["S3Client"]>> {
    const { S3Client } = await this.modulePromise;
    const { region, endpoint, accessKeyId, secretAccessKey, forcePathStyle } = this.runtime;
    return new S3Client({
      region,
      ...(endpoint ? { endpoint } : {}),
      ...(accessKeyId && secretAccessKey ? { credentials: { accessKeyId, secretAccessKey } } : {}),
      forcePathStyle,
    });
  }

  async write(key: string, data: Uint8Array, contentType: string) {
    const { PutObjectCommand } = await this.modulePromise;
    const client = await this.client();
    await client.send(
      new PutObjectCommand({
        Bucket: this.runtime.bucket,
        Key: sanitizeStorageKey(key),
        Body: data,
        ContentType: contentType || storageContentType(key),
      }),
    );
  }

  async read(key: string) {
    const { GetObjectCommand } = await this.modulePromise;
    const client = await this.client();
    try {
      const result = await client.send(
        new GetObjectCommand({ Bucket: this.runtime.bucket, Key: sanitizeStorageKey(key) }),
      );
      const body = result.Body;
      if (!body) return null;
      if (typeof body.transformToByteArray === "function") {
        return await body.transformToByteArray();
      }
      const reader = (body as ReadableStream<Uint8Array>).getReader();
      const chunks: Uint8Array[] = [];
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
      const merged = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.byteLength;
      }
      return merged;
    } catch (error) {
      if ((error as { name?: string }).name === "NoSuchKey") return null;
      if ((error as { name?: string }).name === "NotFound") return null;
      throw error;
    }
  }

  async remove(key: string) {
    const { DeleteObjectCommand } = await this.modulePromise;
    const client = await this.client();
    await client.send(
      new DeleteObjectCommand({ Bucket: this.runtime.bucket, Key: sanitizeStorageKey(key) }),
    );
  }

  async exists(key: string) {
    const { HeadObjectCommand } = await this.modulePromise;
    const client = await this.client();
    try {
      await client.send(
        new HeadObjectCommand({ Bucket: this.runtime.bucket, Key: sanitizeStorageKey(key) }),
      );
      return true;
    } catch (error) {
      if ((error as { name?: string }).name === "NotFound") return false;
      throw error;
    }
  }
}

let storageSingleton: StorageProvider | null = null;

/** @summary Devuelve el proveedor de almacenamiento activo (una única instancia por proceso). */
export function getStorage(): StorageProvider {
  if (storageSingleton) return storageSingleton;
  const { storage } = getConfig();
  if (storage.driver === "s3") {
    storageSingleton = new S3StorageProvider({
      bucket: storage.bucket,
      region: storage.region,
      endpoint: storage.endpoint,
      accessKeyId: storage.accessKeyId,
      secretAccessKey: storage.secretAccessKey,
      forcePathStyle: storage.forcePathStyle,
    });
  } else {
    storageSingleton = new LocalStorageProvider();
  }
  return storageSingleton;
}

/** @summary Indica si el almacenamiento activo usa un bucket remoto. */
export function isRemoteStorage() {
  return getStorage().kind === "s3";
}