/* Maison Ronron hors ligne. VERSION change à chaque mise en ligne (écrit par stamp.py) : les téléphones
   voient alors un nouveau fichier, vident l'ancien cache et reprennent les fichiers à jour. */
const VERSION = "24701337e9";
const CORE = ["./", "app.js", "assets/c/acc.webp", "assets/c/accm.webp", "assets/c/bengal.webp", "assets/c/bengalneige.webp", "assets/c/birman.webp", "assets/c/blanc.webp", "assets/c/chartreux.webp", "assets/c/chocolat.webp", "assets/c/creme.webp", "assets/c/lavande.webp", "assets/c/mainecoon.webp", "assets/c/menthe.webp", "assets/c/noir.webp", "assets/c/nuage.webp", "assets/c/or.webp", "assets/c/persan.webp", "assets/c/rose.webp", "assets/c/roux.webp", "assets/c/scottish.webp", "assets/c/siamois.webp", "assets/c/smoking.webp", "assets/c/sphynx.webp", "assets/c/tigre.webp", "assets/c/tricolore.webp", "assets/cards.js", "assets/cats.js", "assets/haies.js", "assets/lo.js", "assets/monde.webp", "assets/nav.js", "assets/p/lo-0.webp", "assets/p/lo-1.webp", "assets/p/lo-2.webp", "assets/p/lo-3.webp", "assets/p/lo-4.webp", "assets/p/lo-5.webp", "assets/patches.js", "assets/pieces.js", "assets/s/aile-0.webp", "assets/s/allee-0.webp", "assets/s/cour-0.webp", "assets/s/etang-0.webp", "assets/s/gardien-0.webp", "assets/s/grille-0.webp", "assets/s/laby-0.webp", "assets/s/manoir-0.webp", "assets/s/perron-0.webp", "assets/s/serre-0.webp", "assets/walls.js", "gen.js", "icons/apple-touch-icon.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "index.html", "jeux.js", "manifest.webmanifest", "style.css"];
const REST = ["assets/a/musique-1.mp3", "assets/a/musique-2.mp3", "assets/a/musique-3.mp3", "assets/k/aile.webp", "assets/k/allee.webp", "assets/k/cour.webp", "assets/k/est.webp", "assets/k/etang.webp", "assets/k/gardien.webp", "assets/k/grille.webp", "assets/k/hiver.webp", "assets/k/laby.webp", "assets/k/manoir.webp", "assets/k/perron.webp", "assets/k/serre.webp", "assets/k/uniques.webp", "assets/q/61-0.webp", "assets/q/61-1.webp", "assets/q/61-2.webp", "assets/q/61-3.webp", "assets/q/61-4.webp", "assets/q/61-5.webp", "assets/q/61-6.webp", "assets/q/61-7.webp", "assets/q/t1-5.webp", "assets/q/49-0.webp", "assets/q/49-1.webp", "assets/q/49-2.webp", "assets/q/49-3.webp", "assets/q/60-0.webp", "assets/q/60-1.webp", "assets/q/60-2.webp", "assets/q/60-3.webp", "assets/q/60-4.webp", "assets/q/62-0.webp", "assets/q/62-1.webp", "assets/q/62-2.webp", "assets/q/62-3.webp", "assets/q/73-0.webp", "assets/q/t0-5.webp", "assets/q/t1-4.webp", "assets/q/t1-6.webp", "assets/q/t2-5.webp", "assets/q/37-0.webp", "assets/q/37-1.webp", "assets/q/37-2.webp", "assets/q/37-3.webp", "assets/q/37-4.webp", "assets/q/48-0.webp", "assets/q/48-1.webp", "assets/q/48-2.webp", "assets/q/48-3.webp", "assets/q/50-0.webp", "assets/q/50-1.webp", "assets/q/50-2.webp", "assets/q/50-3.webp", "assets/q/63-0.webp", "assets/q/63-1.webp", "assets/q/63-2.webp", "assets/q/63-3.webp", "assets/q/63-4.webp", "assets/q/63-5.webp", "assets/q/72-0.webp", "assets/q/72-1.webp", "assets/q/74-0.webp", "assets/q/t0-4.webp", "assets/q/t0-6.webp", "assets/q/t1-3.webp", "assets/q/t2-4.webp", "assets/q/t2-6.webp", "assets/q/t3-5.webp", "assets/q/25-0.webp", "assets/q/36-0.webp", "assets/q/36-1.webp", "assets/q/36-2.webp", "assets/q/36-3.webp", "assets/q/38-0.webp", "assets/q/38-1.webp", "assets/q/38-2.webp", "assets/q/38-3.webp", "assets/q/38-4.webp", "assets/q/51-0.webp", "assets/q/51-1.webp", "assets/q/51-2.webp", "assets/q/51-3.webp", "assets/q/51-4.webp", "assets/q/51-5.webp", "assets/q/51-6.webp", "assets/q/51-7.webp", "assets/q/64-0.webp", "assets/q/64-1.webp", "assets/q/64-2.webp", "assets/q/64-3.webp", "assets/q/64-4.webp", "assets/q/75-0.webp", "assets/q/t0-3.webp", "assets/q/t1-2.webp", "assets/q/t2-3.webp", "assets/q/t3-4.webp", "assets/q/t3-6.webp", "assets/q/t4-5.webp", "assets/q/24-0.webp", "assets/q/26-0.webp", "assets/q/26-1.webp", "assets/q/39-0.webp", "assets/q/39-1.webp", "assets/q/39-2.webp", "assets/q/39-3.webp", "assets/q/39-4.webp", "assets/q/39-5.webp", "assets/q/52-0.webp", "assets/q/52-1.webp", "assets/q/52-2.webp", "assets/q/52-3.webp", "assets/q/52-4.webp", "assets/q/65-0.webp", "assets/q/76-0.webp", "assets/q/t0-2.webp", "assets/q/t1-1.webp", "assets/q/t2-2.webp", "assets/q/t3-3.webp", "assets/q/t4-4.webp", "assets/q/t4-6.webp", "assets/q/t5-5.webp", "assets/q/27-0.webp", "assets/q/27-1.webp", "assets/q/27-2.webp", "assets/q/40-0.webp", "assets/q/40-1.webp", "assets/q/40-2.webp", "assets/q/40-3.webp", "assets/q/40-4.webp", "assets/q/53-0.webp", "assets/q/53-1.webp", "assets/q/53-2.webp", "assets/q/53-3.webp", "assets/q/53-4.webp", "assets/q/53-5.webp", "assets/q/66-0.webp", "assets/q/t0-1.webp", "assets/q/t1-0.webp", "assets/q/t2-1.webp", "assets/q/t3-2.webp", "assets/q/t4-3.webp", "assets/q/t5-4.webp", "assets/q/t5-6.webp", "assets/q/t6-5.webp", "assets/q/15-0.webp", "assets/q/28-0.webp", "assets/q/28-1.webp", "assets/q/41-0.webp", "assets/q/41-1.webp", "assets/q/41-2.webp", "assets/q/41-3.webp", "assets/q/41-4.webp", "assets/q/41-5.webp", "assets/q/41-6.webp", "assets/q/54-0.webp", "assets/q/54-1.webp", "assets/q/54-2.webp", "assets/q/54-3.webp", "assets/q/54-4.webp", "assets/q/54-5.webp", "assets/q/54-6.webp", "assets/q/67-0.webp", "assets/q/t0-0.webp", "assets/q/t2-0.webp", "assets/q/t3-1.webp", "assets/q/t4-2.webp", "assets/q/t5-3.webp", "assets/q/t6-4.webp", "assets/q/t6-6.webp", "assets/q/t7-5.webp", "assets/q/16-0.webp", "assets/q/16-1.webp", "assets/q/16-2.webp", "assets/q/16-3.webp", "assets/q/29-0.webp", "assets/q/29-1.webp", "assets/q/29-2.webp", "assets/q/3-0.webp", "assets/q/42-0.webp", "assets/q/42-1.webp", "assets/q/42-2.webp", "assets/q/42-3.webp", "assets/q/55-0.webp", "assets/q/55-1.webp", "assets/q/55-2.webp", "assets/q/55-3.webp", "assets/q/55-4.webp", "assets/q/55-5.webp", "assets/q/t3-0.webp", "assets/q/t4-1.webp", "assets/q/t5-2.webp", "assets/q/t6-3.webp", "assets/q/t7-4.webp", "assets/q/t7-6.webp", "assets/q/t8-5.webp", "assets/q/17-0.webp", "assets/q/17-1.webp", "assets/q/17-2.webp", "assets/q/17-3.webp", "assets/q/17-4.webp", "assets/q/30-0.webp", "assets/q/30-1.webp", "assets/q/4-0.webp", "assets/q/4-1.webp", "assets/q/43-0.webp", "assets/q/43-1.webp", "assets/q/43-2.webp", "assets/q/43-3.webp", "assets/q/43-4.webp", "assets/q/43-5.webp", "assets/q/56-0.webp", "assets/q/t4-0.webp", "assets/q/t5-1.webp", "assets/q/t6-2.webp", "assets/q/t7-3.webp", "assets/q/t8-4.webp", "assets/q/t8-6.webp", "assets/q/t9-5.webp", "assets/q/18-0.webp", "assets/q/18-1.webp", "assets/q/18-2.webp", "assets/q/31-0.webp", "assets/q/31-1.webp", "assets/q/31-2.webp", "assets/q/31-3.webp", "assets/q/44-0.webp", "assets/q/44-1.webp", "assets/q/44-2.webp", "assets/q/5-0.webp", "assets/q/5-1.webp", "assets/q/5-2.webp", "assets/q/5-3.webp", "assets/q/57-0.webp", "assets/q/t10-5.webp", "assets/q/t5-0.webp", "assets/q/t6-1.webp", "assets/q/t7-2.webp", "assets/q/t8-3.webp", "assets/q/t9-4.webp", "assets/q/t9-6.webp", "assets/q/19-0.webp", "assets/q/19-1.webp", "assets/q/19-2.webp", "assets/q/32-0.webp", "assets/q/32-1.webp", "assets/q/32-2.webp", "assets/q/45-0.webp", "assets/q/6-0.webp", "assets/q/6-1.webp", "assets/q/t10-4.webp", "assets/q/t10-6.webp", "assets/q/t11-5.webp", "assets/q/t6-0.webp", "assets/q/t7-1.webp", "assets/q/t8-2.webp", "assets/q/t9-3.webp", "assets/q/20-0.webp", "assets/q/20-1.webp", "assets/q/20-2.webp", "assets/q/20-3.webp", "assets/q/33-0.webp", "assets/q/33-1.webp", "assets/q/7-0.webp", "assets/q/t10-3.webp", "assets/q/t11-4.webp", "assets/q/t11-6.webp", "assets/q/t7-0.webp", "assets/q/t8-1.webp", "assets/q/t9-2.webp", "assets/q/21-0.webp", "assets/q/21-1.webp", "assets/q/21-2.webp", "assets/q/21-3.webp", "assets/q/34-0.webp", "assets/q/8-0.webp", "assets/q/t10-2.webp", "assets/q/t11-3.webp", "assets/q/t8-0.webp", "assets/q/t9-1.webp", "assets/q/22-0.webp", "assets/q/9-0.webp", "assets/q/9-1.webp", "assets/q/t10-1.webp", "assets/q/t11-2.webp", "assets/q/t9-0.webp", "assets/q/10-0.webp", "assets/q/t10-0.webp", "assets/q/t11-1.webp", "assets/q/t11-0.webp", "assets/p/laby-haies-bandes.webp"];
const CACHE = "ronron-" + VERSION;

self.addEventListener("install", e => {
  // « reload » : chaque fichier est repris sur le site, jamais dans la copie que le navigateur garde quelques minutes
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE.map(u => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith("ronron-") && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
  warm();
});
// Le reste (dalles du domaine, calques des chantiers) se télécharge en douce, sans bloquer le jeu.
async function warm() {
  const c = await caches.open(CACHE);
  for (const url of REST) {
    try { if (!(await c.match(url))) { const r = await fetch(url); if (r.ok) await c.put(url, r); } } catch (err) { return; }
  }
}
async function networkFirst(req) {
  const c = await caches.open(CACHE);
  try {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 4000);
    // « no-cache » : on redemande toujours le fichier au site, sans se fier à la copie que le navigateur garde dix minutes
    const r = await fetch(req.url, { signal: ctl.signal, cache: "no-cache" }); clearTimeout(timer);
    if (r.ok) c.put(req, r.clone());
    return r;
  } catch (err) {
    return (await c.match(req, { ignoreSearch: true })) || (req.mode === "navigate" && (await c.match("./"))) || Response.error();
  }
}
async function cacheFirst(req) {
  const c = await caches.open(CACHE);
  const hit = await c.match(req);
  if (hit) return hit;
  const r = await fetch(req);
  if (r.ok || r.type === "opaque") c.put(req, r.clone());
  return r;
}
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    // le code vient du réseau quand il y en a (mises à jour immédiates), les images du cache
    const code = req.mode === "navigate" || /\.(html|js|css|webmanifest)$/.test(url.pathname);
    e.respondWith(code ? networkFirst(req) : cacheFirst(req));
  } else if (/(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) e.respondWith(cacheFirst(req));
});
