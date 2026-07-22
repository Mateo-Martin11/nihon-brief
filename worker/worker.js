/* Nihon Briefing — proxy IA (Cloudflare Worker)
   Role : garder la cle API Anthropic COTE SERVEUR. L'app publique appelle ce
   worker sans cle ; le worker appelle Claude avec la cle stockee en secret
   (wrangler secret put ANTHROPIC_API_KEY — jamais dans le code ni le depot).

   Garde-fous contre le detournement du proxy :
   - CORS + verification d'origine : seul le site de l'app peut appeler
   - prompt systeme fixe ici : impossible d'en faire une API Claude generique
   - entree tronquee et validee, sortie plafonnee (max_tokens)
*/

const ALLOWED_ORIGINS = [
  'https://mateo-martin11.github.io',
  'http://127.0.0.1:8777',   // dev local
  'http://localhost:8777',
];

const MODEL = 'claude-haiku-4-5';

const SYSTEM = `Tu es l'assistant culturel de « Nihon Briefing », une app de fiches de préparation à un voyage au Japon entre amis.
On te donne une fiche (catégorie, titre ou mot japonais, contenu). Développe le sujet en français : contexte culturel ou historique, anecdotes vérifiables, conseils pratiques de voyageur quand c'est pertinent.
Réponds en 150 à 250 mots, sans préambule et sans répéter la fiche. Si le sujet s'y prête, introduis 1 ou 2 mots japonais utiles (avec romaji et traduction). Mise en forme : uniquement du **gras** et des listes à puces avec « - ».`;

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json', ...cors },
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = ALLOWED_ORIGINS.includes(origin);
    const cors = {
      'Access-Control-Allow-Origin': allowed ? origin : ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'content-type',
    };

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST')    return json({ error: 'POST uniquement' }, 405, cors);
    if (!allowed)                     return json({ error: 'origine refusée' }, 403, cors);

    let card;
    try { card = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400, cors); }

    // seuls les champs d'une fiche passent, chacun tronque — pas de prompt libre
    const clean = {};
    for (const f of ['cat', 'title', 'jp', 'kana', 'romaji', 'fr', 'meta', 'body']) {
      if (typeof card[f] === 'string' && card[f].length) clean[f] = card[f].slice(0, 400);
    }
    if (!clean.cat || (!clean.title && !clean.jp)) return json({ error: 'fiche incomplète' }, 400, cors);

    const fiche = Object.entries(clean).map(([k, v]) => `${k} : ${v}`).join('\n');

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 700,
        system: SYSTEM,
        messages: [{ role: 'user', content: `Fiche :\n${fiche}\n\nDéveloppe ce sujet.` }],
      }),
    });

    if (!r.ok) {
      // on ne remonte jamais le detail amont (il peut contenir des infos de compte)
      const msg = r.status === 429 ? 'Beaucoup de demandes — réessaie dans une minute.' : 'Service indisponible.';
      return json({ error: msg }, 502, cors);
    }

    const data = await r.json();
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
    if (!text) return json({ error: 'Réponse vide.' }, 502, cors);
    return json({ text }, 200, cors);
  },
};
