import { randomBytes } from "node:crypto";
import express from "express";
import { config } from "./config.js";
import { store } from "./store.js";
import {
  buildAuthUrl,
  verifyOauthHmac,
  exchangeToken,
  paymentSessionResolve,
} from "./shopify.js";
import { createVirevoPayment, verifyVirevoWebhook } from "./virevo.js";

const app = express();

app.get("/health", (_req, res) => res.json({ ok: true }));

// --- OAuth : installation de l'app sur une boutique --------------------------

app.get("/auth", (req, res) => {
  const shop = String(req.query.shop || "");
  if (!/^[a-z0-9-]+\.myshopify\.com$/i.test(shop)) {
    return res.status(400).send("Paramètre shop invalide.");
  }
  // TODO: persister `state` (anti-CSRF) et le vérifier au callback.
  const state = randomBytes(16).toString("hex");
  return res.redirect(buildAuthUrl(shop, state));
});

app.get("/auth/callback", async (req, res) => {
  try {
    if (!verifyOauthHmac(req.query)) return res.status(401).send("HMAC invalide.");
    const shop = String(req.query.shop);
    const { access_token: token } = await exchangeToken(shop, String(req.query.code));
    store.saveToken(shop, token);
    // TODO: enregistrer/activer l'extension de paiement pour cette boutique.
    return res.send("Virevo installé. Vous pouvez fermer cette fenêtre.");
  } catch (err) {
    return res.status(500).send(`Échec de l'installation : ${err.message}`);
  }
});

// --- Session de paiement (Shopify → app) : flux OFFSITE -----------------------
// Corps brut requis pour vérifier le HMAC Shopify.
app.post("/payments/session", express.raw({ type: "*/*" }), async (req, res) => {
  const raw = req.body.toString("utf8");
  // TODO: vérifier le HMAC Shopify de la requête (verifyWebhookHmac) une fois le
  // format de signature de la Payments Apps API confirmé.
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return res.status(400).json({ error: "payload invalide" });
  }

  // TODO: confirmer les noms de champs exacts contre la doc Payments Apps API.
  const shop = String(payload.shop || req.get("X-Shopify-Shop-Domain") || "");
  const paymentSessionId = String(payload.id || payload.gid || "");
  const amountCents = Math.round(parseFloat(payload.amount || "0") * 100);
  const currency = String(payload.currency || "EUR");
  const returnUrl = String(payload.return_url || "");
  const cancelUrl = String(payload.cancel_url || returnUrl);

  if (!paymentSessionId || !amountCents) {
    return res.status(400).json({ error: "session de paiement incomplète" });
  }

  try {
    const payment = await createVirevoPayment({
      amountCents,
      currency,
      reference: paymentSessionId, // mapping session Shopify ↔ paiement Virevo
      returnUrl,
      cancelUrl,
    });
    store.linkSession(paymentSessionId, shop, paymentSessionId);
    // Offsite : on indique à Shopify où rediriger l'acheteur (page Virevo).
    return res.status(201).json({ redirect_url: payment.payment_url });
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
});

// --- Webhook Virevo (paiement réglé) → résout la session Shopify -------------
app.post("/webhooks/virevo", express.raw({ type: "*/*" }), async (req, res) => {
  const raw = req.body.toString("utf8");
  if (!verifyVirevoWebhook(req.get("Virevo-Signature"), raw)) {
    return res.status(400).json({ error: "signature invalide" });
  }
  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return res.status(400).json({ error: "payload invalide" });
  }

  if (event.type === "payment.succeeded") {
    const reference = event?.data?.payment?.reference;
    const link = reference ? store.getSession(reference) : null;
    const token = link ? store.getToken(link.shop) : null;
    if (link && token) {
      try {
        await paymentSessionResolve(link.shop, token, link.paymentSessionId);
      } catch (err) {
        // On répond quand même 200 (Virevo réessaie si on échoue) : on logge.
        console.error("paymentSessionResolve a échoué :", err.message);
      }
    }
  }
  return res.status(200).json({ received: true });
});

app.listen(config.port, () => {
  console.log(`virevo-shopify à l'écoute sur :${config.port}`);
});
