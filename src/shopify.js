import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "./config.js";

/** Version supportée de l'API Admin (NE PAS utiliser `unstable` en prod). */
const API_VERSION = "2025-01";

/** URL d'autorisation OAuth (installation de l'app sur une boutique). */
export function buildAuthUrl(shop, state) {
  const params = new URLSearchParams({
    client_id: config.shopify.apiKey,
    scope: config.shopify.scopes,
    redirect_uri: `${config.appUrl}/auth/callback`,
    state,
  });
  return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
}

/** Vérifie le HMAC d'une requête OAuth (querystring signée par Shopify). */
export function verifyOauthHmac(query) {
  const { hmac, ...rest } = query;
  if (!hmac) return false;
  const message = Object.keys(rest)
    .sort()
    .map((k) => `${k}=${rest[k]}`)
    .join("&");
  const digest = createHmac("sha256", config.shopify.apiSecret).update(message).digest("hex");
  return safeEqualHex(digest, hmac);
}

/** Vérifie le HMAC d'un corps brut signé par Shopify (en-tête X-Shopify-Hmac-Sha256, base64). */
export function verifyWebhookHmac(rawBody, headerB64) {
  if (!headerB64) return false;
  const digest = createHmac("sha256", config.shopify.apiSecret).update(rawBody, "utf8").digest("base64");
  const a = Buffer.from(digest);
  const b = Buffer.from(headerB64);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Échange le code OAuth contre un access token (offline). */
export async function exchangeToken(shop, code) {
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: config.shopify.apiKey,
      client_secret: config.shopify.apiSecret,
      code,
    }),
  });
  if (!res.ok) throw new Error(`OAuth token exchange: ${res.status}`);
  return res.json(); // { access_token, scope }
}

/** Appel GraphQL Admin authentifié. */
async function adminGraphql(shop, token, query, variables) {
  const res = await fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Admin GraphQL: ${res.status}`);
  return res.json();
}

/**
 * Résout une session de paiement (paiement réussi) → Shopify finalise la commande.
 * TODO: confirmer la mutation/les champs exacts contre la version supportée de la
 * Payments Apps API au moment de l'intégration.
 */
export function paymentSessionResolve(shop, token, paymentSessionId) {
  const mutation = `
    mutation PaymentSessionResolve($id: ID!) {
      paymentSessionResolve(id: $id) {
        paymentSession { id status { code } }
        userErrors { field message }
      }
    }`;
  return adminGraphql(shop, token, mutation, { id: paymentSessionId });
}

/** Rejette une session de paiement (échec/annulation). */
export function paymentSessionReject(shop, token, paymentSessionId, reasonCode = "PROCESSING_ERROR") {
  const mutation = `
    mutation PaymentSessionReject($id: ID!, $reason: PaymentSessionRejectionReasonInput!) {
      paymentSessionReject(id: $id, reason: $reason) {
        paymentSession { id status { code } }
        userErrors { field message }
      }
    }`;
  return adminGraphql(shop, token, mutation, { id: paymentSessionId, reason: { code: reasonCode } });
}

function safeEqualHex(a, b) {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
