import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

// Le secret est lu par config.js à l'import → on le fixe AVANT d'importer.
process.env.VIREVO_WEBHOOK_SECRET = "whsec_test";
const { verifyVirevoWebhook } = await import("../src/virevo.js");

const NOW = 1_750_000_000;
const body = JSON.stringify({ event: "payment.succeeded" });
const sig = (secret) => createHmac("sha256", secret).update(`${NOW}.${body}`).digest("hex");

test("signature valide", () => {
  assert.equal(verifyVirevoWebhook(`t=${NOW},v1=${sig("whsec_test")}`, body, NOW), true);
});
test("rotation : deux v1, l'un correspond", () => {
  const header = `t=${NOW},v1=${sig("whsec_autre")},v1=${sig("whsec_test")}`;
  assert.equal(verifyVirevoWebhook(header, body, NOW), true);
});
test("mauvais secret → faux", () => {
  assert.equal(verifyVirevoWebhook(`t=${NOW},v1=${sig("whsec_autre")}`, body, NOW), false);
});
test("corps altéré → faux", () => {
  assert.equal(verifyVirevoWebhook(`t=${NOW},v1=${sig("whsec_test")}`, body + "x", NOW), false);
});
test("hors tolérance (rejeu) → faux", () => {
  assert.equal(verifyVirevoWebhook(`t=${NOW},v1=${sig("whsec_test")}`, body, NOW + 10_000), false);
});
test("en-tête absent/malformé → faux", () => {
  assert.equal(verifyVirevoWebhook(undefined, body, NOW), false);
  assert.equal(verifyVirevoWebhook("nimporte", body, NOW), false);
});
