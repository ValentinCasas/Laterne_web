# ─────────────────────────────────────────────────────────────────────────────
# MenuClick · imagen multi-stage (Next.js standalone)
#
# Build:
#   docker build -t menuclick:latest .
#
# Migraciones (una sola vez o antes de cada release):
#   docker build --target migrations --build-arg DATABASE_URL="mysql://..." -t menuclick:migrations .
#   docker run --rm menuclick:migrations npx prisma migrate deploy
#
# Requiere en runtime: DATABASE_URL, AUTH_SECRET, ROOT_DOMAIN
# y (si STORAGE_DRIVER=s3) las credenciales del bucket.
# ─────────────────────────────────────────────────────────────────────────────

# ── 1. Dependencias ──────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# ── 2. Build ─────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_SERVER_ACTIONS_ENCRYPTION_KEY se define en build para que las Server
# Actions multi-instancia compartan la misma clave de cifrado.
ARG NEXT_SERVER_ACTIONS_ENCRYPTION_KEY
ENV NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=${NEXT_SERVER_ACTIONS_ENCRYPTION_KEY:-}
RUN npx prisma generate
RUN npm run build

# ── 3. Migraciones (target auxiliar) ────────────────────────────────────────
FROM node:22-alpine AS migrations
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json* ./
ENTRYPOINT ["npx", "prisma", "migrate", "deploy"]

# ── 4. Runner (usuario no-root, Node como PID 1) ────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# En modo s3 los uploads viven en el bucket; en modo local se persisten vía
# volumen en /app/public. Asegura que el usuario no-root pueda escribir.
USER nextjs
EXPOSE 3000

# Healthcheck sin curl: Node 22 trae fetch. El endpoint /api/health no toca DB.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]