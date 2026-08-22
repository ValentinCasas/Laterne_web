/**
 * Configuración centralizada de MenuClick.
 *
 * Toda variable de entorno crítica se lee y valida acá. En producción la
 * aplicación falla al iniciar (fail-fast) con un mensaje entendible si falta
 * algo esencial. En desarrollo se toleran valores por defecto para que
 * `npm run dev` siga funcionando sin configuración adicional.
 */

export type MenuClickNodeEnv = "development" | "test" | "production";

export const nodeEnv: MenuClickNodeEnv =
  process.env.NODE_ENV === "test"
    ? "test"
    : process.env.NODE_ENV === "production"
      ? "production"
      : "development";

export const isDevelopment = nodeEnv === "development";
export const isTest = nodeEnv === "test";
export const isProduction = nodeEnv === "production";

/** @summary Secreto no seguro utilizado exclusivamente fuera de producción. */
const DEV_ONLY_FALLBACK = "development-only-change-me";

function envString(name: string) {
  return (process.env[name] ?? "").trim();
}

function envPositiveInt(name: string, fallback: number) {
  const raw = envString(name).match(/^\d+$/)?.[0];
  if (!raw) return fallback;
  const value = Number(raw);
  return value > 0 ? value : fallback;
}

function envBoolean(name: string) {
  const raw = envString(name).toLocaleLowerCase("es");
  if (raw === "1" || raw === "true" || raw === "yes" || raw === "si") return true;
  return false;
}

/** @summary Decide si se confía en los headers `X-Forwarded-*` del proxy. */
export function trustProxy() {
  return envBoolean("TRUST_PROXY");
}

export type StorageConfig = {
  driver: "local" | "s3";
  bucket: string;
  region: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
};

export type MenuClickConfig = {
  nodeEnv: MenuClickNodeEnv;
  isProduction: boolean;
  databaseUrl: string;
  authSecret: string;
  siteUrl: string;
  rootDomain: string;
  appSubdomain: string;
  platformSubdomain: string;
  trustProxy: boolean;
  storage: StorageConfig;
  prismaConnectionLimit: number;
  prismaPoolTimeoutSeconds: number;
  emailWebhookUrl: string;
  emailApiKey: string;
  sessionCookieSecure: boolean;
  deploymentVersion: string;
  deliveryGeocoding: {
    provider: "disabled" | "nominatim";
    endpoint: string;
    userAgent: string;
  };
};

let cachedConfig: MenuClickConfig | null = null;

/** @summary Devuelve la configuración resuelta una única vez por proceso. */
export function getConfig(): MenuClickConfig {
  if (cachedConfig) return cachedConfig;

  const storageDriver = envString("STORAGE_DRIVER").toLocaleLowerCase("es") === "s3" ? "s3" : "local";

  cachedConfig = {
    nodeEnv,
    isProduction,
    databaseUrl: envString("DATABASE_URL"),
    authSecret: envString("AUTH_SECRET") || (isProduction ? "" : DEV_ONLY_FALLBACK),
    siteUrl: envString("NEXT_PUBLIC_SITE_URL"),
    rootDomain: envString("ROOT_DOMAIN"),
    appSubdomain: envString("APP_SUBDOMAIN") || "app",
    platformSubdomain: envString("PLATFORM_SUBDOMAIN") || "platform",
    trustProxy: trustProxy(),
    storage: {
      driver: storageDriver,
      bucket: envString("S3_BUCKET"),
      region: envString("S3_REGION") || "us-east-1",
      endpoint: envString("S3_ENDPOINT"),
      accessKeyId: envString("S3_ACCESS_KEY_ID"),
      secretAccessKey: envString("S3_SECRET_ACCESS_KEY"),
      forcePathStyle: !envBoolean("S3_PATH_STYLE_DISABLED"),
    },
    prismaConnectionLimit: envPositiveInt("PRISMA_CONNECTION_LIMIT", 10),
    prismaPoolTimeoutSeconds: envPositiveInt("PRISMA_POOL_TIMEOUT", 10),
    emailWebhookUrl: envString("EMAIL_WEBHOOK_URL"),
    emailApiKey: envString("EMAIL_API_KEY"),
    sessionCookieSecure: isProduction,
    deploymentVersion: envString("DEPLOYMENT_VERSION"),
    deliveryGeocoding: {
      provider: envString("DELIVERY_GEOCODING_PROVIDER").toLocaleLowerCase("es") === "nominatim" ? "nominatim" : "disabled",
      endpoint: envString("DELIVERY_GEOCODING_ENDPOINT"),
      userAgent: envString("DELIVERY_GEOCODING_USER_AGENT"),
    },
  };

  return cachedConfig;
}

/** @summary Lista las variables críticas ausentes para un entorno dado. */
export function missingCriticalVariables(config: MenuClickConfig) {
  const missing: string[] = [];
  if (!config.databaseUrl) missing.push("DATABASE_URL");
  if (config.isProduction && !config.authSecret) missing.push("AUTH_SECRET");
  if (config.isProduction && !config.rootDomain) missing.push("ROOT_DOMAIN");
  if (config.storage.driver === "s3") {
    if (!config.storage.bucket) missing.push("S3_BUCKET");
    if (!config.storage.accessKeyId) missing.push("S3_ACCESS_KEY_ID");
    if (!config.storage.secretAccessKey) missing.push("S3_SECRET_ACCESS_KEY");
  }
  return missing;
}

/**
 * @summary Valida la configuración al iniciar. En producción lanza un error
 * claro si falta una variable crítica (fail-fast antes de recibir tráfico).
 * En desarrollo solo advierte para no romper `npm run dev`.
 */
export function assertStartupConfig() {
  const config = getConfig();
  const missing = missingCriticalVariables(config);
  if (missing.length === 0) return config;
  const message = `Faltan variables de entorno críticas: ${missing.join(", ")}. Revisá el archivo .env o la documentación en docs/DEPLOYMENT.md.`;
  if (config.isProduction) throw new Error(message);
  console.warn(`[config] ${message}`);
  return config;
}
