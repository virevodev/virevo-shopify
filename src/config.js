// Configuration depuis l'environnement (cf. .env.example).
export const config = {
  port: Number(process.env.PORT || 3000),
  appUrl: process.env.APP_URL || "",
  shopify: {
    apiKey: process.env.SHOPIFY_API_KEY || "",
    apiSecret: process.env.SHOPIFY_API_SECRET || "",
    scopes: process.env.SHOPIFY_SCOPES || "",
  },
  virevo: {
    base: process.env.VIREVO_API_BASE || "https://app.virevo.fr",
    apiKey: process.env.VIREVO_API_KEY || "",
    webhookSecret: process.env.VIREVO_WEBHOOK_SECRET || "",
  },
};
