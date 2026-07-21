/* Nihon Briefing — service worker
   Objectif : l'app doit se lancer a zero barre de reseau.

   Deux regimes de cache distincts :
   - la coquille de l'app (HTML, manifeste, icones) est pre-cachee a l'installation ;
   - les polices Google (CSS + woff2) sont capturees au vol au premier chargement
     en ligne, puis servies depuis le cache. Elles sont immuables et versionnees
     par URL, donc cache-first sans revalidation est sur.
*/

const VERSION    = 'v2';
const SHELL      = `nihon-shell-${VERSION}`;
const FONTS      = `nihon-fonts-${VERSION}`;
const SHELL_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

const isFont = url =>
  url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(SHELL)
      // addAll est tout-ou-rien : une icone manquante ferait echouer l'install
      // entiere et laisserait l'app sans cache. On tolere les echecs unitaires.
      .then(c => Promise.allSettled(SHELL_URLS.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k.startsWith('nihon-') && k !== SHELL && k !== FONTS)
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Polices : cache d'abord, reseau ensuite, et on garde ce qui revient.
  if (isFont(url)) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        // Les woff2 cross-origin reviennent en reponse opaque : illisibles par le
        // script mais parfaitement servables par le navigateur. On les garde.
        const copy = res.clone();
        caches.open(FONTS).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => hit))
    );
    return;
  }

  // Navigation : reseau d'abord pour attraper les mises a jour, repli sur le
  // cache des qu'on est hors-ligne. C'est ce qui fait tenir le mode avion.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(SHELL).then(c => c.put('./index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('./index.html').then(hit => hit || caches.match('./')))
    );
    return;
  }

  // Reste des ressources de meme origine : cache d'abord.
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(SHELL).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      }))
    );
  }
});
