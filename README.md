# Virevo for Shopify — app de paiement *offsite* (squelette)

> ⚠️ **Lire d'abord.** Sur Shopify, un moyen de paiement tiers **n'est pas un
> plugin** : c'est une **app de paiement hébergée** via la **Payments Apps API**,
> et c'est **gated par Shopify**. On ne peut pas la distribuer librement comme
> les modules WooCommerce / PrestaShop.

## Prérequis (hors code, bloquants)
1. **Société + service Virevo live** (Linxo en prod) — Shopify ne valide pas une
   gateway sans entité légale et service fonctionnel.
2. **Statut « Partenaire Paiements » approuvé par Shopify** : sur **invitation**,
   dossier à soumettre, puis **accord de partage de revenu signé** (Shopify
   prélève une part du GMV traité).
3. **SLA** : disponibilité 99,95 %, réponse incident < 2 h, conformité PCI/légale.
4. Revue de l'app par Shopify avant de traiter des paiements réels.

Tant que 1–2 ne sont pas obtenus, **ce squelette ne peut pas être testé** sur une
vraie boutique (il faut des identifiants Partenaire Paiements). Il fixe
l'architecture pour être prêt le jour J.

## Modèle : *Offsite payment extension*
Shopify redirige l'acheteur vers une page hébergée par nous (= la page de
paiement Virevo). Flux :

```
Checkout Shopify
  │  (1) POST « payment session »  →  notre app  (HMAC Shopify vérifié)
  │  (2) on crée un paiement Virevo (POST /v1/payments, reference = session id)
  │  (3) réponse { redirect_url } = payment_url Virevo
  ▼
Acheteur paie sur la page Virevo
  │  (4) webhook Virevo payment.succeeded  →  notre app  (signature vérifiée)
  │  (5) paymentSessionResolve(session_id)  (GraphQL Payments Apps API)
  ▼
Shopify finalise la commande + renvoie l'acheteur au checkout
```

Mapping clé : `paymentSession.id` (Shopify) ↔ `reference`/paiement Virevo.

## Structure du squelette
- `src/server.js` — app Express : OAuth, session de paiement, webhook, health.
- `src/shopify.js` — OAuth (HMAC, échange de token), `paymentSessionResolve` /
  `paymentSessionReject` (Admin GraphQL).
- `src/virevo.js` — client API publique Virevo `/v1` + vérif de signature webhook.
- `src/store.js` — mapping session↔paiement **en mémoire** (⚠️ remplacer par une
  base en production).

## TODO avant production (marqués `TODO:` dans le code)
- Persistance (tokens par boutique, mapping session↔paiement) en base.
- Confirmer les **noms de champs exacts** du payload « payment session » et les
  mutations contre la doc Payments Apps API (version supportée, pas `unstable`).
- Clé d'API Virevo **par marchand** (multi-boutique) au lieu d'une variable d'env.
- Déploiement conforme au SLA Shopify.

## Démarrage (dev local, sans Shopify)
```bash
cp .env.example .env   # remplir les valeurs
npm install
npm run dev            # GET /health pour vérifier
```

## Références
- Shopify — Payments Apps API : https://shopify.dev/docs/apps/build/payments
- Exigences : https://shopify.dev/docs/apps/build/payments/requirements
- Guide développeur Virevo : https://virevo.fr/developpeurs.html

## Licence
GPLv2 or later.
