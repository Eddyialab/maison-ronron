/* Maison Ronron hors ligne. VERSION change à chaque mise en ligne (écrit par stamp.py) : les téléphones
   voient alors un nouveau fichier, vident l'ancien cache et reprennent les fichiers à jour. */
const VERSION = "8c7a2bd5c3";
const CORE = ["./", "app.js", "assets/c/acc-bonnet-assis.webp", "assets/c/acc-bonnet-debout.webp", "assets/c/acc-bonnet-dort.webp", "assets/c/acc-bonnet-marche.webp", "assets/c/acc-couronne-assis.webp", "assets/c/acc-couronne-debout.webp", "assets/c/acc-couronne-dort.webp", "assets/c/acc-couronne-marche.webp", "assets/c/acc-echarpe-assis.webp", "assets/c/acc-echarpe-debout.webp", "assets/c/acc-echarpe-dort.webp", "assets/c/acc-echarpe-marche.webp", "assets/c/acc-grelot-assis.webp", "assets/c/acc-grelot-debout.webp", "assets/c/acc-grelot-dort.webp", "assets/c/acc-grelot-marche.webp", "assets/c/acc-noeud-assis.webp", "assets/c/acc-noeud-debout.webp", "assets/c/acc-noeud-dort.webp", "assets/c/acc-noeud-marche.webp", "assets/c/chartreux-assis.webp", "assets/c/chartreux-debout.webp", "assets/c/chartreux-dort.webp", "assets/c/chartreux-marche.webp", "assets/c/mainecoon-assis.webp", "assets/c/mainecoon-bonnet-assis.webp", "assets/c/mainecoon-bonnet-debout.webp", "assets/c/mainecoon-bonnet-dort.webp", "assets/c/mainecoon-bonnet-marche.webp", "assets/c/mainecoon-couronne-assis.webp", "assets/c/mainecoon-couronne-debout.webp", "assets/c/mainecoon-couronne-dort.webp", "assets/c/mainecoon-couronne-marche.webp", "assets/c/mainecoon-debout.webp", "assets/c/mainecoon-dort.webp", "assets/c/mainecoon-echarpe-assis.webp", "assets/c/mainecoon-echarpe-debout.webp", "assets/c/mainecoon-echarpe-dort.webp", "assets/c/mainecoon-echarpe-marche.webp", "assets/c/mainecoon-grelot-assis.webp", "assets/c/mainecoon-grelot-debout.webp", "assets/c/mainecoon-grelot-dort.webp", "assets/c/mainecoon-grelot-marche.webp", "assets/c/mainecoon-marche.webp", "assets/c/mainecoon-noeud-assis.webp", "assets/c/mainecoon-noeud-debout.webp", "assets/c/mainecoon-noeud-dort.webp", "assets/c/mainecoon-noeud-marche.webp", "assets/c/roux-assis.webp", "assets/c/roux-bonnet-assis.webp", "assets/c/roux-bonnet-debout.webp", "assets/c/roux-bonnet-dort.webp", "assets/c/roux-bonnet-marche.webp", "assets/c/roux-couronne-assis.webp", "assets/c/roux-couronne-debout.webp", "assets/c/roux-couronne-dort.webp", "assets/c/roux-couronne-marche.webp", "assets/c/roux-debout.webp", "assets/c/roux-dort.webp", "assets/c/roux-echarpe-assis.webp", "assets/c/roux-echarpe-debout.webp", "assets/c/roux-echarpe-dort.webp", "assets/c/roux-echarpe-marche.webp", "assets/c/roux-grelot-assis.webp", "assets/c/roux-grelot-debout.webp", "assets/c/roux-grelot-dort.webp", "assets/c/roux-grelot-marche.webp", "assets/c/roux-marche.webp", "assets/c/roux-noeud-assis.webp", "assets/c/roux-noeud-debout.webp", "assets/c/roux-noeud-dort.webp", "assets/c/roux-noeud-marche.webp", "assets/c/siamois-assis.webp", "assets/c/siamois-debout.webp", "assets/c/siamois-dort.webp", "assets/c/siamois-marche.webp", "assets/c/smoking-assis.webp", "assets/c/smoking-debout.webp", "assets/c/smoking-dort.webp", "assets/c/smoking-marche.webp", "assets/c/tigre-assis.webp", "assets/c/tigre-debout.webp", "assets/c/tigre-dort.webp", "assets/c/tigre-marche.webp", "assets/cats.js", "assets/nav.js", "assets/patches.js", "assets/plan.webp", "assets/tiles.js", "assets/walls.js", "gen.js", "icons/apple-touch-icon.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "index.html", "manifest.webmanifest", "style.css"];
const REST = ["assets/a/musique-1.mp3", "assets/a/musique-2.mp3", "assets/a/musique-3.mp3", "assets/p/allee-arche-glycine.webp", "assets/p/allee-arche-roses.webp", "assets/p/allee-chemin-gravier.webp", "assets/p/allee-chemin-paves.webp", "assets/p/allee-debrousse.webp", "assets/p/allee-lampadaires-noirs.webp", "assets/p/allee-lampadaires-verts.webp", "assets/p/allee-massif-hortensias.webp", "assets/p/allee-massif-tulipes.webp", "assets/p/allee-pelouse.webp", "assets/p/allee-rond-buis.webp", "assets/p/allee-rond-cadran.webp", "assets/p/allee-sentier-briques.webp", "assets/p/allee-sentier-dalles.webp", "assets/p/allee-statue-bronze.webp", "assets/p/allee-statue-marbre.webp", "assets/p/cuisine-meubles-bleus.webp", "assets/p/cuisine-meubles-chene.webp", "assets/p/cuisine-murs-bleu.webp", "assets/p/cuisine-murs-creme.webp", "assets/p/cuisine-sol-damier.webp", "assets/p/cuisine-sol-tomettes.webp", "assets/p/entree-balayee.webp", "assets/p/entree-banc-chene.webp", "assets/p/entree-banc-vert.webp", "assets/p/entree-plante-monstera.webp", "assets/p/entree-plante-olivier.webp", "assets/p/entree-sol-ciment.webp", "assets/p/entree-sol-pierre.webp", "assets/p/grille-abri-bleu.webp", "assets/p/grille-abri-bois.webp", "assets/p/grille-banc-bois.webp", "assets/p/grille-banc-fer.webp", "assets/p/grille-chemin-gravier.webp", "assets/p/grille-chemin-paves.webp", "assets/p/grille-debrousse.webp", "assets/p/grille-grille-noire-gravier.webp", "assets/p/grille-grille-noire-paves.webp", "assets/p/grille-grille-verte-gravier.webp", "assets/p/grille-grille-verte-paves.webp", "assets/p/grille-lanternes-laiton.webp", "assets/p/grille-lanternes-noires.webp", "assets/p/grille-massif-lavande.webp", "assets/p/grille-massif-roses.webp", "assets/p/grille-mur-chaule.webp", "assets/p/grille-mur-pierre.webp", "assets/p/grille-pelouse.webp", "assets/p/jardin-allee-gravier.webp", "assets/p/jardin-allee-paves.webp", "assets/p/jardin-arbre-cerisier.webp", "assets/p/jardin-arbre-pommier.webp", "assets/p/jardin-cloture-blanche.webp", "assets/p/jardin-cloture-bois.webp", "assets/p/jardin-debrousse.webp", "assets/p/jardin-fontaine-mosaique.webp", "assets/p/jardin-fontaine-pierre.webp", "assets/p/jardin-pelouse.webp", "assets/p/jardin-portail-blanche-gravier.webp", "assets/p/jardin-portail-blanche-herbe.webp", "assets/p/jardin-portail-blanche-paves.webp", "assets/p/jardin-portail-bois-gravier.webp", "assets/p/jardin-portail-bois-herbe.webp", "assets/p/jardin-portail-bois-paves.webp", "assets/p/salon-arbrechat-gris.webp", "assets/p/salon-arbrechat-naturel.webp", "assets/p/salon-canape-corail.webp", "assets/p/salon-canape-vert.webp", "assets/p/salon-fenetre-sauge.webp", "assets/p/salon-fenetre-terracotta.webp", "assets/p/salon-fenetre.webp", "assets/p/salon-lampe-laiton.webp", "assets/p/salon-lampe-noire.webp", "assets/p/salon-menage.webp", "assets/p/salon-murs-sauge.webp", "assets/p/salon-murs-terracotta.webp", "assets/p/salon-rideaux-lin.webp", "assets/p/salon-rideaux-moutarde.webp", "assets/p/salon-sol-chene.webp", "assets/p/salon-sol-noyer.webp", "assets/p/salon-tableau-abstrait.webp", "assets/p/salon-tableau-paysage.webp", "assets/p/salon-tapis-berbere.webp", "assets/p/salon-tapis-rouge.webp", "assets/t/c0r3.webp", "assets/t/c0r4.webp", "assets/t/c1r3.webp", "assets/t/c1r4.webp", "assets/t/c0r0.webp", "assets/t/c0r1.webp", "assets/t/c0r2.webp", "assets/t/c1r0.webp", "assets/t/c1r1.webp", "assets/t/c1r2.webp", "assets/t/c2r0.webp", "assets/t/c2r1.webp", "assets/t/c2r2.webp", "assets/t/c2r3.webp", "assets/t/c2r4.webp", "assets/t/c3r0.webp", "assets/t/c3r1.webp", "assets/t/c3r2.webp", "assets/t/c3r3.webp", "assets/t/c3r4.webp", "assets/t/c4r0.webp", "assets/t/c4r1.webp", "assets/t/c4r2.webp", "assets/t/c4r3.webp", "assets/t/c4r4.webp"];
const CACHE = "ronron-" + VERSION;

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
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
    const r = await fetch(req, { signal: ctl.signal }); clearTimeout(timer);
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
