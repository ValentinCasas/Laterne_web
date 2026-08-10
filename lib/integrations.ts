export const integrationProviders = ["mercado_pago", "email", "whatsapp", "web_push", "storage"] as const;
export type IntegrationProvider = (typeof integrationProviders)[number];

/** @summary Informa si el servidor dispone de la credencial privada exigida por un proveedor externo. */
export function integrationSecretConfigured(provider: IntegrationProvider) {
  const environmentKeys: Record<IntegrationProvider, string | undefined> = {
    mercado_pago: process.env.MERCADOPAGO_ACCESS_TOKEN,
    email: process.env.EMAIL_API_KEY,
    whatsapp: process.env.WHATSAPP_ACCESS_TOKEN,
    web_push: process.env.VAPID_PRIVATE_KEY,
    storage: process.env.STORAGE_SECRET_KEY,
  };
  return Boolean(environmentKeys[provider]);
}
