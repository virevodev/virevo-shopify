/**
 * Stockage EN MÉMOIRE (squelette). ⚠️ À remplacer par une base en production :
 *  - `tokens`   : access token offline par boutique (OAuth).
 *  - `sessions` : mapping reference Virevo ↔ session de paiement Shopify.
 */
const tokens = new Map(); // shop -> accessToken
const sessions = new Map(); // reference -> { shop, paymentSessionId }

export const store = {
  saveToken(shop, token) {
    tokens.set(shop, token);
  },
  getToken(shop) {
    return tokens.get(shop) ?? null;
  },
  linkSession(reference, shop, paymentSessionId) {
    sessions.set(reference, { shop, paymentSessionId });
  },
  getSession(reference) {
    return sessions.get(reference) ?? null;
  },
};
