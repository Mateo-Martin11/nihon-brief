# Proxy IA — Cloudflare Worker

Détient la clé API Anthropic **en secret côté serveur** et répond aux fiches
de l'app. Le dépôt étant public, la clé ne doit jamais apparaître ici — elle
est stockée via `wrangler secret`, chiffrée chez Cloudflare.

## Garde-fous intégrés

- **Origine verrouillée** : seul `mateo-martin11.github.io` (et localhost en dev)
  peut appeler le worker — vérifié côté serveur, pas seulement par CORS.
- **Prompt système fixe** : le worker ne transmet que des champs de fiche
  tronqués à 400 caractères. Impossible de le détourner en API Claude générique.
- **Sortie plafonnée** : `max_tokens` fixé à 700, modèle fixé (`claude-haiku-4-5`).
- **Erreurs opaques** : les détails de l'API amont ne sont jamais renvoyés.

## Déploiement (une fois, ~3 minutes)

Il faut un compte Cloudflare gratuit ([dash.cloudflare.com](https://dash.cloudflare.com)).

```sh
cd worker
npx wrangler login                          # ouvre le navigateur, connecte-toi
npx wrangler deploy                         # publie → note l'URL *.workers.dev
npx wrangler secret put ANTHROPIC_API_KEY   # colle ta clé sk-ant-... (invisible)
```

Puis donner l'URL du worker (ex. `https://nihon-ia.<compte>.workers.dev`)
pour qu'elle soit branchée dans `index.html`.

## Vérifier

```sh
curl -X POST https://nihon-ia.<compte>.workers.dev/ \
  -H "content-type: application/json" \
  -H "Origin: https://mateo-martin11.github.io" \
  -d '{"cat":"Plat","jp":"もつ鍋","romaji":"motsunabe","body":"Fondue d abats de boeuf."}'
```

Réponse attendue : `{"text":"..."}` en ~2 secondes.

## Changer de modèle

`MODEL` en tête de `worker.js` (`claude-haiku-4-5` actuellement). Après
modification : `npx wrangler deploy`.
