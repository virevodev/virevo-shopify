import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "./config.js";

/**
 * Crée un paiement via l'API publique Virevo /v1. Renvoie l'objet paiement
 * (avec `payment_url`) ou lève une erreur.
 */
export async function createVirevoPayment({ amountCents, currency, reference, returnUrl, cancelUrl }) {
  const res = await fetch(`${config.virevo.base}/v1/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.virevo.apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": reference,
    },
    body: JSON.stringify({
      amount_cents: amountCents,
      currency,
      reference,
      return_url: returnUrl,
      cancel_url: cancelUrl,
    }),
  });
  if (!res.ok) {
    throw new Error(`Virevo /v1/payments a renvoyé ${res.status}`);
  }
  return res.json();
}

/**
 * Vérifie la signature d'un webhook Virevo : en-tête `Virevo-Signature`
 * « t=<unix>,v1=<hmac> », HMAC-SHA256 de "<t>.<corps_brut>", tolérance 5 min.
 */
export function verifyVirevoWebhook(header, rawBody, nowSec = Math.floor(Date.now() / 1000)) {
  const secret = config.virevo.webhookSecret;
  if (!secret || !header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((kv) => kv.split("=").map((s) => s.trim())),
  );
  const t = Number(parts.t);
  if (!Number.isFinite(t) || !parts.v1) return false;
  if (Math.abs(nowSec - t) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(parts.v1);
  return a.length === b.length && timingSafeEqual(a, b);
}
