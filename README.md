# 日本ブリーフィング — Nihon Briefing

Fiches de préparation au Japon : vocabulaire, plats, anecdotes, histoire, étiquette.
49 fiches, 19 catégories, recherche insensible aux accents, et un système de
tampons 済 pour marquer ce qui est acquis.

Application web installable, qui fonctionne **entièrement hors-ligne** — pensée
pour être consultée sur place sans forfait data.

## Installation sur téléphone

1. Ouvrir l'URL du site dans Safari (iOS) ou Chrome (Android), **une fois connecté**.
2. Menu de partage → « Sur l'écran d'accueil ».
3. L'app se lance ensuite en plein écran, mode avion compris.

Le premier chargement en ligne est nécessaire : c'est lui qui met en cache la page
et les polices.

## Structure

| Fichier | Rôle |
| --- | --- |
| `index.html` | Toute l'app — données, rendu, styles. Aucune dépendance. |
| `sw.js` | Service worker : cache de la coquille, capture des polices au vol. |
| `manifest.webmanifest` | Métadonnées d'installation (nom, icônes, plein écran). |
| `icons/` | Icônes 192/512, variante maskable, apple-touch-icon. |
| `worker/` | Proxy Cloudflare pour le bouton IA — la clé Anthropic vit là, jamais ici. |

## Modifier le contenu

Tout est dans `index.html` :

- **`CONFIG.showRomaji`** — affiche ou masque les transcriptions latines.
- **`DATA`** — les fiches. Le gabarit de carte est déduit des champs présents :
  - `jp` + `fr` → carte de vocabulaire (grande, centrée, bandeau de traduction) ;
  - `jp` seul → carte hybride (japonais + romaji + note) ;
  - ni l'un ni l'autre → carte simple (catégorie + titre + corps).
- **`CATS`** — les catégories, sous forme `[nom, kanji, couleur]`.

Un champ `day` optionnel sur une fiche la range sous un en-tête « JOUR n ».

## Développement

Le service worker exige HTTPS ou `localhost` : ouvrir le fichier en `file://`
fait tourner l'app normalement, mais sans hors-ligne ni installation.

```sh
npx http-server . -p 8777 -c-1
```

Après modification, penser à incrémenter `VERSION` dans `sw.js` pour que les
appareils déjà installés récupèrent la nouvelle version.

## Bouton IA (optionnel)

Chaque fiche peut afficher un bouton « IA » qui demande à Claude de développer
le sujet. L'app n'embarque **aucune clé API** (dépôt public) : elle appelle un
proxy Cloudflare Worker qui détient la clé en secret. Voir [worker/](worker/).

- Sans proxy configuré, les boutons n'apparaissent pas — l'app reste inchangée.
- Les réponses sont mises en cache local : une fiche déjà demandée ne coûte
  plus rien et reste lisible hors ligne.
- Hors ligne, seuls les boutons des fiches déjà en cache restent visibles.

Déploiement du proxy : voir `worker/README.md`.

## Note sur la progression

Les tampons sont stockés en `localStorage`, donc **propres à chaque appareil**.
Chacun avance à son rythme ; il n'y a pas de synchronisation entre utilisateurs.
