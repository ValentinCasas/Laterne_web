# Despliegue en producción · MenuClick

Guía para llevar MenuClick a producción sobre un VPS (Hostinger, DigitalOcean,
Hetzner, AWS, etc.) o un servicio gestionado. Es una guía portable: no depende
de ningún proveedor.

Los bloques críticos de MenuClick son tres y TODAS las réplicas deben compartir
la misma base de datos, el mismo storage y el mismo `AUTH_SECRET`:

1. **MySQL** — sesiones, tenants, datos de los negocios.
2. **Storage de uploads** — imágenes, modelos 3D, logos (ver [Storage](#storage)).
3. **Aplicación** — Node.js (Next.js standalone), una o más réplicas.

---

## 1. Desarrollo local (sin Docker)

El flujo de desarrollo no cambia y **no requiere Docker**:

```bash
npm install
npx prisma generate
npx prisma migrate dev        # primer uso: crea la BD y aplica migraciones
npm run dev                   # http://localhost:3000
```

- Los uploads se guardan en `public/` (modo `local`, el default). Nada cambia
  respecto del comportamiento anterior.
- El proxy de la app (`proxy.ts`) funciona con los hosts de desarrollo
  (`localhost`, `lvh.me`, `DEV_TENANT_SLUG`).
- `AUTH_SECRET` tiene un valor por defecto de desarrollo; en producción es
  obligatorio y la app **no arranca** sin él.

---

## 2. Variables de entorno

Ver `.env.example`. Obligatorias en producción:

| Variable | Para qué |
| --- | --- |
| `DATABASE_URL` | MySQL con credenciales. Ej.: `mysql://user:pass@host:3306/laterne` |
| `AUTH_SECRET` | Firma de sesiones. Generar con `openssl rand -base64 48` |
| `ROOT_DOMAIN` | Dominio raíz sin protocolo (`menu-click.app`) |
| `TRUST_PROXY` | `true` solo detrás de un proxy confiable (Nginx/Cloudflare/LB) |

Storage S3 (si `STORAGE_DRIVER=s3`): `S3_BUCKET`, `S3_ACCESS_KEY_ID`,
`S3_SECRET_ACCESS_KEY`, `S3_REGION` y, si no es AWS, `S3_ENDPOINT`.

Multi-instancia: `PRISMA_CONNECTION_LIMIT` (por defecto 10) y
`PRISMA_POOL_TIMEOUT` (10 s). Todas las réplicas deben compartir además
`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` (se fija en **build y runtime**).

### Pool de conexiones y MySQL

`max_connections` del servidor debe cubrir todas las réplicas:

```
réplicas × connection_limit ≤ max_connections
```

Con `PRISMA_CONNECTION_LIMIT=10` y `max_connections=150` caben hasta ~12 réplicas
sobre la misma BD. Si la BD es gestionada, ese límite lo fija el plan.

---

## 3. Storage (uploads de runtime)

| Modo | Cuándo | Comportamiento |
| --- | --- | --- |
| `local` (default) | 1 instancia con disco persistente | Escribe en `public/`; sirve `/images/*` y `/models/*` directo |
| `s3` | Multi-instancia o bucket gestionado | Escribe en el bucket; `/images/*` y `/models/*` se reescriben a `/storage/*` que lee del bucket |

Cualquier bucket S3-compatible sirve: AWS S3, Cloudflare R2, DigitalOcean
Spaces, MinIO.

**Requisito con modo `s3`:** el bucket debe tener la política de lectura pública
(o un CDN/cache frente a él) para que las imágenes se sirvan al navegador. La
app solo escribe/borra contra el bucket.

### Limitaciones conocidas en modo `s3` (no bloquean)

- **Facturación (`lib/documents`):** el módulo de DOCX→PDF lee el logo del
  negocio desde el disco. En modo `s3` la factura cae al monograma. No se
  modificó por estar fuera de alcance (módulo de comprobantes).
- **Landing:** las imágenes personalizadas de las cervezas se filtran por
  existencia en disco; en modo `s3` caen a los defaults empaquetados (los
  defaults sí se sirven). Se recomienda subirlas igual; se resuelve junto con
  el módulo de comprobantes.

---

## 4. Despliegue con Docker

### Requisitos

- Docker ≥ 24 y Compose v2 en el servidor.
- Un dominio apuntando al servidor (o un reverse proxy al puerto 3000).

### Paso a paso

```bash
# 1. Clonar el repo
git clone <repo> menuclick && cd menuclick

# 2. Variables de entorno
cp .env.example .env
# completar DATABASE_URL, AUTH_SECRET, ROOT_DOMAIN, TRUST_PROXY=true,
# STORAGE_DRIVER, credenciales S3, NEXT_SERVER_ACTIONS_ENCRYPTION_KEY.

# 3. Copiar el compose de ejemplo
cp docker-compose.production.example.yml docker-compose.production.yml

# 4. Build y arranque (corre migraciones automáticamente)
docker compose -f docker-compose.production.yml up -d --build

# 5. Verificación
docker compose -f docker-compose.production.yml ps
curl http://localhost:3000/api/health   # {"ok":true,...}
curl http://localhost:3000/api/ready    # {"ok":true,"status":"ready"} (toca la BD)
```

### Imagen directamente (sin Compose)

```bash
docker build -t menuclick:latest .
# migraciones una sola vez
docker build --target migrations \
  --build-arg DATABASE_URL="mysql://user:pass@host:3306/laterne" \
  -t menuclick:migrations .
docker run --rm menuclick:migrations

# ejecutar la app
docker run -d -p 3000:3000 \
  -e DATABASE_URL=... -e AUTH_SECRET=... -e ROOT_DOMAIN=... -e TRUST_PROXY=true \
  --restart unless-stopped menuclick:latest
```

### Múltiples réplicas

Con Compose:

```bash
docker compose -f docker-compose.production.yml up -d --scale web=3
```

Con orquestador (Docker Swarm, K8s, CapRover, Coolify): correr N instancias del
contenedor `web` detrás de un load balancer que use `/api/ready` para decidir
quiénes reciben tráfico y `/api/health` para reiniciar las colgadas.

Todo el estado es externo (MySQL + storage), por lo que las réplicas son
intercambiables. La única excepción es el modo `local` de storage, que requiere
un volumen compartido (NFS, EFS) — por eso para multi-instancia se recomienda
`STORAGE_DRIVER=s3`.

---

## 5. HTTPS y dominio

En el VPS conviene Nginx (o Traefik/Caddy) como reverse proxy:

```nginx
server {
    listen 80;
    server_name menu-click.app *.menu-click.app;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Con certificado de Let's Encrypt (`certbot --nginx -d menu-click.app -d '*.menu-click.app'`).

> **Importante:** con `TRUST_PROXY=true` la app confía en `X-Forwarded-*` para
> conocer el host real. Si ese proxy no existe, dejar `TRUST_PROXY` vacío: la
> app ignora los headers reenviados y usa `Host`, lo que evita host-header
> spoofing.

Los tenants de MenuClick usan subdominios del `ROOT_DOMAIN` (y dominios propios
del negocio) → el wildcard es necesario.

---

## 6. Actualización

```bash
git pull
docker compose -f docker-compose.production.yml build
docker compose -f docker-compose.production.yml up -d --no-deps web
```

Las migraciones las corre el servicio `migrations` (se ejecuta en cada `up`).
Para aplicar migraciones manualmente en un deploy (recomendado para `--scale`):

```bash
docker build --target migrations --build-arg DATABASE_URL="$DATABASE_URL" -t menuclick:migrations .
docker run --rm menuclick:migrations
# recién entonces subir las réplicas nuevas
```

### Rollback

La imagen anterior queda en el registro local de Docker:

```bash
docker compose -f docker-compose.production.yml up -d --no-deps --force-recreate web menuclick:ANTERIOR
```

Si la DB migró a un esquema nuevo, desplegar el código anterior puede requerir
la migración previa. No se borran tablas automáticamente; `prisma migrate
deploy` solo avanza hacia delante.

---

## 7. Backups

- **MySQL:** dump diario (`mysqldump`/`mariadb-dump`) a un storage distinto.
  Restaurar con `mysql < backup.sql`.
- **Storage:** si `s3`, réplicas del bucket (versionado o sync a otro bucket).
  Si `local`, el volumen en el que vive `public/`.
- **Secretos:** `AUTH_SECRET` y las credenciales S3/DB en un gestor de secretos;
  **no** en el repositorio.

---

## 8. Healthcheck / Readiness

| Endpoint | Toca BD | Uso |
| --- | --- | --- |
| `GET /api/health` | No | Proceso vivo; reiniciar container si falla |
| `GET /api/ready` | Sí (timeout 5 s) | Quitar réplica de rotación si devuelve 503 |

El Dockerfile ya incluye un HEALTHCHECK con `fetch` (no requiere curl). En modo
complejo, el orquestador debe usar `ready` para tráfico y `health` para liveness.

---

## 9. Preguntas frecuentes

**¿Puedo correr varias réplicas con la misma DB y mismo storage?**
Sí. Todo el estado es externo. Cada réplica abre `PRISMA_CONNECTION_LIMIT`
conexiones a MySQL y lee/escribe el mismo storage. Requisitos: `AUTH_SECRET`
compartido, `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` compartida, `STORAGE_DRIVER=s3`
(o volumen compartido).

**¿Qué pasa si una réplica muere?**
El orquestador la reinicia; las sesiones viven en MySQL y los uploads en el
storage, así que la réplica nueva es idéntica.

**¿Y si una réplica recibe una request con un tenant que no conoce?**
`resolveTenantByHost` consulta la DB (con caché corta por proceso); si el
dominio no existe, responde 404 del host.

**¿Los logs son centralizados?**
Los logs salen a stdout/stderr en JSON. Conectar un collector (Docker json-file,
Loki, CloudWatch, Papertrail) para reunirlos de todas las réplicas.

**¿Módulo de comprobantes DOCX→PDF?**
Quedó fuera de este trabajo (no se modificó). El conversor se configura con
`DOCUMENT_CONVERTER_URL`/`LIBREOFFICE_PATH` según `.env.example`.