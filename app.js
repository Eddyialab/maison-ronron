/* Maison Ronron — le jeu.
   Sommaire : 1. Données  2. Sauvegarde et vies  3. Interface commune  4. Niveaux
              5. Carte du domaine  6. Chats  7. Chantiers  8. Boutique  9. Réglages  10. Démarrage */
(function () {
  "use strict";

  // Si quelque chose casse, on le dit à l'écran au lieu de laisser le jeu figé sans explication.
  let complained = false;
  window.addEventListener("error", e => {
    if (complained || !e || !e.message || /ResizeObserver|Script error/.test(e.message)) return;
    complained = true;
    const d = document.createElement("div");
    d.setAttribute("role", "alert");
    d.style.cssText = "position:fixed;left:12px;right:12px;bottom:12px;z-index:99;padding:12px 14px;border-radius:14px;background:#2B2622;color:#fff;font:600 14px/1.35 system-ui,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.3)";
    d.textContent = "Un problème est survenu. Ferme l'app et rouvre-la. (" + e.message + (e.lineno ? ", ligne " + e.lineno : "") + ")";
    d.onclick = () => d.remove();
    (document.body || document.documentElement).appendChild(d);
  });

  /* ================= 1. Données ================= */

  const MAX_LIVES = 5;
  const LIFE_MS = 30 * 60 * 1000;
  const SAVE_KEY = "maison-ronron-v1";

  const ZONE_COLORS = ["#F6719F", "#FFC544", "#86BDEB", "#BDB8EA", "#A9DE9C",
                       "#FF9F6B", "#6FD3C7", "#C9A27E", "#9FB0C4", "#B877AC"];

  /* Le domaine : une carte de 5 x 5 zones qu'on parcourt au doigt. Coordonnées en pixels du monde.
     Sous les zones peintes, le plan d'ensemble agrandi sert de fond flou pour les zones pas encore faites. */
  const WORLD = { w: 11466, h: 6452 };
  const TILES = window.RONRON_TILES || [];
  const GARDIEN = [0, 4916];                       // origine de la zone A5, la maison du gardien
  const g = p => [p[0] + GARDIEN[0], p[1] + GARDIEN[1]];
  const z2 = p => [p[0] + 2184, p[1] + 4916];
  const z3 = p => [p[0] + 2184, p[1] + 3687];       // zone de l'allée du manoir, au-dessus de la grille
  const z4 = p => [p[0] + 4368, p[1] + 3687];       // zone de l'aile d'entrée du manoir, à droite de l'allée
  const z5 = p => [p[0] + 4368, p[1] + 2458];       // zone de la cour d'honneur, derrière le grand salon
  const p5 = (x, y, pose, dir) => ({ x: x + 4368, y: y + 2458, pose: pose, dir: dir, min: 12000, max: 30000 });
  const p5c = (x, y, pose, dir, depth) => ({ x: x + 4368, y: y + 2458, pose: pose, dir: dir, depth: depth, min: 12000, max: 30000 });
  const p4 = (x, y, pose, dir, depth) => ({ x: x + 4368, y: y + 3687, pose: pose, dir: dir, depth: depth, min: 12000, max: 30000 });
  const z6 = p => [p[0] + 2184, p[1] + 2458];       // zone de l'aile ouest et de son jardin, à gauche du perron
  const p6 = (x, y, pose, dir, depth) => ({ x: x + 2184, y: y + 2458, pose: pose, dir: dir, depth: depth, min: 12000, max: 30000 });
  const z7 = p => [p[0] + 6552, p[1] + 2458];       // zone de l'aile est, derrière la salle des chats
  const p7 = (x, y, pose, dir) => ({ x: x + 6552, y: y + 2458, pose: pose, dir: dir, min: 12000, max: 30000 });
  const z8 = p => [p[0] + 6552, p[1] + 3687];       // zone du perron est, sous l'aile est
  const p8 = (x, y, pose, dir, depth) => ({ x: x + 6552, y: y + 3687, pose: pose, dir: dir, depth: depth, min: 12000, max: 30000 });
  const z9 = p => [p[0] + 6900, p[1] + 450];        // zone de l'étang, au-dessus de l'aile est (coordonnées à la taille du monde)
  const z10 = p => [p[0], p[1] + 2860];       // zone du labyrinthe, à gauche de l'allée (coordonnées à la taille du monde)
  const z11 = p => [p[0] + 3580, p[1]];        // zone de la serre, au-dessus de la cour (coordonnées à la taille du monde)
  const p11 = (x, y, pose, dir, depth) => ({ x: x + 3580, y: y, pose: pose, dir: dir, depth: depth, min: 12000, max: 30000 });
  const p10 = (x, y, pose, dir, depth) => ({ x: x, y: y + 2860, pose: pose, dir: dir, depth: depth, min: 12000, max: 30000 });
  const p9 = (x, y, pose, dir, depth) => ({ x: x + 6900, y: y + 450, pose: pose, dir: dir, depth: depth, min: 12000, max: 30000 });
  WORLD.start = g([1380, 640]);

  /* Chantiers. « at » : position de la bulle sur la carte. « need » : chantiers à terminer avant.
     « patch » : image superposée au terrain une fois le chantier fait { src, x, y, w, h }.
     Un chantier sans image reste visible mais n'est pas encore achetable. */
  const PATCH = window.RONRON_PATCHES || {};
  const DEPTH_PLANTE = 4916 + 1079;   // bas du pot de la plante de l'entrée
  // L'ordre de cette liste est aussi l'ordre d'empilement des calques : sol, tapis, murs, fenêtre, meubles.
  const SLOTS = [
    { id: "salon_menage", room: "Maison du gardien", name: "Dépoussiérer le salon", verb: "Nettoyer", cost: 2, icon: "broom", at: g([1395, 590]),
      desc: "Toiles d'araignée, cartons, gravats : on vide tout avant de commencer les travaux.", patch: PATCH.menage },
    { id: "salon_sol", room: "Maison du gardien", name: "Poser un nouveau sol", short: "Sol du salon", verb: "Poser", cost: 4, icon: "plus", need: ["salon_menage"], at: g([1370, 650]),
      desc: "Le plancher est troué. Choisis le parquet qui le remplace.",
      styles: [{ name: "Chêne miel", sw: "#D9953F", patch: PATCH.chene }, { name: "Noyer en chevrons", sw: "#7A5A44", patch: PATCH.noyer }] },
    { id: "salon_tapis", room: "Maison du gardien", name: "Poser un tapis", short: "Tapis", verb: "Poser", cost: 3, icon: "plus", need: ["salon_sol"], at: g([1385, 630]),
      desc: "Un tapis au milieu du salon, parfait pour les siestes.",
      styles: [{ name: "Berbère", sw: "#EFE7D6", patch: PATCH.tapis_berbere }, { name: "Oriental rouge", sw: "#A5403F", patch: PATCH.tapis_rouge }] },
    { id: "salon_murs", room: "Maison du gardien", name: "Refaire les murs", short: "Murs du salon", verb: "Peindre", cost: 5, icon: "hammer", need: ["salon_menage"], at: g([1130, 420]),
      desc: "Papier peint décollé, fissures, briques à nu : on rebouche et on repeint.",
      styles: [{ name: "Vert sauge", sw: "#A9BFA3", patch: PATCH.murs_sauge }, { name: "Terracotta", sw: "#E0A07E", patch: PATCH.murs_terracotta }] },
    { id: "salon_fenetre", room: "Maison du gardien", name: "Réparer la fenêtre", verb: "Réparer", cost: 4, icon: "hammer", need: ["salon_menage"], at: g([1550, 400]),
      desc: "On retire les planches et on remplace les vitres cassées.",
      // le pourtour de la fenêtre suit la couleur des murs
      patch: eff => { const m = eff("salon_murs"); return m == null ? PATCH.fenetre : [PATCH.fenetre_sauge, PATCH.fenetre_terracotta][m]; } },
    { id: "salon_tableau", room: "Maison du gardien", name: "Accrocher un tableau", short: "Tableau", verb: "Accrocher", cost: 3, icon: "plus", need: ["salon_murs"], at: g([1160, 380]),
      desc: "Un tableau sur le grand mur du salon.",
      styles: [{ name: "Paysage doré", sw: "#C9A24B", patch: PATCH.tableau_paysage }, { name: "Abstrait", sw: "#3A3340", patch: PATCH.tableau_abstrait }] },
    { id: "salon_rideaux", room: "Maison du gardien", name: "Poser des rideaux", short: "Rideaux", verb: "Poser", cost: 3, icon: "plus", need: ["salon_fenetre"], at: g([1560, 330]),
      desc: "Une tringle et deux rideaux pour habiller la fenêtre.",
      styles: [{ name: "Lin naturel", sw: "#EFE8D8", patch: PATCH.rideaux_lin }, { name: "Velours moutarde", sw: "#D9A62E", patch: PATCH.rideaux_moutarde }] },
    { id: "salon_lampe", room: "Maison du gardien", name: "Placer un lampadaire", short: "Lampadaire", verb: "Placer", cost: 3, icon: "plus", need: ["salon_sol"], at: g([1365, 420]),
      desc: "Un lampadaire dans l'angle du salon.",
      styles: [{ name: "Laiton et crème", sw: "#E8D9A8", patch: PATCH.lampe_laiton }, { name: "Noir", sw: "#2E2D31", patch: PATCH.lampe_noire }] },
    { id: "salon_canape", room: "Maison du gardien", name: "Installer un canapé", short: "Canapé", verb: "Installer", cost: 5, icon: "plus", need: ["salon_sol"], at: g([1540, 600]),
      desc: "Le canapé se place sous la fenêtre. Les chats viendront y faire la sieste.",
      poi: { x: 1475, y: 4916 + 600, pose: "dort", dir: -1, min: 14000, max: 32000 },
      styles: [{ name: "Velours vert", sw: "#3F7A55", patch: PATCH.vert }, { name: "Lin corail", sw: "#EE7F78", patch: PATCH.corail }] },
    // « depth » : objet debout au milieu d'une pièce ; il est trié avec les chats pour qu'ils passent derrière ou devant lui
    { id: "salon_arbre", room: "Maison du gardien", name: "Monter un arbre à chat", short: "Arbre à chat", verb: "Monter", cost: 5, icon: "plus", need: ["salon_sol"], at: g([890, 640]), depth: 5740,
      desc: "Griffoir, niche et perchoir : il s'installe dans la petite pièce de gauche.",
      poi: { x: 866, y: 4916 + 580, pose: "assis", dir: 1, depth: 5741, min: 9000, max: 20000 },
      styles: [{ name: "Beige", sw: "#D9C4A0", patch: PATCH.arbrechat_naturel }, { name: "Gris et bois", sw: "#6E7078", patch: PATCH.arbrechat_gris }] },

    { id: "entree_balai", room: "Maison du gardien", name: "Balayer l'entrée", verb: "Balayer", cost: 2, icon: "broom", need: ["salon_menage"], at: g([1330, 1050]),
      desc: "Des années de feuilles mortes se sont accumulées sur les dalles." , patch: PATCH.entree_balai },
    { id: "entree_sol", room: "Maison du gardien", name: "Refaire le sol de l'entrée", short: "Sol de l'entrée", verb: "Poser", cost: 4, icon: "plus", need: ["entree_balai"], at: g([1330, 1050]),
      desc: "Les vieilles dalles sont usées. Choisis le sol qui accueillera les visiteurs.",
      styles: [{ name: "Pierre claire", sw: "#E6DCC6", patch: PATCH.entree_pierre }, { name: "Carreaux de ciment", sw: "#8FA0B5", patch: PATCH.entree_ciment }] },
    { id: "entree_banc", room: "Maison du gardien", name: "Installer un banc d'entrée", short: "Banc d'entrée", verb: "Installer", cost: 3, icon: "plus", need: ["entree_sol"], at: g([1240, 950]),
      desc: "De quoi s'asseoir pour se déchausser. Chaque banc a son coin.",
      styles: [{ name: "Chêne", sw: "#C9A26B", patch: PATCH.banc_chene }, { name: "Vert bouteille", sw: "#3F6B4A", patch: PATCH.banc_vert }] },
    { id: "entree_plante", room: "Maison du gardien", name: "Ajouter une plante", short: "Plante de l'entrée", verb: "Ajouter", cost: 3, icon: "plus", need: ["entree_balai"], at: g([1600, 940]), depth: DEPTH_PLANTE,
      desc: "Un peu de verdure pour accueillir les visiteurs.",
      styles: [{ name: "Monstera", sw: "#4E9B4A", patch: PATCH.plante_monstera }, { name: "Olivier", sw: "#A9B8A0", patch: PATCH.plante_olivier }] },

    { id: "cuisine_sol", room: "Maison du gardien", name: "Carreler la cuisine", short: "Sol de la cuisine", verb: "Poser", cost: 4, icon: "plus", need: ["entree_balai"], at: g([1780, 860]),
      desc: "Le vieux carrelage est taché et fendu. Choisis le nouveau.",
      styles: [{ name: "Damier", sw: "#33312E", patch: PATCH.cuisine_damier }, { name: "Tomettes", sw: "#C96F4E", patch: PATCH.cuisine_tomettes }] },
    { id: "cuisine_murs", room: "Maison du gardien", name: "Refaire les murs de la cuisine", short: "Murs de la cuisine", verb: "Peindre", cost: 5, icon: "hammer", need: ["entree_balai"], at: g([1940, 610]),
      desc: "On rebouche les fissures et on repeint.",
      styles: [{ name: "Crème", sw: "#F2E6C8", patch: PATCH.cuisine_creme }, { name: "Bleu poudré", sw: "#A9BEDD", patch: PATCH.cuisine_bleu }] },
    { id: "cuisine_meubles", room: "Maison du gardien", name: "Installer la cuisine", short: "Meubles de cuisine", verb: "Installer", cost: 7, icon: "plus", need: ["cuisine_sol"], at: g([1850, 740]),
      desc: "Des placards, un évier et une cuisinière, le long des murs du fond.",
      styles: [{ name: "Chêne et blanc", sw: "#C8944F", patch: PATCH.meubles_chene }, { name: "Bleu pétrole", sw: "#3F6F7C", patch: PATCH.meubles_bleus }] },

    { id: "jardin_debrousse", room: "Jardin du gardien", name: "Débroussailler le jardin", verb: "Débroussailler", cost: 3, icon: "broom", need: ["salon_menage"], at: g([650, 760]),
      desc: "Ronces, branches mortes, vieux sacs et gravats : on évacue tout. Les chats pourront enfin sortir dans le jardin.", patch: PATCH.jardin_debrousse },
    { id: "jardin_pelouse", room: "Jardin du gardien", name: "Semer une pelouse", verb: "Semer", cost: 4, icon: "plus", need: ["jardin_debrousse"], at: g([650, 760]),
      desc: "Une vraie pelouse à la place de l'herbe sèche. Le reste du jardin se construira dessus.", patch: PATCH.jardin_pelouse },
    { id: "jardin_allee", room: "Jardin du gardien", name: "Refaire l'allée", short: "Allée", verb: "Refaire", cost: 4, icon: "hammer", need: ["jardin_pelouse"], at: g([900, 1290]),
      desc: "Il manque des dalles entre le portail et le perron.",
      styles: [{ name: "Pavés clairs", sw: "#E6DCC0", patch: PATCH.allee_paves }, { name: "Gravier et briques", sw: "#B5553C", patch: PATCH.allee_gravier }] },
    { id: "jardin_fontaine", room: "Jardin du gardien", name: "Restaurer la fontaine", short: "Fontaine", verb: "Restaurer", cost: 5, icon: "hammer", need: ["jardin_pelouse"], at: g([2140, 1160]), depth: 4916 + 1240,
      desc: "La fontaine est à sec et envahie d'herbes. On la remet en eau.",
      poi: { x: 2070, y: 4916 + 1278, pose: "assis", dir: 1, depth: 4916 + 1241, min: 7000, max: 15000 },
      styles: [{ name: "Pierre claire", sw: "#7FB5DA", patch: PATCH.fontaine_pierre }, { name: "Mosaïque bleue", sw: "#2F7FB0", patch: PATCH.fontaine_mosaique }] },
    { id: "jardin_cloture", room: "Jardin du gardien", name: "Refaire la clôture", short: "Clôture", verb: "Refaire", cost: 7, icon: "hammer", need: ["jardin_pelouse"], at: g([330, 1150]),
      desc: "Piquets cassés, portail rouillé : on refait tout le tour du jardin.",
      styles: [{ name: "Bois naturel", sw: "#D9A860", patch: PATCH.cloture_bois }, { name: "Blanche", sw: "#F0EFEA", patch: PATCH.cloture_blanche }],
      // le portail neuf remplace l'ancien : son image dépend de la clôture choisie et du sol qu'on voit entre ses barreaux
      extra: eff => PATCH["portail_" + (eff("jardin_cloture") ? "blanche" : "bois") + "_" + (eff("jardin_allee") == null ? "herbe" : eff("jardin_allee") ? "gravier" : "paves")] },
    // posé après la clôture : l'arbre est devant elle
    { id: "jardin_arbre", room: "Jardin du gardien", name: "Faire revivre le grand arbre", short: "Grand arbre", verb: "Soigner", cost: 4, icon: "plus", need: ["jardin_pelouse"], at: g([860, 330]),
      desc: "Le vieil arbre derrière la maison n'a plus une feuille. Choisis ce qu'il deviendra.",
      styles: [{ name: "Cerisier en fleurs", sw: "#F2B6CF", patch: PATCH.arbre_cerisier }, { name: "Pommier", sw: "#5E9E48", patch: PATCH.arbre_pommier }] },

    /* ----- Objets pour chats. « poi » : là où un chat vient s'installer (pattes au point x, y, en pixels du monde).
       Pour les objets triés avec les chats, « depth » peut dépendre du style : le transat et l'herbe ne sont pas posés au même endroit. ----- */
    { id: "objet_panier", room: "Maison du gardien", name: "Installer un panier", short: "Panier", verb: "Installer", cost: 8, icon: "plus", need: ["salon_sol"], at: g([1158, 575]),
      desc: "Un panier douillet dans le salon. Les chats viendront s'y rouler en boule.",
      poi: { x: 1158, y: 4916 + 640, pose: "dort", dir: 1, min: 15000, max: 35000 },
      styles: [{ name: "Osier", sw: "#C9A063", patch: PATCH.panier_osier }, { name: "Tissu bleu", sw: "#8FB3D9", patch: PATCH.panier_bleu }] },
    { id: "objet_griffoir", room: "Maison du gardien", name: "Monter un griffoir", short: "Griffoir", verb: "Monter", cost: 8, icon: "plus", need: ["salon_sol"], at: g([1095, 760]), depth: 4916 + 852,
      desc: "Pour se faire les griffes ailleurs que sur le canapé.",
      poi: { x: 1150, y: 4916 + 860, pose: "griffe", dir: -1, min: 4000, max: 8000 },
      styles: [{ name: "Sisal", sw: "#D8C08A", patch: PATCH.griffoir_sisal }, { name: "Cactus", sw: "#4E9A45", patch: PATCH.griffoir_cactus }] },
    { id: "gardien_tapis", room: "Maison du gardien", name: "Poser un tapis dans la cuisine", short: "Tapis de cuisine", verb: "Poser", cost: 10, icon: "plus", need: ["cuisine_sol"], at: g([1900, 900]),
      desc: "Un petit tapis rond sous les gamelles.",
      styles: [{ name: "Tressé", sw: "#C7A06A", patch: PATCH.gardien_tapis_naturel }, { name: "Rayé rouge et bleu", sw: "#C9504A", patch: PATCH.gardien_tapis_colore }] },
    { id: "objet_gamelles", room: "Maison du gardien", name: "Préparer les gamelles", short: "Gamelles", verb: "Préparer", cost: 7, icon: "plus", need: ["cuisine_sol"], at: g([1815, 870]),
      desc: "Croquettes et eau fraîche dans la cuisine. Les chats passeront manger.",
      poi: { x: 1705, y: 4916 + 915, pose: "assis", dir: 1, min: 5000, max: 10000 },
      styles: [{ name: "Céramique bleue", sw: "#5A86C5", patch: PATCH.gamelles_ceramique }, { name: "Inox sur support", sw: "#C7CCD1", patch: PATCH.gamelles_inox }] },
    { id: "objet_transat", room: "Jardin du gardien", name: "Installer un transat pour chat", short: "Transat", verb: "Installer", cost: 10, icon: "plus", need: ["jardin_pelouse"], at: g([520, 990]),
      depth: [4916 + 1108, 4916 + 1046],
      desc: "Un transat à leur taille, pour la sieste au soleil.",
      poi: [{ x: 572, y: 4916 + 1052, pose: "dort", dir: 1, depth: 4916 + 1109, min: 15000, max: 35000 }, { x: 468, y: 4916 + 1000, pose: "dort", dir: 1, depth: 4916 + 1047, min: 15000, max: 35000 }],
      styles: [{ name: "Bois rayé", sw: "#D9534F", patch: PATCH.transat_bois }, { name: "Rotin", sw: "#E9B949", patch: PATCH.transat_rotin }] },
    { id: "objet_herbe", room: "Jardin du gardien", name: "Planter de l'herbe à chat", short: "Herbe à chat", verb: "Planter", cost: 8, icon: "plus", need: ["jardin_pelouse"], at: g([1680, 1250]),
      depth: [4916 + 1421, 4916 + 1434],
      desc: "Les chats adorent la mâchonner.",
      poi: [{ x: 1425, y: 4916 + 1325, pose: "assis", dir: 1, min: 5000, max: 11000 }, { x: 1472, y: 4916 + 1345, pose: "assis", dir: 1, min: 5000, max: 11000 }],
      styles: [{ name: "Bac en bois", sw: "#8A6238", patch: PATCH.herbe_bac }, { name: "Pot en terre", sw: "#C46A3C", patch: PATCH.herbe_pot }] },

    /* ----- Zone 3 : l'allée du manoir, au-dessus de la grille. Ses sols sont posés AVANT ceux de la grille, qui les recouvrent
       dans la bande commune aux deux zones ; ses objets (rond-point, arche, lampadaires, statue) sont à la fin de la liste. ----- */
    { id: "allee_debrousse", room: "Allée du manoir", name: "Débroussailler l'allée", verb: "Débroussailler", cost: 9, icon: "broom", need: ["grille_pelouse"], at: z3([1350, 930]),
      desc: "Herbes folles, branches mortes et gravats jusqu'au perron du manoir.", patch: PATCH.allee_debrousse },
    { id: "allee_pelouse", room: "Allée du manoir", name: "Semer la pelouse de l'allée", verb: "Semer", cost: 10, icon: "plus", need: ["allee_debrousse"], at: z3([1000, 960]),
      desc: "Une grande pelouse entre le labyrinthe et le manoir, dans la continuité de celle de l'entrée.", patch: PATCH.allee_pelouse },
    { id: "allee_chemin", room: "Allée du manoir", name: "Prolonger le chemin", verb: "Prolonger", cost: 18, icon: "hammer", need: ["allee_pelouse", "grille_chemin"], at: z3([2420, 1040]),
      desc: "Le chemin de l'entrée continue jusqu'au perron du manoir, dans le revêtement choisi à la grille.",
      patch: eff => PATCH["allee_chemin_" + (eff("grille_chemin") ? "gravier" : "paves")] },
    { id: "allee_sentier", room: "Allée du manoir", name: "Refaire le sentier du labyrinthe", short: "Sentier", verb: "Refaire", cost: 13, icon: "hammer", need: ["allee_pelouse"], at: z3([900, 470]),
      desc: "Les vieilles pierres du sentier sont usées et disjointes.",
      styles: [{ name: "Dalles claires", sw: "#EFE6CF", patch: PATCH.sentier_dalles }, { name: "Briques", sw: "#C9603E", patch: PATCH.sentier_briques }] },
    { id: "allee_massif", room: "Allée du manoir", name: "Planter un grand massif", short: "Grand massif", verb: "Planter", cost: 12, icon: "plus", need: ["allee_pelouse"], at: z3([1380, 1100]),
      desc: "Un massif ovale au milieu de la grande pelouse.",
      styles: [{ name: "Hortensias", sw: "#8FA8E8", patch: PATCH.massif_hortensias }, { name: "Tulipes", sw: "#E2483A", patch: PATCH.massif_tulipes }] },

    /* ----- Zone 4 : l'aile d'entrée du manoir, à droite de l'allée. Le grand salon s'ouvre aux chats, qui y entrent par la porte du perron.
       Le piano et les meubles du coin salon sont triés avec les chats ; le tapis et la cheminée restent à plat. ----- */
    { id: "manoir_debrousse", room: "Manoir", name: "Débroussailler le devant du manoir", verb: "Débroussailler", cost: 10, icon: "broom", need: ["allee_pelouse"], at: z4([1300, 1000]),
      desc: "Herbes folles, buissons secs et cailloux tout le long de la façade.", patch: PATCH.manoir_debrousse },
    { id: "manoir_pelouse", room: "Manoir", name: "Semer la pelouse du manoir", verb: "Semer", cost: 13, icon: "plus", need: ["manoir_debrousse"], at: z4([1950, 1060]),
      desc: "La grande pelouse de l'allée fait le tour de l'aile.", patch: PATCH.manoir_pelouse },
    { id: "manoir_chemin", room: "Manoir", name: "Prolonger le chemin le long du manoir", short: "Chemin du manoir", verb: "Prolonger", cost: 18, icon: "hammer", need: ["manoir_pelouse", "allee_chemin"], at: z4([1250, 1390]),
      desc: "Le chemin longe la façade jusqu'au perron, dans le revêtement choisi à la grille.",
      patch: eff => PATCH["manoir_chemin_" + (eff("grille_chemin") ? "gravier" : "paves")] },
    { id: "manoir_fenetres", room: "Manoir", name: "Restaurer les fenêtres", short: "Fenêtres", verb: "Restaurer", cost: 16, icon: "hammer", need: ["manoir_debrousse"], at: z4([1080, 690]),
      desc: "Châssis pourris et vitres sales sur toute la façade.",
      styles: [{ name: "Blanches", sw: "#F2F1EC", patch: PATCH.manoir_fenetres_blanches }, { name: "Volets verts", sw: "#2F6B45", patch: PATCH.manoir_volets_verts }] },
    { id: "manoir_salon", room: "Manoir", name: "Déblayer le grand salon", verb: "Déblayer", cost: 13, icon: "broom", need: ["manoir_debrousse"], at: z4([1480, 600]),
      desc: "Chaise cassée, planches, gravats : on vide la pièce et on remonte le mur effondré. Les chats pourront y entrer.", patch: PATCH.manoir_salon },
    { id: "manoir_sol", room: "Manoir", name: "Poser le sol du grand salon", short: "Sol du grand salon", verb: "Poser", cost: 18, icon: "plus", need: ["manoir_salon"], at: z4([1560, 680]),
      desc: "Le vieux plancher est fichu. Choisis le sol de la plus belle pièce du manoir.",
      styles: [{ name: "Chêne en chevrons", sw: "#D99A4E", patch: PATCH.manoir_sol_chevrons }, { name: "Damier de marbre", sw: "#2E2E33", patch: PATCH.manoir_sol_marbre }] },
    { id: "manoir_murs", room: "Manoir", name: "Habiller les murs du grand salon", short: "Murs du grand salon", verb: "Habiller", cost: 16, icon: "hammer", need: ["manoir_salon"], at: z4([1650, 330]),
      desc: "Du papier peint ou des boiseries, sur les grands murs du salon.",
      styles: [{ name: "Papier peint vert", sw: "#A8BC94", patch: PATCH.manoir_murs_papier }, { name: "Boiseries bleues", sw: "#9FC3C9", patch: PATCH.manoir_murs_boiseries }] },
    { id: "manoir_cheminee", room: "Manoir", name: "Construire une cheminée", short: "Cheminée", verb: "Construire", cost: 18, icon: "plus", need: ["manoir_sol"], at: z4([1300, 430]),
      desc: "Un bon feu dans le grand salon. Les chats viendront dormir devant.",
      poi: [{ x: 4368 + 1345, y: 3687 + 642, pose: "dort", dir: 1, min: 15000, max: 35000 }, { x: 4368 + 1425, y: 3687 + 655, pose: "dort", dir: 1, min: 15000, max: 35000 }],
      styles: [{ name: "Marbre blanc", sw: "#ECEAE6", patch: PATCH.manoir_cheminee_marbre }, { name: "Pierre et chêne", sw: "#8C7A66", patch: PATCH.manoir_cheminee_pierre }] },
    { id: "manoir_canapes", room: "Manoir", name: "Meubler le coin salon", short: "Coin salon", verb: "Meubler", cost: 18, icon: "plus", need: ["manoir_sol"], at: z4([1770, 520]),
      desc: "Un canapé, deux fauteuils, une table basse et un tapis. Les chats viendront faire la sieste sur le canapé.",
      poi: [{ x: 4368 + 1745, y: 3687 + 597, pose: "dort", dir: -1, depth: 4389, min: 15000, max: 35000 },
            { x: 4368 + 1752, y: 3687 + 575, pose: "dort", dir: -1, depth: 4384, min: 15000, max: 35000 }],
      styles: [{ name: "Chesterfield", sw: "#5A3B2E", patch: PATCH.manoir_canapes_chesterfield }, { name: "Velours", sw: "#1F6E6E", patch: PATCH.manoir_canapes_velours }],
      // le tapis reste à plat ; chaque meuble est redessiné à part et trié avec les chats, qui passent derrière la table ou un fauteuil
      parts: ["chesterfield", "velours"].map(n => [["fauteuil", [4312, 4363]], ["canape", [4388, 4383]], ["table", [4395, 4364]]].map(([p, dp], k) => ({ patch: PATCH["manoir_canapes_" + n + "_" + p], depth: dp[n === "velours" ? 1 : 0] }))) },
    { id: "manoir_piano", room: "Manoir", name: "Installer un piano à queue", short: "Piano", verb: "Installer", cost: 21, icon: "plus", need: ["manoir_sol"], at: z4([1500, 380]), depth: 3687 + 588,
      desc: "Un grand piano dans le coin du salon. Les chats adorent s'asseoir sur le clavier.",
      poi: [{ x: 4368 + 1468, y: 3687 + 474, pose: "assis", dir: 1, depth: 3687 + 589, min: 8000, max: 18000 },
            { x: 4368 + 1462, y: 3687 + 484, pose: "assis", dir: 1, depth: 3687 + 589, min: 8000, max: 18000 }],
      styles: [{ name: "Laqué noir", sw: "#1E1E22", patch: PATCH.manoir_piano_noir }, { name: "Laqué blanc", sw: "#F4F3EF", patch: PATCH.manoir_piano_blanc }] },
    { id: "manoir_bureau", room: "Manoir", name: "Aménager le bureau", short: "Bureau", verb: "Aménager", cost: 13, icon: "hammer", need: ["manoir_debrousse"], at: z4([2000, 270]),
      desc: "La petite pièce aux deux portes devient un bureau.",
      styles: [{ name: "Bois sombre", sw: "#6B3A26", patch: PATCH.manoir_bureau_bois }, { name: "Blanc et rotin", sw: "#F3F0E8", patch: PATCH.manoir_bureau_blanc }] },

    /* ----- Zone 5 : la cour d'honneur, au cœur du manoir. Les chats y entrent par la porte du perron et traversent le hall ;
       la salle des chats s'ouvre par l'arche de droite. Tout est posé à plat : les cases derrière les objets sont retirées. ----- */
    { id: "cour_desherbe", room: "Cour", name: "Désherber la cour d'honneur", verb: "Désherber", cost: 10, icon: "broom", need: ["manoir_salon"], at: z5([900, 1000]),
      desc: "Des herbes partout entre les dalles, et même dans la fontaine.", patch: PATCH.cour_desherbe },
    { id: "cour_dallage", room: "Cour", name: "Refaire le dallage de la cour", short: "Dallage de la cour", verb: "Refaire", cost: 18, icon: "hammer", need: ["cour_desherbe"], at: z5([1750, 820]),
      desc: "Les vieilles dalles sont fendues. Choisis le sol de la cour.",
      styles: [{ name: "Pierre blonde", sw: "#E2BE7A", patch: PATCH.cour_dallage_blond }, { name: "Damier pierre et ardoise", sw: "#5E6168", patch: PATCH.cour_dallage_damier }] },
    /* Lot J : le tapis est rangé avant la fontaine, le fauteuil et les pots, qui passent par-dessus. */
    { id: "cour_carpette", room: "Cour", name: "Dérouler un tapis devant le fauteuil", short: "Tapis", verb: "Dérouler", cost: 18, icon: "plus", need: ["cour_fauteuil", "cour_fontaine"], at: z5([1500, 640]),
      desc: "Pour la sieste au soleil, devant le fauteuil.",
      poi: [[{ x: 5863, y: 3140, pose: "dort", dir: -1, min: 12000, max: 28000 }], [{ x: 5860, y: 3127, pose: "dort", dir: -1, min: 12000, max: 28000 }]],
      styles: [{ name: "Kilim", sw: "#B5342B", patch: PATCH.cour_carpette_A }, { name: "Rayures bleues", sw: "#7FA3CF", patch: PATCH.cour_carpette_B }] },
    { id: "cour_fontaine", room: "Cour", name: "Restaurer la fontaine", short: "Fontaine", verb: "Restaurer", cost: 21, icon: "hammer", need: ["cour_dallage"], at: z5([1365, 830]),
      desc: "De l'eau claire et un petit jet. Les chats viendront s'asseoir sur le bord.",
      poi: [[p5(1340, 1066, "assis", 1), p5(1150, 955, "assis", 1)], [p5(1340, 1018, "assis", 1), p5(1140, 910, "assis", 1)]],
      styles: [{ name: "Pierre blanche", sw: "#F1EEE6", patch: PATCH.cour_fontaine_blanche }, { name: "Mosaïque", sw: "#3F6FB0", patch: PATCH.cour_fontaine_mosaique }] },
    { id: "cour_arcades", room: "Cour", name: "Restaurer les arcades", short: "Arcades", verb: "Restaurer", cost: 18, icon: "hammer", need: ["cour_desherbe"], at: z5([880, 430]),
      desc: "Fissures, briques à nu, taches : on refait tous les murs autour de la cour.",
      styles: [{ name: "Crème", sw: "#F1E7D2", patch: PATCH.cour_arcades_creme }, { name: "Ocre rose", sw: "#E3A585", patch: PATCH.cour_arcades_ocre }] },
    { id: "cour_galeries", room: "Cour", name: "Nettoyer les galeries", verb: "Nettoyer", cost: 10, icon: "broom", need: ["cour_desherbe"], at: z5([1330, 260]),
      desc: "Sous les arcades : on balaie et on installe de grandes plantes vertes.", patch: PATCH.cour_galeries },
    { id: "cour_bancs", room: "Cour", name: "Installer des bancs", short: "Bancs", verb: "Installer", cost: 13, icon: "plus", need: ["cour_dallage"], at: z5([1030, 640]),
      desc: "Deux bancs face à la fontaine. Les chats y font la sieste au soleil.",
      poi: [[p5(1050, 722, "dort", 1), p5(1715, 1062, "dort", -1)], [p5(1062, 742, "dort", 1), p5(1722, 1105, "dort", -1)]],
      styles: [{ name: "Pierre sculptée", sw: "#CFC8BA", patch: PATCH.cour_bancs_pierre }, { name: "Fer forgé", sw: "#2F5A3E", patch: PATCH.cour_bancs_fer }] },
    { id: "cour_arbres", room: "Cour", name: "Planter des arbres en bac", short: "Arbres", verb: "Planter", cost: 16, icon: "plus", need: ["cour_dallage"], at: z5([500, 640]),
      desc: "Quatre grands bacs, un dans chaque coin de la cour.",
      styles: [{ name: "Orangers", sw: "#F08A24", patch: PATCH.cour_arbres_orangers }, { name: "Lauriers-roses", sw: "#E37BA4", patch: PATCH.cour_arbres_lauriers }] },
    { id: "cour_hall", room: "Cour", name: "Déblayer le hall d'entrée", short: "Hall", verb: "Déblayer", cost: 13, icon: "broom", need: ["cour_desherbe"], at: z5([440, 1140]),
      desc: "La pièce derrière la porte du perron. Une fois propre, les chats passeront par là pour aller dans la cour.", patch: PATCH.cour_hall },
    { id: "cour_hallsol", room: "Cour", name: "Poser le sol du hall", short: "Sol du hall", verb: "Poser", cost: 16, icon: "plus", need: ["cour_hall"], at: z5([600, 1300]),
      desc: "Le premier sol qu'on voit en entrant au manoir.",
      styles: [{ name: "Marbre à cabochons", sw: "#F3F2EE", patch: PATCH.cour_hallsol_marbre }, { name: "Tomettes", sw: "#C8613E", patch: PATCH.cour_hallsol_tomettes }] },
    { id: "cour_hallmeubles", room: "Cour", name: "Meubler le hall", short: "Meubles du hall", verb: "Meubler", cost: 18, icon: "plus", need: ["cour_hallsol"], at: z5([470, 1060]),
      desc: "Une console et un miroir, ou un coin campagne avec un olivier.",
      poi: [p5(525, 1338, "assis", -1), p5(560, 1330, "dort", 1)],
      styles: [{ name: "Doré", sw: "#D9B444", patch: PATCH.cour_hallmeubles_dore }, { name: "Campagne", sw: "#9C8A63", patch: PATCH.cour_hallmeubles_campagne }] },
    { id: "cour_chats", room: "Cour", name: "Aménager la salle des chats", short: "Salle des chats", verb: "Aménager", cost: 23, icon: "plus", need: ["cour_hall"], at: z5([2150, 300]),
      desc: "Une pièce rien que pour eux : arbre à chat, étagères, coussins et jouets.",
      poi: [[p5(2228, 255, "assis", 1), p5(2075, 262, "dort", 1), p5(2095, 392, "dort", -1)],
            [p5(2375, 215, "assis", -1), p5(2322, 92, "assis", -1), p5(2190, 430, "dort", 1)]],
      styles: [{ name: "Bois naturel", sw: "#C99A62", patch: PATCH.cour_chats_bois }, { name: "Pastel", sw: "#F6C9D6", patch: PATCH.cour_chats_pastel }] },

    /* ----- Zone 2 : la grille d'entrée. Ordre d'empilement : sol, chemin, mur, massif, abri, banc, grille, lanternes. ----- */
    { id: "grille_debrousse", room: "Grille d'entrée", name: "Débroussailler l'entrée", verb: "Débroussailler", cost: 7, icon: "broom", need: ["jardin_pelouse"], at: z2([1250, 1000]),
      desc: "Lierre sur le mur, ronces, caisses cassées : l'entrée du domaine disparaît sous la friche.", patch: PATCH.grille_debrousse },
    { id: "grille_pelouse", room: "Grille d'entrée", name: "Semer la pelouse de l'entrée", verb: "Semer", cost: 8, icon: "plus", need: ["grille_debrousse"], at: z2([1500, 330]),
      desc: "Une grande pelouse de part et d'autre du mur. Tout le reste de l'entrée se posera dessus.", patch: PATCH.grille_pelouse },
    { id: "grille_chemin", room: "Grille d'entrée", name: "Refaire le chemin", short: "Chemin", verb: "Refaire", cost: 13, icon: "hammer", need: ["grille_pelouse"], at: z2([1350, 1280]),
      desc: "Le chemin de terre est défoncé jusqu'au manoir. Choisis son revêtement.",
      styles: [{ name: "Pavés clairs", sw: "#CDBF9E", patch: PATCH.chemin_paves }, { name: "Gravier doré", sw: "#E9CF8E", patch: PATCH.chemin_gravier }] },
    { id: "grille_mur", room: "Grille d'entrée", name: "Restaurer le mur", short: "Mur", verb: "Restaurer", cost: 13, icon: "hammer", need: ["grille_pelouse"], at: z2([800, 560]),
      desc: "Pierres fendues, joints partis : le mur et ses piliers ont besoin d'une vraie remise en état.",
      styles: [{ name: "Pierre claire", sw: "#EADDB8", patch: PATCH.mur_pierre }, { name: "Chaulé blanc", sw: "#F3EBDD", patch: PATCH.mur_chaule }] },
    { id: "grille_massif", room: "Grille d'entrée", name: "Planter un massif", short: "Massif", verb: "Planter", cost: 8, icon: "plus", need: ["grille_pelouse"], at: z2([860, 1010]),
      desc: "Un long massif au pied du mur, bordé de pierres.",
      styles: [{ name: "Rosiers", sw: "#E46A8C", patch: PATCH.massif_roses }, { name: "Lavande", sw: "#8A63C9", patch: PATCH.massif_lavande }] },
    { id: "grille_abri", room: "Grille d'entrée", name: "Installer un abri à chats", short: "Abri à chats", verb: "Installer", cost: 10, icon: "plus", need: ["grille_pelouse"], at: z2([1320, 800]),
      desc: "Une petite cabane avec son coussin, pour les chats qui montent la garde.",
      poi: [{ x: 3460, y: 5882, pose: "dort", dir: 1, min: 12000, max: 26000 }, { x: 3487, y: 5836, pose: "dort", dir: 1, min: 12000, max: 26000 }],
      styles: [{ name: "Bois", sw: "#8A6238", patch: PATCH.abri_bois }, { name: "Bleu pastel", sw: "#B9CDE6", patch: PATCH.abri_bleu }] },
    { id: "grille_banc", room: "Grille d'entrée", name: "Poser un banc", short: "Banc", verb: "Poser", cost: 8, icon: "plus", need: ["grille_pelouse"], at: z2([1570, 220]),
      desc: "Un banc derrière le mur, face à l'allée.",
      poi: [{ x: 3790, y: 5185, pose: "dort", dir: 1, min: 12000, max: 26000 }, { x: 3800, y: 5178, pose: "dort", dir: 1, min: 12000, max: 26000 }],
      styles: [{ name: "Bois", sw: "#B5733A", patch: PATCH.bancjardin_bois }, { name: "Fer blanc", sw: "#DAD9D2", patch: PATCH.bancjardin_fer }] },
    { id: "grille_portail", room: "Grille d'entrée", name: "Remplacer la grille", short: "Grille", verb: "Remplacer", cost: 16, icon: "hammer", need: ["grille_chemin"], at: z2([1930, 760]),
      desc: "La vieille grille rouillée ne ferme plus. La nouvelle sera la première chose qu'on voit du domaine.",
      // on voit le chemin entre les barreaux : l'image dépend du revêtement choisi
      styles: [{ name: "Noir et or", sw: "#2A2A30", patch: eff => PATCH["grille_noire_" + (eff("grille_chemin") ? "gravier" : "paves")] },
               { name: "Vert anglais", sw: "#1F5A3E", patch: eff => PATCH["grille_verte_" + (eff("grille_chemin") ? "gravier" : "paves")] }] },
    { id: "grille_lanternes", room: "Grille d'entrée", name: "Accrocher des lanternes", short: "Lanternes", verb: "Accrocher", cost: 8, icon: "plus", need: ["grille_pelouse"], at: z2([2260, 930]),
      desc: "Une lanterne sur chaque pilier de la grille.",
      styles: [{ name: "Laiton", sw: "#C9A24B", patch: PATCH.lanternes_laiton }, { name: "Fer noir", sw: "#33333A", patch: PATCH.lanternes_noires }] },
    { id: "allee_rondpoint", room: "Allée du manoir", name: "Créer un rond-point", short: "Rond-point", verb: "Créer", cost: 16, icon: "plus", need: ["allee_pelouse"], at: z3([2080, 780]),
      desc: "Un îlot planté devant le perron, pour que les voitures tournent autour.",
      styles: [{ name: "Buis et rosier", sw: "#B3262E", patch: PATCH.rondpoint_buis }, { name: "Cadran solaire", sw: "#B9B29C", patch: PATCH.rondpoint_cadran }] },
    /* Lot H (détails de l'allée) : le bassin passe sous l'arche (son bord gauche est caché par le pilier de l'arche en roses). */
    { id: "allee_bassin", room: "Allée du manoir", name: "Creuser un bassin", short: "Bassin", verb: "Creuser", cost: 36, icon: "hammer", need: ["allee_pelouse"], at: z3([1850, 270]),
      desc: "Des poissons rouges et des nénuphars, au pied du manoir. Les chats viennent les regarder.",
      dep: "allee_arche", depMap: p => (p === 0 ? 0 : 1),
      poi: [[{ x: 4034, y: 4029, pose: "assis", dir: -1, min: 12000, max: 28000 }], [{ x: 4024, y: 4039, pose: "assis", dir: -1, min: 12000, max: 28000 }]],
      styles: [{ name: "Margelle en pierre", sw: "#9A958A", patch: eff => PATCH["allee_bassin_A" + (eff("allee_arche") === 0 ? 0 : 1)] }, { name: "Bassin naturel", sw: "#5FA8A0", patch: eff => PATCH["allee_bassin_B" + (eff("allee_arche") === 0 ? 0 : 1)] }] },
    { id: "allee_arche", room: "Allée du manoir", name: "Dresser une arche fleurie", short: "Arche", verb: "Dresser", cost: 14, icon: "plus", need: ["allee_pelouse"], at: z3([1540, 330]),
      desc: "Une arche au bout du sentier du labyrinthe.",
      styles: [{ name: "Roses", sw: "#F0A9C0", patch: PATCH.arche_roses }, { name: "Glycine", sw: "#9B6AD6", patch: PATCH.arche_glycine }] },
    { id: "allee_lampadaires", room: "Allée du manoir", name: "Installer des lampadaires", short: "Lampadaires", verb: "Installer", cost: 13, icon: "plus", need: ["allee_pelouse"], at: z3([1740, 640]),
      desc: "Trois lampadaires à l'ancienne le long de l'allée.",
      styles: [{ name: "Fonte noire", sw: "#2B2B30", patch: PATCH.lampadaires_noirs }, { name: "Vert anglais", sw: "#1F5A3E", patch: PATCH.lampadaires_verts }] },
    { id: "allee_statue", room: "Allée du manoir", name: "Restaurer la statue", short: "Statue", verb: "Restaurer", cost: 12, icon: "hammer", need: ["allee_pelouse"], at: z3([2110, 1060]),
      desc: "La statue est grise de mousse et son socle est fendu.",
      styles: [{ name: "Marbre blanc", sw: "#F2EFE8", patch: PATCH.statue_marbre }, { name: "Bronze", sw: "#B8852E", patch: PATCH.statue_bronze }] },
    /* ----- Zone 6 : l'aile ouest et son jardin, à gauche du perron. À partir de cette zone, les chantiers coûtent 1,5 fois plus. Ses calques passent par-dessus ceux de l'allée.
       Les chats entrent dans la bibliothèque par le trou du mur de façade, puis vont dans la salle à manger et le hall. ----- */
    { id: "aile_debrousse", room: "Aile ouest", name: "Débroussailler le jardin de l'aile", verb: "Débroussailler", cost: 16, icon: "broom", need: ["allee_pelouse"], at: z6([820, 820]),
      desc: "Herbes folles, branches mortes, souche et arbre mort : tout part.", patch: PATCH.aile_debrousse },
    { id: "aile_pelouse", room: "Aile ouest", name: "Semer la pelouse du jardin", verb: "Semer", cost: 20, icon: "plus", need: ["aile_debrousse"], at: z6([300, 900]),
      desc: "Une belle pelouse verte jusqu'au pied du manoir.", patch: PATCH.aile_pelouse },
    { id: "aile_chemin", room: "Aile ouest", name: "Refaire le chemin du jardin", short: "Chemin du jardin", verb: "Refaire", cost: 23, icon: "hammer", need: ["aile_pelouse", "allee_chemin"], at: z6([640, 640]),
      desc: "Le vieux chemin pavé, dans le revêtement choisi à la grille.",
      patch: eff => PATCH["aile_chemin_" + (eff("grille_chemin") ? "gravier" : "paves")] },
    { id: "aile_gloriette", room: "Aile ouest", name: "Construire un kiosque", short: "Kiosque", verb: "Construire", cost: 31, icon: "plus", need: ["aile_pelouse"], at: z6([480, 330]),
      desc: "Un coin à l'ombre dans le jardin. Les chats y font la sieste.",
      poi: [p6(500, 600, "dort", 1), p6(560, 625, "dort", -1)],
      styles: [{ name: "Gloriette en fer blanc", sw: "#EDEDEA", patch: PATCH.aile_gloriette }, { name: "Pergola à glycine", sw: "#9B6AD6", patch: PATCH.aile_pergola }] },
    { id: "aile_biblio", room: "Aile ouest", name: "Déblayer la grande pièce", verb: "Déblayer", cost: 20, icon: "broom", need: ["aile_debrousse"], at: z6([1600, 700]),
      desc: "Gravats et plancher défoncé. Elle deviendra la bibliothèque, et les chats y entreront par le trou du mur.", patch: PATCH.aile_biblio },
    { id: "aile_salle", room: "Aile ouest", name: "Déblayer la salle à manger", verb: "Déblayer", cost: 20, icon: "broom", need: ["aile_debrousse"], at: z6([2250, 990]),
      desc: "La pièce à côté du hall : on nettoie et on repeint en vert tendre.", patch: PATCH.aile_salle },
    { id: "aile_facade", room: "Aile ouest", name: "Restaurer la façade de l'aile", short: "Façade de l'aile", verb: "Restaurer", cost: 27, icon: "hammer", need: ["aile_biblio"], at: z6([1450, 1010]),
      desc: "On rebouche le trou du mur et on refait les fenêtres, dans le même style que le reste du manoir.",
      patch: eff => PATCH["aile_facade_" + (eff("manoir_fenetres") ? "volets" : "blanche")] },
    { id: "aile_rayons", room: "Aile ouest", name: "Monter les rayonnages", short: "Rayonnages", verb: "Monter", cost: 31, icon: "plus", need: ["aile_biblio"], at: z6([1800, 540]),
      desc: "Des étagères pleines de livres sur les deux murs du fond, avec une échelle.",
      styles: [{ name: "Noyer", sw: "#5E3A22", patch: PATCH.aile_rayons_noyer }, { name: "Blancs", sw: "#F4F2EC", patch: PATCH.aile_rayons_blancs }] },
    { id: "aile_lecture", room: "Aile ouest", name: "Installer un coin lecture", short: "Coin lecture", verb: "Installer", cost: 27, icon: "plus", need: ["aile_biblio"], at: z6([1700, 760]),
      desc: "Un fauteuil bien profond au milieu des livres. Devine qui va s'y installer.",
      poi: [[p6(1700, 700, "dort", -1), p6(1750, 792, "dort", 1)], [p6(1490, 700, "dort", 1), p6(1850, 690, "dort", -1)]],
      styles: [{ name: "Velours vert", sw: "#1F6B45", patch: PATCH.aile_lecture_velours }, { name: "Lin crème", sw: "#F1E9D6", patch: PATCH.aile_lecture_lin }] },
    { id: "aile_atelier", room: "Aile ouest", name: "Aménager l'atelier de peinture", short: "Atelier", verb: "Aménager", cost: 31, icon: "plus", need: ["aile_biblio"], at: z6([2120, 330]),
      desc: "La petite pièce du fond, derrière la bibliothèque, devient un atelier de peintre.",
      poi: [p6(2083, 478, "assis", 1, 2458 + 536), p6(2120, 525, "dort", -1)],
      styles: [{ name: "Bohème", sw: "#D9573B", patch: PATCH.aile_atelier_boheme }, { name: "Tout blanc", sw: "#F6F4EF", patch: PATCH.aile_atelier_blanc }] },
    { id: "aile_table", room: "Aile ouest", name: "Meubler la salle à manger", short: "Salle à manger", verb: "Meubler", cost: 27, icon: "plus", need: ["aile_salle"], at: z6([2350, 880]), depth: 2458 + 1117,
      desc: "Une table, des chaises et un buffet. Les chats se cachent dessous et sautent dessus.",
      poi: [p6(2330, 1015, "assis", 1, 2458 + 1118), p6(2370, 1000, "assis", -1, 2458 + 1118)],
      styles: [{ name: "Chêne", sw: "#B07A3E", patch: PATCH.aile_table_chene }, { name: "Table ronde blanche", sw: "#F3F1EA", patch: PATCH.aile_table_ronde }] },
    /* ----- Zone 7 : l'aile est du manoir, derrière la salle des chats, et son jardin. Chantiers à 1,5 fois le prix ; calques posés à plat.
       Les chats y passent par la salle des chats : dehors vers le jardin, dedans vers la chambre, puis la cuisine et la salle de bain. ----- */
    { id: "est_debrousse", room: "Aile est", name: "Débroussailler le jardin de l'aile est", short: "Débroussailler", verb: "Débroussailler", cost: 16, icon: "broom", need: ["cour_desherbe"], at: z7([1350, 420]),
      desc: "Herbes folles, broussailles et cailloux : on dégage tout autour de l'aile.", patch: PATCH.est_debrousse },
    { id: "est_pelouse", room: "Aile est", name: "Semer la pelouse de l'aile est", short: "Pelouse", verb: "Semer", cost: 20, icon: "plus", need: ["est_debrousse"], at: z7([2050, 1250]),
      desc: "Une pelouse bien verte des deux côtés du chemin.", patch: PATCH.est_pelouse },
    { id: "est_chemin", room: "Aile est", name: "Refaire le chemin de l'aile est", short: "Chemin", verb: "Refaire", cost: 23, icon: "hammer", need: ["est_pelouse", "allee_chemin"], at: z7([1850, 700]),
      desc: "Le chemin qui longe l'aile, dans le revêtement choisi à la grille.",
      patch: eff => PATCH["est_chemin_" + (eff("grille_chemin") ? "gravier" : "paves")] },
    { id: "est_massifs", room: "Aile est", name: "Planter des massifs", short: "Massifs", verb: "Planter", cost: 23, icon: "plus", need: ["est_pelouse"], at: z7([1450, 1180]),
      desc: "Des fleurs tout le long du pied des murs.",
      styles: [{ name: "Rosiers anciens", sw: "#E58FA6", patch: PATCH.est_massifs_rosiers }, { name: "Lavande et buis", sw: "#8E6BC9", patch: PATCH.est_massifs_lavande }] },
    { id: "est_deblai", room: "Aile est", name: "Déblayer l'aile est", short: "Déblayer l'aile", verb: "Déblayer", cost: 27, icon: "broom", need: ["est_debrousse"], at: z7([1000, 800]),
      desc: "Gravats, plâtre tombé et mur effondré : on remet les trois pièces en état. Les chats y viendront depuis leur salle.", patch: PATCH.est_deblai },
    { id: "est_facade", room: "Aile est", name: "Restaurer la façade de l'aile est", short: "Façade de l'aile", verb: "Restaurer", cost: 27, icon: "hammer", need: ["est_deblai"], at: z7([850, 1230]),
      desc: "Des fenêtres neuves, dans le même style que le reste du manoir.",
      patch: eff => PATCH["est_facade_" + (eff("manoir_fenetres") ? "volets" : "blanche")] },
    { id: "est_cuisine", room: "Aile est", name: "Installer la cuisine", short: "Cuisine", verb: "Installer", cost: 35, icon: "plus", need: ["est_deblai"], at: z7([1150, 820]),
      desc: "Un fourneau, une grande table et, bien sûr, les gamelles des chats.",
      poi: [[p7(880, 885, "assis", -1), p7(1060, 872, "assis", -1), p7(1245, 935, "dort", -1)], [p7(1225, 905, "assis", 1), p7(1115, 880, "assis", 1)]],
      styles: [{ name: "Rustique", sw: "#6B4A2E", patch: PATCH.est_cuisine_rustique }, { name: "Campagne bleue", sw: "#8FB3CF", patch: PATCH.est_cuisine_bleue }] },
    { id: "est_chambre", room: "Aile est", name: "Meubler la chambre", short: "Chambre", verb: "Meubler", cost: 31, icon: "plus", need: ["est_deblai"], at: z7([560, 500]),
      desc: "Un grand lit et un panier à son pied. Devine qui dormira sur le lit quand même.",
      poi: [[p7(523, 515, "dort", -1), p7(578, 562, "dort", 1)], [p7(690, 505, "dort", -1), p7(602, 600, "dort", 1), p7(533, 470, "assis", 1)]],
      styles: [{ name: "Lit à baldaquin", sw: "#C98A9A", patch: PATCH.est_chambre_baldaquin }, { name: "Fer blanc", sw: "#EDEBE4", patch: PATCH.est_chambre_fer }] },
    { id: "est_bain", room: "Aile est", name: "Aménager la salle de bain", short: "Salle de bain", verb: "Aménager", cost: 31, icon: "plus", need: ["est_deblai"], at: z7([600, 1110]),
      desc: "Une baignoire à pattes de lion. Quand elle est vide, les chats adorent s'y rouler en boule.",
      poi: [[p7(507, 1140, "dort", 1), p7(618, 1205, "dort", -1)], [p7(498, 1136, "dort", 1), p7(700, 1160, "assis", -1)]],
      styles: [{ name: "Noir et blanc", sw: "#2E2E33", patch: PATCH.est_bain_noir }, { name: "Cuivre et zellige", sw: "#2F7D5B", patch: PATCH.est_bain_cuivre }] },
    /* ----- Zone 8 : le perron est, sous l'aile est. Zone « complète » : 7 grands chantiers et 12 détails (×1,5).
       Les objets debout ont un calque à plat (avec leur ombre) et sont redessinés seuls, triés avec les chats. ----- */
    { id: "perron_debrousse", room: "Perron est", name: "Débroussailler le jardin du perron", short: "Débroussailler", verb: "Débroussailler", cost: 16, icon: "broom", need: ["est_debrousse"], at: z8([1900, 560]),
      desc: "Herbes sèches, buisson mort et cailloux : on dégage tout devant l'entrée est.", patch: PATCH.perron_debrousse },
    { id: "perron_pelouse", room: "Perron est", name: "Semer la pelouse du perron", short: "Pelouse", verb: "Semer", cost: 20, icon: "plus", need: ["perron_debrousse"], at: z8([760, 1250]),
      desc: "Une pelouse bien tondue de part et d'autre des allées.", patch: PATCH.perron_pelouse },
    { id: "perron_chemin", room: "Perron est", name: "Refaire les allées du perron", short: "Allées", verb: "Refaire", cost: 23, icon: "hammer", need: ["perron_pelouse", "allee_chemin"], at: z8([1150, 760]),
      desc: "Les allées qui partent du perron, dans le revêtement choisi à la grille.",
      patch: eff => PATCH["perron_chemin_" + (eff("grille_chemin") ? "gravier" : "paves")] },
    { id: "perron_porte", room: "Perron est", name: "Restaurer le perron", short: "Perron", verb: "Restaurer", cost: 35, icon: "hammer", need: ["perron_debrousse"], at: z8([520, 330]),
      desc: "Colonnes, fronton, marches et une porte neuve, avec une plante en pot au pied des marches.",
      styles: [{ name: "Porte verte", sw: "#1F5E3B", patch: PATCH.perron_porte_verte }, { name: "Porte bordeaux", sw: "#7A1F45", patch: PATCH.perron_porte_bordeaux }] },
    { id: "perron_statues", room: "Perron est", name: "Sculpter des statues de chats", short: "Statues", verb: "Sculpter", cost: 31, icon: "hammer", need: ["perron_chemin"], at: z8([1460, 560]),
      desc: "Les deux vieilles statues usées laissent la place à deux chats assis.",
      styles: [{ name: "Marbre blanc", sw: "#EDEAE2", patch: eff => PATCH["perron_statues_marbre_" + (eff("grille_chemin") ? "gravier" : "paves")] },
               { name: "Bronze", sw: "#A8692E", patch: eff => PATCH["perron_statues_bronze_" + (eff("grille_chemin") ? "gravier" : "paves")] }],
      parts: [[{ patch: PATCH.perron_statues_marbre_p0, depth: 4842 }, { patch: PATCH.perron_statues_marbre_p1, depth: 4553 }], [{ patch: PATCH.perron_statues_bronze_p0, depth: 4842 }, { patch: PATCH.perron_statues_bronze_p1, depth: 4553 }]] },
    { id: "perron_banc", room: "Perron est", name: "Changer le banc", short: "Banc", verb: "Installer", cost: 23, icon: "plus", need: ["perron_pelouse"], at: z8([1180, 330]),
      desc: "Un beau banc à la place du vieux banc de bois. Les chats y font la sieste.",
      poi: [[p8(1170, 455, "dort", -1, 4270), p8(1255, 420, "assis", -1, 4270)], [p8(1180, 446, "dort", -1, 4264), p8(1110, 478, "assis", 1, 4264)]],
      styles: [{ name: "Fer forgé blanc", sw: "#F1F0EC", patch: PATCH.perron_banc_fer }, { name: "Teck et coussins", sw: "#D49A3A", patch: PATCH.perron_banc_teck }],
      parts: [[{ patch: PATCH.perron_banc_fer_p0, depth: 4269 }], [{ patch: PATCH.perron_banc_teck_p0, depth: 4263 }]] },
    { id: "perron_oiseaux", room: "Perron est", name: "Installer un bain d'oiseaux", short: "Bain d'oiseaux", verb: "Installer", cost: 27, icon: "plus", need: ["perron_pelouse"], at: z8([2230, 330]),
      desc: "De l'eau claire pour les oiseaux. Les chats viennent s'asseoir à côté pour les guetter.",
      poi: [p8(2140, 572, "assis", 1), p8(2115, 572, "assis", 1)],
      styles: [{ name: "Pierre", sw: "#CFCBC0", patch: PATCH.perron_oiseaux_pierre }, { name: "Céramique bleue", sw: "#3A6FB8", patch: PATCH.perron_oiseaux_ceramique }],
      parts: [[{ patch: PATCH.perron_oiseaux_pierre_p0, depth: 4247 }], [{ patch: PATCH.perron_oiseaux_ceramique_p0, depth: 4247 }]] },
    { id: "perron_lampadaires", room: "Perron est", name: "Poser des lampadaires", short: "Lampadaires", verb: "Poser", cost: 23, icon: "plus", need: ["perron_chemin"], at: z8([1420, 200]),
      desc: "Quelques lampadaires le long de l'allée, pour les soirées au jardin.",
      styles: [{ name: "Fer noir", sw: "#2B2B2E", patch: PATCH.perron_lampadaires_naturel }, { name: "Vert sauge", sw: "#6F8F6A", patch: PATCH.perron_lampadaires_vert }],
      parts: [[{ patch: PATCH.perron_lampadaires_naturel_p0, depth: 4568 }, { patch: PATCH.perron_lampadaires_naturel_p1, depth: 4347 }, { patch: PATCH.perron_lampadaires_naturel_p2, depth: 4105 }, { patch: PATCH.perron_lampadaires_naturel_p3, depth: 3926 }], [{ patch: PATCH.perron_lampadaires_vert_p0, depth: 4333 }, { patch: PATCH.perron_lampadaires_vert_p1, depth: 4099 }, { patch: PATCH.perron_lampadaires_vert_p2, depth: 3944 }]] },
    { id: "perron_treillage", room: "Perron est", name: "Planter un rosier grimpant", short: "Rosier grimpant", verb: "Planter", cost: 20, icon: "plus", need: ["perron_pelouse"], at: z8([230, 470]),
      desc: "Un treillage contre le mur du manoir, couvert de roses.",
      styles: [{ name: "Roses roses", sw: "#E88AA6", patch: PATCH.perron_treillage_naturel }, { name: "Roses blanches", sw: "#F4F2EA", patch: PATCH.perron_treillage_vert }] },
    { id: "perron_nichoir", room: "Perron est", name: "Accrocher un nichoir", short: "Nichoir", verb: "Accrocher", cost: 16, icon: "plus", need: ["perron_pelouse"], at: z8([1930, 380]),
      desc: "Un nichoir sur un grand piquet. Les chats le surveillent de près.",
      poi: [[p8(1805, 708, "assis", 1)], [p8(1900, 676, "assis", 1)]],
      styles: [{ name: "Bois naturel", sw: "#9A6B3E", patch: PATCH.perron_nichoir_naturel }, { name: "Bleu ciel", sw: "#8CC4EA", patch: PATCH.perron_nichoir_vert }],
      parts: [[{ patch: PATCH.perron_nichoir_naturel_p0, depth: 4410 }], [{ patch: PATCH.perron_nichoir_vert_p0, depth: 4374 }]] },
    { id: "perron_pots", room: "Perron est", name: "Fleurir le pied des statues", short: "Pots de fleurs", verb: "Fleurir", cost: 16, icon: "plus", need: ["perron_statues"], at: z8([1000, 1110]),
      desc: "Un pot de fleurs au pied de chaque statue.",
      styles: [{ name: "Géraniums", sw: "#D8343A", patch: PATCH.perron_pots_naturel }, { name: "Marguerites", sw: "#F7F5EE", patch: PATCH.perron_pots_vert }],
      parts: [[{ patch: PATCH.perron_pots_naturel_p0, depth: 4555 }, { patch: PATCH.perron_pots_naturel_p1, depth: 4862 }], [{ patch: PATCH.perron_pots_vert_p0, depth: 4561 }, { patch: PATCH.perron_pots_vert_p1, depth: 4851 }]] },
    { id: "perron_brouette", room: "Perron est", name: "Garer une brouette fleurie", short: "Brouette", verb: "Installer", cost: 20, icon: "plus", need: ["perron_pelouse"], at: z8([1620, 760]),
      desc: "Une vieille brouette pleine de fleurs. Devine qui va dormir dedans.",
      poi: [[p8(1590, 830, "dort", -1, 4667)], [p8(1580, 838, "dort", -1, 4665)]],
      styles: [{ name: "Bois et fleurs jaunes", sw: "#E9C238", patch: PATCH.perron_brouette_naturel }, { name: "Bleue et fleurs blanches", sw: "#5E86C2", patch: PATCH.perron_brouette_vert }],
      parts: [[{ patch: PATCH.perron_brouette_naturel_p0, depth: 4666 }], [{ patch: PATCH.perron_brouette_vert_p0, depth: 4664 }]] },
    { id: "perron_arbre", room: "Perron est", name: "Monter un arbre à chat d'extérieur", short: "Arbre à chat", verb: "Monter", cost: 23, icon: "plus", need: ["perron_pelouse"], at: z8([650, 1130]),
      desc: "Un arbre à chat avec un petit toit, pour faire la sieste au jardin.",
      poi: [[p8(603, 1258, "dort", -1, 5117)], [p8(1318, 1368, "dort", -1, 5189)]],
      styles: [{ name: "Bois et sisal", sw: "#B98552", patch: PATCH.perron_arbre_naturel }, { name: "Blanc et bleu", sw: "#F2F2F0", patch: PATCH.perron_arbre_vert }],
      parts: [[{ patch: PATCH.perron_arbre_naturel_p0, depth: 5116 }], [{ patch: PATCH.perron_arbre_vert_p0, depth: 5188 }]] },
    { id: "perron_jardiniere", room: "Perron est", name: "Accrocher une jardinière", short: "Jardinière", verb: "Accrocher", cost: 16, icon: "plus", need: ["perron_porte"], at: z8([150, 560]),
      desc: "Des fleurs sous la fenêtre, à gauche du perron.",
      styles: [{ name: "Géraniums", sw: "#E46C8A", patch: PATCH.perron_jardiniere_naturel }, { name: "Lavande", sw: "#8E7BD0", patch: PATCH.perron_jardiniere_bleu }] },
    { id: "perron_paillasson", room: "Perron est", name: "Poser un paillasson", short: "Paillasson", verb: "Poser", cost: 12, icon: "plus", need: ["perron_porte"], at: z8([560, 520]),
      desc: "Un paillasson devant la porte. Le coin préféré des chats pour attendre qu'on ouvre.",
      poi: [p8(560, 575, "dort", -1)],
      styles: [{ name: "Fibre de coco", sw: "#C8A15C", patch: PATCH.perron_paillasson_naturel }, { name: "Rayé noir et blanc", sw: "#2E2E33", patch: PATCH.perron_paillasson_bleu }] },
    { id: "perron_gamelles", room: "Perron est", name: "Poser des gamelles", short: "Gamelles", verb: "Poser", cost: 12, icon: "plus", need: ["perron_porte"], at: z8([560, 870]),
      desc: "De l'eau et des croquettes au pied du perron.",
      poi: [[p8(652, 866, "assis", -1)], [p8(690, 905, "assis", -1)]],
      styles: [{ name: "Céramique crème", sw: "#EFE3C8", patch: PATCH.perron_gamelles_naturel }, { name: "Émail bleu", sw: "#3F6FB5", patch: PATCH.perron_gamelles_bleu }] },
    { id: "perron_arrosoir", room: "Perron est", name: "Ranger l'arrosoir et les pots", short: "Arrosoir", verb: "Ranger", cost: 16, icon: "plus", need: ["perron_porte"], at: z8([930, 470]),
      desc: "Un arrosoir et une pile de pots à côté des marches.",
      styles: [{ name: "Zinc et terre cuite", sw: "#B9BCC0", patch: PATCH.perron_arrosoir_naturel }, { name: "Émail bleu", sw: "#4C7DC4", patch: PATCH.perron_arrosoir_bleu }],
      parts: [[{ patch: PATCH.perron_arrosoir_naturel_p0, depth: 4347 }], [{ patch: PATCH.perron_arrosoir_bleu_p0, depth: 4340 }]] },
    { id: "perron_gueridon", room: "Perron est", name: "Poser un guéridon", short: "Guéridon", verb: "Poser", cost: 16, icon: "plus", need: ["perron_banc"], at: z8([1380, 280]),
      desc: "Une petite table à côté du banc, pour le thé ou la citronnade.",
      styles: [{ name: "Teck", sw: "#A87444", patch: PATCH.perron_gueridon_naturel }, { name: "Fer blanc", sw: "#F1F0EC", patch: PATCH.perron_gueridon_bleu }],
      parts: [[{ patch: PATCH.perron_gueridon_naturel_p0, depth: 4119 }], [{ patch: PATCH.perron_gueridon_bleu_p0, depth: 4125 }]] },
    { id: "perron_olivier", room: "Perron est", name: "Planter un arbre en pot", short: "Arbre en pot", verb: "Planter", cost: 20, icon: "plus", need: ["perron_porte"], at: z8([340, 640]),
      desc: "Un grand pot au coin du perron.",
      styles: [{ name: "Olivier", sw: "#8FA889", patch: PATCH.perron_olivier_naturel }, { name: "Citronnier", sw: "#E8D23A", patch: PATCH.perron_olivier_bleu }],
      parts: [[{ patch: PATCH.perron_olivier_naturel_p0, depth: 4531 }], [{ patch: PATCH.perron_olivier_bleu_p0, depth: 4521 }]] },
    /* ----- Détails de la maison du gardien et de son jardin (ajoutés après coup, sans cadenas). Le tunnel, les bacs du potager
       et la cabane ne bloquent pas les chats : ils passent dedans ou derrière, cachés le temps de traverser. ----- */
    { id: "gardien_murs", room: "Maison du gardien", name: "Ravaler les murs extérieurs", short: "Murs extérieurs", verb: "Ravaler", cost: 27, icon: "hammer", need: ["jardin_debrousse"], at: g([700, 1000]),
      desc: "Fissures, briques à nu et herbes sèches : on refait les murs de la maison en pierre blanchie.", patch: PATCH.gardien_murs_pierre },
    { id: "gardien_etagere", room: "Maison du gardien", name: "Accrocher une étagère", short: "Étagère du salon", verb: "Accrocher", cost: 13, icon: "plus", need: ["salon_murs"], at: g([710, 620]),
      desc: "Quelques livres et une plante au mur du salon.",
      styles: [{ name: "Bois naturel", sw: "#B07A46", patch: PATCH.gardien_etagere_naturel }, { name: "Blanche et colorée", sw: "#F2F0EA", patch: PATCH.gardien_etagere_colore }] },
    { id: "gardien_table", room: "Maison du gardien", name: "Poser une table basse", short: "Table basse", verb: "Poser", cost: 16, icon: "plus", need: ["salon_sol"], at: g([1380, 600]),
      desc: "Devant le canapé. Les chats s'y assoient au milieu des tasses.",
      poi: [[{ x: 1335, y: 4916 + 648, pose: "assis", dir: 1, depth: 4916 + 716, min: 8000, max: 20000 }], [{ x: 1425, y: 4916 + 660, pose: "assis", dir: -1, depth: 4916 + 716, min: 8000, max: 20000 }]],
      styles: [{ name: "Bois rond", sw: "#A9774A", patch: PATCH.gardien_table_naturel }, { name: "Jaune moutarde", sw: "#E2B13C", patch: PATCH.gardien_table_colore }],
      parts: [[{ patch: PATCH.gardien_table_naturel_p0, depth: 5630 }], [{ patch: PATCH.gardien_table_colore_p0, depth: 5631 }]] },
    { id: "gardien_tunnel", room: "Maison du gardien", name: "Installer un tunnel pour chat", short: "Tunnel", verb: "Installer", cost: 12, icon: "plus", need: ["salon_sol"], at: g([980, 860]),
      desc: "Un tunnel en tissu sur le parquet. Les chats passent dedans en courant.",
      styles: [{ name: "Lin beige", sw: "#E3D5B8", patch: PATCH.gardien_tunnel_naturel }, { name: "Rayé rouge", sw: "#D5433F", patch: PATCH.gardien_tunnel_colore }],
      parts: [[{ patch: PATCH.gardien_tunnel_naturel_p0, depth: 5854 }], [{ patch: PATCH.gardien_tunnel_colore_p0, depth: 5858 }]] },
    { id: "gardien_etagerecuisine", room: "Maison du gardien", name: "Monter une étagère de cuisine", short: "Étagère de cuisine", verb: "Monter", cost: 13, icon: "plus", need: ["cuisine_murs"], at: g([1950, 560]),
      desc: "Des bocaux et des herbes aromatiques au-dessus du plan de travail.",
      styles: [{ name: "Bois et bocaux", sw: "#B48A55", patch: PATCH.gardien_etagerecuisine_naturel }, { name: "Bleue et faïence", sw: "#5A8FC9", patch: PATCH.gardien_etagerecuisine_colore }] },
    { id: "gardien_portemanteau", room: "Maison du gardien", name: "Installer un porte-manteau", short: "Porte-manteau", verb: "Installer", cost: 12, icon: "plus", need: ["entree_sol"], at: g([1400, 1000]),
      desc: "Pour les manteaux et le parapluie, près de la porte.",
      styles: [{ name: "Bois", sw: "#9B7448", patch: PATCH.gardien_portemanteau_naturel }, { name: "Métal noir", sw: "#2E2E33", patch: PATCH.gardien_portemanteau_colore }],
      parts: [[{ patch: PATCH.gardien_portemanteau_naturel_p0, depth: 6099 }], [{ patch: PATCH.gardien_portemanteau_colore_p0, depth: 6100 }]] },
    { id: "gardien_mangeoire", room: "Jardin du gardien", name: "Suspendre une mangeoire", short: "Mangeoire", verb: "Suspendre", cost: 12, icon: "plus", need: ["jardin_arbre"], at: g([1000, 240]),
      desc: "Une mangeoire pour les oiseaux, accrochée au grand arbre. Les chats lèvent le nez.",
      styles: [{ name: "Bois", sw: "#9A6B3E", patch: PATCH.gardien_mangeoire_naturel }, { name: "Bleu ciel", sw: "#7FB8DE", patch: PATCH.gardien_mangeoire_colore }] },
    { id: "gardien_tablejardin", room: "Jardin du gardien", name: "Installer une table de jardin", short: "Table de jardin", verb: "Installer", cost: 18, icon: "plus", need: ["jardin_pelouse"], at: g([300, 700]),
      desc: "Une table et deux chaises sur la pelouse. Devine qui fera la sieste dessus.",
      poi: [[{ x: 300, y: 4916 + 770, pose: "dort", dir: 1, depth: 4916 + 896, min: 15000, max: 35000 }], [{ x: 300, y: 4916 + 752, pose: "dort", dir: 1, depth: 4916 + 891, min: 15000, max: 35000 }]],
      styles: [{ name: "Bois", sw: "#A87A4C", patch: PATCH.gardien_tablejardin_naturel }, { name: "Bistrot vert d'eau", sw: "#9ADBC3", patch: PATCH.gardien_tablejardin_colore }],
      parts: [[{ patch: PATCH.gardien_tablejardin_naturel_p0, depth: 5810 }], [{ patch: PATCH.gardien_tablejardin_colore_p0, depth: 5805 }]] },
    { id: "gardien_potager", room: "Jardin du gardien", name: "Faire un petit potager", short: "Potager", verb: "Planter", cost: 20, icon: "plus", need: ["jardin_pelouse"], at: g([2450, 700]),
      desc: "Deux carrés de légumes à côté de la maison.",
      styles: [{ name: "Laitues et tomates", sw: "#5FA34A", patch: PATCH.gardien_potager_naturel }, { name: "Laitues et fraises", sw: "#E0474C", patch: PATCH.gardien_potager_colore }],
      parts: [[{ patch: PATCH.gardien_potager_naturel_p0, depth: 5723 }, { patch: PATCH.gardien_potager_naturel_p1, depth: 5822 }], [{ patch: PATCH.gardien_potager_colore_p0, depth: 5823 }, { patch: PATCH.gardien_potager_colore_p1, depth: 5789 }, { patch: PATCH.gardien_potager_colore_p2, depth: 5840 }]] },
    { id: "gardien_cabane", room: "Jardin du gardien", name: "Construire une cabane à outils", short: "Cabane", verb: "Construire", cost: 23, icon: "hammer", need: ["jardin_pelouse"], at: g([2000, 230]),
      desc: "Une petite cabane au fond du jardin, avec un pot de fleurs à la porte.",
      styles: [{ name: "Bois brut", sw: "#8A6440", patch: PATCH.gardien_cabane_naturel }, { name: "Bleu pastel", sw: "#A9C9E2", patch: PATCH.gardien_cabane_colore }],
      parts: [[{ patch: PATCH.gardien_cabane_naturel_p0, depth: 5344 }], [{ patch: PATCH.gardien_cabane_colore_p0, depth: 5475 }]] },
    { id: "gardien_dalles", room: "Jardin du gardien", name: "Poser des pas japonais", short: "Pas japonais", verb: "Poser", cost: 13, icon: "plus", need: ["jardin_fontaine"], at: g([1700, 1380]),
      desc: "Des pierres dans la pelouse, jusqu'à la fontaine.",
      styles: [{ name: "Galets ronds", sw: "#BDB6A8", patch: PATCH.gardien_dalles_naturel }, { name: "Dalles carrées", sw: "#E6DCC3", patch: PATCH.gardien_dalles_colore }] },
    { id: "gardien_lanternes", room: "Jardin du gardien", name: "Poser des lanternes", short: "Lanternes", verb: "Poser", cost: 16, icon: "plus", need: ["jardin_allee"], at: g([760, 1220]),
      desc: "De petites lanternes le long de l'allée.",
      styles: [{ name: "Noires", sw: "#2B2B2E", patch: PATCH.gardien_lanternes_naturel }, { name: "Blanches", sw: "#F2F2EE", patch: PATCH.gardien_lanternes_colore }],
      parts: [[{ patch: PATCH.gardien_lanternes_naturel_p0, depth: 6096 }, { patch: PATCH.gardien_lanternes_naturel_p1, depth: 6196 }, { patch: PATCH.gardien_lanternes_naturel_p2, depth: 6344 }], [{ patch: PATCH.gardien_lanternes_colore_p0, depth: 6100 }, { patch: PATCH.gardien_lanternes_colore_p1, depth: 6201 }, { patch: PATCH.gardien_lanternes_colore_p2, depth: 6245 }, { patch: PATCH.gardien_lanternes_colore_p3, depth: 6354 }]] },
    /* ----- Détails du manoir (zone C4 : salon, bureau, façade, pelouse) et de la cour d'honneur (C3), ajoutés après coup, sans cadenas.
       La haie et la jardinière de la cour ne bloquent pas les chats : ils passent derrière, cachés le temps de traverser. ----- */
    { id: "manoir_coussin", room: "Manoir", name: "Poser un coussin devant la cheminée", short: "Coussin", verb: "Poser", cost: 12, icon: "plus", need: ["manoir_cheminee"], at: z4([1410, 615]),
      desc: "Un gros coussin rond devant le feu. Devine qui va dormir dessus.",
      poi: [[p4(1410, 634, "dort", 1, 4368)], [p4(1428, 644, "dort", 1, 4370)]],
      styles: [{ name: "Velours bordeaux", sw: "#7E1F33", patch: PATCH.manoir_coussin_velours }, { name: "Tricot crème", sw: "#EADFC4", patch: PATCH.manoir_coussin_tricot }],
      // redessiné trié avec les chats : sinon le pied du fauteuil (et son bout de tapis) passe par-dessus
      parts: [[{ patch: PATCH.manoir_coussin_velours, depth: 4367 }], [{ patch: PATCH.manoir_coussin_tricot, depth: 4369 }]] },
    { id: "manoir_tableau", room: "Manoir", name: "Accrocher un tableau", short: "Tableau", verb: "Accrocher", cost: 13, icon: "plus", need: ["manoir_murs"], at: z4([1815, 440]),
      desc: "Un grand tableau au-dessus du canapé.",
      styles: [{ name: "Paysage doré", sw: "#C9A23A", patch: PATCH.manoir_tableau_paysage }, { name: "Planche botanique", sw: "#F3F1E8", patch: PATCH.manoir_tableau_botanique }] },
    { id: "manoir_manteau", room: "Manoir", name: "Décorer la cheminée", short: "Déco de cheminée", verb: "Décorer", cost: 13, icon: "plus", need: ["manoir_cheminee"], at: z4([1300, 370]),
      desc: "Quelques objets sur le manteau de la cheminée.",
      styles: [{ name: "Pendule dorée", sw: "#D4AE3E", patch: eff => eff("manoir_cheminee") === 1 ? PATCH.manoir_manteau_pendule_pierre : PATCH.manoir_manteau_pendule },
               { name: "Pivoines", sw: "#E58FB0", patch: eff => eff("manoir_cheminee") === 1 ? PATCH.manoir_manteau_pivoines_pierre : PATCH.manoir_manteau_pivoines }] },
    { id: "manoir_globe", room: "Manoir", name: "Installer un globe", short: "Globe", verb: "Installer", cost: 12, icon: "plus", need: ["manoir_bureau"], at: z4([2000, 215]),
      desc: "Un globe terrestre sur pied, dans le bureau.",
      styles: [{ name: "Bois ancien", sw: "#9C7A3C", patch: eff => eff("manoir_bureau") === 1 ? PATCH.manoir_globe_bois_blanc : PATCH.manoir_globe_bois },
               { name: "Bleu pastel", sw: "#9CC7E6", patch: eff => eff("manoir_bureau") === 1 ? PATCH.manoir_globe_pastel_blanc : PATCH.manoir_globe_pastel }] },
    { id: "cour_tapis", room: "Cour", name: "Dérouler un tapis de couloir", short: "Tapis", verb: "Dérouler", cost: 10, icon: "plus", need: ["cour_hall"], at: z4([995, 315]),
      desc: "Un long tapis dans la petite pièce à côté du hall.",
      styles: [{ name: "Rouge et or", sw: "#A3242C", patch: PATCH.cour_tapis_rouge }, { name: "Sauge et crème", sw: "#8FA27E", patch: PATCH.cour_tapis_sauge }] },
    { id: "manoir_regarnie", room: "Manoir", name: "Regarnir la pelouse", short: "Pelouse", verb: "Regarnir", cost: 13, icon: "broom", need: ["manoir_pelouse"], at: z4([780, 850]),
      desc: "Il reste des plaques de terre dans la pelouse : on ressème.", patch: PATCH.manoir_regarnie },
    { id: "manoir_jardinieres", room: "Manoir", name: "Fleurir les fenêtres", short: "Jardinières", verb: "Fleurir", cost: 17, icon: "plus", need: ["manoir_fenetres"], at: z4([1075, 800]),
      desc: "Une jardinière sous chaque fenêtre de la façade.",
      styles: [{ name: "Géraniums", sw: "#D8343A", patch: PATCH.manoir_jardinieres_geraniums }, { name: "Lavande et marguerites", sw: "#8E7BD0", patch: PATCH.manoir_jardinieres_lavande }] },
    { id: "manoir_haie", room: "Manoir", name: "Planter le long de la façade", short: "Pied de façade", verb: "Planter", cost: 20, icon: "plus", need: ["manoir_pelouse"], at: z4([640, 640]),
      desc: "Les buissons secs au pied des murs laissent la place à une vraie bordure.",
      styles: [{ name: "Buis taillé", sw: "#4F7A35", patch: PATCH.manoir_haie_buis }, { name: "Hortensias", sw: "#8FA6E0", patch: PATCH.manoir_haie_hortensias }] },
    { id: "manoir_banc", room: "Manoir", name: "Installer un banc", short: "Banc", verb: "Installer", cost: 17, icon: "plus", need: ["manoir_pelouse"], at: z4([1100, 1170]),
      desc: "Un banc sur la pelouse, face au chemin. Parfait pour une sieste au soleil.",
      poi: [[p4(1090, 1180, "dort", 1, 5068)], [p4(1065, 1210, "dort", 1, 5052)]],
      styles: [{ name: "Bois vert", sw: "#2F5A3E", patch: PATCH.manoir_banc_bois }, { name: "Fer blanc", sw: "#F1F0EC", patch: PATCH.manoir_banc_fer }],
      parts: [[{ patch: PATCH.manoir_banc_bois_p0, depth: 5067 }], [{ patch: PATCH.manoir_banc_fer_p0, depth: 5051 }]] },
    { id: "manoir_vasques", room: "Manoir", name: "Poser deux grands pots", short: "Grands pots", verb: "Poser", cost: 20, icon: "plus", need: ["manoir_pelouse"], at: z4([380, 660]),
      desc: "Un de chaque côté de la pelouse.",
      styles: [{ name: "Vasques de buis", sw: "#A9A6A0", patch: PATCH.manoir_vasques_pierre }, { name: "Citronniers", sw: "#F2D33A", patch: PATCH.manoir_vasques_citronniers }],
      parts: [[{ patch: PATCH.manoir_vasques_pierre_p0, depth: 4510 }, { patch: PATCH.manoir_vasques_pierre_p1, depth: 4648 }], [{ patch: PATCH.manoir_vasques_citronniers_p0, depth: 4414 }, { patch: PATCH.manoir_vasques_citronniers_p1, depth: 4662 }]] },
    { id: "manoir_niche", room: "Manoir", name: "Construire une maison pour chat", short: "Maison pour chat", verb: "Construire", cost: 17, icon: "hammer", need: ["manoir_pelouse"], at: z4([1630, 1120]),
      desc: "Une petite maison au coin du salon. Les chats montent la garde devant.",
      poi: [p4(1752, 1249, "assis", -1)],
      styles: [{ name: "Bois", sw: "#B98552", patch: PATCH.manoir_niche_bois }, { name: "Bleu pâle", sw: "#B9D0E4", patch: PATCH.manoir_niche_bleue }],
      parts: [[{ patch: PATCH.manoir_niche_bois_p0, depth: 4942 }], [{ patch: PATCH.manoir_niche_bleue_p0, depth: 4942 }]] },
    { id: "manoir_arbre", room: "Manoir", name: "Planter un petit arbre", short: "Petit arbre", verb: "Planter", cost: 21, icon: "plus", need: ["manoir_pelouse"], at: z4([2510, 1230]),
      desc: "Un arbre au bord du chemin, en bas de la pelouse.",
      styles: [{ name: "Érable du Japon", sw: "#B8382E", patch: PATCH.manoir_arbre_erable }, { name: "Magnolia", sw: "#F2C4CF", patch: PATCH.manoir_arbre_magnolia }],
      parts: [[{ patch: PATCH.manoir_arbre_erable_p0, depth: 5136 }], [{ patch: PATCH.manoir_arbre_magnolia_p0, depth: 5167 }]] },
    { id: "manoir_plante", room: "Manoir", name: "Poser un figuier en pot", short: "Figuier", verb: "Poser", cost: 18, icon: "plus", need: ["manoir_pelouse"], at: z4([2090, 760]),
      desc: "Un grand figuier lyre dans un pot émaillé, contre le mur du salon.", patch: PATCH.manoir_plante_figuier,
      parts: [[{ patch: PATCH.manoir_plante_figuier_p0, depth: 4695 }]] },
    { id: "cour_bistro", room: "Cour", name: "Installer une table de bistrot", short: "Table de bistrot", verb: "Installer", cost: 20, icon: "plus", need: ["cour_dallage"], at: z5([1060, 1010]),
      desc: "Une petite table et deux chaises près de la fontaine.",
      styles: [{ name: "Fer noir", sw: "#2B2B2E", patch: PATCH.cour_bistro_terre }, { name: "Blanc et bleu", sw: "#4C7DC4", patch: PATCH.cour_bistro_blanc }],
      parts: [[{ patch: PATCH.cour_bistro_terre_p0, depth: 3679 }], [{ patch: PATCH.cour_bistro_blanc_p0, depth: 3646 }]] },
    { id: "cour_pots", room: "Cour", name: "Fleurir la fontaine", short: "Pots de fleurs", verb: "Fleurir", cost: 13, icon: "plus", need: ["cour_fontaine"], at: z5([1570, 740]),
      desc: "Trois pots de géraniums autour du bassin.",
      styles: [{ name: "Terre cuite", sw: "#C8613E", patch: PATCH.cour_pots_terre }, { name: "Faïence bleue", sw: "#3A6FB8", patch: PATCH.cour_pots_blanc }],
      parts: [[{ patch: PATCH.cour_pots_terre_p0, depth: 3445 }, { patch: PATCH.cour_pots_terre_p1, depth: 3315 }, { patch: PATCH.cour_pots_terre_p2, depth: 3147 }], [{ patch: PATCH.cour_pots_blanc_p0, depth: 3432 }, { patch: PATCH.cour_pots_blanc_p1, depth: 3289 }, { patch: PATCH.cour_pots_blanc_p2, depth: 3449 }]] },
    { id: "cour_panier", room: "Cour", name: "Poser un panier pour chat", short: "Panier", verb: "Poser", cost: 12, icon: "plus", need: ["cour_dallage"], at: z5([1990, 790]),
      desc: "Un panier au soleil, dans un coin de la cour.",
      poi: [[p5(1999, 818, "dort", -1)], [p5(1992, 842, "dort", -1)]],
      styles: [{ name: "Osier", sw: "#C49A5A", patch: PATCH.cour_panier_osier }, { name: "Blanc rayé", sw: "#7FA3D6", patch: PATCH.cour_panier_blanc }] },
    { id: "cour_lanternes", room: "Cour", name: "Accrocher des lanternes", short: "Lanternes", verb: "Accrocher", cost: 17, icon: "plus", need: ["cour_arcades"], at: z5([1150, 250]),
      desc: "Une lanterne sous chaque arche.",
      styles: [{ name: "Fer noir", sw: "#2B2B2E", patch: PATCH.cour_lanternes_fer }, { name: "Blanches", sw: "#F2F2EE", patch: PATCH.cour_lanternes_blanc }] },
    { id: "cour_jardiniere", room: "Cour", name: "Planter une jardinière", short: "Jardinière", verb: "Planter", cost: 16, icon: "plus", need: ["cour_dallage"], at: z5([890, 540]),
      desc: "Une longue jardinière au pied du mur du fond.",
      styles: [{ name: "Lavande", sw: "#8E7BD0", patch: PATCH.cour_jardiniere_lavande }, { name: "Agapanthes", sw: "#4F6FD0", patch: PATCH.cour_jardiniere_agapanthes }],
      parts: [[{ patch: PATCH.cour_jardiniere_lavande_p0, depth: 3140 }], [{ patch: PATCH.cour_jardiniere_agapanthes_p0, depth: 3237 }]] },
    { id: "cour_fauteuil", room: "Cour", name: "Installer un fauteuil", short: "Fauteuil", verb: "Installer", cost: 17, icon: "plus", need: ["cour_dallage"], at: z5([1450, 500]),
      desc: "Un fauteuil confortable près de la fontaine. Il ne restera pas libre longtemps.",
      poi: [[p5c(1435, 540, "dort", -1, 3106)], [p5c(1465, 545, "dort", -1, 3102)]],
      styles: [{ name: "Rotin", sw: "#C49A5A", patch: PATCH.cour_fauteuil_rotin }, { name: "Bois blanc", sw: "#F2F1EC", patch: PATCH.cour_fauteuil_blanc }],
      parts: [[{ patch: PATCH.cour_fauteuil_rotin_p0, depth: 3105 }], [{ patch: PATCH.cour_fauteuil_blanc_p0, depth: 3101 }]] },
    /* ----- Zone 9 : l'étang et le hangar à bateaux (fenêtre monde x 6900..10540, y 450..2498 ; images agrandies ×4/3). Cadenas : 9e zone payante. ----- */
    { id: "etang_debrousse", room: "Étang", name: "Débroussailler les berges", short: "Débroussailler", verb: "Débroussailler", cost: 18, icon: "broom", need: ["est_pelouse"], at: z9([1200, 1960]),
      desc: "Branches mortes, herbes sèches et feuilles : on dégage le tour de l'étang.", patch: PATCH.etang_debrousse },
    { id: "etang_pelouse", room: "Étang", name: "Semer la pelouse des berges", short: "Pelouse", verb: "Semer", cost: 21, icon: "plus", need: ["etang_debrousse"], at: z9([870, 380]),
      desc: "Une herbe bien verte tout autour de l'eau.", patch: PATCH.etang_pelouse },
    { id: "etang_eau", room: "Étang", name: "Nettoyer l'étang", short: "Eau claire", verb: "Nettoyer", cost: 29, icon: "broom", need: ["etang_pelouse"], at: z9([1330, 1200]),
      desc: "Plus de vase ni de vieux piquets : une eau claire et des nénuphars en fleurs.", patch: PATCH.etang_eau },
    { id: "etang_chemin", room: "Étang", name: "Paver le tour de l'étang", short: "Chemin", verb: "Paver", cost: 26, icon: "hammer", need: ["etang_pelouse", "grille_chemin"], at: z9([3400, 1530]),
      desc: "Le chemin longe l'étang jusqu'au hangar, dans le même revêtement que l'entrée.",
      patch: eff => PATCH["etang_chemin_" + (eff("grille_chemin") ? "gravier" : "paves")] },
    { id: "etang_ponton", room: "Étang", name: "Reconstruire le ponton", short: "Ponton", verb: "Reconstruire", cost: 31, icon: "hammer", need: ["etang_eau"], at: z9([1730, 1730]),
      desc: "Un ponton tout neuf où les chats viennent regarder les poissons.",
      poi: [[p9(1700, 1124, "assis", 1)], [p9(1492, 1492, "assis", -1)]],
      styles: [{ name: "Bois naturel", sw: "#C98A3E", patch: PATCH.etang_ponton_bois }, { name: "Blanc et bleu marine", sw: "#2B3F73", patch: PATCH.etang_ponton_blanc }] },
    { id: "etang_hangar", room: "Étang", name: "Rebâtir le hangar à bateaux", short: "Hangar", verb: "Rebâtir", cost: 39, icon: "hammer", need: ["etang_eau"], at: z9([2870, 540]),
      desc: "Des planches neuves, des fenêtres et un ponton solide devant.",
      styles: [{ name: "Bois et volets verts", sw: "#C98A3E", patch: PATCH.etang_hangar_bois }, { name: "Rouge suédois", sw: "#A8322D", patch: PATCH.etang_hangar_rouge }] },
    { id: "etang_canards", room: "Étang", name: "Mettre une maison des canards", short: "Maison des canards", verb: "Mettre", cost: 18, icon: "plus", need: ["etang_eau"], at: z9([1280, 1090]),
      desc: "Une petite maison qui flotte au milieu des nénuphars.",
      styles: [{ name: "Toit rouge", sw: "#A8322D", patch: PATCH.etang_canards_naturel }, { name: "Toit bleu", sw: "#3A6FB8", patch: PATCH.etang_canards_blanc }] },
    { id: "etang_barque", room: "Étang", name: "Amarrer une barque", short: "Barque", verb: "Amarrer", cost: 21, icon: "plus", need: ["etang_hangar"], at: z9([2240, 1120]),
      desc: "Une petite barque attachée au ponton du hangar.",
      styles: [{ name: "Bois verni", sw: "#8B4A2B", patch: PATCH.etang_barque_naturel }, { name: "Blanche à rayure bleue", sw: "#3A6FB8", patch: PATCH.etang_barque_blanc }] },
    { id: "etang_lanternes", room: "Étang", name: "Éclairer le ponton du hangar", short: "Lanternes", verb: "Éclairer", cost: 18, icon: "plus", need: ["etang_hangar"], at: z9([1975, 830]),
      desc: "Deux lanternes au bout du ponton du hangar.",
      styles: [{ name: "Fer noir", sw: "#2B2B2E", patch: PATCH.etang_lanternes_naturel }, { name: "Blanches", sw: "#F2F2EE", patch: PATCH.etang_lanternes_blanc }],
      parts: [[{ patch: PATCH.etang_lanternes_naturel_p0, depth: 1382 }, { patch: PATCH.etang_lanternes_naturel_p1, depth: 1469 }], [{ patch: PATCH.etang_lanternes_blanc_p0, depth: 1330 }, { patch: PATCH.etang_lanternes_blanc_p1, depth: 1425 }]] },
    { id: "etang_banc", room: "Étang", name: "Installer un banc face à l'eau", short: "Banc", verb: "Installer", cost: 18, icon: "plus", need: ["etang_pelouse"], at: z9([1120, 300]),
      desc: "Un banc près du gros rocher, pour regarder l'étang.",
      poi: [[p9(1131, 365, "dort", 1, 930)], [p9(1151, 384, "dort", 1, 930)]],
      styles: [{ name: "Bois", sw: "#7A5A3A", patch: PATCH.etang_banc_naturel }, { name: "Blanc", sw: "#F2F1EC", patch: PATCH.etang_banc_blanc }],
      parts: [[{ patch: PATCH.etang_banc_naturel_p0, depth: 929 }], [{ patch: PATCH.etang_banc_blanc_p0, depth: 929 }]] },
    { id: "etang_piquenique", room: "Étang", name: "Étendre une nappe de pique-nique", short: "Pique-nique", verb: "Étendre", cost: 16, icon: "plus", need: ["etang_pelouse"], at: z9([370, 1690]),
      desc: "Une nappe et un panier au bord de l'eau. Une sieste s'impose.",
      poi: [[p9(371, 1776, "dort", 1)], [p9(203, 1582, "dort", 1)]],
      styles: [{ name: "Vichy rouge", sw: "#D8343A", patch: PATCH.etang_piquenique_naturel }, { name: "Rayures bleues", sw: "#3A6FB8", patch: PATCH.etang_piquenique_blanc }] },
    { id: "etang_peche", room: "Étang", name: "Poser le matériel de pêche", short: "Pêche", verb: "Poser", cost: 16, icon: "plus", need: ["etang_ponton"], at: z9([2440, 1730]),
      desc: "Une canne, un seau et une épuisette. Un chat surveille le bouchon.",
      poi: [[p9(2187, 1957, "assis", -1)], [p9(2103, 1959, "assis", -1)]],
      styles: [{ name: "Canne en bambou", sw: "#B98552", patch: PATCH.etang_peche_naturel }, { name: "Canne bleue", sw: "#3A6FB8", patch: PATCH.etang_peche_blanc }],
      parts: [[{ patch: PATCH.etang_peche_naturel_p0, depth: 2447 }], [{ patch: PATCH.etang_peche_blanc_p0, depth: 2449 }]] },
    /* ----- Zone 10 : le labyrinthe (fenêtre monde x 0..3640, y 2860..4908 ; images agrandies ×4/3). Cadenas : 10e zone payante. ----- */
    { id: "laby_debrousse", room: "Labyrinthe", name: "Débroussailler le labyrinthe", short: "Débroussailler", verb: "Débroussailler", cost: 18, icon: "broom", need: ["allee_pelouse", "aile_pelouse"], at: z10([520, 330]),
      desc: "Herbes folles, ronces et vieilles pierres : on dégage le tour des haies.", patch: PATCH.laby_debrousse },
    { id: "laby_pelouse", room: "Labyrinthe", name: "Semer la pelouse", short: "Pelouse", verb: "Semer", cost: 21, icon: "plus", need: ["laby_debrousse"], at: z10([2000, 300]),
      desc: "Un gazon bien vert entre les haies et tout autour.", patch: PATCH.laby_pelouse },
    { id: "laby_haies", room: "Labyrinthe", name: "Tailler les haies", short: "Haies taillées", verb: "Tailler", cost: 34, icon: "broom", need: ["laby_pelouse"], at: z10([560, 960]),
      desc: "Des haies nettes et droites, et deux arrondis autour de la rotonde. Les chats peuvent enfin s'y promener.", patch: PATCH.laby_haies },
    { id: "laby_allees", room: "Labyrinthe", name: "Tracer les allées", short: "Allées", verb: "Tracer", cost: 29, icon: "hammer", need: ["laby_haies"], at: z10([1240, 1470]),
      desc: "Quatre allées qui mènent à la place de la rotonde.",
      styles: [{ name: "Gravier blanc", sw: "#E6E3DA", patch: PATCH.laby_allees_gravier }, { name: "Dalles claires", sw: "#E8D7A6", patch: PATCH.laby_allees_dalles }] },
    { id: "laby_rotonde", room: "Labyrinthe", name: "Restaurer la rotonde", short: "Rotonde", verb: "Restaurer", cost: 39, icon: "hammer", need: ["laby_haies"], at: z10([1620, 860]),
      desc: "Le petit temple au cœur du labyrinthe retrouve ses colonnes.",
      styles: [{ name: "Marbre et dôme", sw: "#5E9C8C", patch: PATCH.laby_rotonde_marbre }, { name: "Blanche aux roses", sw: "#F2B6C6", patch: PATCH.laby_rotonde_roses }],
      parts: [[{ patch: PATCH.laby_rotonde_marbre_p0, depth: 4210 }], [{ patch: PATCH.laby_rotonde_roses_p0, depth: 4206 }]] },
    { id: "laby_muret", room: "Labyrinthe", name: "Relever les murets", short: "Murets", verb: "Relever", cost: 23, icon: "hammer", need: ["laby_pelouse"], at: z10([300, 700]),
      desc: "Les vieux murs écroulés autour du labyrinthe, comme neufs.",
      styles: [{ name: "Pierre", sw: "#B8B0A0", patch: PATCH.laby_muret_pierre }, { name: "Crépi et tuiles", sw: "#D9643A", patch: PATCH.laby_muret_crepi }] },
    { id: "laby_coussins", room: "Labyrinthe", name: "Poser des coussins dans la rotonde", short: "Coussins", verb: "Poser", cost: 16, icon: "plus", need: ["laby_rotonde"], at: z10([1720, 1130]),
      desc: "Pour la sieste, à l'ombre de la rotonde.", poi: [[p10(1580, 1117, "dort", 1, 4022), p10(1762, 1135, "dort", -1, 4039)], [p10(1620, 1095, "dort", 1, 3998), p10(1462, 1184, "dort", 1, 4090), p10(1762, 1150, "dort", -1, 4056)]],
      styles: [{ name: "Rayés bleus", sw: "#7FA6C9", patch: PATCH.laby_coussins_A }, { name: "Fleuris roses", sw: "#F0B8B8", patch: PATCH.laby_coussins_B }] },
    { id: "laby_arche", room: "Labyrinthe", name: "Dresser une arche à l'entrée", short: "Arche", verb: "Dresser", cost: 21, icon: "plus", need: ["laby_haies"], at: z10([960, 1500]),
      desc: "Une arche fleurie à l'entrée du labyrinthe.",
      styles: [{ name: "Roses", sw: "#F0A9C0", patch: PATCH.laby_arche_A }, { name: "Glycine", sw: "#9B6AD6", patch: PATCH.laby_arche_B }],
      parts: [[{ patch: PATCH.laby_arche_A_p0, depth: 4463 }, { patch: PATCH.laby_arche_A_p1, depth: 4479 }, { patch: PATCH.laby_arche_A_p2, depth: 4496 }, { patch: PATCH.laby_arche_A_p3, depth: 4512 }, { patch: PATCH.laby_arche_A_p4, depth: 4529 }, { patch: PATCH.laby_arche_A_p5, depth: 4545 }, { patch: PATCH.laby_arche_A_p6, depth: 4562 }, { patch: PATCH.laby_arche_A_p7, depth: 4578 }, { patch: PATCH.laby_arche_A_p8, depth: 4595 }, { patch: PATCH.laby_arche_A_p9, depth: 4611 }, { patch: PATCH.laby_arche_A_p10, depth: 4628 }, { patch: PATCH.laby_arche_A_p11, depth: 4644 }, { patch: PATCH.laby_arche_A_p12, depth: 4661 }, { patch: PATCH.laby_arche_A_p13, depth: 4677 }, { patch: PATCH.laby_arche_A_p14, depth: 4694 }], [{ patch: PATCH.laby_arche_B_p0, depth: 4428 }, { patch: PATCH.laby_arche_B_p1, depth: 4443 }, { patch: PATCH.laby_arche_B_p2, depth: 4458 }, { patch: PATCH.laby_arche_B_p3, depth: 4473 }, { patch: PATCH.laby_arche_B_p4, depth: 4488 }, { patch: PATCH.laby_arche_B_p5, depth: 4504 }, { patch: PATCH.laby_arche_B_p6, depth: 4519 }, { patch: PATCH.laby_arche_B_p7, depth: 4534 }, { patch: PATCH.laby_arche_B_p8, depth: 4549 }, { patch: PATCH.laby_arche_B_p9, depth: 4564 }, { patch: PATCH.laby_arche_B_p10, depth: 4579 }, { patch: PATCH.laby_arche_B_p11, depth: 4594 }, { patch: PATCH.laby_arche_B_p12, depth: 4609 }, { patch: PATCH.laby_arche_B_p13, depth: 4624 }]] },
    { id: "laby_banc", room: "Labyrinthe", name: "Installer un banc", short: "Banc", verb: "Installer", cost: 18, icon: "plus", need: ["laby_haies"], at: z10([1200, 1040]),
      desc: "Un banc près de la rotonde. Il ne restera pas libre longtemps.", poi: [[p10(1203, 1094, "dort", 1, 4067)], [p10(1236, 1086, "dort", 1, 4058)]],
      styles: [{ name: "Pierre", sw: "#A9A59C", patch: PATCH.laby_banc_A }, { name: "Bois blanc", sw: "#F2F1EC", patch: PATCH.laby_banc_B }],
      parts: [[{ patch: PATCH.laby_banc_A_p0, depth: 4066 }], [{ patch: PATCH.laby_banc_B_p0, depth: 4057 }]] },
    { id: "laby_statue", room: "Labyrinthe", name: "Dresser une statue de chat", short: "Statue", verb: "Dresser", cost: 18, icon: "plus", need: ["laby_pelouse"], at: z10([830, 680]),
      desc: "Le gardien du labyrinthe, sur son socle.",
      styles: [{ name: "Chat en pierre", sw: "#9A958A", patch: PATCH.laby_statue_A }, { name: "Chat en buis", sw: "#4F7A3A", patch: PATCH.laby_statue_B }],
      parts: [[{ patch: PATCH.laby_statue_A_p0, depth: 3485 }], [{ patch: PATCH.laby_statue_B_p0, depth: 3487 }]] },
    { id: "laby_lanternes", room: "Labyrinthe", name: "Planter des lanternes", short: "Lanternes", verb: "Planter", cost: 16, icon: "plus", need: ["laby_haies"], at: z10([260, 1240]),
      desc: "Quelques lanternes pour trouver l'entrée à la nuit tombée.",
      styles: [{ name: "Fer noir", sw: "#2B2B2E", patch: PATCH.laby_lanternes_A }, { name: "Sur piquets blancs", sw: "#E8C77A", patch: PATCH.laby_lanternes_B }],
      parts: [[{ patch: PATCH.laby_lanternes_A_p0, depth: 4186 }, { patch: PATCH.laby_lanternes_A_p1, depth: 4431 }, { patch: PATCH.laby_lanternes_A_p2, depth: 4875 }], [{ patch: PATCH.laby_lanternes_B_p0, depth: 4533 }, { patch: PATCH.laby_lanternes_B_p1, depth: 4464 }, { patch: PATCH.laby_lanternes_B_p2, depth: 4662 }, { patch: PATCH.laby_lanternes_B_p3, depth: 4606 }]] },
    /* lot K : décors (images K1/K2 faites sur le départ B ; laby_k_calques.py) */
    { id: "laby_cadran", room: "Labyrinthe", name: "Installer un cadran solaire", short: "Cadran solaire", verb: "Installer", cost: 23, icon: "plus", need: ["laby_pelouse"], at: z10([2110, 250]),
      desc: "Sur la grande pelouse, au-dessus du labyrinthe. Un chat vient s'y asseoir au soleil.", poi: [[p10(2213, 346, "assis", -1)], [p10(2205, 363, "assis", -1)]],
      styles: [{ name: "Pierre et bronze", sw: "#5E9C8C", patch: PATCH.laby_cadran_A }, { name: "Colonne aux roses", sw: "#D9B44A", patch: PATCH.laby_cadran_B }],
      parts: [[{ patch: PATCH.laby_cadran_A_p0, depth: 3212 }], [{ patch: PATCH.laby_cadran_B_p0, depth: 3229 }]] },
    { id: "laby_urnes", room: "Labyrinthe", name: "Poser des urnes fleuries", short: "Urnes", verb: "Poser", cost: 18, icon: "plus", need: ["laby_allees"], at: z10([1990, 1180]),
      desc: "Une de chaque côté de la rotonde.",
      styles: [{ name: "Pierre et buis", sw: "#A9A59C", patch: PATCH.laby_urnes_A }, { name: "Géraniums", sw: "#E86A8A", patch: PATCH.laby_urnes_B }],
      parts: [[{ patch: PATCH.laby_urnes_A_p0, depth: 4198 }, { patch: PATCH.laby_urnes_A_p1, depth: 4191 }], [{ patch: PATCH.laby_urnes_B_p0, depth: 4168 }, { patch: PATCH.laby_urnes_B_p1, depth: 4023 }]] },
    { id: "laby_topiaires", room: "Labyrinthe", name: "Planter des topiaires à l'entrée", short: "Topiaires", verb: "Planter", cost: 18, icon: "plus", need: ["laby_haies"], at: z10([2400, 560]),
      desc: "Deux buis taillés pour marquer l'entrée, côté maison.",
      styles: [{ name: "Cônes en pots", sw: "#C2703D", patch: PATCH.laby_topiaires_A }, { name: "Caisses de Versailles", sw: "#F2F1EC", patch: PATCH.laby_topiaires_B }],
      parts: [[{ patch: PATCH.laby_topiaires_A_p0, depth: 3539 }, { patch: PATCH.laby_topiaires_A_p1, depth: 3602 }], [{ patch: PATCH.laby_topiaires_B_p0, depth: 3512 }, { patch: PATCH.laby_topiaires_B_p1, depth: 3780 }]] },
    { id: "laby_panneau", room: "Labyrinthe", name: "Planter un panneau", short: "Panneau", verb: "Planter", cost: 13, icon: "plus", need: ["laby_haies"], at: z10([2600, 400]),
      desc: "Pour que personne ne passe à côté du labyrinthe.",
      styles: [{ name: "Bois sombre", sw: "#5A3E2B", patch: PATCH.laby_panneau_A }, { name: "Peint en blanc", sw: "#E8E2D0", patch: PATCH.laby_panneau_B }],
      parts: [[{ patch: PATCH.laby_panneau_A_p0, depth: 3371 }], [{ patch: PATCH.laby_panneau_B_p0, depth: 3585 }]] },
    { id: "laby_nichoir", room: "Labyrinthe", name: "Installer un nichoir", short: "Nichoir", verb: "Installer", cost: 16, icon: "plus", need: ["laby_pelouse"], at: z10([560, 260]),
      desc: "Sur la petite pelouse près de la statue. Un chat y guette les oiseaux.", poi: [[p10(614, 446, "assis", -1)], [p10(625, 440, "assis", -1)]],
      styles: [{ name: "Toit d'ardoise", sw: "#6B7280", patch: PATCH.laby_nichoir_A }, { name: "Maison rose", sw: "#F2A7B8", patch: PATCH.laby_nichoir_B }],
      parts: [[{ patch: PATCH.laby_nichoir_A_p0, depth: 3292 }], [{ patch: PATCH.laby_nichoir_B_p0, depth: 3286 }]] },
    /* ----- fin de la zone 10 ----- */
    /* ----- Zone 11 : la serre (fenêtre monde x 3580..7220, y 0..2048 ; images agrandies ×4/3). Cadenas : 11e zone payante. ----- */
    { id: "serre_debrousse", room: "Serre", name: "Débroussailler autour de la serre", short: "Débroussailler", verb: "Débroussailler", cost: 18, icon: "broom", need: ["aile_pelouse", "cour_desherbe"], at: z11([700, 1500]),
      desc: "Branches mortes, ronces et feuilles : on dégage le tour de la vieille serre.", patch: PATCH.serre_debrousse },
    { id: "serre_pelouse", room: "Serre", name: "Semer la pelouse", short: "Pelouse", verb: "Semer", cost: 21, icon: "plus", need: ["serre_debrousse"], at: z11([2700, 500]),
      desc: "Un gazon bien vert tout autour de la serre.", patch: PATCH.serre_pelouse },
    { id: "serre_verriere", room: "Serre", name: "Restaurer la verrière", short: "Verrière", verb: "Restaurer", cost: 44, icon: "hammer", need: ["serre_pelouse"], at: z11([1900, 900]),
      desc: "Armature repeinte en blanc, vitres neuves, sol en terre cuite : la serre retrouve sa lumière.", patch: PATCH.serre_verriere },
    { id: "serre_allees", room: "Serre", name: "Repaver le chemin", short: "Allées", verb: "Repaver", cost: 29, icon: "hammer", need: ["serre_pelouse"], at: z11([2700, 1850]),
      desc: "Le chemin qui descend de la serre vers la cour.",
      styles: [{ name: "Briques en épi", sw: "#B5523B", patch: PATCH.serre_allees_briques }, { name: "Dalles claires", sw: "#E8DCC0", patch: PATCH.serre_allees_dalles }] },
    { id: "serre_etablis", room: "Serre", name: "Installer les établis", short: "Établis", verb: "Installer", cost: 21, icon: "plus", need: ["serre_verriere"], at: z11([1250, 1150]),
      desc: "Le coin des semis, dans la moitié gauche de la serre.",
      styles: [{ name: "Établis et pots", sw: "#C2703D", patch: PATCH.serre_etablis_A }, { name: "Fougères et orchidées", sw: "#E58FC0", patch: PATCH.serre_etablis_B }] },
    { id: "serre_plantes", room: "Serre", name: "Rentrer les grandes plantes", short: "Grandes plantes", verb: "Rentrer", cost: 23, icon: "plus", need: ["serre_verriere"], at: z11([2450, 700]),
      desc: "De quoi faire de l'ombre aux chats, dans la moitié droite.",
      styles: [{ name: "Citronniers", sw: "#F2D23B", patch: PATCH.serre_plantes_A }, { name: "Palmiers et bananiers", sw: "#4E9A3E", patch: PATCH.serre_plantes_B }],
      parts: [[{ patch: PATCH.serre_plantes_A_p0, depth: 1676 }], []] },
    { id: "serre_suspensions", room: "Serre", name: "Accrocher des suspensions", short: "Suspensions", verb: "Accrocher", cost: 16, icon: "plus", need: ["serre_verriere"], at: z11([1800, 420]),
      desc: "Le long du faîtage, sous le toit de verre.",
      styles: [{ name: "Lanternes en laiton", sw: "#C9A24A", patch: PATCH.serre_suspensions_A }, { name: "Paniers fleuris", sw: "#E88AB4", patch: PATCH.serre_suspensions_B }] },
    { id: "serre_chassis", room: "Serre", name: "Construire des châssis de semis", short: "Châssis", verb: "Construire", cost: 18, icon: "hammer", need: ["serre_pelouse"], at: z11([1150, 380]),
      desc: "Deux caisses vitrées derrière la serre, pour les jeunes pousses.",
      styles: [{ name: "Bois", sw: "#8A6A48", patch: PATCH.serre_chassis_A }, { name: "Peints en blanc", sw: "#F2F1EC", patch: PATCH.serre_chassis_B }],
      parts: [[{ patch: PATCH.serre_chassis_A_p0, depth: 972 }, { patch: PATCH.serre_chassis_A_p1, depth: 844 }], [{ patch: PATCH.serre_chassis_B_p0, depth: 993 }, { patch: PATCH.serre_chassis_B_p1, depth: 849 }]] },
    { id: "serre_tonneau", room: "Serre", name: "Poser une réserve d'eau", short: "Réserve d'eau", verb: "Poser", cost: 13, icon: "plus", need: ["serre_pelouse"], at: z11([3000, 950]),
      desc: "Au coin de la serre, avec ses arrosoirs.",
      styles: [{ name: "Tonneau et arrosoirs", sw: "#7A5232", patch: PATCH.serre_tonneau_A }, { name: "Jarre bleue", sw: "#2F6DB0", patch: PATCH.serre_tonneau_B }],
      parts: [[{ patch: PATCH.serre_tonneau_A_p0, depth: 1332 }], [{ patch: PATCH.serre_tonneau_B_p0, depth: 1288 }]] },
    { id: "serre_banc", room: "Serre", name: "Installer un banc", short: "Banc", verb: "Installer", cost: 18, icon: "plus", need: ["serre_pelouse"], at: z11([3250, 1300]),
      desc: "Face à la serre, à l'ombre du grand arbre. Un chat y fait la sieste.", poi: [[p11(2988, 1491, "dort", -1, 1665)], [p11(3002, 1521, "dort", -1, 1689)]],
      styles: [{ name: "Vert sauge", sw: "#9DB592", patch: PATCH.serre_banc_A }, { name: "Fer forgé blanc", sw: "#F2F1EC", patch: PATCH.serre_banc_B }],
      parts: [[{ patch: PATCH.serre_banc_A_p0, depth: 1664 }], [{ patch: PATCH.serre_banc_B_p0, depth: 1688 }]] },
    { id: "serre_brouette", room: "Serre", name: "Fleurir une brouette", short: "Brouette", verb: "Fleurir", cost: 16, icon: "plus", need: ["serre_allees"], at: z11([2250, 1950]),
      desc: "Dans la boucle du chemin, sous la porte de la serre.",
      styles: [{ name: "Géraniums", sw: "#D9423A", patch: PATCH.serre_brouette_A }, { name: "Pétunias", sw: "#E88AB4", patch: PATCH.serre_brouette_B }],
      parts: [[{ patch: PATCH.serre_brouette_A_p0, depth: 1825 }], [{ patch: PATCH.serre_brouette_B_p0, depth: 1832 }]] },
    { id: "serre_massif", room: "Serre", name: "Planter une bordure fleurie", short: "Bordure", verb: "Planter", cost: 18, icon: "plus", need: ["serre_verriere"], at: z11([1500, 1900]),
      desc: "Le long du soubassement de la serre.",
      styles: [{ name: "Lavande et marguerites", sw: "#8E7CC3", patch: PATCH.serre_massif_A }, { name: "Roses et hortensias", sw: "#7FA6D9", patch: PATCH.serre_massif_B }] },
    { id: "serre_coussin", room: "Serre", name: "Poser un panier au soleil", short: "Panier", verb: "Poser", cost: 13, icon: "plus", need: ["serre_verriere"], at: z11([2600, 1560]),
      desc: "Devant la porte de la serre, là où le sol est tiède.", poi: [[p11(2444, 1370, "dort", 1, 1443)], [p11(2421, 1374, "dort", 1, 1456)]],
      styles: [{ name: "Vichy rouge", sw: "#D9423A", patch: PATCH.serre_coussin_A }, { name: "Lavande", sw: "#C7B3E6", patch: PATCH.serre_coussin_B }] },
    /* ----- fin de la zone 11 ----- */
    /* ----- Détails de la grille d'entrée (lot G) : placés en fin de liste, leurs calques passent par-dessus le reste. ----- */
    { id: "grille_plaque", room: "Grille d'entrée", name: "Poser la plaque du domaine", short: "Plaque", verb: "Poser", cost: 16, icon: "plus", need: ["grille_mur"], at: z2([1450, 550]),
      desc: "« Maison Ronron », sur le petit mur à côté de la grille.",
      styles: [{ name: "Émail bleu", sw: "#1F3A7A", patch: PATCH.grille_plaque_A }, { name: "Laiton", sw: "#CEA442", patch: PATCH.grille_plaque_B }] },
    { id: "grille_boite", room: "Grille d'entrée", name: "Fixer une boîte aux lettres", short: "Boîte aux lettres", verb: "Fixer", cost: 18, icon: "hammer", need: ["grille_mur"], at: z2([2440, 1110]),
      desc: "Pour les lettres et les cartes postales, sur le mur à droite de la grille.",
      styles: [{ name: "Vert anglais", sw: "#2F5A3E", patch: PATCH.grille_boite_A }, { name: "Noire et or", sw: "#23232A", patch: PATCH.grille_boite_B }] },
    { id: "grille_pots", room: "Grille d'entrée", name: "Mettre un pot au portail", short: "Pot du portail", verb: "Mettre", cost: 16, icon: "plus", need: ["grille_chemin"], at: z2([2215, 1200]),
      desc: "Une plante en pot au pied du pilier de droite.",
      styles: [{ name: "Buis en boule", sw: "#C8613E", patch: PATCH.grille_pots_A }, { name: "Laurier en caisse blanche", sw: "#F1F0EC", patch: PATCH.grille_pots_B }],
      parts: [[{ patch: PATCH.grille_pots_A_p0, depth: 6215 }], [{ patch: PATCH.grille_pots_B_p0, depth: 6258 }]] },
    { id: "grille_panneau", room: "Grille d'entrée", name: "Planter un panneau", short: "Panneau", verb: "Planter", cost: 13, icon: "plus", need: ["grille_pelouse"], at: z2([2390, 1370]),
      desc: "« Attention chats » : les visiteurs sont prévenus.",
      styles: [{ name: "Bois peint", sw: "#B98552", patch: PATCH.grille_panneau_A }, { name: "Émail blanc", sw: "#EEF2F8", patch: PATCH.grille_panneau_B }],
      parts: [[{ patch: PATCH.grille_panneau_A_p0, depth: 6393 }], [{ patch: PATCH.grille_panneau_B_p0, depth: 6411 }]] },
    { id: "grille_grimpante", room: "Grille d'entrée", name: "Faire grimper une plante", short: "Plante grimpante", verb: "Faire grimper", cost: 29, icon: "plus", need: ["grille_mur"], at: z2([880, 600]),
      desc: "Des fleurs tout le long du grand mur, au-dessus du massif.",
      styles: [{ name: "Rosier rose", sw: "#E58FA8", patch: PATCH.grille_grimpante_A }, { name: "Glycine", sw: "#A98AD6", patch: PATCH.grille_grimpante_B }] },
    { id: "grille_gamelles", room: "Grille d'entrée", name: "Poser des gamelles", short: "Gamelles", verb: "Poser", cost: 16, icon: "plus", need: ["grille_abri"], at: z2([1380, 990]),
      desc: "Croquettes et eau fraîche devant l'abri. Il y a toujours un chat à côté.",
      poi: [[{ x: 3684, y: 5928, pose: "assis", dir: -1, min: 12000, max: 28000 }], [{ x: 3714, y: 5924, pose: "assis", dir: -1, min: 12000, max: 28000 }]],
      styles: [{ name: "Céramique blanche", sw: "#F3F1E8", patch: PATCH.grille_gamelles_A }, { name: "Émail bleu", sw: "#3A6FB8", patch: PATCH.grille_gamelles_B }] },
    { id: "grille_arbrechat", room: "Grille d'entrée", name: "Installer un arbre à chat", short: "Arbre à chat", verb: "Installer", cost: 21, icon: "plus", need: ["grille_abri"], at: z2([1530, 800]),
      desc: "Deux plateaux à côté du pilier : en haut on surveille la rue, en bas on fait la sieste.",
      poi: [[{ x: 3729, y: 5576, pose: "assis", dir: 1, min: 12000, max: 28000, depth: 5929 }, { x: 3708, y: 5722, pose: "dort", dir: 1, min: 12000, max: 28000, depth: 5928 }], [{ x: 3711, y: 5568, pose: "assis", dir: 1, min: 12000, max: 28000, depth: 5912 }, { x: 3774, y: 5730, pose: "dort", dir: -1, min: 12000, max: 28000, depth: 5911 }]],
      styles: [{ name: "Bois naturel", sw: "#C9A26B", patch: PATCH.grille_arbrechat_A }, { name: "Bois blanc", sw: "#F1F0EC", patch: PATCH.grille_arbrechat_B }],
      parts: [[{ patch: PATCH.grille_arbrechat_A_p0, depth: 5927 }], [{ patch: PATCH.grille_arbrechat_B_p0, depth: 5910 }]] },
    { id: "grille_bordure", room: "Grille d'entrée", name: "Border le chemin", short: "Bordure", verb: "Border", cost: 23, icon: "plus", need: ["grille_chemin"], at: z2([900, 1250]),
      desc: "Une bordure le long du chemin. Les chats s'y cachent en passant.",
      styles: [{ name: "Lavande", sw: "#8E7CC3", patch: PATCH.grille_bordure_A }, { name: "Buis taillé", sw: "#4E7A35", patch: PATCH.grille_bordure_B }] },
    { id: "grille_arbre", room: "Grille d'entrée", name: "Planter un arbre", short: "Arbre", verb: "Planter", cost: 34, icon: "plus", need: ["grille_pelouse"], at: z2([2060, 330]),
      desc: "Un arbre derrière la grille, sur la pelouse de l'allée.",
      styles: [{ name: "Érable rouge", sw: "#C8452E", patch: PATCH.grille_arbre_A }, { name: "Bouleau", sw: "#A9C46A", patch: PATCH.grille_arbre_B }],
      parts: [[{ patch: PATCH.grille_arbre_A_p0, depth: 5414 }], [{ patch: PATCH.grille_arbre_B_p0, depth: 5384 }]] },
    { id: "grille_mangeoire", room: "Grille d'entrée", name: "Installer une mangeoire", short: "Mangeoire", verb: "Installer", cost: 18, icon: "plus", need: ["grille_pelouse"], at: z2([1260, 150]),
      desc: "Des graines pour les oiseaux. Un chat les surveille, très sérieusement.",
      poi: [[{ x: 3529, y: 5131, pose: "assis", dir: -1, min: 12000, max: 28000 }], [{ x: 3534, y: 5138, pose: "assis", dir: -1, min: 12000, max: 28000 }]],
      styles: [{ name: "Bois", sw: "#8A6238", patch: PATCH.grille_mangeoire_A }, { name: "Blanc et bleu", sw: "#7FA3D6", patch: PATCH.grille_mangeoire_B }],
      parts: [[{ patch: PATCH.grille_mangeoire_A_p0, depth: 5203 }], [{ patch: PATCH.grille_mangeoire_B_p0, depth: 5214 }]] },
    /* ----- Détails de l'allée du manoir (lot H ; le bassin est rangé avant l'arche). Un détail posé sur un objet qui change
       de forme selon son style (dep) a une variante par style de cet objet : calques <id>_<A|B><style de l'objet>, places et cases d'indice style + 2 × style de l'objet. ----- */
    { id: "allee_fauteuils", room: "Allée du manoir", name: "Installer deux fauteuils", short: "Fauteuils", verb: "Installer", cost: 23, icon: "plus", need: ["allee_pelouse"], at: z3([2075, 330]),
      desc: "Face au bassin. Les chats ont vite compris à qui ils étaient.",
      poi: [[{ x: 4192, y: 4022, pose: "dort", dir: 1, min: 12000, max: 28000, depth: 4131 }, { x: 4274, y: 4059, pose: "dort", dir: -1, min: 12000, max: 28000, depth: 4131 }], [{ x: 4174, y: 4027, pose: "dort", dir: 1, min: 12000, max: 28000, depth: 4150 }, { x: 4264, y: 4067, pose: "dort", dir: -1, min: 12000, max: 28000, depth: 4150 }]],
      styles: [{ name: "Bois blanc", sw: "#F1F0EC", patch: PATCH.allee_fauteuils_A }, { name: "Rotin", sw: "#B98552", patch: PATCH.allee_fauteuils_B }],
      parts: [[{ patch: PATCH.allee_fauteuils_A_p0, depth: 4130 }], [{ patch: PATCH.allee_fauteuils_B_p0, depth: 4149 }]] },
    { id: "allee_topiaire", room: "Allée du manoir", name: "Tailler un chat dans le buis", short: "Topiaire", verb: "Tailler", cost: 31, icon: "plus", need: ["allee_pelouse"], at: z3([1235, 690]),
      desc: "Un chat de buis sur la pelouse, à côté de l'arche. Les vrais chats l'ignorent.",
      styles: [{ name: "Chat assis", sw: "#5E8C3A", patch: PATCH.allee_topiaire_A }, { name: "Chat couché", sw: "#4E7A35", patch: PATCH.allee_topiaire_B }],
      parts: [[{ patch: PATCH.allee_topiaire_A_p0, depth: 4509 }], [{ patch: PATCH.allee_topiaire_B_p0, depth: 4509 }]] },
    { id: "allee_hamac", room: "Allée du manoir", name: "Suspendre un hamac", short: "Hamac", verb: "Suspendre", cost: 23, icon: "plus", need: ["allee_pelouse"], at: z3([1910, 1190]),
      desc: "Entre le massif et la statue. Réservé à la sieste.",
      poi: [[{ x: 4089, y: 4897, pose: "dort", dir: 1, min: 12000, max: 28000, depth: 5026 }], [{ x: 4089, y: 4887, pose: "dort", dir: 1, min: 12000, max: 28000, depth: 5003 }]],
      styles: [{ name: "Rayé bleu", sw: "#3A6FB8", patch: PATCH.allee_hamac_A }, { name: "Macramé", sw: "#EFE6CF", patch: PATCH.allee_hamac_B }],
      parts: [[{ patch: PATCH.allee_hamac_A_p0, depth: 5025 }], [{ patch: PATCH.allee_hamac_B_p0, depth: 5002 }]] },
    { id: "allee_coussins", room: "Allée du manoir", name: "Poser des coussins", short: "Coussins", verb: "Poser", cost: 16, icon: "plus", need: ["allee_rondpoint"], at: z3([1975, 835]),
      desc: "Sur la margelle du rond-point, pour la sieste au soleil.",
      dep: "allee_rondpoint", poi: [[{ x: 4154, y: 4532, pose: "dort", dir: 1, min: 12000, max: 28000 }], [{ x: 4159, y: 4525, pose: "dort", dir: 1, min: 12000, max: 28000 }], [{ x: 4148, y: 4546, pose: "dort", dir: 1, min: 12000, max: 28000 }], [{ x: 4153, y: 4539, pose: "dort", dir: 1, min: 12000, max: 28000 }]],
      styles: [{ name: "Rayures bleues", sw: "#3A6FB8", patch: eff => PATCH["allee_coussins_A" + (eff("allee_rondpoint") | 0)] }, { name: "Fleuri rose", sw: "#F0B8C8", patch: eff => PATCH["allee_coussins_B" + (eff("allee_rondpoint") | 0)] }] },
    { id: "allee_paniers", room: "Allée du manoir", name: "Suspendre des paniers fleuris", short: "Paniers fleuris", verb: "Suspendre", cost: 20, icon: "plus", need: ["allee_lampadaires"], at: z3([1690, 690]),
      desc: "Un panier de fleurs à chacun des trois lampadaires.", dep: "allee_lampadaires",
      styles: [{ name: "Pétunias roses", sw: "#E58FA8", patch: eff => PATCH["allee_paniers_A" + (eff("allee_lampadaires") | 0)] }, { name: "Géraniums rouges", sw: "#D8343A", patch: eff => PATCH["allee_paniers_B" + (eff("allee_lampadaires") | 0)] }] },
    { id: "allee_lampions", room: "Allée du manoir", name: "Accrocher des lampions", short: "Lampions", verb: "Accrocher", cost: 16, icon: "plus", need: ["allee_arche"], at: z3([1600, 330]),
      desc: "Sous l'arche, pour les soirs d'été.", dep: "allee_arche",
      styles: [{ name: "Lampions en papier", sw: "#F3D27A", patch: eff => PATCH["allee_lampions_A" + (eff("allee_arche") | 0)] }, { name: "Guirlande guinguette", sw: "#FFF3B0", patch: eff => PATCH["allee_lampions_B" + (eff("allee_arche") | 0)] }] },
    { id: "allee_bordure", room: "Allée du manoir", name: "Border le sentier", short: "Bordure", verb: "Border", cost: 23, icon: "plus", need: ["allee_sentier"], at: z3([560, 950]),
      desc: "Des fleurs tout le long du sentier. Les chats s'y cachent en passant.",
      styles: [{ name: "Tulipes", sw: "#E2483A", patch: PATCH.allee_bordure_A }, { name: "Pensées", sw: "#7A5BC4", patch: PATCH.allee_bordure_B }] },
    { id: "allee_fleurs", room: "Allée du manoir", name: "Fleurir la statue", short: "Fleurs de la statue", verb: "Fleurir", cost: 16, icon: "plus", need: ["allee_statue"], at: z3([2060, 1400]),
      desc: "Un massif tout autour du socle de la statue.",
      styles: [{ name: "Lavande", sw: "#8E7CC3", patch: PATCH.allee_fleurs_A }, { name: "Roses blanches", sw: "#F3F1E8", patch: PATCH.allee_fleurs_B }] },
    /* ----- Détails de l'aile d'entrée du manoir (lot I). ----- */
    { id: "manoir_jardin", room: "Manoir", name: "Installer un salon de jardin", short: "Salon de jardin", verb: "Installer", cost: 34, icon: "plus", need: ["manoir_pelouse"], at: z4([710, 860]),
      desc: "Une table, deux chaises et du thé. Les chaises sont vite prises.",
      poi: [[{ x: 4936, y: 4529, pose: "assis", dir: 1, min: 12000, max: 28000, depth: 4691 }, { x: 5165, y: 4580, pose: "assis", dir: -1, min: 12000, max: 28000, depth: 4691 }], [{ x: 4928, y: 4512, pose: "assis", dir: 1, min: 12000, max: 28000, depth: 4716 }, { x: 5173, y: 4627, pose: "assis", dir: -1, min: 12000, max: 28000, depth: 4716 }]],
      styles: [{ name: "Fer forgé vert", sw: "#2F5A3E", patch: PATCH.manoir_jardin_A }, { name: "Bois blanc", sw: "#F1F0EC", patch: PATCH.manoir_jardin_B }],
      parts: [[{ patch: PATCH.manoir_jardin_A_p0, depth: 4690 }], [{ patch: PATCH.manoir_jardin_B_p0, depth: 4715 }]] },
    { id: "manoir_lanternes", room: "Manoir", name: "Planter des lanternes", short: "Lanternes", verb: "Planter", cost: 21, icon: "plus", need: ["manoir_pelouse"], at: z4([1300, 1290]),
      desc: "Le long de la bordure, pour les soirées sur la pelouse.",
      styles: [{ name: "Fer noir", sw: "#2B2B30", patch: PATCH.manoir_lanternes_A }, { name: "Laiton", sw: "#C9A24B", patch: PATCH.manoir_lanternes_B }],
      parts: [[{ patch: PATCH.manoir_lanternes_A_p0, depth: 4566 }, { patch: PATCH.manoir_lanternes_A_p1, depth: 4879 }, { patch: PATCH.manoir_lanternes_A_p2, depth: 5082 }, { patch: PATCH.manoir_lanternes_A_p3, depth: 5075 }, { patch: PATCH.manoir_lanternes_A_p4, depth: 4888 }, { patch: PATCH.manoir_lanternes_A_p5, depth: 4696 }], [{ patch: PATCH.manoir_lanternes_B_p0, depth: 4769 }, { patch: PATCH.manoir_lanternes_B_p1, depth: 5089 }, { patch: PATCH.manoir_lanternes_B_p2, depth: 5077 }, { patch: PATCH.manoir_lanternes_B_p3, depth: 4891 }, { patch: PATCH.manoir_lanternes_B_p4, depth: 4696 }]] },
    { id: "manoir_puits", room: "Manoir", name: "Restaurer le vieux puits", short: "Puits", verb: "Restaurer", cost: 36, icon: "hammer", need: ["manoir_pelouse"], at: z4([2310, 880]),
      desc: "Il servait aux jardiniers. Les chats aiment s'asseoir sur la margelle.",
      poi: [[{ x: 6548, y: 4662, pose: "assis", dir: 1, min: 12000, max: 28000, depth: 4797 }], [{ x: 6583, y: 4672, pose: "assis", dir: 1, min: 12000, max: 28000, depth: 4761 }]],
      styles: [{ name: "Pierre et tuiles", sw: "#B5523B", patch: PATCH.manoir_puits_A }, { name: "Pierre claire et roses", sw: "#EFE6CF", patch: PATCH.manoir_puits_B }],
      parts: [[{ patch: PATCH.manoir_puits_A_p0, depth: 4796 }], [{ patch: PATCH.manoir_puits_B_p0, depth: 4760 }]] },
    { id: "manoir_oiseaux", room: "Manoir", name: "Poser un bain d'oiseaux", short: "Bain d'oiseaux", verb: "Poser", cost: 21, icon: "plus", need: ["manoir_pelouse"], at: z4([1390, 1250]),
      desc: "Les oiseaux viennent boire. Un chat les surveille, l'air de rien.",
      poi: [[{ x: 5868, y: 5057, pose: "assis", dir: -1, min: 12000, max: 28000 }], [{ x: 5928, y: 5062, pose: "assis", dir: -1, min: 12000, max: 28000 }]],
      styles: [{ name: "Pierre grise", sw: "#A8A49A", patch: PATCH.manoir_oiseaux_A }, { name: "Céramique bleue", sw: "#3A6FB8", patch: PATCH.manoir_oiseaux_B }],
      parts: [[{ patch: PATCH.manoir_oiseaux_A_p0, depth: 5063 }], [{ patch: PATCH.manoir_oiseaux_B_p0, depth: 5071 }]] },
    { id: "manoir_griffoir", room: "Manoir", name: "Installer un griffoir", short: "Griffoir", verb: "Installer", cost: 16, icon: "plus", need: ["manoir_pelouse"], at: z4([1860, 1230]),
      desc: "Pour épargner les meubles du manoir.",
      poi: [[{ x: 6283, y: 4992, pose: "griffe", dir: -1, min: 12000, max: 28000 }], [{ x: 6390, y: 4915, pose: "griffe", dir: -1, min: 12000, max: 28000 }]],
      styles: [{ name: "Sisal et bois", sw: "#C9A26B", patch: PATCH.manoir_griffoir_A }, { name: "Poteau blanc", sw: "#F1F0EC", patch: PATCH.manoir_griffoir_B }],
      parts: [[{ patch: PATCH.manoir_griffoir_A_p0, depth: 5016 }], [{ patch: PATCH.manoir_griffoir_B_p0, depth: 4929 }]] },
    { id: "manoir_grimpante", room: "Manoir", name: "Faire grimper une plante", short: "Plante grimpante", verb: "Faire grimper", cost: 23, icon: "plus", need: ["manoir_fenetres"], at: z4([985, 620]),
      desc: "Sur l'angle du grand salon, jusqu'en haut du mur.",
      styles: [{ name: "Lierre", sw: "#3F6B2E", patch: PATCH.manoir_grimpante_A }, { name: "Rosier blanc", sw: "#F3F1E8", patch: PATCH.manoir_grimpante_B }] },
    { id: "manoir_horloge", room: "Manoir", name: "Installer une horloge comtoise", short: "Horloge", verb: "Installer", cost: 21, icon: "plus", need: ["manoir_murs"], at: z4([1155, 470]),
      desc: "À gauche de la cheminée. On l'entend de tout le salon.",
      styles: [{ name: "Bois foncé", sw: "#5A3420", patch: PATCH.manoir_horloge_A }, { name: "Blanche et or", sw: "#E9D9A6", patch: PATCH.manoir_horloge_B }],
      parts: [[{ patch: PATCH.manoir_horloge_A_p0, depth: 4262 }], [{ patch: PATCH.manoir_horloge_B_p0, depth: 4275 }]] },
    { id: "manoir_gramophone", room: "Manoir", name: "Poser un gramophone", short: "Gramophone", verb: "Poser", cost: 18, icon: "plus", need: ["manoir_sol"], at: z4([1500, 660]),
      desc: "Pour danser dans le grand salon.",
      styles: [{ name: "Pavillon en laiton", sw: "#C9A24B", patch: PATCH.manoir_gramophone_A }, { name: "Pavillon fleuri", sw: "#F0B8C8", patch: PATCH.manoir_gramophone_B }],
      parts: [[{ patch: PATCH.manoir_gramophone_A_p0, depth: 4426 }], [{ patch: PATCH.manoir_gramophone_B_p0, depth: 4424 }]] },
    /* ----- Détails de la cour d'honneur (lot J ; le tapis est plus haut, avant la fontaine). ----- */
    { id: "cour_portraits", room: "Cour", name: "Accrocher des portraits de chats", short: "Portraits", verb: "Accrocher", cost: 26, icon: "plus", need: ["cour_galeries"], at: z5([490, 140]),
      desc: "Les ancêtres de la maison, en peinture, dans la petite galerie.",
      styles: [{ name: "Cadres dorés", sw: "#C9A24B", patch: PATCH.cour_portraits_A }, { name: "Aquarelles", sw: "#F3F1E8", patch: PATCH.cour_portraits_B }] },
    { id: "cour_banquette", room: "Cour", name: "Installer une banquette", short: "Banquette", verb: "Installer", cost: 21, icon: "plus", need: ["cour_galeries"], at: z5([480, 330]),
      desc: "Sous les portraits, pour les admirer assis.",
      styles: [{ name: "Velours bordeaux", sw: "#7A2342", patch: PATCH.cour_banquette_A }, { name: "Lin crème", sw: "#EFE6CF", patch: PATCH.cour_banquette_B }] },
    { id: "cour_statue", room: "Cour", name: "Poser une statue de chat", short: "Statue", verb: "Poser", cost: 21, icon: "plus", need: ["cour_galeries"], at: z5([270, 240]),
      desc: "Dans le coin de la galerie, un chat qui ne bouge jamais.",
      styles: [{ name: "Buste en marbre", sw: "#F1EEE6", patch: PATCH.cour_statue_A }, { name: "Terre cuite", sw: "#D49A72", patch: PATCH.cour_statue_B }] },
    { id: "cour_grimpante", room: "Cour", name: "Faire grimper une plante", short: "Plante grimpante", verb: "Faire grimper", cost: 31, icon: "plus", need: ["cour_arcades"], at: z5([1950, 330]),
      desc: "Sur le haut du mur aux arcades, jusqu'à la salle des chats.",
      styles: [{ name: "Bougainvillier", sw: "#C2287A", patch: PATCH.cour_grimpante_A }, { name: "Jasmin", sw: "#F3F1E8", patch: PATCH.cour_grimpante_B }] },
    { id: "cour_voliere", room: "Cour", name: "Installer une volière", short: "Volière", verb: "Installer", cost: 34, icon: "plus", need: ["cour_dallage"], at: z5([1760, 760]),
      desc: "Deux oiseaux qui chantent. Un chat qui les regarde, très, très attentivement.",
      poi: [[{ x: 6154, y: 3270, pose: "assis", dir: -1, min: 12000, max: 28000 }], [{ x: 6150, y: 3256, pose: "assis", dir: 1, min: 12000, max: 28000 }]],
      styles: [{ name: "Laiton", sw: "#B8913E", patch: PATCH.cour_voliere_A }, { name: "Blanche", sw: "#F1F0EC", patch: PATCH.cour_voliere_B }],
      parts: [[{ patch: PATCH.cour_voliere_A_p0, depth: 3486 }], [{ patch: PATCH.cour_voliere_B_p0, depth: 3268 }]] },
    { id: "cour_cartons", room: "Cour", name: "Empiler des cartons", short: "Cartons", verb: "Empiler", cost: 21, icon: "plus", need: ["cour_dallage"], at: z5([730, 850]),
      desc: "Le meilleur lit du monde, d'après les chats.",
      poi: [[{ x: 5146, y: 3410, pose: "dort", dir: -1, min: 12000, max: 28000, depth: 3434 }], [{ x: 5133, y: 3373, pose: "dort", dir: 1, min: 12000, max: 28000, depth: 3443 }]],
      styles: [{ name: "Cartons", sw: "#C49A6C", patch: PATCH.cour_cartons_A }, { name: "Boîtes à chapeaux", sw: "#F4C6D2", patch: PATCH.cour_cartons_B }],
      parts: [[{ patch: PATCH.cour_cartons_A_p0, depth: 3433 }], [{ patch: PATCH.cour_cartons_B_p0, depth: 3442 }]] }
  ];
  const SLOT = {}; SLOTS.forEach(s => { SLOT[s.id] = s; });
  /* Détail posé sur un autre objet (s.dep) : une variante par style de cet objet. Places des chats et cases de la grille
     sont rangées à l'indice style + 2 × style de l'objet (depMap pour regrouper, par ex. « sans arche » avec la glycine). */
  const houseSt = id => (S.house[id] && S.house[id].done ? S.house[id].style | 0 : null);
  const vk = (s, k, st) => (s && s.dep ? k + 2 * (s.depMap ? s.depMap(st(s.dep)) : (st(s.dep) | 0)) : k);
  /* Décorations de Noël, débloquées par le calendrier de l'Avent : posées sur le domaine du 1er décembre au 6 janvier.
     DECOS_START (liste écrite par art/noel_app.py) */
  const DECOS = [
    { id: "grille", day: 6, name: "Couronnes de la grille", at: [4114, 5676], patch: PATCH.noel_grille, parts: [],
      block: [] },
    { id: "entree", day: 12, name: "L'entrée du manoir en fête", at: [4600, 3980], patch: PATCH.noel_entree, parts: [{ patch: PATCH.noel_entree_p0, depth: 4162 }, { patch: PATCH.noel_entree_p1, depth: 4550 }],
      block: [164457, 164458, 164459, 164460, 164461, 164462, 164463, 165174, 165175, 165176, 165177, 165178, 165179, 165180, 165892, 165893, 165894, 165895, 165896, 166609, 166610, 166611, 166612, 166613, 180982, 180983, 180984, 180985, 180986, 180987, 180988, 181699, 181700, 181701, 181702, 181703, 181704, 181705, 181706, 182416, 182417, 182418, 182419, 182420, 182421, 182422, 182423, 182424, 183133, 183134, 183135, 183136, 183137, 183138, 183139, 183140, 183141, 183851, 183852, 183853, 183854, 183855, 183856, 183857, 184569, 184571, 184572] },
    { id: "gardien", day: 18, name: "Le sapin du gardien", at: [760, 5900], patch: PATCH.noel_gardien, parts: [{ patch: PATCH.noel_gardien_p0, depth: 6084 }],
      block: [245968, 245969, 245970, 245971, 245972, 245973, 245974, 245975, 245976, 245977, 245978, 245979, 245980, 245981, 245982, 245983, 245984, 245985, 246685, 246686, 246687, 246688, 246689, 246690, 246691, 246692, 246693, 246694, 246695, 246696, 246697, 246698, 246699, 246700, 246701, 247403, 247404, 247405, 247406, 247407, 247408, 247409, 247410, 247411, 247412, 247413, 247414, 247415, 247416, 247417, 247418, 248121, 248122, 248123, 248124, 248125, 248126, 248127, 248128, 248129, 248130, 248131, 248132, 248133, 248134, 248135, 248837, 248838, 248839, 248840, 248841, 248842, 248843, 248844, 248845, 248846, 248847, 248848, 248849, 248850, 248851, 248852, 249554, 249555, 249556, 249557, 249558, 249559, 249560, 249561, 249562, 249563, 249564, 249565, 249566, 249567, 249568, 249569, 249570, 250271, 250272, 250273, 250274, 250275, 250276, 250277, 250278, 250279, 250280, 250281, 250282, 250283, 250284, 250285, 250286, 250287, 250989, 250990, 250991, 250992, 250993, 250994, 250995, 250996, 250997, 250998, 250999, 251000, 251001, 251002, 251709, 251710, 251711, 251712, 251713, 251714, 251715, 251716, 251717, 252428, 252430, 252431, 252432, 252433, 252434, 253149] },
    { id: "cour", day: 24, name: "Le grand sapin de la cour", at: [6120, 3050], patch: PATCH.noel_cour, parts: [{ patch: PATCH.noel_cour_p0, depth: 3358 }],
      block: [124415, 124416, 124417, 124418, 124419, 124420, 124421, 124422, 124423, 124424, 124425, 124426, 124427, 124428, 124429, 124430, 124431, 124432, 125132, 125133, 125134, 125135, 125136, 125137, 125138, 125139, 125140, 125141, 125142, 125143, 125144, 125145, 125146, 125147, 125148, 125149, 125849, 125850, 125851, 125852, 125853, 125854, 125855, 125856, 125857, 125858, 125859, 125860, 125861, 125862, 125863, 125864, 125865, 125866, 126566, 126567, 126568, 126569, 126570, 126571, 126572, 126573, 126574, 126575, 126576, 126577, 126578, 126579, 126580, 126581, 127283, 127284, 127285, 127286, 127287, 127288, 127289, 127290, 127291, 127292, 127293, 127294, 127295, 127296, 127297, 127298, 128000, 128001, 128002, 128003, 128004, 128005, 128006, 128007, 128008, 128009, 128010, 128011, 128012, 128013, 128014, 128015, 128016, 128717, 128718, 128719, 128720, 128721, 128722, 128723, 128724, 128725, 128726, 128727, 128728, 128729, 128730, 128731, 128732, 128733, 129434, 129435, 129436, 129437, 129438, 129439, 129440, 129441, 129442, 129443, 129444, 129445, 129446, 129447, 129448, 129449, 130155, 130156, 130157, 130159, 130160, 130161, 130162, 130163, 130164, 130877, 130878, 130879] }
  ].filter(d => d.patch);
  /* DECOS_END */

  /* Zones : chaque nouvelle zone du domaine se débloque contre des croquettes avant qu'on puisse y lancer des chantiers.
     La maison du gardien et son jardin sont ouverts d'office. Prix revus à la hausse en 0.39 (×1,3, et au moins +1) quand les jeux bonus sont arrivés. */
  const ZONE_STEP = 26;                 // 1re zone 26 croquettes, 2e 52, 3e 78…
  const ZONES = {
    grille: { name: "La grille d'entrée", desc: "L'entrée du domaine, sa grille et son petit jardin." },
    allee: { name: "L'allée du manoir", desc: "La grande allée qui monte jusqu'au perron." },
    manoir: { name: "L'aile d'entrée du manoir", desc: "La façade, le grand salon et le bureau." },
    cour: { name: "La cour d'honneur", desc: "La cour à la fontaine, le hall et la salle des chats." },
    aile: { name: "L'aile ouest", desc: "Son jardin, la bibliothèque et la salle à manger." },
    est: { name: "L'aile est", desc: "Son jardin, une cuisine, une chambre et une salle de bain." },
    perron: { name: "Le perron est", desc: "L'entrée est du manoir et son jardin : 19 chantiers, plein de détails." },
    etang: { name: "L'étang", desc: "L'étang aux nénuphars, son ponton et le hangar à bateaux : 12 chantiers." },
    laby: { name: "Le labyrinthe", desc: "Les haies, la rotonde au centre et ses allées : 16 chantiers." },
    serre: { name: "La serre", desc: "La grande verrière, ses plantes et son jardin : 13 chantiers." }
  };
  const zoneCost = z => ZONE_STEP * (Object.keys(ZONES).indexOf(z) + 1);
  const zoneOf = s => { const p = s.id.split("_")[0]; return ZONES[p] ? p : null; };
  const zoneOpen = z => !z || !!(S.zones && S.zones[z]);
  // une partie commencée avant les zones payantes garde ouvertes les zones où elle a déjà construit
  function migrateZones() {
    if (!S.zones) S.zones = {};
    SLOTS.forEach(s => { const z = zoneOf(s); if (z && isDone(s.id)) S.zones[z] = true; });
  }

  /* Déplacements des chats : une grille de cases praticables couvre tout le sol de la maison du gardien.
     Chaque meuble posé retire les cases qu'il occupe. */
  const NAV = window.RONRON_NAV;

  const BREEDS = [
    { id: "roux", name: "Gouttière roux", price: 4, fur: "#F2A24A", dark: "#D9812A", belly: "#FFF1DC", stripes: true },
    { id: "tigre", name: "Européen tigré", price: 7, fur: "#A9A197", dark: "#6F685F", belly: "#EFE9DF", stripes: true },
    { id: "smoking", name: "Chat smoking", price: 8, fur: "#3F3D45", dark: "#2A282E", belly: "#FFFFFF", bib: true },
    { id: "siamois", name: "Siamois", price: 10, fur: "#F1E3CC", dark: "#6B4A3A", points: true, eye: "#3F95CF" },
    { id: "chartreux", name: "Chartreux", price: 13, fur: "#8E99A8", dark: "#727D8C", eye: "#D99A22" },
    { id: "mainecoon", name: "Maine coon", price: 20, fur: "#B07A4A", dark: "#7E5230", belly: "#F3E3CC", stripes: true, big: true },
    { id: "noir", name: "Chat noir", price: 13, fur: "#26242A", dark: "#141316", eye: "#C9D94A" },
    { id: "blanc", name: "Chat blanc", price: 20, fur: "#F4F1EC", dark: "#D8D3CC", eye: "#5FA4DD" },
    { id: "tricolore", name: "Tricolore", price: 26, fur: "#F6F2EC", dark: "#E07A2E", belly: "#FFFFFF", eye: "#7DAA3C" },
    { id: "scottish", name: "Scottish fold", price: 33, fur: "#B3B6BE", dark: "#8A8D96", belly: "#E9E6E2", stripes: true, eye: "#E08A1E" },
    { id: "birman", name: "Sacré de Birmanie", price: 39, fur: "#F1E2CB", dark: "#5A3F33", points: true, eye: "#4D7FD0", big: true },
    { id: "bengal", name: "Bengal", price: 46, fur: "#D39A4E", dark: "#6B4423", belly: "#F3DFC0", stripes: true, eye: "#3DAA4E" },
    { id: "persan", name: "Persan", price: 52, fur: "#F2E6D2", dark: "#D9C8AE", eye: "#D97A1E", big: true },
    { id: "sphynx", name: "Sphynx", price: 59, fur: "#E8B9AA", dark: "#C98F80", eye: "#2EB8A6" },
    { id: "bengalneige", name: "Bengal des neiges", price: 65, fur: "#E2E4E8", dark: "#6E727C", belly: "#F4EDE2", stripes: true, eye: "#3FA4E0" },
    { id: "or", name: "Chat d'or", price: 78, fur: "#E2B43A", dark: "#B9822A", belly: "#F4D27A", stripes: true, eye: "#1FA060" }
  ];
  const BREED = {}; BREEDS.forEach(b => { BREED[b.id] = b; });
  /* Robes rares : on ne peut pas les adopter, elles n'arrivent qu'avec un chaton. Ce sont les poses du chat roux, recolorées. */
  const RARES = [
    { id: "creme", name: "Crème", fur: "#F1DEC0", dark: "#D6BE98", belly: "#FFF6E8", stripes: true },
    { id: "chocolat", name: "Chocolat", fur: "#7A5440", dark: "#5A3B2C", belly: "#C9A58A", stripes: true },
    { id: "rose", name: "Rose praline", fur: "#F2A6BE", dark: "#D9819E", belly: "#FDE3EB", stripes: true },
    { id: "lavande", name: "Lavande", fur: "#BBA8E8", dark: "#9883CF", belly: "#EEE8FB", stripes: true },
    { id: "menthe", name: "Menthe", fur: "#95DDC0", dark: "#6DBF9F", belly: "#E3F7EE", stripes: true },
    { id: "nuage", name: "Bleu nuage", fur: "#9EC7EE", dark: "#77A6D6", belly: "#E6F1FC", stripes: true }
  ];
  RARES.forEach(r => { r.rare = true; BREED[r.id] = r; });
  const COATS = BREEDS.concat(RARES);       // toutes les robes de l'album
  /* Chats peints : quatre poses par race (debout, marche, assis, dort), tournées vers la droite.
     Une race sans images retombe sur le chat dessiné en code. */
  const CATS = window.RONRON_CATS || {};
  COATS.forEach(b => { if (CATS[b.id]) b.sprite = b.id; });
  const SPRITE_SCALE = 0.46;
  /* Accessoires : chacun est dessiné seul, posé par-dessus le chat. Ceux du roux vont à toutes les races (mêmes poses),
     le Maine coon a les siens. Un chat en porte jusqu'à trois : un au cou, un sur les yeux, un sur la tête (dessinés dans cet ordre). */
  const ACC_IMG = window.RONRON_ACC || {}, ACC_MC = window.RONRON_ACCM || {};
  const WEAR_SLOTS = [["tete", "Sur la tête"], ["yeux", "Sur les yeux"], ["cou", "Au cou"]];
  const DRAW_ORDER = ["cou", "yeux", "tete"];
  const ACCS = [
    { id: "grelot", name: "Collier à grelot", slot: "cou", price: 2 },
    { id: "noeud", name: "Nœud papillon", slot: "cou", price: 3 },
    { id: "echarpe", name: "Écharpe", slot: "cou", price: 3 },
    { id: "bonnet", name: "Bonnet", slot: "tete", price: 4 },
    { id: "couronne", name: "Couronne", slot: "tete", price: 8 },
    { id: "lunettes", name: "Lunettes rondes", slot: "yeux", price: 10 },
    { id: "noeudrose", name: "Nœud rose", slot: "tete", price: 8 },
    { id: "perles", name: "Collier de perles", slot: "cou", tuna: 4 },
    { id: "bandana", name: "Bandana", slot: "cou", price: 9 },
    { id: "soleil", name: "Lunettes de soleil", slot: "yeux", price: 12 },
    { id: "paille", name: "Chapeau de paille", slot: "tete", price: 13 },
    { id: "fleurs", name: "Couronne de fleurs", slot: "tete", tuna: 4 },
    { id: "hawai", name: "Collier hawaïen", slot: "cou", price: 10 },
    { id: "sorciere", name: "Chapeau de sorcière", slot: "tete", tuna: 5 },
    { id: "pirate", name: "Chapeau de pirate", slot: "tete", tuna: 5 },
    { id: "lapin", name: "Oreilles de lapin", slot: "tete", price: 13 },
    { id: "cape", name: "Cape de super-héros", slot: "cou", tuna: 6 },
    { id: "noel", name: "Bonnet de Noël", slot: "tete", price: 12 },
    { id: "cacheoreilles", name: "Cache-oreilles", slot: "tete", price: 10 },
    { id: "renne", name: "Bois de renne", slot: "tete", tuna: 4 },
    { id: "cadeau", name: "Nœud de cadeau", slot: "cou", price: 9 }
  ].filter(a => ACC_IMG[a.id]);                        // un accessoire n'apparaît qu'une fois ses images arrivées
  const ACC = {}; ACCS.forEach(a => { ACC[a.id] = a; });
  const wornIds = cat => DRAW_ORDER.map(k => cat && cat.wears && cat.wears[k]).filter(id => id && ACC[id]);
  function catLook(breed, worn, pose) {
    const mc = breed === "mainecoon", T = mc ? ACC_MC : ACC_IMG;
    // une image par chat (ou par accessoire) : ses 4 poses côte à côte, q.sx dit où commence la pose
    return { src: "assets/c/" + breed + ".webp", q: CATS[breed][pose],
             accs: (worn || []).filter(id => T[id] && T[id][pose]).map(id => ({ src: "assets/c/" + (T[id][pose].f || (mc ? "accm-" : "acc-") + id) + ".webp", q: T[id][pose] })) };
  }
  const CAT_NAMES = ["Mochi", "Caramel", "Pixel", "Noisette", "Gribouille", "Plume", "Biscotte", "Ziggy", "Pépite", "Olive", "Câlin", "Praline",
    "Réglisse", "Nougat", "Filou", "Sushi", "Cannelle", "Moka", "Pompon", "Miette", "Flocon", "Cookie", "Tofu", "Pistache", "Brioche",
    "Chipie", "Sésame", "Truffe", "Kiwi", "Bulle", "Galette", "Mimosa", "Patate", "Choupette", "Grisou", "Doudou"];
  const MAX_CATS = 30;

  /* Thon : la deuxième monnaie. Elle ne se gagne qu'en finissant un niveau sans perdre de poisson,
     et sert à nourrir un chat pour qu'il ait un chaton. */
  const TUNA_FOR = { normal: 1, double: 1, mini: 2, boss: 3, geant: 5, rafale: 2, trouee: 1, zero: 2, pelotes: 1 };
  const LITTER = 20;          // boîtes de thon pour un chaton
  const BIRTH_LEVELS = 3;     // il naît 3 niveaux réussis plus tard
  const GROW_LEVELS = 10;     // et devient grand 10 niveaux réussis après sa naissance
  const KITTEN_SCALE = 0.62;
  const catsSoon = () => S.cats.length + S.cats.filter(c => c.expect).length;   // les chatons attendus ont déjà leur place
  // Robe du chaton, tirée quand on nourrit sa mère : souvent la sienne, sinon une autre race (les moins chères plus souvent),
  // parfois une robe rare (de préférence une qu'on n'a pas encore).
  function rollCoat(mom) {
    const r = Math.random();
    if (r < 0.4) return mom.breed;
    if (r < 0.82) {
      const w = BREEDS.map(b => 1 / b.price), tot = w.reduce((a, b) => a + b, 0);
      let x = Math.random() * tot;
      for (let i = 0; i < BREEDS.length; i++) { x -= w[i]; if (x <= 0) return BREEDS[i].id; }
      return BREEDS[0].id;
    }
    const missing = RARES.filter(c => !S.album[c.id]), pool = missing.length ? missing : RARES;
    return pool[Math.floor(Math.random() * pool.length)].id;
  }
  // Après chaque niveau réussi : les chatons attendus naissent, les chatons grandissent.
  function growFamily() {
    const born = [], grown = [];
    S.cats.slice().forEach(c => {
      if (c.kitten && S.level >= c.kitten) { delete c.kitten; grown.push(c); }
      if (c.expect && S.level >= c.expect.due) {
        const used = S.cats.map(o => o.name);
        const name = CAT_NAMES.find(n => used.indexOf(n) < 0) || "Chaton " + S.nextCat;
        const kid = { id: S.nextCat++, breed: BREED[c.expect.coat] ? c.expect.coat : c.breed, name: name, owned: [], wears: {},
          kitten: S.level + GROW_LEVELS, mom: c.id, fresh: true };
        S.cats.push(kid); S.album[kid.breed] = true; delete c.expect;
        born.push({ mom: c, kid: kid });
      }
    });
    return { born: born, grown: grown };
  }
  // un seul accessoire (« wear ») devient un par endroit (« wears ») ; un ancien accessoire disparu est simplement retiré
  function migrateWears() {
    (S.cats || []).forEach(c => {
      if (!c.wears) c.wears = {};
      if (c.wear) { const a = ACC[c.wear]; if (a) c.wears[a.slot] = a.id; }
      delete c.wear;
    });
  }
  function migrateAlbum() {
    migrateWears();
    if (!S.album || typeof S.album !== "object") S.album = {};
    if (typeof S.tuna !== "number") S.tuna = 0;
    S.cats.forEach(c => { S.album[c.breed] = true; });
  }

  /* ================= 2. Sauvegarde et vies ================= */

  function freshSave() {
    return { v: 1, level: 1, kibble: 0, lives: MAX_LIVES, lifeAt: 0, house: {}, zones: {}, cats: [], nextCat: 1, inLevel: null, tuna: 0, album: {}, tickets: 3, games: { m3: 1, tm: 1 } };
  }
  let S = freshSave();
  let memoryOnly = false;
  let loaded = false;      // tant que la partie n'a pas été relue, on n'écrit rien : on ne remplace jamais une sauvegarde par une partie vide

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) S = Object.assign(freshSave(), JSON.parse(raw));
      loaded = true;
    } catch (e) { memoryOnly = true; }
  }
  function save() {
    if (!loaded) return;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { memoryOnly = true; }
  }

  // Code de sauvegarde : la partie entière, à copier pour la retrouver ailleurs.
  function saveCode() {
    const bytes = new TextEncoder().encode(JSON.stringify(S));
    let bin = ""; bytes.forEach(b => { bin += String.fromCharCode(b); });
    return "RONRON1." + btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function readCode(text) {
    try {
      const t = String(text || "").replace(/\s+/g, "");
      if (t.indexOf("RONRON1.") !== 0) return null;
      const bin = atob(t.slice(8).replace(/-/g, "+").replace(/_/g, "/"));
      const o = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, ch => ch.charCodeAt(0))));
      if (!o || typeof o.level !== "number" || typeof o.kibble !== "number" || !o.house || !Array.isArray(o.cats)) return null;
      return Object.assign(freshSave(), o);
    } catch (e) { return null; }
  }

  // lifeAt : début de la demi-heure en cours de recharge (0 si les vies sont pleines).
  function syncLives() {
    const now = Date.now();
    if (S.lives >= MAX_LIVES) { S.lifeAt = 0; return; }
    if (!S.lifeAt || S.lifeAt > now) S.lifeAt = now;
    while (S.lives < MAX_LIVES && now - S.lifeAt >= LIFE_MS) { S.lives++; S.lifeAt += LIFE_MS; }
    if (S.lives >= MAX_LIVES) S.lifeAt = 0;
  }
  function loseLife() {
    syncLives();
    if (S.lives > 0) { S.lives--; if (!S.lifeAt) S.lifeAt = Date.now(); }
  }
  function nextLifeIn() { return S.lives >= MAX_LIVES ? 0 : Math.max(0, LIFE_MS - (Date.now() - S.lifeAt)); }
  function clock(ms) {
    const s = Math.ceil(ms / 1000), m = Math.floor(s / 60);
    return m + ":" + String(s % 60).padStart(2, "0");
  }

  /* ================= 3. Interface commune ================= */

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const app = $("#app"), sheet = $("#sheet"), backdrop = $("#backdrop"), toastEl = $("#toast");
  const ico = (name, cls) => '<svg class="ico' + (cls ? " " + cls : "") + '" aria-hidden="true"><use href="#i-' + name + '"/></svg>';
  const plural = (n, word) => n + " " + word + (n > 1 ? "s" : "");
  const levelsText = n => n + (n > 1 ? " niveaux" : " niveau");
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let view = "home", pendingReload = false;
  /* Mode contemplation : on cache tout (bandeau, onglets, bulles, indications) pour ne garder que le domaine et les chats.
     La carte s'agrandit à tout l'écran ; on garde le même endroit au centre. Le bouton reste, discret, pour revenir. */
  let zen = false, zenTimer = 0;
  function setZen(on) {
    if (on === zen) return;
    const l0 = camLimits(), wx = (l0.vw / 2 - cam.x) / cam.s, wy = (l0.vh / 2 - cam.y) / cam.s;
    zen = on;
    app.classList.toggle("zen", on);
    const b = $("#btn-zen");
    b.setAttribute("aria-pressed", String(on));
    b.setAttribute("aria-label", on ? "Afficher l'interface" : "Masquer l'interface pour regarder les chats");
    b.firstChild.firstChild.setAttribute("href", on ? "#i-eye" : "#i-eye-off");
    if (on) toastEl.hidden = true;
    if (l0.vw) centerOn(wx, wy, cam.s);
    zenWake();
  }
  // en mode contemplation, le bouton s'estompe ; il se réveille dès qu'on touche l'écran
  function zenWake() {
    const b = $("#btn-zen");
    b.classList.add("awake"); clearTimeout(zenTimer);
    if (zen) zenTimer = setTimeout(() => b.classList.remove("awake"), 2500);
  }
  $("#btn-zen").addEventListener("click", () => setZen(!zen));      // le son du bouton est joué par le gestionnaire commun
  $("#screen-home").addEventListener("pointerdown", () => { if (zen) zenWake(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && zen && sheet.hidden) setZen(false); });

  function show(name) {
    if (name !== "home") setZen(false);
    if (pendingReload && name !== "level" && name !== "bonus") { pendingReload = false; save(); location.reload(); return; }
    view = name;
    ["home", "level", "shop", "cards", "games", "bonus"].forEach(v => { $("#screen-" + v).hidden = v !== name; });
    app.classList.toggle("inlevel", name === "level" || name === "bonus");
    $("#tab-home").setAttribute("aria-current", name === "home" ? "page" : "false");
    $("#tab-shop").setAttribute("aria-current", name === "shop" ? "page" : "false");
    $("#tab-cards").setAttribute("aria-current", name === "cards" ? "page" : "false");
    $("#tab-games").setAttribute("aria-current", name === "games" ? "page" : "false");
    if (name === "home") { renderHome(); announceBirth(); }
    if (name === "shop") renderShop();
    if (name === "cards") renderCards();
    if (name === "games") RonronJeux.renderHub();
    renderAdventBtn(); startSnow(); updateCardBadge();
  }

  let sheetClose = null, sheetSticky = false;
  function openSheet(html, opts) {
    closeSheet();
    opts = opts || {};
    sheet.innerHTML = html;
    sheet.hidden = false; backdrop.hidden = false;
    sheetClose = opts.onClose || null; sheetSticky = !!opts.sticky;
    const first = $("button, input", sheet);
    if (first && !opts.noFocus) { try { first.focus({ preventScroll: true }); } catch (e) { /* sans importance */ } }
  }
  function closeSheet() {
    if (sheet.hidden) return;
    sheet.hidden = true; backdrop.hidden = true; sheet.innerHTML = "";
    const cb = sheetClose; sheetClose = null;
    if (cb) cb();
  }
  backdrop.addEventListener("click", () => { if (!sheetSticky) closeSheet(); });

  let toastTimer = 0;
  function toast(msg) {
    toastEl.textContent = msg; toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, 2600);
  }
  function buzz(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* sans importance */ } }

  /* ---------- Sons et musique ----------
     Tout passe par un AudioContext : c'est le seul moyen de régler le volume sur iPhone.
     Les bruitages sont fabriqués à la volée (aucun fichier) ; les musiques sont trois morceaux joués à la suite, en boucle. */
  const AUDIO_KEY = "maison-ronron-audio";
  const MUSIC = ["assets/a/musique-1.mp3", "assets/a/musique-2.mp3", "assets/a/musique-3.mp3"];
  const audioPref = { sfx: 0.7, music: 0.45 };
  try { Object.assign(audioPref, JSON.parse(localStorage.getItem(AUDIO_KEY) || "{}")); } catch (e) { /* réglages par défaut */ }
  let AC = null, sfxOut = null, musicOut = null, musicSrc = null, musicIdx = Math.floor(Math.random() * MUSIC.length), musicTimer = 0, musicRun = 0, noiseBuf = null, lastTick = 0;
  const curve = v => v * v;                       // l'oreille n'entend pas le volume de façon linéaire
  function audioApply() {
    if (!AC) return;
    sfxOut.gain.value = curve(audioPref.sfx);
    musicOut.gain.setTargetAtTime(curve(audioPref.music) * 0.9, AC.currentTime, 0.08);
    if (audioPref.music > 0) startMusic(); else stopMusic();
  }
  function setAudio(key, v) {
    audioPref[key] = Math.max(0, Math.min(1, v));
    try { localStorage.setItem(AUDIO_KEY, JSON.stringify(audioPref)); } catch (e) { /* sans importance */ }
    audioApply();
  }
  // Les navigateurs n'autorisent le son qu'après un premier geste : on démarre (ou on relance) à chaque appui.
  function audioWake() {
    try {
      if (!AC) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        AC = new Ctx();
        sfxOut = AC.createGain(); musicOut = AC.createGain();
        sfxOut.connect(AC.destination); musicOut.connect(AC.destination);
        audioApply();
      } else if (AC.state !== "running" && !document.hidden) AC.resume();
    } catch (e) { AC = null; }
  }
  ["pointerdown", "touchend", "keydown"].forEach(ev => document.addEventListener(ev, audioWake, true));
  document.addEventListener("visibilitychange", () => {
    if (!AC) return;
    try { if (document.hidden) AC.suspend(); else AC.resume(); } catch (e) { /* sans importance */ }
  });

  function stopMusic() {
    musicRun++; clearTimeout(musicTimer);
    if (musicSrc) { try { musicSrc.onended = null; musicSrc.stop(); } catch (e) { /* déjà arrêtée */ } musicSrc = null; }
  }
  function startMusic() {
    if (!AC || musicSrc || audioPref.music <= 0) return;
    const run = ++musicRun, url = MUSIC[musicIdx % MUSIC.length];
    clearTimeout(musicTimer);
    musicSrc = { pending: true };
    fetch(url).then(r => r.arrayBuffer()).then(data => new Promise((ok, ko) => AC.decodeAudioData(data, ok, ko))).then(buf => {
      if (run !== musicRun) return;
      const src = AC.createBufferSource();
      src.buffer = buf; src.connect(musicOut);
      src.onended = () => {
        if (musicSrc !== src) return;
        musicSrc = null; musicIdx++;
        musicTimer = setTimeout(startMusic, 1800);          // un court silence, puis le morceau suivant
      };
      src.start(); musicSrc = src;
    }).catch(() => { if (run === musicRun) { musicSrc = null; musicIdx++; musicTimer = setTimeout(startMusic, 20000); } });
  }

  // Briques des bruitages : une note (o.f en Hz, glissant vers o.f2) ou un souffle filtré.
  function tone(o) {
    const t0 = AC.currentTime + (o.t || 0), osc = AC.createOscillator(), g = AC.createGain();
    osc.type = o.type || "sine";
    osc.frequency.setValueAtTime(o.f, t0);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t0 + o.d);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(o.g, t0 + (o.a || 0.006));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.d);
    osc.connect(g); g.connect(sfxOut);
    osc.start(t0); osc.stop(t0 + o.d + 0.03);
  }
  function hiss(o) {
    if (!noiseBuf) {
      noiseBuf = AC.createBuffer(1, Math.floor(AC.sampleRate * 0.4), AC.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t0 = AC.currentTime + (o.t || 0), src = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
    src.buffer = noiseBuf; f.type = "bandpass"; f.frequency.value = o.f; f.Q.value = o.q || 1.2;
    g.gain.setValueAtTime(o.g, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.d);
    src.connect(f); f.connect(g); g.connect(sfxOut);
    src.start(t0); src.stop(t0 + o.d + 0.02);
  }
  const chime = (notes, t, step, d, g) => notes.forEach((f, k) => { tone({ f: f, t: t + k * step, d: d, g: g, type: "triangle" }); tone({ f: f * 2, t: t + k * step, d: d * 0.6, g: g * 0.25 }); });
  const SFX = {
    tap: () => tone({ f: 620, f2: 520, d: 0.045, g: 0.07, type: "triangle" }),
    cross: () => tone({ f: 900, f2: 700, d: 0.05, g: 0.11, type: "triangle" }),
    uncross: () => tone({ f: 520, f2: 400, d: 0.05, g: 0.09, type: "triangle" }),
    cat: () => {                                   // petit « mrrp » montant, puis deux notes claires
      tone({ f: 480, f2: 760, d: 0.11, g: 0.16, type: "triangle" });
      chime([784, 1175], 0.09, 0.08, 0.26, 0.17);
    },
    wrong: () => {                                 // deux notes graves qui frottent
      tone({ f: 196, f2: 120, d: 0.32, g: 0.26, type: "triangle" });
      tone({ f: 208, f2: 127, d: 0.32, g: 0.16, type: "triangle" });
      hiss({ f: 300, d: 0.12, g: 0.12 });
    },
    win: () => { chime([523, 659, 784, 1047], 0, 0.1, 0.34, 0.18); chime([1319, 1568, 2093], 0.44, 0.07, 0.6, 0.1); },
    lose: () => chime([392, 311, 262], 0, 0.2, 0.5, 0.17),
    build: () => {                                 // trois coups de marteau, puis l'étincelle du travail fini
      [0, 0.15, 0.3].forEach(t => { hiss({ f: 1100, q: 2, t: t, d: 0.07, g: 0.35 }); tone({ f: 170, f2: 90, t: t, d: 0.09, g: 0.3 }); });
      chime([1047, 1319, 1568, 2093], 0.5, 0.07, 0.5, 0.13);
    },
    buy: () => {                                   // ronron (note grave qui tremble) et carillon de bienvenue
      for (let k = 0; k < 9; k++) tone({ f: 62 + (k % 2) * 4, t: k * 0.05, d: 0.05, g: 0.14, type: "sawtooth", a: 0.01 });
      chime([659, 784, 1047], 0.3, 0.1, 0.45, 0.16);
    },
    wear: () => chime([880, 1319], 0, 0.07, 0.28, 0.13),
    pop: () => { tone({ f: 700, f2: 1100, d: 0.07, g: 0.12, type: "triangle" }); tone({ f: 1400, t: 0.03, d: 0.06, g: 0.05 }); },
    pop2: () => { tone({ f: 880, f2: 1500, d: 0.07, g: 0.12, type: "triangle" }); chime([1568], 0.05, 0, 0.18, 0.08); },
    zap: () => { hiss({ f: 2400, q: 0.8, d: 0.18, g: 0.16 }); tone({ f: 1200, f2: 300, d: 0.22, g: 0.12, type: "sawtooth" }); }
  };
  function sfx(name) {
    if (!AC || AC.state !== "running" || audioPref.sfx <= 0) return;
    if (name === "cross" || name === "uncross") {            // en glissant le doigt, pas plus d'un tic toutes les 40 ms
      const now = performance.now();
      if (now - lastTick < 40) return;
      lastTick = now;
    }
    try { SFX[name](); } catch (e) { /* un bruitage raté ne doit jamais gêner le jeu */ }
  }
  // un tic discret sur les boutons de l'interface
  document.addEventListener("click", e => {
    const b = e.target.closest ? e.target.closest("button, .mk") : null;
    if (b && !b.disabled && !(b.closest && b.closest("#board"))) sfx("tap");
  }, true);

  let lastKibble = -1, lastTuna = -1;
  function updateHud() {
    syncLives();
    $("#kibble-count").textContent = S.kibble;
    if (lastKibble !== -1 && lastKibble !== S.kibble) {
      const p = $("#hud-kibble"); p.classList.remove("bump"); void p.offsetWidth; p.classList.add("bump");
    }
    lastKibble = S.kibble;
    $("#tuna-count").textContent = S.tuna;
    if (lastTuna !== -1 && lastTuna !== S.tuna) {
      const p = $("#hud-tuna"); p.classList.remove("bump"); void p.offsetWidth; p.classList.add("bump");
    }
    lastTuna = S.tuna;
    $("#lives-count").textContent = S.lives;
    $("#lives-timer").textContent = S.lives < MAX_LIVES ? "+1 dans " + clock(nextLifeIn()) : "";
    const play = $("#tab-play");
    play.classList.toggle("nolife", S.lives <= 0);
    $("#play-sub").textContent = S.lives <= 0 ? "Vie dans " + clock(nextLifeIn()) : levelName(S.level);
    play.dataset.kind = S.lives <= 0 ? "normal" : kindOf(S.level);
    const gt = $("#tab-games"), nt = S.tickets || 0;
    gt.classList.toggle("badge", nt > 0); gt.dataset.n = nt > 99 ? "99+" : nt;
  }

  /* ================= 4. Niveaux ================= */

  // Les niveaux sont calculés en tâche de fond quand c'est possible, pour ne pas figer l'écran.
  const levelCache = {}, levelWaiters = {};
  let worker = null, workerBroken = false;
  function getWorker() {
    if (worker || workerBroken) return worker;
    try {
      const tag = document.querySelector('script[src^="gen.js"]');       // même version que le reste de la page
      worker = new Worker(tag ? tag.getAttribute("src") : "gen.js");
      worker.onmessage = e => deliver(e.data);
      worker.onerror = () => {
        workerBroken = true; worker = null;
        Object.keys(levelWaiters).forEach(k => computeHere(+k));
      };
    } catch (e) { workerBroken = true; worker = null; }
    return worker;
  }
  function computeHere(level) {
    setTimeout(() => deliver(window.RonronGen.makeLevel(level) || { level: level, failed: true }), 30);
  }
  function deliver(lv) {
    if (!lv.failed) levelCache[lv.level] = lv;
    const w = levelWaiters[lv.level];
    if (w) { delete levelWaiters[lv.level]; w.resolve(lv); }
  }
  function requestLevel(level) {
    if (levelCache[level]) return Promise.resolve(levelCache[level]);
    if (levelWaiters[level]) return levelWaiters[level].promise;
    const w = {};
    w.promise = new Promise(res => { w.resolve = res; });
    levelWaiters[level] = w;
    if (getWorker()) worker.postMessage(level); else computeHere(level);
    return w.promise;
  }

  const board = $("#board");
  let L = null;          // partie en cours : { lv, n, k, sol, st, fish, placed, over, time }
  // Types de niveaux (calculés par gen.js) : nom affiché et récompense.
  const KIND_NAME = { normal: "", double: "Deux chats", mini: "Mini-boss", boss: "Boss", geant: "Boss géant", rafale: "Rafale", trouee: "Grille trouée", zero: "Zéro faute", pelotes: "Pelotes" };
  const SPECIAL = { rafale: 1, trouee: 1, zero: 1, pelotes: 1 };
  // Explication montrée la première fois qu'on tombe sur chaque niveau spécial (un tous les 7 niveaux).
  const SPECIAL_RULES = {
    rafale: ["Rafale", "Cinq petites grilles 5 × 5 à enchaîner avant la fin du compte à rebours. Tes 3 poissons servent pour les cinq grilles. Si le temps est écoulé, le niveau est perdu."],
    trouee: ["Grille trouée", "Des pots de fleurs occupent certaines cases : aucun chat ne peut s'y installer. Toutes les autres règles restent les mêmes."],
    zero: ["Zéro faute", "Un seul poisson : la moindre erreur fait perdre le niveau. En échange, la récompense est triplée."],
    pelotes: ["Pelotes", "Chaque pelote de laine indique combien de chats sont posés dans les 8 cases qui l'entourent. Une pelote n'accueille jamais de chat."]
  };
  const kindOf = level => (window.RonronGen ? window.RonronGen.kindOf(level) : "normal");
  const rewardOf = level => (window.RonronGen ? window.RonronGen.rewardFor(level) : 1);
  const levelName = level => "Niveau " + level + (KIND_NAME[kindOf(level)] ? " · " + KIND_NAME[kindOf(level)] : "");
  // Bonus de rapidité : en dessous de ce temps, une croquette de plus. Il dépend de la taille de la grille, double avec deux chats.
  const FAST_BY_SIZE = { 5: 30, 6: 40, 7: 50, 8: 60, 9: 75, 10: 90 };
  const fastFor = (n, k) => (FAST_BY_SIZE[n] || 90) * (k === 2 ? 2 : 1);

  // Chrono du niveau : il ne compte que quand l'appli est à l'écran.
  function elapsed() { if (!L || !L.time) return 0; const t = L.time; return (t.acc + (t.from ? performance.now() - t.from : 0)) / 1000; }
  function clockText(sec) { sec = Math.floor(sec); return Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0"); }
  function renderChrono() {
    const el = $("#chrono"); if (!el) return;
    if (!L || !L.time) { el.hidden = true; return; }
    const sec = elapsed(); el.hidden = false;
    if (L.limit) {                       // rafale : compte à rebours
      const left = Math.max(0, L.limit - sec);
      el.textContent = clockText(Math.ceil(left));
      el.classList.remove("late"); el.classList.toggle("hurry", left < 30);
      if (left <= 0 && !L.over) timeUp();
      return;
    }
    el.classList.remove("hurry");
    el.textContent = clockText(sec);
    el.classList.toggle("late", sec >= L.fast);
  }
  document.addEventListener("visibilitychange", () => {
    if (!L || !L.time || L.over) return;
    const t = L.time;
    if (document.hidden && t.from) { t.acc += performance.now() - t.from; t.from = 0; }
    else if (!document.hidden && !t.from) t.from = performance.now();
  });
  setInterval(() => { if (L && L.time && !L.over && view === "level") renderChrono(); }, 250);
  // État d'une case : 0 vide, 1 croix du joueur, 3 chat, 4 erreur (2, ancienne croix automatique, n'est plus utilisé).

  function renderFishes(left, max) {
    max = max || (L && L.fishMax) || 3;
    let h = "";
    for (let k = 0; k < max; k++) h += '<svg viewBox="0 0 28 20"' + (k >= left ? ' class="lost"' : "") + '><use href="#i-fish"/></svg>';
    const f = $("#fishes"); f.innerHTML = h; f.setAttribute("aria-label", plural(left, "poisson") + " sur " + max);
  }

  function startLevel() {
    syncLives();
    if (S.lives <= 0) { toast("Plus de vies. La prochaine arrive dans " + clock(nextLifeIn()) + "."); return; }
    closeSheet();
    show("level");
    const level = S.level;
    L = null;
    $("#level-title").textContent = "Niveau " + level;
    $("#level-size").textContent = "";
    $("#screen-level").dataset.kind = kindOf(level);
    renderChrono();
    board.className = "board loading";
    board.innerHTML = "<span>Préparation de la grille…</span>";
    renderFishes(3);
    requestLevel(level).then(lv => {
      if (view !== "level" || S.level !== level || L) return;
      if (lv.failed) { toast("Impossible de préparer ce niveau."); show("home"); return; }
      initLevel(lv);
      requestLevel(level + 1);
    });
  }

  function initLevel(lv) {
    const n = lv.n;
    const k = lv.k || 1, kind = lv.kind || "normal";
    const fishMax = kind === "zero" ? 1 : 3;
    L = { lv: lv, n: n, k: k, fast: fastFor(n, k), sol: new Set(lv.stars || lv.solution.map((c, r) => r * n + c)), st: new Uint8Array(n * n), fish: fishMax, fishMax: fishMax,
          placed: 0, over: false, grid: 0, limit: kind === "rafale" ? lv.limit || 180 : 0,
          time: { acc: 0, from: document.hidden ? 0 : performance.now() } };
    S.inLevel = { level: lv.level, fishLost: 0 }; save();
    sizeLine();
    renderChrono();
    drawBoard(lv);
    renderFishes(fishMax, fishMax);
    clearTimeout(hintArm); hintArm = 0; hintBusy = false; $("#level-hint").classList.remove("why"); renderHintBtn();
    $("#level-hint").textContent = k === 2
      ? "Deux chats par zone, par ligne et par colonne, jamais côte à côte. En moins de " + clockText(L.fast) + ", une croquette en plus."
      : kind === "rafale" ? "Cinq grilles 5 × 5 à finir avant la fin du compte à rebours."
      : kind === "trouee" ? "Pas de chat dans les pots de fleurs. En moins de " + clockText(L.fast) + ", une croquette en plus."
      : kind === "zero" ? "Un seul poisson : pas le droit à l'erreur. Récompense triplée."
      : kind === "pelotes" ? "Chaque pelote dit combien de chats l'entourent (8 cases autour)."
      : lv.level <= 2
      ? "Un chat par zone, par ligne et par colonne, jamais côte à côte. Un tap : croix. Deux taps : chat."
      : "Un tap : une croix. Deux taps rapides : un chat. En moins de " + clockText(L.fast) + ", une croquette en plus.";
    if (k === 2 && !S.seenGeant) {         // premier boss géant : on explique la règle avant de lancer le chrono
      S.seenGeant = true; save(); L.time.from = 0;
      const cur = L; showRules(() => { if (L === cur && !L.over && !document.hidden) L.time.from = performance.now(); });
    } else if (SPECIAL[kind] && !(S.seenSpecial && S.seenSpecial[kind])) {     // premier niveau spécial de ce type
      S.seenSpecial = Object.assign({}, S.seenSpecial, { [kind]: true }); save(); L.time.from = 0;
      const cur = L; showSpecial(kind, () => { if (L === cur && !L.over && !document.hidden) L.time.from = performance.now(); });
    }
  }
  function sizeLine() {
    const lv = L.lv, reward = lv.reward || rewardOf(lv.level);
    $("#level-size").textContent = (KIND_NAME[lv.kind] ? KIND_NAME[lv.kind] + " · " : "") +
      (lv.kind === "rafale" ? "grille " + (L.grid + 1) + " sur 5 · " : "") + plural(reward, "croquette");
  }
  // Dessine la grille : couleurs mélangées selon le niveau, pots de fleurs (grille trouée) et pelotes.
  function drawBoard(lv) {
    const n = lv.n, g = lv.grids ? lv.grids[L.grid] : lv;
    const rnd = window.RonronGen.mulberry32(lv.level * 31 + 7 + L.grid * 101);
    const cols = ZONE_COLORS.slice();
    for (let i = cols.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = cols[i]; cols[i] = cols[j]; cols[j] = t; }
    L.cols = cols;
    const block = new Set(lv.block || []), clue = {};
    (lv.clues || []).forEach(q => { clue[q[0]] = q[1]; });
    board.className = "board";
    board.style.setProperty("--n", n);
    board.style.setProperty("--gap", (n <= 6 ? 7 : n <= 8 ? 5 : 3) + "px");
    board.style.setProperty("--rc", (n <= 6 ? 11 : n <= 8 ? 8 : 6) + "px");
    let h = "";
    for (let i = 0; i < n * n; i++) {
      if (block.has(i)) { h += '<div class="cell block" data-i="' + i + '" data-s="5"><svg class="pot"><use href="#i-pot"/></svg></div>'; continue; }
      const z = '" style="--zone:' + cols[g.regions[i]] + '">';
      if (clue[i] !== undefined) { h += '<div class="cell clue" data-i="' + i + '" data-s="5' + z + '<svg class="yarn"><use href="#i-yarn"/></svg><b>' + clue[i] + "</b></div>"; continue; }
      h += '<div class="cell" data-i="' + i + '" data-s="0' + z + '<svg class="c"><use href="#i-cat"/></svg><svg class="x"><use href="#i-cross"/></svg></div>';
    }
    board.innerHTML = h;
    L.cells = $$(".cell", board);
    L.st = new Uint8Array(n * n); L.placed = 0;
    for (let i = 0; i < n * n; i++) if (block.has(i) || clue[i] !== undefined) L.st[i] = 5;     // 5 : case sans chat possible
    L.sol = new Set(g.stars);
  }
  // Rafale : grille suivante, ou fin du niveau.
  function nextGrid() {
    L.grid++;
    sizeLine();
    board.classList.add("swap");
    setTimeout(() => { if (!L || L.over) return; drawBoard(L.lv); }, 260);
    toast("Grille " + (L.grid + 1) + " sur 5");
  }
  function timeUp() {
    if (!L || L.over) return;
    lose("time");
  }
  function showSpecial(kind, then) {
    const r = SPECIAL_RULES[kind];
    openSheet('<span class="tag">Niveau spécial</span><h2>' + r[0] + "</h2><p>" + r[1] + "</p>" +
      "<p>Un niveau spécial arrive tous les 7 niveaux, chacun son tour : Rafale, Grille trouée, Zéro faute et Pelotes. Il rapporte aussi une pochette de cartes.</p>" +
      '<button class="btn block" id="sp-ok" type="button">C\'est parti</button>', { sticky: true });
    $("#sp-ok").onclick = () => { closeSheet(); if (then) then(); };
  }

  function setCell(i, s) { L.st[i] = s; L.cells[i].dataset.s = s; }

  function tryCat(i) {
    if (!L || L.over) return;
    const s = L.st[i];
    if (s >= 2) return;
    if (L.sol.has(i)) {
      setCell(i, 3); L.placed++; buzz(12); sfx("cat");      // les croix restent à la main du joueur : rien n'est rempli à sa place
      if (L.placed === L.n * L.k) { if (L.limit && L.grid < 4) nextGrid(); else win(); }
    } else {
      setCell(i, 4);
      const el = L.cells[i]; el.classList.remove("shake"); void el.offsetWidth; el.classList.add("shake");
      L.fish--; S.inLevel.fishLost++; save();
      renderFishes(L.fish); buzz([30, 40, 30]); sfx("wrong");
      if (L.fish <= 0) lose();
    }
  }

  /* Indice (2 boîtes de thon, toujours payant) : la prochaine case qu'on trouve par logique, avec la raison en une phrase.
     La zone, la ligne ou la colonne concernée s'éclaire, les cases écartées reçoivent une croix grise (un chat posé) ou orange (une déduction),
     les lignes ou colonnes du raisonnement sont encadrées, la case brille, puis le chat s'y pose. Un indice n'est pas une erreur :
     le niveau peut rester parfait. Premier tap : le bouton demande confirmation ; deuxième tap dans les 3 secondes : on paie. */
  const HINT_COST = 2;
  let hintArm = 0, hintBusy = false;
  // Les zones sont nommées par leur couleur ; les lignes et colonnes ne sont jamais numérotées : on les encadre sur la grille.
  const ZONE_NAMES = { "#F6719F": "rose", "#FFC544": "jaune", "#86BDEB": "bleue", "#BDB8EA": "lilas", "#A9DE9C": "verte",
                       "#FF9F6B": "orange", "#6FD3C7": "turquoise", "#C9A27E": "marron", "#9FB0C4": "grise", "#B877AC": "violette" };
  const zoneName = z => '<b class="zn"><i style="background:' + L.cols[z] + '"></i>' + (ZONE_NAMES[L.cols[z]] || "") + "</b>";
  function zoneList(zs) {
    const p = zs.map(zoneName), names = p.length > 1 ? p.slice(0, -1).join(", ") + " et " + p[p.length - 1] : p[0];
    return (zs.length > 1 ? "les zones " : "la zone ") + names;
  }
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  function place(byRow, at) {
    const n = L.n;
    if (byRow) return at === 0 ? "tout en haut" : at === n - 1 ? "tout en bas" : (at + 1) + "e en partant du haut";
    return at === 0 ? "tout à gauche" : at === n - 1 ? "tout à droite" : (at + 1) + "e en partant de la gauche";
  }
  function bandName(r) {
    const m = r.b - r.a + 1, w = r.byRow ? "ligne" : "colonne";
    return m === 1 ? "la " + w + " en pointillés jaunes" : "les " + m + " " + w + "s en pointillés jaunes";
  }
  function stepText(r, several) {
    const one = r.zs && r.zs.length === 1, m = r.b - r.a + 1;
    if (r.rule === "inside") return cap(zoneList(r.zs)) + (one ? " tient tout entière" : " tiennent tout entières") + " dans " + bandName(r) + " : " +
      (one ? "son chat" : "leurs chats") + (m === 1 ? " occupe" : " occupent") + (m === 1 ? " cette " + (r.byRow ? "ligne" : "colonne") : " ces " + (r.byRow ? "lignes" : "colonnes")) +
      ", il n'y reste pas de place pour une autre zone.";
    if (r.rule === "touch") return (one ? "Seule " : "Seules ") + zoneList(r.zs) + (one ? " peut" : " peuvent") + " encore mettre un chat dans " + bandName(r) + " : " +
      (one ? "son chat y sera" : "leurs chats y seront") + " forcément, donc pas ailleurs.";
    if (r.rule === "look") {
      const k = r.kill, where = k.unit === "zone" ? "dans la zone " + zoneName(k.at) : k.unit === "row" ? "sur la ligne en pointillés rouges"
        : k.unit === "col" ? "dans la colonne en pointillés rouges" : "autour de la pelote en pointillés rouges";
      return (several ? "Un chat sur une des cases entourées de rouge" : "Un chat sur la case entourée de rouge") +
        " ne laisserait plus " + (L.k === 2 ? "assez de" : "aucune") + " place " + where + ".";
    }
    if (r.rule === "clue") return "La pelote " + r.v + " a déjà " + (r.v > 1 ? "ses " + r.v + " chats" : "son chat") + " autour d'elle : ses autres voisines restent vides.";
    return "";
  }
  function hintText(h) {
    if (!h) return "Pas de déduction simple ici : voici un chat de la solution.";
    if (h.alone) return "La zone " + zoneName(h.at) + " n'a qu'une seule case : son chat va forcément là.";
    const need = h.need || 1, two = need === 2;
    let head;
    if (h.unit === "clue") head = "Cette pelote veut <b>" + plural(h.v, "chat") + "</b> autour d'elle et il ne reste que ces cases : il en faut un ici.";
    else {
      const inU = h.unit === "zone" ? "Dans la zone " + zoneName(h.at) : h.unit === "row" ? "Sur la ligne encadrée en noir (" + place(true, h.at) + ")"
        : "Dans la colonne encadrée en noir (" + place(false, h.at) + ")";
      head = inU + (two ? ", il ne reste que <b>deux cases</b> pour ses deux chats : en voici un." : ", il ne reste qu'<b>une case</b> possible : la voici.");
    }
    const out = [head];
    if (h.no.some(q => q[1] < 0)) out.push('<span class="hx grey"></span>Croix grises : ces cases ' + (L.k === 2
      ? "touchent un chat déjà posé, ou sont sur une ligne, une colonne ou une zone qui a déjà ses deux chats."
      : "touchent un chat déjà posé, ou sont sur sa ligne, sa colonne ou sa zone."));
    const st = h.steps.slice(-2), looks = st.filter(r => r.rule === "look").length;
    const said = [];                                       // deux déductions qui se disent pareil : une seule phrase
    st.forEach(r => { const t = stepText(r, looks > 1); if (said.indexOf(t) < 0) said.push(t); });
    if (said.length) {
      const t = said.join(" ");
      out.push('<span class="hx orange"></span>Croix orange : ' + t.charAt(0).toLowerCase() + t.slice(1) +
        (h.steps.length > 2 ? " D'autres croix orange viennent d'un raisonnement du même genre, fait juste avant." : ""));
    }
    return out.join("<br>");
  }
  // Sur la grille : l'unité de l'indice (cases claires ou cadre blanc), les cases écartées (croix grises ou orange),
  // les lignes ou colonnes du raisonnement (cadre jaune) et, pour « un chat ici bloquerait… », la case et ce qu'elle bloquerait (rouge).
  function hintCells(h, gr) {
    const n = L.n, out = [];
    for (let j = 0; j < n * n; j++) {
      if (h.unit === "zone" ? gr.regions[j] === h.at && L.st[j] !== 5 : h.unit === "row" ? ((j / n) | 0) === h.at : h.unit === "col" ? j % n === h.at
          : (j === h.at || window.RonronGen.around(n, h.at).indexOf(j) >= 0)) out.push(j);
    }
    return out;
  }
  function hintFrame(kind, r0, c0, r1, c1) {
    const n = L.n, A = L.cells[r0 * n + c0], B = L.cells[r1 * n + c1], f = document.createElement("div"), pad = 3;
    f.className = "hframe " + kind;
    f.style.left = (A.offsetLeft - pad) + "px"; f.style.top = (A.offsetTop - pad) + "px";
    f.style.width = (B.offsetLeft + B.offsetWidth - A.offsetLeft + 2 * pad) + "px"; f.style.height = (B.offsetTop + B.offsetHeight - A.offsetTop + 2 * pad) + "px";
    board.appendChild(f); return f;
  }
  function clearHint() {
    if (!L || !L.cells) return;
    L.cells.forEach(el => el.classList.remove("hint-unit", "hint-dim", "hint-cell", "hint-no", "hint-rule", "hint-ring", "hint-band", "hint-kill"));
    $$(".hframe", board).forEach(f => f.remove());
  }
  function showHint(h, gr, i) {
    const n = L.n, keep = new Set(), unit = h ? hintCells(h, gr) : [i];
    clearHint();
    unit.forEach(j => { keep.add(j); if (j !== i) L.cells[j].classList.add("hint-unit"); });
    if (h && (h.unit === "row" || h.unit === "col")) hintFrame("unit", h.unit === "row" ? h.at : 0, h.unit === "row" ? 0 : h.at, h.unit === "row" ? h.at : n - 1, h.unit === "row" ? n - 1 : h.at);
    if (h) {
      const shown = h.steps.length - Math.min(2, h.steps.length);
      h.no.forEach(q => { const el = L.cells[q[0]]; if (L.st[q[0]] === 3 || L.st[q[0]] === 5) return; el.classList.add("hint-no"); if (q[1] >= 0) el.classList.add("hint-rule"); });
      h.steps.forEach((r, k) => {
        if (k < shown) return;
        if (r.rule === "inside" || r.rule === "touch") {
          hintFrame("band", r.byRow ? r.a : 0, r.byRow ? 0 : r.a, r.byRow ? r.b : n - 1, r.byRow ? n - 1 : r.b);
          for (let j = 0; j < n * n; j++) { const l = r.byRow ? (j / n) | 0 : j % n; if (l >= r.a && l <= r.b) keep.add(j); }
          (r.zs || []).forEach(z => { for (let j = 0; j < n * n; j++) if (gr.regions[j] === z) keep.add(j); });
        } else if (r.rule === "look") {
          L.cells[r.cell].classList.add("hint-ring"); keep.add(r.cell);
          const k = r.kill;
          if (k.unit === "row") hintFrame("kill", k.at, 0, k.at, n - 1);
          else if (k.unit === "col") hintFrame("kill", 0, k.at, n - 1, k.at);
          else if (k.unit === "clue") { const r0 = (k.at / n) | 0, c0 = k.at % n; hintFrame("kill", Math.max(0, r0 - 1), Math.max(0, c0 - 1), Math.min(n - 1, r0 + 1), Math.min(n - 1, c0 + 1)); }
          for (let j = 0; j < n * n; j++) {
            const inK = k.unit === "zone" ? gr.regions[j] === k.at : k.unit === "row" ? ((j / n) | 0) === k.at : k.unit === "col" ? j % n === k.at : Math.abs(((j / n) | 0) - ((k.at / n) | 0)) <= 1 && Math.abs(j % n - k.at % n) <= 1;
            if (inK) { keep.add(j); if (k.unit === "zone") L.cells[j].classList.add("hint-kill"); }
          }
        } else if (r.rule === "clue") {
          const r0 = (r.at / n) | 0, c0 = r.at % n; keep.add(r.at); window.RonronGen.around(n, r.at).forEach(j => keep.add(j));
          hintFrame("band", Math.max(0, r0 - 1), Math.max(0, c0 - 1), Math.min(n - 1, r0 + 1), Math.min(n - 1, c0 + 1));
        }
      });
    }
    L.cells.forEach((el, j) => { if (!keep.has(j)) el.classList.add("hint-dim"); });
    L.cells[i].classList.add("hint-cell");
  }
  function renderHintBtn() {
    const b = $("#btn-hint"); if (!b) return;
    const poor = S.tuna < HINT_COST;
    b.classList.toggle("poor", poor); b.classList.toggle("arm", !!hintArm && !poor);
    b.innerHTML = (hintArm && !poor ? "Confirmer · " : "Indice · ") + HINT_COST + " " + ico("tuna");
    b.setAttribute("aria-label", hintArm ? "Confirmer l'indice pour " + HINT_COST + " boîtes de thon" : "Indice pour " + HINT_COST + " boîtes de thon");
    b.disabled = !L || L.over;
  }
  function useHint() {
    if (!L || L.over || hintBusy || L.placed >= L.n * L.k) return;
    if (S.tuna < HINT_COST) { toast("Un indice coûte " + HINT_COST + " boîtes de thon. Tu en gagnes en finissant un niveau sans erreur."); return; }
    if (!hintArm) { hintArm = setTimeout(() => { hintArm = 0; renderHintBtn(); }, 3000); renderHintBtn(); return; }
    clearTimeout(hintArm); hintArm = 0;
    const gr = L.lv.grids ? L.lv.grids[L.grid] : L.lv, n = L.n;
    const g = Array.from(gr.regions); (L.lv.block || []).forEach(i => { g[i] = -1; });
    const have = []; for (let j = 0; j < n * n; j++) if (L.st[j] === 3) have.push(j);
    let h = null;
    try { h = L.k === 2 ? window.RonronGen.hintStep2(n, g, have) : window.RonronGen.hintStep(n, g, have, L.lv.clues ? { clues: L.lv.clues } : null); } catch (e) { h = null; }
    if (h && !L.sol.has(h.i)) h = null;                        // jamais un chat faux : sinon, une case de la solution
    let i = h ? h.i : -1;
    if (i < 0) { for (const j of L.sol) if (L.st[j] !== 3) { i = j; break; } }
    if (i < 0) return;
    S.tuna -= HINT_COST; S.hints = (S.hints || 0) + 1; save(); updateHud(); renderHintBtn();
    hintBusy = true;
    const why = $("#level-hint"); why.classList.add("why"); why.innerHTML = hintText(h);
    const cur = L;
    showHint(h, gr, i); sfx("tap"); buzz(10);
    // le chat se pose au bout de 1,1 s ; les repères restent jusqu'au prochain tap sur la grille (ou 20 s) pour laisser le temps de lire
    setTimeout(() => {
      hintBusy = false;
      if (L !== cur) return;
      L.cells[i].classList.remove("hint-cell");
      if (!L.over && L.st[i] !== 3) {
        setCell(i, 3); L.placed++; buzz(12); sfx("cat");
        if (L.placed === L.n * L.k) { clearHint(); if (L.limit && L.grid < 4) nextGrid(); else win(); }
      }
      clearTimeout(L.hintT); L.hintT = setTimeout(() => { if (L === cur) clearHint(); }, 20000);
      renderHintBtn();
    }, 1100);
  }

  function win() {
    const sec = elapsed();
    if (L.time && L.time.from) { L.time.acc += performance.now() - L.time.from; L.time.from = 0; }
    L.over = true; renderChrono();
    const done = S.level, kind = L.lv.kind || kindOf(done), base = L.lv.reward || rewardOf(done), fast = !L.limit && sec < L.fast ? 1 : 0;
    const perfect = S.inLevel ? S.inLevel.fishLost === 0 : L.fish >= 3, tuna = perfect ? TUNA_FOR[kind] || 1 : 0;
    S.kibble += base + fast; S.tuna += tuna; S.level++; S.inLevel = null; S.tickets = (S.tickets || 0) + 1;
    const fam = growFamily(), pack = PACK_FOR[kind] || 0;
    if (pack) addPack(pack, KIND_NAME[kind] || "Niveau", { rare: kind === "geant" });
    fam.born.forEach(b => addPack(1, "Naissance de " + b.kid.name));
    const packCards = pack + fam.born.length;
    save(); updateHud();
    setTimeout(() => sfx("win"), 260);
    setTimeout(() => {
      if (view !== "level") return;
      const title = { mini: "Mini-boss battu !", boss: "Boss battu !", geant: "Boss géant battu !", rafale: "Rafale réussie !", trouee: "Grille trouée réussie !",
        zero: "Zéro faute !", pelotes: "Pelotes démêlées !" }[kind];
      openSheet(
        '<span class="tag">Niveau ' + done + " réussi</span>" + (title ? "<h2>" + title + "</h2>" : "") +
        '<div class="big">' + ico("kibble") + "+" + plural(base + fast, "croquette") + "</div>" +
        '<p class="timeline">Temps : <strong>' + clockText(sec) + "</strong>" +
          (L.limit ? "" : fast ? " · bonus de rapidité <strong>+1</strong>" : " · moins de " + clockText(L.fast) + " = une croquette en plus") + "</p>" +
        (tuna ? '<div class="big tuna">' + ico("tuna") + "Perfect : +" + plural(tuna, "boîte") + " de thon</div>"
              : '<p class="timeline">Finis sans perdre de poisson pour gagner une boîte de thon.</p>') +
        fam.born.map(b => "<p class=\"family\">" + ico("paw") + "<span><strong>" + esc(b.mom.name) + " a eu un chaton !</strong> Va le voir dans la maison.</span></p>").join("") +
        fam.grown.map(c => "<p class=\"family\">" + ico("paw") + "<span>" + esc(c.name) + " est devenu grand.</span></p>").join("") +
        (packCards ? '<p class="family pack">' + ico("cards") + "<span><strong>" + (packCards > 1 ? plural(packCards, "carte") + " à ouvrir" : "Une carte à ouvrir") +
          '</strong></span><button class="btn small" id="w-pack" type="button">Ouvrir</button></p>' : "") +
        '<p class="family ticket">' + ico("ticket") + "<span><strong>+1 ticket</strong> pour la salle de jeux (" + plural(S.tickets, "ticket") + ")</span></p>" +
        "<p>Tu as maintenant <strong>" + plural(S.kibble, "croquette") + "</strong> à dépenser dans la maison.</p>" +
        '<div class="row"><button class="btn ghost" id="w-home" type="button">La maison</button>' +
        '<button class="btn" id="w-next" type="button">Niveau suivant</button></div>',
        { sticky: true });
      $("#w-next").onclick = () => startLevel();
      $("#w-home").onclick = () => { closeSheet(); show("home"); };
      if ($("#w-pack")) $("#w-pack").onclick = () => openPacks(afterWin);
    }, 550);
  }

  // Après avoir ouvert les cartes gagnées à la fin d'un niveau : on repart d'ici.
  function afterWin() {
    if (view !== "level") return;
    openSheet('<h2>Et maintenant ?</h2><div class="row"><button class="btn ghost" id="w-home" type="button">La maison</button>' +
      '<button class="btn" id="w-next" type="button">Niveau suivant</button></div>', { sticky: true });
    $("#w-next").onclick = () => startLevel();
    $("#w-home").onclick = () => { closeSheet(); show("home"); };
  }
  function lose(why) {
    L.over = true; renderChrono();
    loseLife(); S.inLevel = null; save(); updateHud();
    setTimeout(() => sfx("lose"), 320);
    setTimeout(() => {
      if (view !== "level") return;
      const none = S.lives <= 0;
      openSheet(
        '<span class="tag">' + levelName(S.level) + "</span><h2>" + (why === "time" ? "Temps écoulé" : "Plus de poissons") + "</h2>" +
        "<p>Le niveau est perdu et te coûte une vie. " +
        (none ? "Tu n'as plus de vie : la prochaine arrive dans <strong>" + clock(nextLifeIn()) + "</strong>."
              : "Il te reste <strong>" + plural(S.lives, "vie") + "</strong>.") + "</p>" +
        '<div class="row"><button class="btn ghost" id="l-home" type="button">La maison</button>' +
        '<button class="btn" id="l-retry" type="button"' + (none ? " disabled" : "") + ">Recommencer</button></div>",
        { sticky: true });
      $("#l-retry").onclick = () => startLevel();
      $("#l-home").onclick = () => { closeSheet(); show("home"); };
    }, 450);
  }

  function quitLevel() {
    if (!L || L.over || !S.inLevel || S.inLevel.fishLost === 0) {
      S.inLevel = null; save(); closeSheet(); show("home"); return;
    }
    openSheet(
      "<h2>Quitter le niveau ?</h2><p>Tu as déjà perdu un poisson : abandonner maintenant te coûte <strong>une vie</strong>.</p>" +
      '<div class="row"><button class="btn ghost" id="q-stay" type="button">Continuer</button>' +
      '<button class="btn danger" id="q-go" type="button">Abandonner</button></div>');
    $("#q-stay").onclick = () => closeSheet();
    $("#q-go").onclick = () => {
      L.over = true; loseLife(); S.inLevel = null; save(); updateHud();
      closeSheet(); show("home");
    };
  }

  // Gestes sur la grille : un tap pose ou retire une croix (on peut glisser pour en tracer plusieurs),
  // deux taps rapides sur la même case y posent un chat.
  const DOUBLE_TAP = 320;      // délai maximal entre les deux taps, en millisecondes
  let ptr = null, lastTap = null;
  function cellAt(x, y) {
    const t = document.elementFromPoint(x, y);
    const c = t && t.closest ? t.closest(".cell") : null;
    return c && board.contains(c) ? +c.dataset.i : -1;
  }
  board.addEventListener("pointerdown", e => {
    if (!L || L.over) return;
    if (!hintBusy && board.querySelector(".hframe, .hint-no, .hint-unit, .hint-dim")) clearHint();
    const i = cellAt(e.clientX, e.clientY);
    if (i < 0) return;
    e.preventDefault();
    try { board.setPointerCapture(e.pointerId); } catch (err) { /* sans importance */ }
    const now = performance.now();
    if (lastTap && lastTap.i === i && now - lastTap.t < DOUBLE_TAP) {
      // deuxième tap : la croix posée ou retirée par le premier ne compte plus, on tente le chat
      lastTap = null; ptr = { i: i, done: true };
      if (L.st[i] <= 1) { setCell(i, 0); tryCat(i); }
      return;
    }
    const prev = L.st[i];
    ptr = { i: i, paint: -1 };
    lastTap = prev <= 1 ? { i: i, t: now } : null;
    if (prev === 0) { setCell(i, 1); ptr.paint = 1; sfx("cross"); }
    else if (prev === 1) { setCell(i, 0); ptr.paint = 0; sfx("uncross"); }
  });
  board.addEventListener("pointermove", e => {
    if (!ptr || ptr.done || !L || L.over) return;
    const j = cellAt(e.clientX, e.clientY);
    if (j < 0 || j === ptr.i) return;
    lastTap = null;            // on trace des croix en glissant : ce n'est pas un double tap
    if (ptr.paint === 1 && L.st[j] === 0) { setCell(j, 1); sfx("cross"); }
    else if (ptr.paint === 0 && L.st[j] === 1) { setCell(j, 0); sfx("uncross"); }
  });
  function endPtr() { ptr = null; }
  board.addEventListener("pointerup", endPtr);
  board.addEventListener("pointercancel", endPtr);
  board.addEventListener("contextmenu", e => e.preventDefault());

  function showRules(then) {
    const two = L && L.k === 2, sp = L && L.lv && SPECIAL_RULES[L.lv.kind];
    openSheet(
      (sp ? '<span class="tag">Niveau spécial</span><h2>' + sp[0] + "</h2><p>" + sp[1] + "</p>" : "") +
      "<h2>Règles" + (two ? " à deux chats" : "") + "</h2><ul>" +
      (two ? "<li>Place <strong>deux chats dans chaque zone</strong> de couleur.</li><li>Deux chats par ligne et deux par colonne.</li>"
           : "<li>Place <strong>un chat dans chaque zone</strong> de couleur.</li><li>Un seul chat par ligne et par colonne.</li>") +
      "<li>Deux chats ne se touchent jamais, même en diagonale.</li>" +
      "<li>Un chat mal placé te coûte un poisson. À zéro poisson, le niveau est perdu et tu perds une vie.</li>" +
      "<li>Tous les 5 niveaux, un mini-boss (3 croquettes) ; tous les 10, un boss (5) ; tous les 20, un boss géant à deux chats (10). " +
      "Passé le niveau 200, le niveau le plus dur de chaque série se joue aussi à deux chats.</li>" +
      "<li>Tous les 7 niveaux, un niveau spécial, chacun son tour : Rafale, Grille trouée, Zéro faute et Pelotes.</li>" +
      "<li>Finis vite pour une croquette en plus : de 30 s sur une grille 5 × 5 à 1:30 sur une 10 × 10, le double avec deux chats.</li>" +
      "<li>Finis sans perdre de poisson pour gagner du thon : une boîte, 2 sur un mini-boss, 3 sur un boss, 5 sur un boss géant. " +
      "Dans l'onglet Chats, 20 boîtes de thon données à un chat lui font avoir un chaton.</li>" +
      "<li>Bloqué ? Le bouton <strong>Indice</strong> coûte 2 boîtes de thon : il te montre la prochaine case à trouver et y pose le chat. " +
      "Sur la grille, une croix grise marque une case écartée par un chat déjà posé, une croix orange une case écartée par un raisonnement, expliqué sous la grille. " +
      "Un indice n'est pas une erreur : le niveau peut rester parfait.</li>" +
      "</ul><p><strong>Un tap</strong> pose ou retire une croix ; tu peux glisser le doigt pour en tracer plusieurs. " +
      "<strong>Deux taps rapides</strong> sur une case y posent un chat.</p>" +
      '<button class="btn block" id="r-ok" type="button">Compris</button>', then ? { sticky: true } : undefined);
    $("#r-ok").onclick = () => { closeSheet(); if (then) then(); };
  }

  /* ================= 5. Carte du domaine ================= */

  const mapEl = $("#map"), worldEl = $("#world"), markersEl = $("#markers");
  const cam = { x: 0, y: 0, s: 0.5, placed: false };   // écran = monde × s + (x, y)
  worldEl.style.width = WORLD.w + "px"; worldEl.style.height = WORLD.h + "px";

  function camLimits() {
    const vw = mapEl.clientWidth, vh = mapEl.clientHeight;
    const min = Math.max(vw / WORLD.w, vh / WORLD.h);
    return { vw: vw, vh: vh, min: min, max: Math.max(min * 1.5, 0.56) };   // au-delà de 0,56 l'image serait trop agrandie
  }
  function applyCam() {
    const l = camLimits();
    if (!l.vw) return;
    cam.s = Math.min(l.max, Math.max(l.min, cam.s));
    cam.x = Math.min(0, Math.max(l.vw - WORLD.w * cam.s, cam.x));
    cam.y = Math.min(0, Math.max(l.vh - WORLD.h * cam.s, cam.y));
    if (!camFrame) camFrame = requestAnimationFrame(drawCam);
  }
  // On n'écrit la position de la carte qu'une fois par image, même si le doigt envoie plus d'évènements.
  // Pendant un pincement, les images ne sont rechargées qu'à petite cadence : c'est ce qui faisait saccader le zoom.
  let camFrame = 0, viewAt = 0, viewTimer = 0, wheelAt = 0;
  const zooming = () => fingers.size >= 2 || performance.now() - wheelAt < 250;
  function drawCam() {
    camFrame = 0;
    worldEl.style.transform = "translate(" + cam.x.toFixed(1) + "px," + cam.y.toFixed(1) + "px) scale(" + cam.s.toFixed(4) + ")";
    markersEl.style.setProperty("--inv", (1 / cam.s).toFixed(3));
    clearTimeout(viewTimer);
    if (zooming() && performance.now() - viewAt < 220) viewTimer = setTimeout(updateView, 240);
    else updateView();
  }

  /* Peinture de la carte. Sur un téléphone, garder chaque calque décodé à l'écran faisait jusqu'à 400 Mo d'images (et le zoom les redessinait toutes) :
     le navigateur ralentissait puis fermait la page. On peint donc le domaine nous-mêmes, dans des carreaux de 1024 × 1024 pixels du monde :
     dalles du terrain puis calques des chantiers, dans l'ordre. Seuls les carreaux autour de l'écran existent ; les images ne servent que le temps
     de les peindre (un petit cache garde les dernières). Zoomer ou déplacer la carte ne fait que glisser des images déjà prêtes.
     En vue éloignée : une seule toile au quart (le domaine et tous les calques), qui reste aussi dessous en attendant les carreaux. */
  const chunkEl = $("#chunks"), farEl = $("#farlayers"), planEl = worldEl.querySelector(".plan"), LO = window.RONRON_LO || null;
  const FAR = 0.26, CH = 1024, NI = Math.ceil(WORLD.w / CH), NJ = Math.ceil(WORLD.h / CH);
  const DPR = Math.min(3, window.devicePixelRatio || 1);
  // Safari (tous les navigateurs d'iPhone) : createImageBitmap y est fragile (dalles du terrain dessinées vides) et chaque image repasse par la
  // mémoire graphique : on y décode des images classiques, et on garde moins de choses en mémoire.
  const WEBKIT = /Apple/.test(navigator.vendor || "");
  const BM_MAX = (WEBKIT ? 8 : navigator.deviceMemory >= 8 ? 24 : 12) * 1e6;          // pixels d'images décodées gardés en cache
  const diag = { fails: 0, errors: 0, last: "" };
  let shownList = [], farKey = null, farBusy = false, farSheets = null, farDrop = 0;
  const chunks = {};
  let painting = false, paintAgain = false;
  const paintStats = { batches: 0, chunks: 0, draws: 0, waitMs: 0, drawMs: 0, fromSnap: 0, full: 0 };
  /* Essai d'un style : on garde, pour chaque carreau touché, une copie peinte jusqu'au calque essayé (non compris).
     Changer de style ne repeint alors que ce calque et ceux qui passent par-dessus. */
  let snapIds = null;
  const pid = p => p.src + "@" + p.x + "," + p.y;
  function dropSnaps() {
    snapIds = null;
    Object.keys(chunks).forEach(c => { const o = chunks[c]; if (o.snap) { o.snap.cv.width = o.snap.cv.height = 0; o.snap = null; } });
  }
  function prepSnaps(slot) {
    const ps = [];
    (slot.styles || [{ patch: slot.patch }]).forEach(st => { let p = st.patch; if (typeof p === "function") p = p(effStyle); if (p) ps.push(p); });
    snapIds = new Set(ps.map(p => p.src));
    Object.keys(chunks).forEach(c => { const o = chunks[c], g = geom(+c); if (ps.some(p => hit(g, p)) && !(o.snap && snapIds.has(o.snap.at))) o.key = null; });
    updateView();
  }
  const hit = (g, p) => p.x < g.x + g.cw && p.x + p.w > g.x && p.y < g.y + g.ch && p.y + p.h > g.y;
  function geom(id) {
    const i = id % NI, j = (id - i) / NI, x = i * CH, y = j * CH;
    // 2 pixels de recouvrement avec le carreau voisin : pas de fine ligne entre deux carreaux une fois zoomé
    return { x: x, y: y, cw: Math.min(CH + (i < NI - 1 ? 2 : 0), WORLD.w - x), ch: Math.min(CH + (j < NJ - 1 ? 2 : 0), WORLD.h - y) };
  }
  function viewBox(m) {
    const l = camLimits();
    return { x0: -cam.x / cam.s - m, y0: -cam.y / cam.s - m, x1: (l.vw - cam.x) / cam.s + m, y1: (l.vh - cam.y) / cam.s + m };
  }
  function chunkIds(b) {
    const out = [];
    for (let j = Math.max(0, Math.floor(b.y0 / CH)); j <= Math.min(NJ - 1, Math.floor(b.y1 / CH)); j++)
      for (let i = Math.max(0, Math.floor(b.x0 / CH)); i <= Math.min(NI - 1, Math.floor(b.x1 / CH)); i++) out.push(j * NI + i);
    return out;
  }
  const lod = () => (cam.s * DPR >= (WEBKIT ? 0.78 : 0.6) ? 1 : 0.5);          // définition des carreaux : pleine, ou moitié quand on est assez loin
  function dropChunk(id) { const c = chunks[id]; if (!c) return; c.cv.width = c.cv.height = 0; if (c.snap) c.snap.cv.width = c.snap.cv.height = 0; c.cv.remove(); delete chunks[id]; }

  // Cache des images décodées : les plus anciennes sont libérées dès que le total dépasse BM_MAX.
  const bmCache = new Map();
  let bmPx = 0;
  const imgOf = p => (p.pk ? p.pk[0] : p.src);     // petit calque rangé dans une planche (assets/f, pack_flats.py) : on le découpe dedans
  function getBitmap(src) {
    let e = bmCache.get(src);
    if (e) { bmCache.delete(src); bmCache.set(src, e); return e.p; }
    e = { bm: null, px: 0 };
    e.p = (!WEBKIT && typeof createImageBitmap === "function" ? fetch(src).then(r => (r.ok ? r.blob() : Promise.reject())).then(b => createImageBitmap(b))
      : Promise.reject()).catch(() => new Promise(res => {       // Safari, ou navigateur plus ancien : image classique
        const im = new Image(); im.decoding = "async";
        im.onload = () => (im.decode ? im.decode() : Promise.resolve()).then(() => res(im.naturalWidth ? im : null), () => res(null));
        im.onerror = () => res(null); im.src = src; }))
      .then(bm => {
        if (bmCache.get(src) !== e) { free(bm); return bm; }     // déjà sorti du cache : sert une fois, puis libéré
        if (!bm) { bmCache.delete(src); diag.fails++; diag.last = src.split("/").pop(); return null; }           // échec (réseau, mémoire) : on réessaiera
        e.bm = bm; e.px = bm ? bm.width * bm.height : 0; bmPx += e.px;
        for (const [k, o] of bmCache) {                          // les plus anciennes d'abord
          if (bmPx <= BM_MAX || bmCache.size <= 4) break;
          if (k === src || !o.bm) continue;
          bmCache.delete(k); bmPx -= o.px; free(o.bm);
        }
        return bm;
      });
    bmCache.set(src, e);
    return e.p;
  }
  function free(bm) { if (!bm) return; if (bm.close) setTimeout(() => bm.close(), 0); else bm.src = ""; }
  let missN = 0;

  function updateView() {
    const l = camLimits();
    if (!l.vw) return;
    const far = cam.s < FAR;
    if (chunkEl.hidden !== far) chunkEl.hidden = far;
    if (far) { if (!zooming()) Object.keys(chunks).forEach(dropChunk); farCheck(); return; }
    const keep = new Set(chunkIds(viewBox(WEBKIT ? 250 : 400)));
    Object.keys(chunks).forEach(id => { if (!keep.has(+id)) dropChunk(id); });
    if (!painting) paint(); else paintAgain = true;
    farCheck();
  }
  function jobs() {
    const r = lod(), v = viewBox(160), cx = (v.x0 + v.x1) / 2, cy = (v.y0 + v.y1) / 2;
    return chunkIds(v).filter(id => !chunks[id] || chunks[id].key !== layersKey || chunks[id].r !== r)
      .map(id => ({ id: id, g: geom(id) })).sort((a, b) => Math.hypot(a.g.x + 512 - cx, a.g.y + 512 - cy) - Math.hypot(b.g.x + 512 - cx, b.g.y + 512 - cy));
  }
  async function paint() {
    painting = true;
    try {
      for (;;) {
        paintAgain = false;
        if (cam.s < FAR || layersKey === null) break;
        const todo = jobs().slice(0, 16);           // tout l'écran d'un coup : chaque image n'est décodée qu'une fois
        if (!todo.length) break;
        const key = layersKey, r = lod(), all = TILES.concat(shownList);
        // essai d'un style : la copie est prise à la place du chantier dans l'ordre global (même si son calque ne touche pas ce carreau)
        const ia = snapIds ? all.findIndex(p => snapIds.has(p.src)) : -1, gi = ia >= 0 ? new Map(all.map((p, i) => [pid(p), i])) : null;
        todo.forEach(o => {
          o.cv = document.createElement("canvas"); o.cv.width = Math.ceil(o.g.cw * r); o.cv.height = Math.ceil(o.g.ch * r);
          o.ctx = o.cv.getContext("2d"); o.ctx.imageSmoothingQuality = "high";
          o.list = all.filter(p => hit(o.g, p)).map(pid); o.pos = 0; o.start = 0; o.snapAt = -1;
          const old = chunks[o.id], sn = old && old.snap;
          if (sn && sn.cv.width && sn.r === r && sn.n <= o.list.length && sn.ids.every((s, i) => s === o.list[i])) try { o.ctx.drawImage(sn.cv, 0, 0); o.start = sn.n; o.snap = sn; } catch (e) { /* copie libérée */ }
          if (o.start) paintStats.fromSnap++; else paintStats.full++;
          if (ia >= 0) { let k = o.list.findIndex(s => gi.get(s) >= ia); if (k < 0) k = o.list.length; if (k > 0 && !(o.snap && o.snap.n === k)) o.snapAt = k; }
        });
        const srcs = all.filter(p => todo.some(o => hit(o.g, p))), at = new Map(srcs.map((p, i) => [pid(p), i]));
        // premier calque à peindre vraiment (ceux d'avant sont dans les instantanés) : on ne décode rien avant
        const first = Math.min.apply(null, todo.map(o => (o.start < o.list.length ? at.get(o.list[o.start]) : srcs.length)));
        paintStats.batches++; paintStats.chunks += todo.length;
        let ok = true, miss = false, slice = performance.now();
        for (let k = 0; k < srcs.length; k++) {
          const p = srcs[k];
          // ce calque est-il à peindre dans au moins un carreau ? (sinon : déjà dans l'instantané)
          const use = todo.filter(o => hit(o.g, p) && o.pos++ >= o.start);
          if (!use.length) continue;
          use.forEach(o => { if (o.pos - 1 === o.snapAt) {          // copie avant le calque essayé
            const c = document.createElement("canvas"); c.width = o.cv.width; c.height = o.cv.height; c.getContext("2d").drawImage(o.cv, 0, 0);
            o.snap = { n: o.snapAt, ids: o.list.slice(0, o.snapAt), at: all[ia].src, r: r, cv: c }; } });
          for (let b = Math.max(k + 1, first); b < Math.min(srcs.length, Math.max(k + 1, first) + 2); b++) getBitmap(imgOf(srcs[b]));     // les suivantes se décodent pendant ce temps
          const tw = performance.now(), bm = await getBitmap(imgOf(p)); paintStats.waitMs += performance.now() - tw; const td = performance.now();
          if (layersKey !== key || lod() !== r || cam.s < FAR) { ok = false; break; }
          if (!bm) { miss = true; continue; }
          const kx = p.pk ? 1 : bm.width / p.w, ky = p.pk ? 1 : bm.height / p.h, ox = p.pk ? p.pk[1] : 0, oy = p.pk ? p.pk[2] : 0;
          use.forEach(o => {
            // seulement la partie de l'image qui tombe dans le carreau
            const x0 = Math.max(p.x, o.g.x), y0 = Math.max(p.y, o.g.y), x1 = Math.min(p.x + p.w, o.g.x + o.g.cw), y1 = Math.min(p.y + p.h, o.g.y + o.g.ch);
            paintStats.draws++; try { o.ctx.drawImage(bm, ox + (x0 - p.x) * kx, oy + (y0 - p.y) * ky, (x1 - x0) * kx, (y1 - y0) * ky, (x0 - o.g.x) * r, (y0 - o.g.y) * r, (x1 - x0) * r, (y1 - y0) * r); } catch (e) { /* image libérée */ }
          });
          paintStats.drawMs += performance.now() - td;
          // on rend la main au navigateur toutes les 10 ms : la carte continue de glisser pendant qu'on peint
          if (performance.now() - slice > 10) { await yieldNow(); slice = performance.now(); }
        }
        if (ok) todo.forEach(o => {               // le chantier essayé vient après tout ce carreau : copie du carreau entier
          if (o.snapAt > 0 && o.snapAt === o.list.length && !(o.snap && o.snap.n === o.snapAt)) {
            const c = document.createElement("canvas"); c.width = o.cv.width; c.height = o.cv.height; c.getContext("2d").drawImage(o.cv, 0, 0);
            o.snap = { n: o.snapAt, ids: o.list.slice(), at: all[ia].src, r: r, cv: c };
          }
        });
        if (!ok) { todo.forEach(o => { o.cv.width = o.cv.height = 0; const sn = chunks[o.id] && chunks[o.id].snap; if (o.snap && o.snap !== sn) o.snap.cv.width = o.snap.cv.height = 0; }); continue; }
        const keep = new Set(chunkIds(viewBox(WEBKIT ? 250 : 400)));
        todo.forEach(o => {
          if (!keep.has(o.id)) { o.cv.width = o.cv.height = 0; return; }        // la carte est partie ailleurs entre-temps
          const cv = o.cv;
          cv.className = "chunk"; cv.style.cssText = "left:" + o.g.x + "px;top:" + o.g.y + "px;width:" + o.g.cw + "px;height:" + o.g.ch + "px";
          const old = chunks[o.id];
          if (old) { old.cv.replaceWith(cv); old.cv.width = old.cv.height = 0; } else chunkEl.appendChild(cv);
          if (old && old.snap && old.snap !== o.snap) { old.snap.cv.width = old.snap.cv.height = 0; }
          const sn = o.snap && o.snap.cv.width && snapIds ? o.snap : null;
          if (o.snap && !sn) o.snap.cv.width = o.snap.cv.height = 0;      // plus d'essai en cours : la copie ne sert plus
          chunks[o.id] = { cv: cv, key: miss ? null : key, r: r, snap: sn };      // une image manquait : ce carreau sera repeint
        });
        if (miss) { missN++; setTimeout(updateView, Math.min(60000, 4000 * Math.pow(2, missN - 1))); break; }
        missN = 0;
      }
    } catch (e) { diag.errors++; diag.last = String(e && e.message || e); missN++; setTimeout(updateView, Math.min(60000, 2000 * Math.pow(2, missN))); } finally { painting = false; }
  }
  function painted() { return cam.s < FAR || !jobs().length; }
  // rendre la main sans attendre l'image suivante (un message est servi tout de suite, setTimeout et requestAnimationFrame font attendre)
  const yieldChan = typeof MessageChannel === "function" ? new MessageChannel() : null, yieldQ = [];
  if (yieldChan) yieldChan.port1.onmessage = () => { const f = yieldQ.shift(); if (f) f(); };
  const yieldNow = () => new Promise(res => { if (yieldChan) { yieldQ.push(res); yieldChan.port2.postMessage(0); } else setTimeout(res, 0); });
  function composeFar() {
    if (!LO || !farEl || farBusy || farKey === layersKey) return;
    farBusy = true;
    const key = layersKey, shown = shownList;
    const load = src => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
    const sheets = farSheets || Promise.all(["assets/monde.webp"].concat(LO.sheets).map(load));
    farSheets = sheets;
    clearTimeout(farDrop); farDrop = setTimeout(() => { if (!farBusy) farSheets = null; }, 15000);   // les planches ne restent pas en mémoire
    sheets.then(ims => {
      farBusy = false;
      if (key !== layersKey) { composeFar(); return; }
      const q = LO.q;
      if (farEl.width !== Math.ceil(WORLD.w / q)) { farEl.width = Math.ceil(WORLD.w / q); farEl.height = Math.ceil(WORLD.h / q); }
      const ctx = farEl.getContext("2d");
      ctx.clearRect(0, 0, farEl.width, farEl.height);
      if (ims[0]) ctx.drawImage(ims[0], 0, 0, farEl.width, farEl.height);
      shown.forEach(p => { const m = LO.map[p.src]; if (m && ims[m[0] + 1]) ctx.drawImage(ims[m[0] + 1], m[1], m[2], m[3], m[4], Math.round(p.x / q), Math.round(p.y / q), m[3], m[4]); });   // calé sur les pixels : pas de bord à demi transparent
      farKey = key; farEl.hidden = false;
      farCheck();
    });
  }
  // Retour dans l'appli : un iPhone à court de mémoire peut vider des toiles pendant qu'elle était en arrière-plan.
  // Un carreau est toujours entièrement opaque (les dalles couvrent tout) : un pixel transparent veut dire « vidé », on le repeint.
  function emptied(cv, x, y) {
    try { return cv.width > 0 && cv.getContext("2d").getImageData(x, y, 1, 1).data[3] === 0; } catch (e) { return false; }
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    missN = 0;
    Object.keys(chunks).forEach(c => { const o = chunks[c]; if (emptied(o.cv, o.cv.width >> 1, o.cv.height >> 1)) o.key = null; });
    if (farEl && farKey && emptied(farEl, farEl.width >> 1, farEl.height >> 1)) { farKey = null; composeFar(); }
    updateView();
  });
  // état de la carte, affiché dans les réglages : aide à comprendre un souci sur un téléphone
  function mapDiag() {
    const n = Object.keys(chunks).length, px = Object.keys(chunks).reduce((s, c) => s + chunks[c].cv.width * chunks[c].cv.height, 0);
    return "Carte : " + n + " carreaux, " + Math.round((px + (farEl ? farEl.width * farEl.height : 0)) * 4 / 1e6) + " Mo de dessins, " +
      Math.round(bmPx * 4 / 1e6) + " Mo d'images, " + (WEBKIT ? "Safari" : "autre") + ", écran ×" + DPR +
      (diag.fails || diag.errors ? " · échecs " + diag.fails + ", erreurs " + diag.errors + " (" + diag.last.slice(0, 60) + ")" : " · aucun échec");
  }
  function farCheck() { if (farEl && farKey && farEl.hidden) farEl.hidden = false; }
  function centerOn(wx, wy, s) {
    const l = camLimits();
    if (!l.vw) return;
    cam.s = Math.min(l.max, Math.max(l.min, s || cam.s));
    cam.x = l.vw / 2 - wx * cam.s; cam.y = l.vh / 2 - wy * cam.s;
    applyCam();
  }
  function zoomAt(px, py, factor) {
    const l = camLimits();
    const ns = Math.min(l.max, Math.max(l.min, cam.s * factor));
    const wx = (px - cam.x) / cam.s, wy = (py - cam.y) / cam.s;
    cam.s = ns; cam.x = px - wx * ns; cam.y = py - wy * ns;
    applyCam();
  }

  // Un doigt : on déplace la carte. Deux doigts : on zoome. Molette : zoom sur ordinateur.
  const fingers = new Map();
  let dragDist = 0, pinchDist = 0;
  mapEl.addEventListener("pointerdown", e => {
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (fingers.size === 1) dragDist = 0;
    if (fingers.size === 2) { const f = Array.from(fingers.values()); pinchDist = Math.hypot(f[0].x - f[1].x, f[0].y - f[1].y); }
  });
  window.addEventListener("pointermove", e => {
    const f = fingers.get(e.pointerId);
    if (!f) return;
    const dx = e.clientX - f.x, dy = e.clientY - f.y;
    f.x = e.clientX; f.y = e.clientY;
    if (fingers.size === 1) {
      cam.x += dx; cam.y += dy; dragDist += Math.abs(dx) + Math.abs(dy);
      applyCam();
    } else if (fingers.size === 2) {
      const g = Array.from(fingers.values()), d = Math.hypot(g[0].x - g[1].x, g[0].y - g[1].y), r = mapEl.getBoundingClientRect();
      if (pinchDist > 0) zoomAt((g[0].x + g[1].x) / 2 - r.left, (g[0].y + g[1].y) / 2 - r.top, d / pinchDist);
      pinchDist = d; dragDist = 99;
    }
  });
  function liftFinger(e) {
    const was = fingers.size; fingers.delete(e.pointerId);
    if (fingers.size < 2) pinchDist = 0;
    if (was >= 2 && fingers.size < 2) { clearTimeout(viewTimer); updateView(); }
  }
  window.addEventListener("pointerup", liftFinger);
  window.addEventListener("pointercancel", liftFinger);
  mapEl.addEventListener("wheel", e => {
    e.preventDefault(); wheelAt = performance.now();
    const r = mapEl.getBoundingClientRect();
    zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.12 : 1 / 1.12);
  }, { passive: false });
  window.addEventListener("resize", applyCam);

  /* ================= 6. Chats ================= */

  function shade(hex, amt) {   // amt de -100 (noir) à 100 (blanc)
    const v = parseInt(hex.slice(1), 16), to = amt < 0 ? 0 : 255, t = Math.abs(amt) / 100;
    const ch = k => Math.round(((v >> k) & 255) + (to - ((v >> k) & 255)) * t);
    return "#" + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
  }

  // Chat vu de côté, tête tournée vers nous. Origine : entre les pattes, au sol.
  function catSprite(breed, worn) {
    const has = id => (worn || []).indexOf(id) >= 0;
    const b = BREED[breed] || BREEDS[0];
    const fur = b.fur, dk = b.dark, limb = b.points ? dk : fur, far = shade(limb, -14);
    const eye = b.eye || "#3A3340";
    let s = '<g class="catsprite">';
    s += '<path class="tail" d="M-11 -11 Q-21 -13 -17 -25" fill="none" stroke="' + (b.points ? dk : fur) + '" stroke-width="' + (b.big ? 6 : 4) + '" stroke-linecap="round"/>';
    s += '<rect class="leg b" x="-6.2" y="-8" width="3.2" height="8" rx="1.5" fill="' + far + '"/>' +
      '<rect class="leg" x="6.4" y="-8" width="3.2" height="8" rx="1.5" fill="' + far + '"/>';
    s += '<ellipse cx="0" cy="-11.5" rx="12" ry="7" fill="' + fur + '"/>';
    if (b.belly) s += '<ellipse cx="2" cy="-8" rx="8" ry="3.2" fill="' + b.belly + '"/>';
    if (b.stripes) s += '<path d="M-7 -17.6 v3.4 M-3 -18.3 v3.6 M1 -18.3 v3.4" stroke="' + dk + '" stroke-width="1.6" stroke-linecap="round" fill="none"/>';
    s += '<rect class="leg" x="-9.6" y="-8" width="3.2" height="8" rx="1.5" fill="' + limb + '"/>' +
      '<rect class="leg b" x="3" y="-8" width="3.2" height="8" rx="1.5" fill="' + limb + '"/>';
    if (b.bib) s += '<rect x="-9.6" y="-2.4" width="3.2" height="2.4" rx="1.2" fill="#fff"/><rect x="3" y="-2.4" width="3.2" height="2.4" rx="1.2" fill="#fff"/>';
    // tête
    const ear = b.points ? dk : fur;
    s += '<path d="M5.2 -21.5 L6.4 -28.6 L11 -24 Z" fill="' + ear + '"/><path d="M12.6 -24 L17.2 -28.6 L18.4 -21.5 Z" fill="' + ear + '"/>';
    if (b.big) s += '<path d="M4.2 -15 L1.4 -13.4 L4.8 -12.4 Z M19.4 -15 L22.2 -13.4 L18.8 -12.4 Z" fill="' + fur + '"/>';
    s += '<circle cx="11.8" cy="-17.6" r="7.4" fill="' + fur + '"/>';
    if (b.points) s += '<ellipse cx="11.8" cy="-15.6" rx="4.4" ry="3.6" fill="' + dk + '"/>';
    if (b.bib) s += '<ellipse cx="11.8" cy="-14.6" rx="4.2" ry="3.2" fill="#fff"/><ellipse cx="9" cy="-9.4" rx="3.4" ry="2.8" fill="#fff"/>';
    else if (b.belly && !b.points) s += '<ellipse cx="11.8" cy="-14.4" rx="3.6" ry="2.6" fill="' + b.belly + '"/>';
    if (b.stripes) s += '<path d="M10.4 -24 v2.2 M13.2 -24 v2.2" stroke="' + dk + '" stroke-width="1.3" stroke-linecap="round" fill="none"/>';
    s += '<g class="open"><circle cx="9" cy="-18" r="1.5" fill="' + eye + '"/><circle cx="14.6" cy="-18" r="1.5" fill="' + eye + '"/></g>';
    s += '<g class="closed"><path d="M7.6 -17.8 q1.4 1.4 2.8 0 M13.2 -17.8 q1.4 1.4 2.8 0" stroke="#3A3340" stroke-width="1" fill="none" stroke-linecap="round"/></g>';
    s += '<path d="M10.9 -15.6 h1.8 l-0.9 1.1 Z" fill="#EE7F8E"/>';
    // accessoire
    if (has("grelot")) s += '<path d="M5.6 -12.6 Q10 -9.4 16.6 -11.8" stroke="#D8434B" stroke-width="1.8" fill="none" stroke-linecap="round"/><circle cx="10.6" cy="-9.4" r="1.7" fill="#F6C453"/>';
    if (has("noeud")) s += '<path d="M10.8 -10.4 L6.6 -13 V-7.8 Z M10.8 -10.4 L15 -13 V-7.8 Z" fill="#D8434B"/><circle cx="10.8" cy="-10.4" r="1.2" fill="#A82E36"/>';
    if (has("echarpe")) s += '<path d="M5.4 -12.4 Q10.6 -8.6 17 -11.6" stroke="#4FA6DC" stroke-width="3.2" fill="none" stroke-linecap="round"/><rect x="6" y="-11" width="3" height="6.4" rx="1.2" fill="#3F8FC2"/>';
    if (has("bonnet")) s += '<path d="M5.4 -22 Q11.8 -32.5 18.2 -22 Z" fill="#E5484D"/><rect x="4.8" y="-23" width="14" height="2.6" rx="1.3" fill="#fff"/><circle cx="11.8" cy="-29.6" r="2" fill="#fff"/>';
    if (has("couronne")) s += '<path d="M6.6 -23.4 L6 -28.6 L9.2 -26 L11.8 -30 L14.4 -26 L17.6 -28.6 L17 -23.4 Z" fill="#F6C453" stroke="#D99A22" stroke-width="0.5"/>';
    s += '<text class="zzz" x="20" y="-26">z</text></g>';
    return s;
  }
  function portrait(breed, worn) {
    if (BREED[breed] && BREED[breed].sprite) {
      const L = catLook(breed, worn, "assis"), q = L.q;
      let x0 = -q.ax * q.w, y0 = -q.ay * q.h, x1 = x0 + q.w, y1 = y0 + q.h;
      let h = poseSvg(L.src, q, x0, y0);
      L.accs.forEach(o => {
        const k = o.q, ax = -k.ax * k.w, ay = -k.ay * k.h;
        h += poseSvg(o.src, k, ax, ay);
        x0 = Math.min(x0, ax); y0 = Math.min(y0, ay); x1 = Math.max(x1, ax + k.w); y1 = Math.max(y1, ay + k.h);
      });
      return '<svg class="portrait sp" viewBox="' + [x0, y0, x1 - x0, y1 - y0].map(v => v.toFixed(1)).join(" ") + '" aria-hidden="true">' + h + "</svg>";
    }
    return '<svg class="portrait" viewBox="-27 -36 56 40" aria-hidden="true">' + catSprite(breed, worn) + "</svg>";
  }

  const catRT = {};   // état d'animation de chaque chat, par identifiant
  const rand = (a, b) => a + Math.random() * (b - a);
  // cases libres (1 maison, 2 jardin du gardien, 3 entrée du domaine, 4 passage caché dans la haie),
  // recalculées quand un meuble est posé ou qu'un chantier se termine
  let navFree = null;
  let navHouse = [], navGarden = [], navGate = [], navAllee = [], navManoir = [], navSalon = [], navCour = [], navHall = [], navChats = [], navAile = [], navBiblio = [], navEst = [], navEstIn = [], navPerron = [], navEtang = [], navLaby = [], navSerre = [];
  // passages où le chat se faufile sans être vu : haie, sous la grille, porte du manoir, hall vers la cour, arche de la salle des chats
  const HIDDEN = v => v === 4 || v === 6 || v === 9 || v === 13 || v === 14 || v === 18 || v === 24 || v === 25 || v === 29 || v === 32;   // 29 : dans les roseaux ; 32 : derrière les haies du labyrinthe
  function buildNav() {
    navFree = new Uint8Array(NAV.w * NAV.h);
    const garden = isDone("jardin_debrousse");      // tant que le jardin est en friche, les chats restent à l'intérieur
    const gate = garden && isDone("grille_debrousse");   // même règle pour l'entrée, qu'ils rejoignent par un trou dans la haie
    const allee = gate && isDone("allee_debrousse");     // et pour l'allée du manoir, où ils passent sous la grille
    const manoir = allee && isDone("manoir_debrousse");  // puis le devant du manoir
    const salon = manoir && isDone("manoir_salon");      // et le grand salon, par la porte du perron
    const hall = manoir && isDone("cour_hall");          // le hall, puis la cour d'honneur juste derrière
    const chats = hall && isDone("cour_chats");          // et la salle des chats, par l'arche de droite
    const aile = allee && isDone("aile_debrousse");      // le jardin de l'aile ouest, à gauche du perron
    const biblio = aile && isDone("aile_biblio"), salle = aile && isDone("aile_salle"), atelier = biblio && isDone("aile_atelier");
    const est = chats && isDone("est_debrousse"), estIn = chats && isDone("est_deblai");   // l'aile est, par la salle des chats
    const perron = manoir && isDone("perron_debrousse");     // le jardin du perron est, à côté du devant du manoir
    const etang = est && isDone("etang_debrousse"), ponton = etang && isDone("etang_ponton");   // l'étang, au-dessus du jardin de l'aile est
    const laby = allee && aile && isDone("laby_debrousse"), labyIn = laby && isDone("laby_haies");   // le labyrinthe ; ses allées une fois les haies taillées
    const serre = isDone("serre_debrousse");                                  // autour de la serre
    for (let r = 0; r < NAV.h; r++) for (let c = 0; c < NAV.w; c++) {
      const v = NAV.rows[r].charCodeAt(c) - 48;
      navFree[r * NAV.w + c] = v === 1 || (v === 2 && garden) || ((v === 3 || v === 4) && gate) || ((v === 5 || v === 6) && allee) ||
        (v === 7 && manoir) || ((v === 8 || v === 9) && salon) || ((v === 10 || v === 11 || v === 13) && hall) || ((v === 12 || v === 14) && chats) ||
        ((v === 15 || v === 18) && aile) || (v === 16 && biblio) || (v === 17 && salle) || (v === 19 && atelier) ||
        ((v === 20 || v === 24) && est) || (((v >= 21 && v <= 23) || v === 25) && estIn) || (v === 26 && perron) || ((v === 27 || v === 29) && etang) || (v === 28 && ponton) ||
        (v === 30 && laby) || ((v === 31 || v === 32) && labyIn) || (v === 33 && serre) ? v : 0;
    }
    const open = navFree.slice();                    // le sol praticable, avant les meubles
    Object.keys(NAV.blocks).forEach(id => {
      if (isDone(id)) (NAV.blocks[id][vk(SLOT[id], S.house[id].style | 0, houseSt)] || NAV.blocks[id][0] || []).forEach(i => { navFree[i] = 0; });
    });
    DECOS.forEach(d => { if (decoShown(d)) d.block.forEach(i => { navFree[i] = 0; }); });      // pied des sapins de Noël
    reconnect(open);
    // tunnel, bacs du potager, cabane : on passe dedans ou derrière, caché (case de passage, jamais une destination)
    Object.keys(NAV.hide || {}).forEach(id => {
      if (isDone(id)) (NAV.hide[id][vk(SLOT[id], S.house[id].style | 0, houseSt)] || NAV.hide[id][0] || []).forEach(i => { if (navFree[i]) navFree[i] = 4; });
    });
    // on ne garde que le plus grand ensemble de cases reliées entre elles, pour qu'aucun chat ne reste coincé
    const comp = new Int32Array(navFree.length); let best = 0, bestSize = 0, id = 0;
    for (let i = 0; i < navFree.length; i++) {
      if (!navFree[i] || comp[i]) continue;
      id++; let size = 0; const q = [i]; comp[i] = id;
      while (q.length) {
        const k = q.pop(), kc = k % NAV.w; size++;
        // voisins droits uniquement : c'est ce que les trajets savent franchir
        [k - NAV.w, k + NAV.w, kc > 0 ? k - 1 : -1, kc < NAV.w - 1 ? k + 1 : -1].forEach(j => {
          if (j >= 0 && j < navFree.length && navFree[j] && !comp[j]) { comp[j] = id; q.push(j); }
        });
      }
      if (size > bestSize) { bestSize = size; best = id; }
    }
    navHouse = []; navGarden = []; navGate = []; navAllee = []; navManoir = []; navSalon = []; navCour = []; navHall = []; navChats = []; navAile = []; navBiblio = []; navEst = []; navEstIn = []; navPerron = []; navEtang = []; navLaby = []; navSerre = [];
    for (let i = 0; i < navFree.length; i++) {
      if (comp[i] !== best) navFree[i] = 0;
      else if (navFree[i] === 1) navHouse.push(i);
      else if (navFree[i] === 2) navGarden.push(i);
      else if (navFree[i] === 3) navGate.push(i);       // les passages cachés (4, 6, 9) ne sont jamais une destination
      else if (navFree[i] === 5) navAllee.push(i);
      else if (navFree[i] === 7) navManoir.push(i);
      else if (navFree[i] === 8) navSalon.push(i);
      else if (navFree[i] === 10) navCour.push(i);
      else if (navFree[i] === 11) navHall.push(i);
      else if (navFree[i] === 12) navChats.push(i);
      else if (navFree[i] === 15) navAile.push(i);
      else if (navFree[i] === 16) navBiblio.push(i);          // la salle à manger (17) n'est qu'un passage : les chats y vont pour sauter sur la table
      else if (navFree[i] === 20) navEst.push(i);
      else if (navFree[i] >= 21 && navFree[i] <= 23) navEstIn.push(i);
      else if (navFree[i] === 26) navPerron.push(i);
      else if (navFree[i] === 27 || navFree[i] === 28) navEtang.push(i);
      else if (navFree[i] === 30 || navFree[i] === 31) navLaby.push(i);
      else if (navFree[i] === 33) navSerre.push(i);
    }
  }
  /* Un meuble peut fermer un passage selon le style choisi (le banc vert de l'entrée coupait le salon et la cuisine du reste).
     Tant qu'un morceau d'au moins 40 cases est coupé du grand ensemble, on lui ouvre le chemin le plus court à travers
     le pied des meubles : ces cases deviennent un passage caché (le chat passe derrière le meuble). */
  function reconnect(open) {
    const N = navFree.length, W = NAV.w;
    const nb4 = k => { const c = k % W; return [k - W, k + W, c > 0 ? k - 1 : -1, c < W - 1 ? k + 1 : -1]; };
    const skip = new Set();                          // morceaux qu'aucun meuble ne sépare (coupés par un mur) : on les laisse
    for (let round = 0; round < 12; round++) {
      const comp = new Int32Array(N), sizes = [0]; let id = 0, best = 0;
      for (let i = 0; i < N; i++) {
        if (!navFree[i] || comp[i]) continue;
        id++; let size = 0; const q = [i]; comp[i] = id;
        while (q.length) { const k = q.pop(); size++; nb4(k).forEach(j => { if (j >= 0 && j < N && navFree[j] && !comp[j]) { comp[j] = id; q.push(j); } }); }
        sizes.push(size); if (size > sizes[best]) best = id;
      }
      let cut = 0;
      for (let k = 1; k <= id; k++) if (k !== best && sizes[k] >= 40 && (!cut || sizes[k] > sizes[cut]) && !skip.has(k + ":" + sizes[k])) cut = k;
      if (!cut) return;
      const prev = new Int32Array(N).fill(-1), q = [];
      for (let i = 0; i < N; i++) if (comp[i] === cut) { prev[i] = i; q.push(i); }
      let hit = -1;
      for (let h = 0; h < q.length && hit < 0; h++) {
        const k = q[h];
        for (const j of nb4(k)) {
          if (j < 0 || j >= N || prev[j] !== -1) continue;
          if (navFree[j] && comp[j] === best) { prev[j] = k; hit = j; break; }
          // sous un meuble (jamais à travers un mur), ou par un autre petit morceau coupé
          if ((!navFree[j] && open[j]) || (navFree[j] && comp[j] !== cut)) { prev[j] = k; q.push(j); }
        }
      }
      if (hit < 0) { skip.add(cut + ":" + sizes[cut]); continue; }
      for (let k = prev[hit]; comp[k] !== cut; k = prev[k]) if (!navFree[k]) navFree[k] = 4;
    }
  }
  function neighbours(i) {
    const c = i % NAV.w, r = (i / NAV.w) | 0, out = [];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && cc >= 0 && rr < NAV.h && cc < NAV.w) out.push(rr * NAV.w + cc);
    }
    return out;
  }
  const cellOf = (x, y) => Math.floor((y - NAV.y0) / NAV.cell) * NAV.w + Math.floor((x - NAV.x0) / NAV.cell);
  const cellXY = i => [NAV.x0 + (i % NAV.w + 0.5) * NAV.cell, NAV.y0 + (((i / NAV.w) | 0) + 0.5) * NAV.cell];
  function randomCell() {
    // on tire d'abord l'endroit, pour que les chats restent visibles un peu partout : maison, jardin, entrée
    const pools = [[navHouse, 0.22], [navGarden, 0.14], [navGate, 0.08], [navAllee, 0.09], [navManoir, 0.07], [navSalon, 0.11], [navCour, 0.11], [navHall, 0.02], [navChats, 0.06], [navAile, 0.07], [navBiblio, 0.03], [navEst, 0.06], [navEstIn, 0.06], [navPerron, 0.08], [navEtang, 0.08], [navLaby, 0.08], [navSerre, 0.08]].filter(p => p[0].length);
    if (!pools.length) return 0;
    let k = Math.random() * pools.reduce((t, p) => t + p[1], 0);
    for (const p of pools) { k -= p[1]; if (k <= 0) return p[0][Math.floor(Math.random() * p[0].length)]; }
    const last = pools[pools.length - 1][0];
    return last[Math.floor(Math.random() * last.length)];
  }
  function nearestFree(x, y) {
    let best = -1, bd = 1e12;
    for (let i = 0; i < navFree.length; i++) if (navFree[i] && !HIDDEN(navFree[i])) { const p = cellXY(i), d = (p[0] - x) * (p[0] - x) + (p[1] - y) * (p[1] - y); if (d < bd) { bd = d; best = i; } }
    return best;
  }
  // Plus court chemin case par case, puis on ne garde que les changements de direction.
  function pathTo(from, to) {
    const prev = new Int32Array(navFree.length).fill(-1), q = [from]; prev[from] = from;
    for (let h = 0; h < q.length; h++) {
      const k = q[h];
      if (k === to) break;
      const kc = k % NAV.w, kr = (k / NAV.w) | 0;
      neighbours(k).forEach(j => {
        if (!navFree[j] || prev[j] !== -1) return;
        const jc = j % NAV.w, jr = (j / NAV.w) | 0;
        if (jc !== kc && jr !== kr && (!navFree[kr * NAV.w + jc] || !navFree[jr * NAV.w + kc])) return;   // pas de diagonale qui rase un coin
        prev[j] = k; q.push(j);
      });
    }
    if (prev[to] === -1) return [];
    const cells = []; for (let k = to; k !== from; k = prev[k]) cells.push(k);
    cells.reverse();
    const pts = []; let last = from, dir = 0;
    cells.forEach((k, n) => {
      const d = k - last;
      if (n && d !== dir) pts.push(cellXY(last));
      dir = d; last = k;
    });
    pts.push(cellXY(to));
    return pts;
  }
  function rt(cat) {
    if (!catRT[cat.id]) {
      const p = cellXY(randomCell());
      catRT[cat.id] = { x: p[0], y: p[1], path: [], state: "idle", until: 0, dir: Math.random() < 0.5 ? 1 : -1, node: null };
    }
    return catRT[cat.id];
  }
  /* Points d'intérêt : meubles et objets où un chat vient dormir, s'asseoir ou se faire les griffes.
     Le chat marche jusqu'à la case libre la plus proche, saute à sa place, y reste un moment, puis redescend. */
  function poiList() {
    const list = [];
    SLOTS.forEach(s => {
      if (!s.poi || !isDone(s.id)) return;
      const k = vk(s, S.house[s.id].style | 0, houseSt), p = Array.isArray(s.poi) ? (s.poi[k] || s.poi[0]) : s.poi;
      // un style peut avoir plusieurs places (un tableau) : chacune accueille un chat
      (Array.isArray(p) ? p : [p]).forEach((q, j) => list.push(Object.assign({ id: j ? s.id + "#" + j : s.id }, q)));
    });
    return list;
  }
  function pickPoi(r, from) {
    const busy = {};
    Object.keys(catRT).forEach(k => { const o = catRT[k]; if (o !== r && o.poi) busy[o.poi.id] = true; });
    const list = poiList().filter(p => !busy[p.id]);
    for (let tries = 0; tries < 3 && list.length; tries++) {
      const p = list.splice(Math.floor(Math.random() * list.length), 1)[0];
      const near = nearestFree(p.x, p.y);
      if (near < 0) continue;
      const a = cellXY(near);
      if (Math.hypot(a[0] - p.x, a[1] - p.y) > 260) continue;      // trop loin d'une case où les chats ont accès en ce moment
      const path = near === from ? [a] : pathTo(from, near);
      if (!path.length) continue;
      return { poi: Object.assign({ ax: a[0], ay: a[1] }, p), path: path };
    }
    return null;
  }
  function newTrip(r) {
    let from = cellOf(r.x, r.y);
    if (!(from >= 0 && navFree[from])) from = nearestFree(r.x, r.y);
    r.poi = null; r.goal = null;
    // de temps en temps, un meuble ou un objet ; le plus souvent une balade dans la pièce, parfois une traversée du domaine
    if (Math.random() < 0.32) {
      const go = pickPoi(r, from);
      if (go) { r.goal = go.poi; r.poi = go.poi; r.path = go.path; r.state = "walk"; return; }
    }
    let to = randomCell();
    if (Math.random() < 0.65) for (let k = 0; k < 12; k++) {
      const c = randomCell(), a = cellXY(c);
      if (Math.hypot(a[0] - r.x, a[1] - r.y) < 260) { to = c; break; }
    }
    r.path = pathTo(from, to);
    r.state = r.path.length ? "walk" : "idle";
    if (!r.path.length) r.until = performance.now() + 1500;
  }
  function startHop(r, x, y, t, next) {
    r.state = "hop"; r.hop = { x0: r.x, y0: r.y, x1: x, y1: y, t0: t, dur: 380 + Math.min(320, Math.hypot(x - r.x, y - r.y) * 2), next: next };
    if (Math.abs(x - r.x) > 3) r.dir = x > r.x ? 1 : -1;
  }
  // Après la pose d'un meuble : les chats qui se trouvent dessus rejoignent la case libre la plus proche.
  function settleCats() {
    Object.keys(catRT).forEach(k => {
      const r = catRT[k];
      if (r.poi && r.state !== "walk") { const p = cellXY(nearestFree(r.poi.ax, r.poi.ay)); r.x = p[0]; r.y = p[1]; }   // on le fait redescendre de son meuble
      r.poi = null; r.goal = null; r.hop = null; r.lift = 0;
      if (r.state === "hop" || r.state === "poi") { r.state = "idle"; r.until = 0; }
      const i = cellOf(r.x, r.y);
      if (i >= 0 && navFree[i]) { if (r.state === "walk") { r.path = []; r.state = "idle"; r.until = 0; } return; }
      const p = cellXY(nearestFree(r.x, r.y)); r.x = p[0]; r.y = p[1]; r.path = []; r.state = "idle"; r.until = 0;
    });
  }
  const CAT_SCALE = 1.7;
  const isSprite = cat => !!(BREED[cat.breed] && BREED[cat.breed].sprite);
  function catsSVG() {
    return S.cats.map(c => isSprite(c)
      ? '<g class="cat idle" data-cat="' + c.id + '"><ellipse class="sh" cx="0" cy="-3" rx="30" ry="8" fill="#1E1A14" opacity=".3"/><svg class="spr" preserveAspectRatio="none"><image/></svg>' + '<svg class="acc" preserveAspectRatio="none"><image/></svg>'.repeat(3) + '</g>'
      : '<g class="cat idle" data-cat="' + c.id + '"><ellipse cx="1" cy="0" rx="14" ry="3.6" fill="#1E1A14" opacity=".28"/>' + catSprite(c.breed, wornIds(c)) + "</g>").join("");
  }
  // el : un petit <svg> qui ne montre que la pose voulue de l'image (viewBox), l'<image> dedans porte l'image entière
  function putImage(el, src, q, k) {
    const w = q.w * SPRITE_SCALE * (k || 1), h = q.h * SPRITE_SCALE * (k || 1), im = el.firstChild;
    im.setAttribute("href", src);
    im.setAttribute("width", q.sw || q.w); im.setAttribute("height", q.sh || q.h);
    el.setAttribute("viewBox", (q.sx || 0) + " " + (q.sy || 0) + " " + q.w + " " + q.h);
    el.setAttribute("x", (-w * q.ax).toFixed(1)); el.setAttribute("y", (-h * q.ay).toFixed(1));
    el.setAttribute("width", w.toFixed(1)); el.setAttribute("height", h.toFixed(1));
    el.removeAttribute("display");
  }
  const poseSvg = (src, q, x, y) => '<svg x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + q.w + '" height="' + q.h + '" viewBox="' + (q.sx || 0) + " " + (q.sy || 0) + " " + q.w + " " + q.h +
    '" preserveAspectRatio="none"><image href="' + src + '" width="' + (q.sw || q.w) + '" height="' + (q.sh || q.h) + '"/></svg>';
  function setPose(cat, r, pose) {
    const kid = cat.kitten ? KITTEN_SCALE : 1, worn = cat.kitten ? [] : wornIds(cat), tag = pose + "|" + worn.join(",") + "|" + kid;
    if (r.shown === tag) return;
    r.shown = tag;
    const L = catLook(cat.breed, worn, pose), accEls = r.node.querySelectorAll(".acc");
    putImage(r.node.querySelector(".spr"), L.src, L.q, kid);
    accEls.forEach((el, i) => { if (L.accs[i]) putImage(el, L.accs[i].src, L.accs[i].q, kid); else el.setAttribute("display", "none"); });
    r.node.querySelector(".sh").setAttribute("rx", (pose === "dort" ? 34 : pose === "assis" ? 24 : 30) * kid);
  }
  function placeCat(cat, t) {
    const r = rt(cat);
    if (!r.node) return;
    if (isSprite(cat)) {
      r.node.setAttribute("transform", "translate(" + r.x.toFixed(1) + "," + (r.y - (r.lift || 0)).toFixed(1) + ") scale(" + r.dir + ",1)");
      let pose = r.state === "sleep" ? "dort" : r.state === "walk" ? (Math.floor((t || 0) / 190) % 2 ? "marche" : "debout") : (r.sit ? "assis" : "debout");
      if (r.state === "hop") pose = "marche";
      if (r.state === "poi") pose = r.poi.pose === "griffe" ? (Math.floor((t || 0) / 420) % 2 ? "marche" : "debout") : r.poi.pose;
      setPose(cat, r, pose);
      return;
    }
    const sc = CAT_SCALE * (BREED[cat.breed] && BREED[cat.breed].big ? 1.18 : 1) * (cat.kitten ? KITTEN_SCALE : 1);
    r.node.setAttribute("transform", "translate(" + r.x.toFixed(1) + "," + r.y.toFixed(1) + ") scale(" + (r.dir * sc).toFixed(2) + "," + sc.toFixed(2) + ")");
    const cls = "cat " + r.state;
    if (r.node.getAttribute("class") !== cls) r.node.setAttribute("class", cls);
  }
  /* Murs devant les chats. Les murs font partie de l'image de fond : quand un chat passe derrière l'un d'eux,
     on redessine par-dessus lui la bande de mur concernée, découpée dans ce qui est affiché à cet instant. */
  const WALLS = window.RONRON_WALLS || null;
  let wallCanvas = null, wallBox = null, wallStamp = 0, wallKey = "";
  if (WALLS) {
    let x0 = 1e9, y0 = 1e9, x1 = 0, y1 = 0;
    WALLS.strips.forEach(st => {
      st.w = st.cols.length * WALLS.step; st.cx = st.x + st.w / 2;
      st.top = Math.min.apply(null, st.cols.map(c => c[0])); st.bot = Math.max.apply(null, st.cols.map(c => c[1]));
      x0 = Math.min(x0, st.x); x1 = Math.max(x1, st.x + st.w); y0 = Math.min(y0, st.top); y1 = Math.max(y1, st.bot);
    });
    wallBox = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  // Recompose l'image de la maison (dalles du terrain puis calques des chantiers) dès que ce qui est affiché change.
  function refreshWalls(layers) {
    if (!WALLS) return;
    const B = wallBox, inB = t => t.x < B.x + B.w && t.x + t.w > B.x && t.y < B.y + B.h && t.y + t.h > B.y;
    const list = TILES.filter(inB).concat(layers.filter(inB));      // seulement ce qui touche la maison : pas tout le domaine
    const key = list.map(p => p.src).join("|");                     // un chantier ailleurs sur le domaine ne refait pas les murs
    if (key === wallKey) return;
    wallKey = key;
    const stamp = ++wallStamp;
    Promise.all(list.map(p => getBitmap(imgOf(p)))).then(ims => {
      if (stamp !== wallStamp) return;
      const cv = document.createElement("canvas"); cv.width = B.w; cv.height = B.h;
      const ctx = cv.getContext("2d");
      list.forEach((p, i) => { if (ims[i]) try { if (p.pk) ctx.drawImage(ims[i], p.pk[1], p.pk[2], p.w, p.h, p.x - B.x, p.y - B.y, p.w, p.h); else ctx.drawImage(ims[i], p.x - B.x, p.y - B.y, p.w, p.h); } catch (e) { /* image libérée */ } });
      WALLS.strips.forEach(st => { if (st.node) { st.node.remove(); st.node = null; } });
      wallCanvas = cv;
      sortCats();
    });
  }
  function stripNode(st) {
    if (st.node || !wallCanvas) return st.node;
    try {
      const cv = document.createElement("canvas"); cv.width = st.w; cv.height = st.bot - st.top;
      const ctx = cv.getContext("2d"), step = WALLS.step;
      st.cols.forEach((c, k) => {
        const h = c[1] - c[0];
        if (h > 0) ctx.drawImage(wallCanvas, st.x + k * step - wallBox.x, c[0] - wallBox.y, step, h, k * step, c[0] - st.top, step, h);
      });
      const n = document.createElementNS("http://www.w3.org/2000/svg", "image");
      n.setAttribute("class", "wall"); n.setAttribute("href", cv.toDataURL());
      n.setAttribute("x", st.x); n.setAttribute("y", st.top); n.setAttribute("width", st.w); n.setAttribute("height", cv.height);
      st.node = n;
    } catch (e) { wallCanvas = null; }   // navigateur qui refuse de relire l'image : on se passe des murs
    return st.node;
  }
  /* Haies du labyrinthe : comme les murs, découpées en bandes (assets/haies.js) ; une bande est posée par-dessus un chat qui passe derrière. */
  const HEDGES = window.RONRON_HEDGES || null;
  if (HEDGES) HEDGES.strips = HEDGES.strips.map(a => ({ x: a[0], top: a[1], w: a[2], h: a[3], sx: a[4], sy: a[5], a: a[6], b: a[7], bot: a[1] + a[3], cx: a[0] + a[2] / 2, node: null }));
  function hedgeNode(st) {
    if (st.node) return st.node;
    const NS = "http://www.w3.org/2000/svg", n = document.createElementNS(NS, "svg"), im = document.createElementNS(NS, "image");
    n.setAttribute("class", "wall"); n.setAttribute("x", st.x); n.setAttribute("y", st.top); n.setAttribute("width", st.w); n.setAttribute("height", st.h);
    n.setAttribute("viewBox", st.sx + " " + st.sy + " " + st.w + " " + st.h); n.setAttribute("preserveAspectRatio", "none");
    im.setAttribute("href", HEDGES.src); im.setAttribute("width", HEDGES.fw); im.setAttribute("height", HEDGES.fh);
    n.appendChild(im); st.node = n; return n;
  }
  // Ordre de dessin : chats et objets du plus loin au plus près, et après chacun les bandes de mur qui le cachent.
  function sortCats() {
    const layer = $("#objects");
    if (!layer) return;
    const items = Array.from(layer.children).filter(n => !n.classList.contains("wall")).map(n => {
      if (n.dataset.cat) {
        const r = catRT[n.dataset.cat];
        if (!r) return { n: n, y: 0 };
        const up = r.poi && (r.state === "poi" || r.state === "hop");
        return { n: n, cat: !up, x: r.x, y: up && r.poi.depth ? Math.max(r.y, r.poi.depth) : r.y, hw: 46, h: 104 };
      }
      return { n: n, y: +n.dataset.depth };   // meuble : son image ne contient déjà que ce qui dépasse des murs
    }).sort((p, q) => p.y - q.y);
    const after = items.map(() => []);
    if (WALLS && wallCanvas) WALLS.strips.forEach(st => {
      let slot = -1;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        // caché par cette bande : assez près pour la toucher, les pattes sous le haut du mur et derrière la ligne de son pied
        if (it.cat && Math.abs(it.x - st.cx) < it.hw + st.w / 2 && it.y > st.top && it.y - it.h < st.bot && it.y < st.a * it.x + st.b - 1) slot = i;
      }
      if (slot >= 0) { const n = stripNode(st); if (n) after[slot].push(n); }
      else if (st.node && st.node.parentNode) st.node.remove();
    });
    if (HEDGES) {
      const on = isDone(HEDGES.need), cats = on ? items.map((it, i) => (it.cat ? i : -1)).filter(i => i >= 0) : [];
      HEDGES.strips.forEach(st => {
        let slot = -1;
        for (let j = 0; j < cats.length; j++) {
          const it = items[cats[j]];
          if (Math.abs(it.x - st.cx) < it.hw + st.w / 2 && it.y > st.top && it.y - it.h < st.bot && it.y < st.a * it.x + st.b - 1) slot = cats[j];
        }
        if (slot >= 0) after[slot].push(hedgeNode(st));
        else if (st.node && st.node.parentNode) st.node.remove();
      });
    }
    const order = [];
    items.forEach((it, i) => { order.push(it.n); after[i].forEach(n => order.push(n)); });
    const kids = layer.children;
    let same = kids.length === order.length;
    for (let i = 0; same && i < order.length; i++) if (kids[i] !== order[i]) same = false;
    if (!same) order.forEach(n => layer.appendChild(n));
  }
  function renderCats() {
    $("#objects").innerHTML = catsSVG();
    S.cats.forEach(c => { const r = rt(c); r.node = $('#objects [data-cat="' + c.id + '"]'); r.shown = null; r.hidden = false; placeCat(c, 0); });
    renderDepth();
  }
  let lastT = 0, lastSort = 0;
  function tick(t) {
    requestAnimationFrame(tick);
    const dt = Math.min(0.1, (t - lastT) / 1000); lastT = t;
    if (view !== "home" || reducedMotion || zooming()) return;
    S.cats.forEach(cat => {
      const r = rt(cat);
      if (r.state === "walk") {
        const goal = r.path[0], dx = goal[0] - r.x, dy = goal[1] - r.y;
        const inHedge = HIDDEN(navFree[cellOf(r.x, r.y)]);      // dans la haie ou sous la grille : le chat disparaît et se faufile vite
        if (inHedge !== !!r.hidden) { r.hidden = inHedge; r.node.style.opacity = inHedge ? 0 : 1; }
        const d = Math.hypot(dx, dy * 1.6), step = (inHedge ? 150 : 62) * dt;   // la profondeur est écrasée par la vue de dessus
        if (d <= step) {
          r.x = goal[0]; r.y = goal[1]; r.path.shift();
          if (!r.path.length && r.goal) {                       // arrivé au pied du meuble : il saute dessus
            const p = r.goal; r.goal = null;
            startHop(r, p.x, p.y, t, "poi");
          } else if (!r.path.length) {
            const k = Math.random();
            if (k < 0.55) { r.state = "idle"; r.sit = Math.random() < 0.6; r.until = t + rand(1500, 4500); }
            else if (k < 0.8) { r.state = "sleep"; r.until = t + rand(6000, 14000); }
            else newTrip(r);
          }
        } else {
          r.x += dx / d * step; r.y += dy / d * step;
          if (Math.abs(dx) > 1.5) r.dir = dx > 0 ? 1 : -1;
        }
      } else if (r.state === "hop") {
        const h = r.hop, u = Math.min(1, (t - h.t0) / h.dur), e = u * u * (3 - 2 * u);
        r.x = h.x0 + (h.x1 - h.x0) * e; r.y = h.y0 + (h.y1 - h.y0) * e;
        r.lift = Math.sin(Math.PI * u) * Math.min(46, 14 + Math.abs(h.y1 - h.y0) * 0.35);      // petit bond
        if (u >= 1) {
          r.lift = 0; r.hop = null;
          if (h.next === "poi" && r.poi) { r.state = "poi"; r.dir = r.poi.dir || r.dir; r.until = t + rand(r.poi.min || 8000, r.poi.max || 16000); }
          else { r.poi = null; r.state = "idle"; r.sit = Math.random() < 0.5; r.until = t + rand(800, 2500); }
        }
      } else if (r.state === "poi") {
        if (t > r.until) startHop(r, r.poi.ax, r.poi.ay, t, "floor");
      } else {
        if (r.hidden) { r.hidden = false; r.node.style.opacity = 1; }
        if (t > r.until) newTrip(r);
      }
      placeCat(cat, t);
    });
    if (t - lastSort > 100) { lastSort = t; sortCats(); }
  }

  /* ================= 7. Chantiers ================= */

  let preview = null;   // { id, style } : style essayé depuis la feuille de choix
  const isDone = id => !!(S.house[id] && S.house[id].done);
  const available = s => !isDone(s.id) && (s.need || []).every(isDone) && zoneOpen(zoneOf(s));
  // zones fermées dont un premier chantier serait prêt : on y pose un cadenas
  function lockedZones() {
    const out = [];
    Object.keys(ZONES).forEach(z => {
      if (zoneOpen(z)) return;
      const first = SLOTS.find(s => zoneOf(s) === z && !isDone(s.id) && (s.need || []).every(isDone));
      if (first) out.push({ z: z, at: first.at });
    });
    return out;
  }
  const patchOf = (s, k) => (s.styles ? s.styles[k | 0] && s.styles[k | 0].patch : s.patch);
  const hasArt = s => (s.styles ? s.styles.some(st => st.patch) : !!s.patch);

  // Style affiché pour un chantier : celui qu'on essaie dans la feuille de choix, sinon celui qui est posé.
  function effStyle(id) {
    if (preview && preview.id === id) return preview.style;
    return isDone(id) ? (S.house[id].style | 0) : null;
  }
  let layersKey = null;
  function renderLayers() {
    const shown = [];
    SLOTS.forEach(s => {
      const k = effStyle(s.id);
      if (k == null || s.depth) return;
      let p = patchOf(s, k);
      if (typeof p === "function") p = p(effStyle);
      if (p) shown.push(p);
      const more = s.extra && s.extra(effStyle);
      if (more) shown.push(more);
    });
    DECOS.forEach(d => { if (decoShown(d)) shown.push(d.patch); });
    // les calques ne changent pas à chaque passage ici : on ne refait les images que si la liste a changé
    const key = shown.map(p => p.src + "@" + p.x + "," + p.y).join("|");
    if (key !== layersKey) {
      // les carreaux que le changement ne touche pas gardent leur image : essayer un style ne repeint que son coin
      const oldKey = layersKey, id = p => p.src + "@" + p.x + "," + p.y, A_ = new Set(shownList.map(id)), B_ = new Set(shown.map(id));
      const changed = shownList.filter(p => !B_.has(id(p))).concat(shown.filter(p => !A_.has(id(p))));
      layersKey = key; shownList = shown;
      Object.keys(chunks).forEach(c => { const o = chunks[c]; if (o.key === oldKey && !changed.some(p => hit(geom(+c), p))) o.key = key; });
      updateView(); composeFar();
    }
    refreshWalls(shown);
    renderDepth();
  }
  // Objets triés en profondeur avec les chats : ils vivent dans le même calque qu'eux.
  function renderDepth() {
    const layer = $("#objects");
    if (!layer) return;
    Array.from(layer.querySelectorAll(".obj")).forEach(n => n.remove());
    let h = "";
    // un objet rangé dans une planche (p.fw : taille de la planche) est cadré par une vue sur sa partie de la planche
    const img = (p, dp) => {
        if (!p) return;
        if (p.fw) h += '<svg class="obj" data-depth="' + dp + '" x="' + p.x + '" y="' + p.y + '" width="' + p.w + '" height="' + p.h + '" viewBox="' + p.sx + " " + p.sy + " " + p.w + " " + p.h +
          '" preserveAspectRatio="none"><image href="' + p.src + '" width="' + p.fw + '" height="' + p.fh + '"/></svg>';
        else h += '<image class="obj" data-depth="' + dp + '" href="' + p.src + '" x="' + p.x + '" y="' + p.y + '" width="' + p.w + '" height="' + p.h + '"/>';
    };
    SLOTS.forEach(s => {
      const k = effStyle(s.id);
      if (k == null) return;
      // « parts » : morceaux d'un chantier posé à plat, redessinés un par un à leur profondeur
      if (s.parts) (s.parts[vk(s, k, effStyle)] || s.parts[k] || []).forEach(o => img(o.patch, o.depth));
      if (s.depth) img(patchOf(s, k), Array.isArray(s.depth) ? s.depth[k] : s.depth);
    });
    DECOS.forEach(d => { if (decoShown(d)) d.parts.forEach(o => img(o.patch, o.depth)); });
    if (h) layer.insertAdjacentHTML("beforeend", h);
    sortCats();
  }
  function renderMarkers() {
    markersEl.innerHTML = preview ? "" : SLOTS.filter(available).map(s =>
      '<button class="mk' + (S.kibble < s.cost || !hasArt(s) ? " poor" : "") + '" type="button" data-slot="' + s.id + '" style="left:' + s.at[0] + "px;top:" + s.at[1] +
      'px" aria-label="' + esc(s.name) + ", " + plural(s.cost, "croquette") + '"><span class="bob">' + ico(s.icon) + "<b>" + s.cost + "</b></span></button>").join("") +
      lockedZones().map(l =>
      '<button class="mk lock' + (S.kibble < zoneCost(l.z) ? " poor" : "") + '" type="button" data-zone="' + l.z + '" style="left:' + l.at[0] + "px;top:" + l.at[1] +
      'px" aria-label="Débloquer ' + esc(ZONES[l.z].name) + ", " + plural(zoneCost(l.z), "croquette") + '"><span class="bob">' + ico("lock") + "<b>" + zoneCost(l.z) + "</b></span></button>").join("");
  }
  function openZone(z) {
    const zone = ZONES[z], cost = zoneCost(z), poor = S.kibble < cost, l = lockedZones().find(o => o.z === z);
    if (!zone || !l) return;
    const lim = camLimits();
    if (lim.vw) centerOn(l.at[0], l.at[1] + lim.vh * 0.2 / cam.s);
    openSheet('<span class="tag">Nouvelle zone</span><h2>' + esc(zone.name) + "</h2><p>" + esc(zone.desc) +
      " Débloque-la pour y lancer ses chantiers.</p>" +
      '<button class="btn block" id="z-buy" type="button"' + (poor ? " disabled" : "") + ">" +
      (poor ? "Il te manque " + plural(cost - S.kibble, "croquette") : "Débloquer · " + cost + " " + ico("kibble")) + "</button>", { noFocus: true });
    $("#z-buy").onclick = () => {
      if (S.kibble < cost || zoneOpen(z)) return;
      S.kibble -= cost; S.zones[z] = true;
      save(); closeSheet(); buzz(15); sfx("buy"); renderHome();
      toast(zone.name + " : zone débloquée !");
    };
  }

  function renderHome() {
    renderLayers(); renderMarkers(); renderCats();
    if (!cam.placed && mapEl.clientWidth) { cam.placed = true; centerOn(WORLD.start[0], WORLD.start[1], 0.5); }
    else applyCam();
    const done = SLOTS.filter(s => isDone(s.id)).length, open = SLOTS.filter(available), locks = lockedZones();
    let hint;
    const cheapest = locks.length ? Math.min.apply(null, locks.map(l => zoneCost(l.z))) : 0;
    if (!open.length && locks.length) hint = S.kibble >= cheapest ? "Touche le cadenas pour débloquer une nouvelle zone." : "Réussis des niveaux pour débloquer la zone suivante (" + cheapest + " croquettes).";
    else if (done === SLOTS.length) hint = "Tous les chantiers disponibles sont terminés. Les suivants arrivent avec leurs images.";
    else if (open.length && !open.some(hasArt)) hint = "Glisse pour te balader, pince pour zoomer. Les chantiers s'activeront avec leurs images.";
    else if (!open.some(s => S.kibble >= s.cost)) hint = "Réussis des niveaux pour gagner des croquettes, puis reviens lancer un chantier.";
    else hint = "Touche une bulle pour lancer un chantier.";
    $("#room-hint").textContent = hint;
    $("#btn-styles").hidden = !SLOTS.some(s => isDone(s.id) && s.styles && s.styles.filter(st => st.patch).length > 1);
    updateHud();
  }

  function openSlot(slot, restyle) {
    const ready = hasArt(slot), poor = !restyle && S.kibble < slot.cost;
    const styles = slot.styles ? slot.styles.map((st, k) => ({ st: st, k: k })).filter(o => o.st.patch) : [];
    let sel = restyle ? (S.house[slot.id].style | 0) : (styles.length ? styles[0].k : 0);
    if (styles.length) { preview = { id: slot.id, style: sel }; renderLayers(); renderMarkers(); prepSnaps(slot); }
    // on remonte le chantier dans le haut de l'écran, au-dessus de la feuille
    const l = camLimits();
    if (l.vw) centerOn(slot.at[0], slot.at[1] + l.vh * 0.2 / cam.s);
    let h = '<span class="tag">' + esc(slot.room) + "</span><h2>" + esc(restyle ? slot.short || slot.name : slot.name) + "</h2><p>" + esc(restyle ? "Changer de style est gratuit." : slot.desc) + "</p>";
    if (styles.length > 1) {
      h += '<div class="swatches">' + styles.map(o =>
        '<button class="swatch" type="button" data-k="' + o.k + '" aria-pressed="' + (o.k === sel) + '"><i style="background:' + o.st.sw + '"></i>' + esc(o.st.name) + "</button>").join("") + "</div>";
    }
    if (!ready) h += "<p><strong>Image en attente.</strong> Ce chantier s'activera dès que son image sera intégrée au jeu.</p>";
    h += '<button class="btn block" id="s-buy" type="button"' + (poor || !ready ? " disabled" : "") + ">" +
      (!ready ? "Bientôt disponible"
        : restyle ? "Appliquer ce style"
        : poor ? "Il te manque " + plural(slot.cost - S.kibble, "croquette")
        : esc(slot.verb) + " · " + slot.cost + " " + ico("kibble")) + "</button>";
    openSheet(h, { onClose: () => { preview = null; dropSnaps(); if (view === "home") renderHome(); }, noFocus: true });
    $$(".swatch", sheet).forEach(b => {
      b.onclick = () => {
        sel = +b.dataset.k; preview.style = sel;
        $$(".swatch", sheet).forEach(x => x.setAttribute("aria-pressed", x === b));
        renderLayers();
      };
    });
    $("#s-buy").onclick = () => {
      if (!ready) return;
      if (restyle) S.house[slot.id].style = sel;
      else {
        if (S.kibble < slot.cost) return;
        S.kibble -= slot.cost;
        S.house[slot.id] = { done: true, style: sel };
        addPack(1, slot.short || slot.name, { album: ALB[zoneOf(slot) || "gardien"] ? zoneOf(slot) || "gardien" : null });
      }
      buildNav(); settleCats();
      save(); closeSheet(); buzz(15); sfx(restyle ? "wear" : "build");
      if (!restyle) toast(slot.name + " : c'est fait ! Une carte à ouvrir.");
      updateCardBadge();
    };
  }

  $("#btn-styles").onclick = () => {
    const list = SLOTS.filter(s => isDone(s.id) && s.styles && s.styles.filter(st => st.patch).length > 1);
    openSheet('<h2>Changer un style</h2><p>Changer de style est gratuit.</p><div class="list">' +
      list.map(s => '<button type="button" data-slot="' + s.id + '">' + esc(s.short || s.name) + "<span>" + esc(s.styles[S.house[s.id].style | 0].name) + "</span></button>").join("") + "</div>");
    $$(".list button", sheet).forEach(b => { b.onclick = () => openSlot(SLOT[b.dataset.slot], true); });
  };

  markersEl.addEventListener("click", e => {
    const m = e.target.closest ? e.target.closest(".mk") : null;
    if (m && dragDist < 10) { if (m.dataset.zone) openZone(m.dataset.zone); else openSlot(SLOT[m.dataset.slot]); }
  });

  /* ================= 8. Boutique ================= */

  function renderShop() {
    const full = catsSoon() >= MAX_CATS;
    $("#shop-breeds").innerHTML = BREEDS.map(b => {
      const poor = S.kibble < b.price;
      return '<div class="card">' + portrait(b.id, null) + '<div class="name">' + esc(b.name) + "</div>" +
        '<button class="btn small block" type="button" data-breed="' + b.id + '"' + (poor || full ? " disabled" : "") + ">" +
        (full ? "Maison pleine" : "Adopter · " + b.price + " " + ico("kibble")) + "</button></div>";
    }).join("");
    $("#mycats-title").textContent = "Mes chats (" + S.cats.length + ")";
    const have = COATS.filter(c => S.album[c.id]).length;
    $("#shop-tuna").innerHTML = '<div class="tunabox">' + ico("tuna") + "<p><strong>" + plural(S.tuna, "boîte") + " de thon.</strong> " +
      "Gagne-en en finissant un niveau sans perdre de poisson. Donne " + LITTER + " boîtes à un chat : un chaton naîtra " + BIRTH_LEVELS + " niveaux plus tard.</p></div>" +
      '<button class="btn ghost small block" id="b-album" type="button">Album des robes · ' + have + " / " + COATS.length + "</button>";
    $("#b-album").onclick = openAlbum;
    $("#shop-cats").innerHTML = S.cats.length ? S.cats.map(c => {
      const owned = c.owned || [], coat = BREED[c.breed] || {}, mom = c.mom ? S.cats.find(o => o.id === c.mom) : null;
      let line = esc(coat.name || "") + (coat.rare ? " · robe rare" : "");
      if (c.kitten) line = "Chaton " + (mom ? "de " + esc(mom.name) + " " : "") + "· " + esc(coat.name || "") + (coat.rare ? " (rare)" : "") +
        " · grand dans " + levelsText(Math.max(1, c.kitten - S.level));
      else if (c.expect) line += ' · <span class="soon">un chaton dans ' + levelsText(Math.max(1, c.expect.due - S.level)) + "</span>";
      let chips = "";
      if (!c.kitten && !c.expect) chips += '<button class="chip feed" type="button" data-feed="1"' + (S.tuna < LITTER || full ? " disabled" : "") + ">" +
        (full ? "Maison pleine" : "Nourrir · " + LITTER + " " + ico("tuna")) + "</button>";
      if (!c.kitten && ACCS.length) {
        const n = wornIds(c).length;
        chips += '<button class="chip dress" type="button" data-dress="1">' + ico("plus") + "Habiller" + (n ? " · " + n + " porté" + (n > 1 ? "s" : "") : "") + "</button>";
      }
      return '<div class="catrow' + (c.kitten ? " kid" : "") + '" data-cat="' + c.id + '">' + portrait(c.breed, wornIds(c)) +
        '<div><input id="cat-name-' + c.id + '" type="text" maxlength="14" value="' + esc(c.name) + '" aria-label="Nom du chat">' +
        '<div class="breed">' + line + "</div></div>" +
        '<div class="chips">' + (chips || '<span class="small">Trop petit pour les accessoires.</span>') + "</div></div>";
    }).join("") : '<p class="empty">Aucun chat pour l\'instant. Le premier coûte ' + plural(BREEDS[0].price, "croquette") + ' : adopte-le juste en dessous, il viendra se promener dans la maison.</p>';
    updateHud();
  }

  function openAlbum() {
    const have = COATS.filter(c => S.album[c.id]).length;
    openSheet("<h2>Album des robes</h2><p>" + have + " robes sur " + COATS.length + ". Les robes rares n'arrivent qu'avec un chaton.</p>" +
      '<div class="album">' + COATS.map(c => {
        const got = !!S.album[c.id];
        return '<div class="robe' + (got ? "" : " missing") + (c.rare ? " rare" : "") + '">' + portrait(c.id, null) +
          "<span>" + (got || !c.rare ? esc(c.name) : "???") + "</span>" + (c.rare ? "<em>Rare</em>" : "") + "</div>";
      }).join("") + "</div>" +
      '<button class="btn block" id="al-ok" type="button">Fermer</button>', { noFocus: true });
    $("#al-ok").onclick = () => closeSheet();
  }

  // Un chaton est né pendant les niveaux : on le présente en revenant à la maison, et on peut lui choisir un nom.
  function announceBirth() {
    const kid = S.cats.find(c => c.fresh);
    if (!kid || !sheet.hidden || view !== "home") return;
    const mom = S.cats.find(c => c.id === kid.mom), coat = BREED[kid.breed] || {};
    // le chaton apparaît à côté de sa mère, et on va les voir
    const r = rt(kid), m = mom ? catRT[mom.id] : null;
    if (m && !m.poi) { r.x = m.x; r.y = m.y; r.path = []; r.state = "idle"; r.until = 0; r.dir = -m.dir; placeCat(kid, 0); }
    const l = camLimits();
    if (l.vw) centerOn(r.x, r.y + l.vh * 0.22 / Math.max(cam.s, 0.5), 0.5);
    openSheet('<span class="tag">Un chaton est né</span><h2>' + (mom ? esc(mom.name) + " a eu un chaton !" : "Un chaton est né !") + "</h2>" +
      '<div class="newborn' + (coat.rare ? " rare" : "") + '">' + portrait(kid.breed, null) + "</div>" +
      "<p>Robe <strong>" + esc(coat.name || "") + "</strong>" + (coat.rare ? ", une robe rare !" : ".") + " Il deviendra grand dans " + GROW_LEVELS + " niveaux.</p>" +
      '<input class="namefield" id="k-name" type="text" maxlength="14" value="' + esc(kid.name) + '" aria-label="Nom du chaton">' +
      '<button class="btn block" id="k-ok" type="button">Bienvenue, petit chat !</button>', { sticky: true, noFocus: true });
    sfx("cat");
    $("#k-ok").onclick = () => {
      kid.name = $("#k-name").value.trim() || kid.name; delete kid.fresh; save();
      closeSheet(); renderHome(); announceBirth();
    };
  }

  $("#shop-breeds").addEventListener("click", e => {
    const b = e.target.closest ? e.target.closest("button[data-breed]") : null;
    if (!b || b.disabled) return;
    const breed = BREED[b.dataset.breed];
    if (S.kibble < breed.price || catsSoon() >= MAX_CATS) return;
    S.kibble -= breed.price;
    const used = S.cats.map(c => c.name);
    const name = CAT_NAMES.find(n => used.indexOf(n) < 0) || "Chat " + S.nextCat;
    S.cats.push({ id: S.nextCat++, breed: breed.id, name: name, owned: [], wears: {} });
    S.album[breed.id] = true;
    save(); renderShop(); buzz(15); sfx("buy");
    toast(name + " a rejoint la maison.");
  });
  $("#shop-cats").addEventListener("click", e => {
    const f = e.target.closest ? e.target.closest("button[data-feed]") : null;
    if (f) {
      if (f.disabled) return;
      const cat = S.cats.find(c => c.id === +f.closest(".catrow").dataset.cat);
      if (!cat || cat.kitten || cat.expect || S.tuna < LITTER || catsSoon() >= MAX_CATS) return;
      S.tuna -= LITTER; cat.expect = { due: S.level + BIRTH_LEVELS, coat: rollCoat(cat) };
      save(); renderShop(); buzz(15); sfx("buy");
      toast(cat.name + " se régale. Un chaton naîtra dans " + BIRTH_LEVELS + " niveaux.");
      return;
    }
    const d = e.target.closest ? e.target.closest("button[data-dress]") : null;
    if (d) openDress(+d.closest(".catrow").dataset.cat);
  });
  /* Habiller un chat : un accessoire par endroit (tête, yeux, cou). Un accessoire acheté reste à ce chat ; on l'enlève ou on le remet librement. */
  function dressHtml(cat) {
    const owned = cat.owned || [];
    return '<div class="dress-prev">' + portrait(cat.breed, wornIds(cat)) + "</div>" +
      WEAR_SLOTS.map(([slot, label]) => {
        const list = ACCS.filter(a => a.slot === slot);
        if (!list.length) return "";
        return "<h3>" + label + '</h3><div class="chips">' + list.map(a => {
          const has = owned.indexOf(a.id) >= 0, on = cat.wears[slot] === a.id;
          const poor = !has && (a.tuna ? S.tuna < a.tuna : S.kibble < a.price);
          return '<button class="chip' + (a.tuna && !has ? " feed" : "") + '" type="button" data-acc="' + a.id + '" aria-pressed="' + on + '"' + (poor ? " disabled" : "") + ">" +
            esc(a.name) + (has ? "" : " · " + (a.tuna ? a.tuna + " " + ico("tuna") : a.price + " " + ico("kibble"))) + "</button>";
        }).join("") + "</div>";
      }).join("") +
      '<p class="small">Les accessoires en thon sont les plus beaux : le thon se gagne en finissant un niveau sans perdre de poisson.</p>' +
      '<button class="btn block" id="dress-ok" type="button">Terminé</button>';
  }
  function openDress(id) {
    const cat = S.cats.find(c => c.id === id);
    if (!cat || cat.kitten) return;
    const head = () => '<span class="tag">' + plural(S.kibble, "croquette") + " · " + plural(S.tuna, "boîte") + " de thon</span><h2>Habiller " + esc(cat.name) + "</h2>";
    openSheet('<div id="dress">' + head() + dressHtml(cat) + "</div>", { noFocus: true, onClose: renderShop });
    const box = $("#dress");
    box.addEventListener("click", e => {
      if (e.target.closest("#dress-ok")) { closeSheet(); return; }
      const b = e.target.closest("button[data-acc]");
      if (!b || b.disabled) return;
      const acc = ACC[b.dataset.acc];
      cat.owned = cat.owned || [];
      if (cat.owned.indexOf(acc.id) < 0) {
        if (acc.tuna ? S.tuna < acc.tuna : S.kibble < acc.price) return;
        if (acc.tuna) S.tuna -= acc.tuna; else S.kibble -= acc.price;
        cat.owned.push(acc.id); cat.wears[acc.slot] = acc.id; sfx("buy");
      } else {
        if (cat.wears[acc.slot] === acc.id) delete cat.wears[acc.slot]; else cat.wears[acc.slot] = acc.id;
        sfx("wear");
      }
      save(); updateHud();
      box.innerHTML = head() + dressHtml(cat);
    });
  }
  $("#shop-cats").addEventListener("change", e => {
    if (e.target.tagName !== "INPUT") return;
    const cat = S.cats.find(c => c.id === +e.target.closest(".catrow").dataset.cat);
    cat.name = e.target.value.trim() || cat.name; e.target.value = cat.name; save();
  });

  /* ================= 9. Réglages ================= */

  function openSettings() {
    openSheet(
      "<h2>Maison Ronron</h2><p>Version 0.39." + (memoryOnly ? " <strong>La sauvegarde est indisponible dans ce navigateur : la partie sera perdue à la fermeture.</strong>" : " La partie est enregistrée sur cet appareil.") + "</p>" +
      '<span class="tag">Son</span>' +
      '<label class="vol"><span>Musique</span><input id="v-music" type="range" min="0" max="100" step="5" value="' + Math.round(audioPref.music * 100) + '"><output id="o-music">' + Math.round(audioPref.music * 100) + '</output></label>' +
      '<label class="vol"><span>Bruitages</span><input id="v-sfx" type="range" min="0" max="100" step="5" value="' + Math.round(audioPref.sfx * 100) + '"><output id="o-sfx">' + Math.round(audioPref.sfx * 100) + '</output></label>' +
      (adventDay() >= 1 ? '<label class="toggle"><span>Neige sur le domaine</span><input id="v-snow" type="checkbox"' + (S.snowOff ? "" : " checked") + "></label>" : "") +
      '<span class="tag">Sauvegarde</span>' +
      '<p>Copie ce code et garde-le quelque part (une note, un message) : il permet de retrouver ta partie sur un autre téléphone ou après une réinstallation.</p>' +
      '<textarea class="code" id="b-code" rows="3" spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="Code de sauvegarde"></textarea>' +
      '<div class="row"><button class="btn ghost small" id="b-copy" type="button">Copier mon code</button>' +
      '<button class="btn ghost small" id="b-load" type="button">Restaurer ce code</button></div>' +
      '<span class="tag">Outils de test</span>' +
      '<p class="mapdiag">' + mapDiag() + "</p>" +
      '<div class="row"><button class="btn ghost small" id="t-kibble" type="button">+10 croquettes</button>' +
      '<button class="btn ghost small" id="t-lives" type="button">Recharger les vies</button>' +
      '<button class="btn ghost small" id="t-tuna" type="button">+20 boîtes de thon</button>' +
      '<button class="btn ghost small" id="t-tickets" type="button">+5 tickets</button></div>' +
      '<div class="field"><input id="t-level" type="number" min="1" max="99999" inputmode="numeric" value="' + S.level + '" aria-label="Numéro de niveau">' +
      '<button class="btn ghost small" id="t-go" type="button">Aller à ce niveau</button></div>' +
      '<button class="btn danger small" id="t-reset" type="button">Tout recommencer</button>');
    $("#v-music").oninput = e => { setAudio("music", e.target.value / 100); $("#o-music").textContent = e.target.value; };
    $("#v-sfx").oninput = e => { setAudio("sfx", e.target.value / 100); $("#o-sfx").textContent = e.target.value; };
    $("#v-sfx").onchange = () => sfx("cat");               // un exemple à entendre quand on relâche le curseur
    if ($("#v-snow")) $("#v-snow").onchange = e => { S.snowOff = !e.target.checked; save(); startSnow(); };
    const mine = saveCode();
    $("#b-code").value = mine;
    $("#b-copy").onclick = () => {
      const box = $("#b-code"); box.value = saveCode(); box.focus(); box.select();
      const done = ok => toast(ok ? "Code copié" : "Sélectionne le code et copie-le");
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(box.value).then(() => done(true), () => done(false));
      else { let ok = false; try { ok = document.execCommand("copy"); } catch (err) { ok = false; } done(ok); }
    };
    let loadArmed = false;
    $("#b-load").onclick = e => {
      const next = readCode($("#b-code").value);
      if (!next) { toast($("#b-code").value.trim() === mine ? "Colle d'abord le code d'une autre partie" : "Ce code n'est pas valide"); return; }
      if ($("#b-code").value.trim() === mine) { toast("Colle d'abord le code d'une autre partie"); return; }
      if (!loadArmed) { loadArmed = true; e.currentTarget.textContent = "Confirmer : remplacer ma partie"; return; }
      S = next; migrateAlbum(); migrateCards(); Object.keys(catRT).forEach(k => delete catRT[k]); buildNav();
      syncLives(); save(); closeSheet(); show("home"); toast("Partie restaurée : niveau " + S.level);
    };
    $("#t-kibble").onclick = () => { S.kibble += 10; save(); refresh(); toast("+10 croquettes"); };
    $("#t-lives").onclick = () => { S.lives = MAX_LIVES; S.lifeAt = 0; save(); refresh(); toast("Vies rechargées"); };
    $("#t-tuna").onclick = () => { S.tuna += 20; save(); refresh(); toast("+20 boîtes de thon"); };
    $("#t-tickets").onclick = () => { S.tickets = (S.tickets || 0) + 5; save(); refresh(); toast("+5 tickets"); };
    $("#t-go").onclick = () => {
      const v = Math.max(1, Math.min(99999, parseInt($("#t-level").value, 10) || 1));
      S.level = v; save(); refresh(); toast("Prochain niveau : " + v);
    };
    let armed = false;
    $("#t-reset").onclick = e => {
      if (!armed) { armed = true; e.currentTarget.textContent = "Confirmer : tout effacer"; return; }
      S = freshSave(); migrateCards(); Object.keys(catRT).forEach(k => delete catRT[k]); buildNav();
      save(); closeSheet(); show("home"); toast("Partie remise à zéro");
    };
  }
  function refresh() {
    updateHud();
    if (view === "home") renderHome();
    if (view === "shop") renderShop();
    if (view === "cards") renderCards();
  }

  /* ================= 9. Cartes à collectionner et calendrier de l'Avent ================= */
  /* Chaque carte est une scène du domaine avec un chat (images : assets/k, liste : assets/cards.js). Un album par zone,
     « Hiver au domaine » (calendrier de l'Avent) et les cartes uniques (jauge des doublons). On gagne des pochettes
     aux mini-boss, boss, boss géants et niveaux spéciaux, à chaque chantier et à chaque naissance. */
  const CARDS = window.RONRON_CARDS || { w: 330, h: 440, albums: [] };
  const ALB = {}, CARD = {};
  CARDS.albums.forEach(a => { ALB[a.id] = a; a.rows = Math.ceil(a.cards.length / a.cols); a.cards.forEach((c, i) => { c.i = i; c.album = a.id; CARD[c.id] = c; }); });
  const RARITY = ["Commune", "Rare", "Dorée", "Unique"];
  const DUP_POINTS = [10, 25, 50, 50];             // points de jauge d'un doublon, selon sa rareté
  const PACK_FOR = { mini: 1, boss: 2, geant: 3, rafale: 3, trouee: 3, zero: 3, pelotes: 3 };
  const ALBUM_GIFT = { gardien: { kibble: 40 }, grille: { kitten: "creme" }, allee: { tuna: 20 }, manoir: { kitten: "chocolat" }, cour: { kitten: "rose" },
    aile: { kibble: 60 }, est: { kitten: "lavande" }, perron: { kitten: "menthe" }, etang: { kitten: "nuage" }, laby: { tuna: 30 }, serre: { kibble: 80 }, hiver: { kitten: "bengalneige" }, uniques: { kitten: "or" } };
  const giftText = g => g.kitten ? "un chaton à la robe " + (BREED[g.kitten] ? BREED[g.kitten].name : "rare") : g.kibble ? plural(g.kibble, "croquette") : plural(g.tuna, "boîte") + " de thon";

  function migrateCards() {
    if (S.cards && typeof S.cards === "object" && S.cards.have) return;
    S.cards = { have: {}, packs: [], gauge: 0, pity: 0, miss: 0, fresh: {}, done: {} };
    // une pochette de bienvenue pour chaque zone où l'on a déjà rénové quelque chose
    CARDS.albums.forEach(a => {
      if (a.season || a.unique) return;
      if (SLOTS.some(s => (zoneOf(s) || "gardien") === a.id && isDone(s.id))) S.cards.packs.push({ n: 3, album: a.id, why: "Bienvenue" });
    });
  }
  const albumOpen = a => !a.season && !a.unique && (a.zone ? zoneOpen(a.zone) : true);
  const owned = id => (S.cards.have[id] || 0) > 0;
  const albumCount = a => a.cards.filter(c => owned(c.id)).length;
  function addPack(n, why, opts) { S.cards.packs.push(Object.assign({ n: n, why: why }, opts || {})); }

  // Une carte au hasard : 70 % commune, 25 % rare, 5 % dorée (une dorée garantie après 12 pochettes sans).
  // Plus on enchaîne les doublons, plus une carte manquante a de chances de sortir.
  function drawOne(pool, rare) {
    let r;
    if (S.cards.pity >= 12 && pool.some(c => c.r === 2)) r = 2;
    else { const x = Math.random(); r = x < 0.05 ? 2 : x < 0.3 ? 1 : 0; }
    if (rare && r < 1) r = 1;
    let cand = pool.filter(c => c.r === r);
    for (let k = r; !cand.length && k >= 0; k--) cand = pool.filter(c => c.r === k);
    if (!cand.length) cand = pool;
    const missing = cand.filter(c => !owned(c.id)), pNew = Math.min(0.9, 0.35 + 0.1 * S.cards.miss);
    const pick = missing.length && Math.random() < pNew ? missing : cand;
    const c = pick[Math.floor(Math.random() * pick.length)];
    if (c.r === 2) S.cards.pity = 0;
    return c;
  }
  function gainCard(c) {
    const isNew = !owned(c.id);
    S.cards.have[c.id] = (S.cards.have[c.id] || 0) + 1;
    let points = 0;
    if (isNew) { S.cards.fresh[c.id] = 1; S.cards.miss = 0; }
    else { points = DUP_POINTS[c.r]; S.cards.gauge += points; S.cards.miss++; }
    return { card: c, isNew: isNew, points: points };
  }
  function openPack(p) {
    let pool = [];
    if (p.album && ALB[p.album]) pool = ALB[p.album].cards;
    else CARDS.albums.forEach(a => { if (albumOpen(a)) pool = pool.concat(a.cards); });
    if (!pool.length) return [];
    S.cards.pity++;
    const out = [];
    for (let k = 0; k < p.n; k++) out.push(gainCard(drawOne(pool, p.rare && k === 0)));
    return out;
  }
  // Chaton offert (album complet) ; s'il n'y a plus de place, 20 boîtes de thon à la place.
  function giveKitten(breed) {
    if (catsSoon() >= MAX_CATS) { S.tuna += 20; return null; }
    const used = S.cats.map(o => o.name);
    const name = CAT_NAMES.find(n => used.indexOf(n) < 0) || "Chaton " + S.nextCat;
    const kid = { id: S.nextCat++, breed: breed, name: name, owned: [], wears: {}, kitten: S.level + GROW_LEVELS, fresh: true };
    S.cats.push(kid); S.album[breed] = true;
    return kid;
  }
  // Albums qui viennent d'être complétés : leur cadeau est donné une seule fois.
  function checkAlbums() {
    const done = [];
    CARDS.albums.forEach(a => {
      if (S.cards.done[a.id] || albumCount(a) < a.cards.length) return;
      S.cards.done[a.id] = true;
      const g = ALBUM_GIFT[a.id] || { tuna: 10 };
      if (g.kibble) S.kibble += g.kibble;
      if (g.tuna) S.tuna += g.tuna;
      const kid = g.kitten ? giveKitten(g.kitten) : null;
      done.push({ album: a, gift: g, kid: kid, full: !!g.kitten && !kid });
    });
    return done;
  }

  function cardArt(c) {
    const a = ALB[c.album], col = c.i % a.cols, row = Math.floor(c.i / a.cols);
    return '<span class="art" style="background-image:url(' + a.src + ");background-size:" + a.cols * 100 + "% " + a.rows * 100 + "%;background-position:" +
      (a.cols > 1 ? col / (a.cols - 1) * 100 : 0) + "% " + (a.rows > 1 ? row / (a.rows - 1) * 100 : 0) + '%"></span>';
  }
  function cardHtml(c, o) {
    o = o || {};
    if (o.back) return '<div class="tcard back r' + c.r + '"><span class="q">' + ico("paw") + '</span><span class="nm"><b>?</b><i>' + RARITY[c.r] + "</i></span></div>";
    return '<div class="tcard r' + c.r + (o.big ? " big" : "") + '" data-card="' + c.id + '">' + cardArt(c) +
      '<span class="nm"><b>' + esc(c.n) + "</b><i>" + (c.r === 3 ? "Carte unique" : esc(c.s) + " · " + RARITY[c.r]) + "</i></span>" +
      (o.count > 1 ? '<span class="cnt">×' + o.count + "</span>" : "") + (o.fresh ? '<span class="new">Nouvelle</span>' : "") + "</div>";
  }
  const PACK_BACK = '<div class="tcard cover"><span class="q">' + ico("cards") + '</span><span class="nm"><b>Maison Ronron</b><i>Carte à collectionner</i></span></div>';
  function updateCardBadge() {
    const n = S.cards ? S.cards.packs.length : 0, t = $("#tab-cards");
    if (!t) return;
    t.classList.toggle("badge", n > 0); t.dataset.n = n > 9 ? "9+" : n;
  }

  function renderCards() {
    const el = $("#screen-cards");
    const all = CARDS.albums.reduce((n, a) => n + a.cards.length, 0), have = CARDS.albums.reduce((n, a) => n + albumCount(a), 0);
    const packs = S.cards.packs.length, cardsIn = S.cards.packs.reduce((n, p) => n + p.n, 0), g = S.cards.gauge, uniqLeft = ALB.uniques ? ALB.uniques.cards.some(c => !owned(c.id)) : false;
    let h = '<div class="cardshead"><h2>Mes cartes</h2><span class="count">' + have + " / " + all + "</span></div>";
    if (packs) h += '<button class="btn block packbtn" id="c-open" type="button">' + ico("cards") + "Ouvrir " + (packs > 1 ? packs + " pochettes" : "la pochette") +
      " · " + plural(cardsIn, "carte") + "</button>";
    else h += '<p class="hint">Gagne des pochettes aux mini-boss, aux boss, aux niveaux spéciaux, à chaque chantier et à chaque naissance.</p>';
    h += '<div class="gauge"><div class="gl"><b>Jauge des doublons</b><span>' + Math.min(100, g) + " / 100</span></div>" +
      '<div class="bar"><i style="width:' + Math.min(100, g) + '%"></i></div>' +
      "<p>Chaque doublon remplit la jauge : 10 points pour une commune, 25 pour une rare, 50 pour une dorée. À 100, une carte unique se débloque.</p>" +
      (g >= 100 ? '<button class="btn small block" id="c-unique" type="button">' + (uniqLeft ? "Débloquer une carte unique" : "Échanger contre 10 boîtes de thon") + "</button>" : "") + "</div>";
    h += '<div class="albums">' + CARDS.albums.map(a => {
      const n = albumCount(a), open = albumOpen(a) || a.season || a.unique, first = a.cards.slice().reverse().find(c => owned(c.id));
      const fresh = a.cards.some(c => S.cards.fresh[c.id]);
      const note = a.season ? "Calendrier de l'Avent" : a.unique ? "Jauge des doublons" : !open ? "Zone à débloquer" : S.cards.done[a.id] ? "Album complet" : "Complet : " + giftText(ALBUM_GIFT[a.id] || {});
      return '<button class="albtile' + (open ? "" : " locked") + (S.cards.done[a.id] ? " full" : "") + '" type="button" data-album="' + a.id + '">' +
        '<span class="cover">' + (first ? cardArt(first) : ico(open ? "cards" : "lock")) + (fresh ? '<span class="dot"></span>' : "") + "</span>" +
        "<b>" + esc(a.name) + "</b><span class=\"prog\">" + n + " / " + a.cards.length + '</span><span class="bar"><i style="width:' + Math.round(n / a.cards.length * 100) + '%"></i></span>' +
        '<span class="note">' + esc(note) + "</span></button>";
    }).join("") + "</div>";
    el.innerHTML = h;
    if ($("#c-open")) $("#c-open").onclick = () => openPacks();
    if ($("#c-unique")) $("#c-unique").onclick = claimUnique;
    $$(".albtile", el).forEach(b => { b.onclick = () => openAlbumCards(b.dataset.album); });
    updateCardBadge();
  }
  function openAlbumCards(id) {
    const a = ALB[id]; if (!a) return;
    const n = albumCount(a), gift = ALBUM_GIFT[a.id];
    openSheet('<span class="tag">Album</span><h2>' + esc(a.name) + "</h2><p>" + n + " carte" + (n > 1 ? "s" : "") + " sur " + a.cards.length + "." +
      (a.season ? " Une carte par jour du calendrier de l'Avent." : a.unique ? " Elles se gagnent avec la jauge des doublons." : "") +
      (gift ? (S.cards.done[a.id] ? " Album complet : tu as gagné " : " Complet, il rapporte ") + "<strong>" + giftText(gift) + "</strong>." : "") + "</p>" +
      '<div class="cardgrid">' + a.cards.map(c => owned(c.id) ? cardHtml(c, { count: S.cards.have[c.id], fresh: S.cards.fresh[c.id] }) : cardHtml(c, { back: true })).join("") + "</div>" +
      '<button class="btn ghost block" id="a-close" type="button">Fermer</button>', { noFocus: true });
    a.cards.forEach(c => { delete S.cards.fresh[c.id]; }); save();
    $("#a-close").onclick = () => { closeSheet(); if (view === "cards") renderCards(); };
    $$(".cardgrid .tcard[data-card]", sheet).forEach(t => { t.onclick = () => zoomCard(CARD[t.dataset.card], () => openAlbumCards(id)); });
  }
  function zoomCard(c, back) {
    openSheet('<div class="reveal">' + cardHtml(c, { big: true }) + "</div><p class=\"revtxt\">" + esc(ALB[c.album].name) +
      (S.cards.have[c.id] > 1 ? " · tu l'as en " + S.cards.have[c.id] + " exemplaires" : "") + "</p>" +
      '<button class="btn block" id="z-back" type="button">Retour</button>');
    $("#z-back").onclick = () => back ? back() : closeSheet();
  }
  // Ouvre les pochettes en attente, carte par carte (ou toutes d'un coup), puis annonce les albums complétés.
  function openPacks(after) {
    if (!S.cards.packs.length) return;
    const p = S.cards.packs.shift(), got = openPack(p), done = checkAlbums();
    save(); updateHud(); updateCardBadge();
    let k = 0;
    const next = () => {
      if (done.length) return showAlbumDone(done.splice(0), next);
      if (S.cards.packs.length) return openPacks(after);
      closeSheet(); if (after) after(); else if (view === "cards") renderCards();
    };
    const step = () => {
      if (k >= got.length) return next();
      const g = got[k], last = k + 1 >= got.length;
      openSheet('<span class="tag">' + esc(p.why || "Pochette") + " · carte " + (k + 1) + " sur " + got.length + "</span>" +
        '<div class="reveal"><div class="flip"><div class="face backf">' + PACK_BACK + '</div><div class="face frontf">' + cardHtml(g.card, { big: true }) + "</div></div></div>" +
        '<p class="revtxt">' + (g.isNew ? "<strong>Nouvelle carte !</strong> " + esc(ALB[g.card.album].name) : "Doublon : <strong>+" + g.points + " points</strong> dans la jauge") + "</p>" +
        '<div class="row">' + (got.length - k > 1 || S.cards.packs.length ? '<button class="btn ghost" id="rv-all" type="button">Tout ouvrir</button>' : "") +
        '<button class="btn" id="rv-next" type="button">' + (!last ? "Carte suivante" : S.cards.packs.length ? "Pochette suivante" : "Terminer") + "</button></div>", { sticky: true });
      const f = $(".flip", sheet);
      setTimeout(() => { if (f) f.classList.add("on"); sfx(g.isNew ? "buy" : "tap"); }, reducedMotion ? 0 : 280);
      $("#rv-next").onclick = () => { k++; step(); };
      if ($("#rv-all")) $("#rv-all").onclick = () => revealAll(got.slice(k + 1), done, after);
    };
    step();
  }
  function revealAll(rest, done, after) {
    while (S.cards.packs.length) { const p = S.cards.packs.shift(); rest = rest.concat(openPack(p)); }
    done = done.concat(checkAlbums()); save(); updateHud(); updateCardBadge();
    const nNew = rest.filter(g => g.isNew).length, pts = rest.reduce((n, g) => n + g.points, 0);
    openSheet('<span class="tag">Pochettes ouvertes</span><h2>' + plural(rest.length, "carte") + "</h2><p>" + (nNew ? "<strong>" + plural(nNew, "nouvelle carte") + "</strong>" : "Pas de nouvelle carte") +
      (pts ? " · doublons : <strong>+" + pts + " points</strong> dans la jauge" : "") + ".</p>" +
      '<div class="cardgrid">' + rest.map(g => cardHtml(g.card, { fresh: g.isNew })).join("") + "</div>" +
      '<button class="btn block" id="rv-ok" type="button">Super</button>', { sticky: true });
    sfx("buy");
    $("#rv-ok").onclick = () => {
      const fin = () => { closeSheet(); if (after) after(); else if (view === "cards") renderCards(); };
      done.length ? showAlbumDone(done, fin) : fin();
    };
  }
  function showAlbumDone(list, then) {
    const d = list.shift();
    if (!d) return then();
    openSheet('<span class="tag">Album complet</span><h2>' + esc(d.album.name) + "</h2>" +
      "<p>Les " + d.album.cards.length + " cartes sont réunies ! Ton cadeau : <strong>" + giftText(d.gift) + "</strong>" +
      (d.full ? ". Tu as déjà 30 chats : tu reçois 20 boîtes de thon à la place." : d.kid ? ". Il t'attend dans la maison." : ".") + "</p>" +
      '<button class="btn block" id="ad-ok" type="button">Merci !</button>', { sticky: true });
    sfx("win"); updateHud();
    $("#ad-ok").onclick = () => showAlbumDone(list, then);
  }
  function claimUnique() {
    if (S.cards.gauge < 100) return;
    S.cards.gauge -= 100;
    const left = ALB.uniques ? ALB.uniques.cards.filter(c => !owned(c.id)) : [];
    if (!left.length) { S.tuna += 10; save(); updateHud(); toast("+10 boîtes de thon"); renderCards(); return; }
    const c = left[Math.floor(Math.random() * left.length)];
    gainCard(c); const done = checkAlbums(); save(); updateHud();
    openSheet('<span class="tag">Carte unique</span><div class="reveal"><div class="flip"><div class="face backf">' + PACK_BACK + '</div><div class="face frontf">' + cardHtml(c, { big: true }) +
      '</div></div></div><p class="revtxt"><strong>' + esc(c.n) + "</strong> rejoint ta collection.</p>" +
      '<button class="btn block" id="u-ok" type="button">Génial</button>', { sticky: true });
    const f = $(".flip", sheet); setTimeout(() => { if (f) f.classList.add("on"); sfx("win"); }, reducedMotion ? 0 : 280);
    $("#u-ok").onclick = () => showAlbumDone(done, () => { closeSheet(); renderCards(); });
  }

  /* ----- Calendrier de l'Avent : une case par jour du 1er au 24 décembre ; on rattrape les cases oubliées jusqu'au 6 janvier.
     Il donne les 12 cartes « Hiver au domaine », du thon, des croquettes, des pochettes et 4 décorations du domaine. ----- */
  const ADVENT = [{ kibble: 10, snow: true }, { card: "hiver-1" }, { tuna: 3 }, { card: "hiver-2" }, { pack: 3 }, { deco: "grille", card: "hiver-3" },
    { kibble: 15 }, { card: "hiver-5" }, { tuna: 5 }, { card: "hiver-6" }, { pack: 3 }, { deco: "entree", card: "hiver-4" },
    { kibble: 20 }, { card: "hiver-8" }, { tuna: 5 }, { card: "hiver-9" }, { pack: 3 }, { deco: "gardien", card: "hiver-7" },
    { kibble: 25 }, { card: "hiver-10" }, { tuna: 8 }, { card: "hiver-11" }, { pack: 3, rare: true }, { deco: "cour", card: "hiver-12" }];
  const ADVENT_ORDER = [7, 15, 2, 20, 11, 24, 5, 18, 13, 1, 22, 9, 16, 4, 23, 10, 3, 19, 12, 6, 21, 14, 8, 17];   // cases mélangées, comme un vrai calendrier
  const DECO = {}; DECOS.forEach(d => { DECO[d.id] = d; });
  // Jour du calendrier : 0 en novembre (bientôt), 1 à 31 en décembre, 31 jusqu'au 6 janvier, -1 le reste de l'année.
  function adventDay() {
    const t = new Date(), m = t.getMonth(), d = t.getDate();
    return m === 11 ? d : m === 0 && d <= 6 ? 31 : m === 10 ? 0 : -1;
  }
  function advent() {
    const t = new Date(), y = t.getMonth() === 0 ? t.getFullYear() - 1 : t.getFullYear();
    if (!S.advent || S.advent.year !== y) S.advent = { year: y, open: {}, deco: {} };
    return S.advent;
  }
  const decoShown = d => adventDay() >= 1 && !!(S.advent && S.advent.deco && S.advent.deco[d.id]) && S.advent.year === advent().year;
  const snowOn = () => adventDay() >= 1 && !!(S.advent && S.advent.open && S.advent.open[1]) && !S.snowOff;
  const adventWaiting = () => { const day = adventDay(); if (day < 1) return 0; const A = advent(); let n = 0; for (let k = 1; k <= Math.min(24, day); k++) if (!A.open[k]) n++; return n; };
  function adventText(r) {
    const parts = [];
    if (r.deco && DECO[r.deco]) parts.push("Décoration : " + DECO[r.deco].name);
    if (r.card) parts.push("une carte Hiver au domaine");
    if (r.snow) parts.push("la neige sur le domaine");
    if (r.tuna) parts.push(plural(r.tuna, "boîte") + " de thon");
    if (r.kibble) parts.push(plural(r.kibble, "croquette"));
    if (r.pack) parts.push("une pochette de " + r.pack + " cartes" + (r.rare ? " (une rare au moins)" : ""));
    return parts.join(" + ");
  }
  function adventIcon(r) { return r.deco ? "gift" : r.card ? "cards" : r.pack ? "cards" : r.tuna ? "tuna" : r.kibble ? "kibble" : "gift"; }
  function renderAdventBtn() {
    const b = $("#btn-advent"); if (!b) return;
    const day = adventDay();
    b.hidden = day < 0;
    if (day < 0) return;
    const wait = adventWaiting();
    b.classList.toggle("badge", wait > 0); b.dataset.n = wait;
    $("#advent-sub").textContent = day === 0 ? "J-" + Math.max(1, Math.ceil((new Date(new Date().getFullYear(), 11, 1) - new Date()) / 86400000)) : wait ? "À ouvrir" : "Avent";
  }
  function openAdvent() {
    const day = adventDay(), A = advent();
    const cells = ADVENT_ORDER.map(k => {
      const r = ADVENT[k - 1], opened = !!A.open[k], can = day >= k && !opened;
      return '<button class="adv' + (opened ? " opened" : can ? " can" : " shut") + (r.deco ? " big" : "") + '" type="button" data-day="' + k + '"' + (can || opened ? "" : " disabled") +
        ' aria-label="' + k + " décembre" + (opened ? ", ouverte : " + esc(adventText(r)) : can ? ", à ouvrir" : ", fermée") + '"><b>' + k + "</b>" + (opened ? ico(adventIcon(r)) : "") + "</button>";
    }).join("");
    openSheet('<span class="tag">Calendrier de l\'Avent</span><h2>' + (day === 0 ? "Il ouvre le 1er décembre" : "Une case par jour") + "</h2>" +
      "<p>" + (day === 0 ? "Chaque jour du 1er au 24 décembre, une case à ouvrir : les 12 cartes « Hiver au domaine », du thon, des croquettes, des pochettes et 4 décorations de Noël pour le domaine."
        : "Les cases oubliées se rattrapent jusqu'au 6 janvier. Les 6, 12, 18 et 24, une décoration de Noël apparaît sur le domaine.") + "</p>" +
      '<div class="advgrid">' + cells + "</div>" +
      '<button class="btn ghost block" id="adv-close" type="button">Fermer</button>', { noFocus: true });
    $("#adv-close").onclick = () => closeSheet();
    $$(".adv", sheet).forEach(b => { b.onclick = () => { const k = +b.dataset.day; if (A.open[k]) toast(k + " décembre : " + adventText(ADVENT[k - 1])); else openAdventDay(k); }; });
  }
  function openAdventDay(k) {
    const A = advent(), r = ADVENT[k - 1];
    if (A.open[k] || adventDay() < k) return;
    A.open[k] = true;
    if (r.tuna) S.tuna += r.tuna;
    if (r.kibble) S.kibble += r.kibble;
    if (r.deco) { A.deco[r.deco] = true; buildNav(); settleCats(); renderLayers(); }
    const got = r.card && CARD[r.card] ? gainCard(CARD[r.card]) : null;
    if (r.pack) addPack(r.pack, k + " décembre", { rare: !!r.rare });
    const done = checkAlbums();
    save(); updateHud(); updateCardBadge(); renderAdventBtn(); startSnow();
    const d = r.deco ? DECO[r.deco] : null;
    openSheet('<span class="tag">' + k + " décembre</span><h2>" + (d ? esc(d.name) : got ? esc(got.card.n) : r.pack ? "Une pochette de cartes" : "Un petit cadeau") + "</h2>" +
      (got ? '<div class="reveal"><div class="flip"><div class="face backf">' + PACK_BACK + '</div><div class="face frontf">' + cardHtml(got.card, { big: true }) + "</div></div></div>" : "") +
      "<p>" + esc(adventText(r)) + (r.snow ? ". Il neige sur le domaine jusqu'au 6 janvier (réglable dans les réglages)." : d ? ". Va la voir sur le domaine !" : ".") + "</p>" +
      '<div class="row">' + (d ? '<button class="btn ghost" id="ad-see" type="button">Voir sur le domaine</button>' : "") +
      (r.pack ? '<button class="btn ghost" id="ad-pack" type="button">Ouvrir la pochette</button>' : "") +
      '<button class="btn" id="ad-ok" type="button">' + (got || r.pack ? "Super" : "Merci") + "</button></div>", { sticky: true });
    const f = $(".flip", sheet); setTimeout(() => { if (f) f.classList.add("on"); }, reducedMotion ? 0 : 280);
    sfx("buy");
    const fin = () => showAlbumDone(done, () => { closeSheet(); if (view === "home") renderHome(); });
    $("#ad-ok").onclick = fin;
    if ($("#ad-see")) $("#ad-see").onclick = () => showAlbumDone(done, () => { closeSheet(); show("home"); const l = camLimits(); if (l.vw) centerOn(d.at[0], d.at[1], 0.45); });
    if ($("#ad-pack")) $("#ad-pack").onclick = () => showAlbumDone(done, () => openPacks(() => { if (view === "home") renderHome(); }));
  }

  /* Neige : des flocons qui tombent sur la carte en décembre, une fois la case du 1er ouverte. */
  let snowRaf = 0, snowFlakes = null, snowLast = 0;
  function startSnow() {
    const cv = $("#snow"); if (!cv) return;
    const on = snowOn() && view === "home" && !document.hidden && !reducedMotion;
    cv.hidden = !on;
    if (!on) { if (snowRaf) cancelAnimationFrame(snowRaf); snowRaf = 0; return; }
    if (snowRaf) return;
    const tick = t => {
      snowRaf = requestAnimationFrame(tick);
      if (t - snowLast < 33) return;                     // 30 images par seconde suffisent
      const dt = Math.min(0.1, (t - (snowLast || t)) / 1000); snowLast = t;
      const w = cv.clientWidth, h = cv.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
      if (!w || !h) return;
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      if (!snowFlakes) snowFlakes = Array.from({ length: 90 }, () => ({ x: Math.random() * w, y: Math.random() * h, r: 1 + Math.random() * 2.6, v: 18 + Math.random() * 30, p: Math.random() * 6.28 }));
      const ctx = cv.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      snowFlakes.forEach(f => {
        f.y += f.v * dt * (0.6 + f.r / 3); f.p += dt; f.x += Math.sin(f.p) * 12 * dt;
        if (f.y > h + 4) { f.y = -4; f.x = Math.random() * w; }
        if (f.x < -4) f.x = w + 4; else if (f.x > w + 4) f.x = -4;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.283); ctx.fill();
      });
    };
    snowRaf = requestAnimationFrame(tick);
  }
  document.addEventListener("visibilitychange", startSnow);

  /* ================= 10. Démarrage ================= */

  load();
  $("#tab-home").onclick = () => show("home");
  $("#tab-shop").onclick = () => show("shop");
  $("#tab-cards").onclick = () => show("cards");
  $("#tab-games").onclick = () => show("games");
  RonronJeux.init({ S: () => S, save: save, updateHud: updateHud, sfx: sfx, buzz: buzz, openSheet: openSheet, closeSheet: closeSheet, show: show, toast: toast, ico: ico, plural: plural, esc: esc });
  $("#b-quit").onclick = () => RonronJeux.quit();
  $("#btn-advent").onclick = () => openAdvent();
  $("#tab-play").onclick = () => startLevel();
  $("#btn-settings").onclick = () => openSettings();
  $("#btn-quit").onclick = () => quitLevel();
  $("#btn-rules").onclick = () => showRules();
  $("#btn-hint").onclick = () => useHint();
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !sheetSticky) closeSheet(); });

  migrateZones();
  migrateAlbum();
  migrateCards();
  buildNav();
  let abandoned = false;
  if (S.inLevel) {            // l'appli a été fermée en plein niveau
    if (S.inLevel.fishLost > 0) { loseLife(); abandoned = true; }
    S.inLevel = null;
  }
  syncLives(); save();
  show("home");
  if (abandoned) toast("Niveau abandonné en cours de route : une vie perdue.");
  setInterval(updateHud, 1000);
  requestAnimationFrame(tick);
  requestLevel(S.level);      // la première grille se prépare pendant qu'on regarde la maison

  // App installée : fonctionnement hors ligne, et on demande au téléphone de ne pas effacer la sauvegarde.
  if ("serviceWorker" in navigator && window.top === window && /^https?:$/.test(location.protocol)) {
    // Mise à jour : dès qu'une nouvelle version prend la main, on recharge la page (hors d'un niveau, pour ne rien faire perdre).
    let hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!hadController) { hadController = true; return; }       // première installation : rien à recharger
      if (view === "level" || view === "bonus") pendingReload = true; else location.reload();
    });
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then(reg => {
        // l'app reste souvent ouverte en arrière-plan : on revérifie quand elle revient au premier plan
        document.addEventListener("visibilitychange", () => { if (!document.hidden && reg) reg.update().catch(() => {}); });
      }).catch(() => {});
    });
  }
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (e) { /* sans importance */ }

  // pour les tests : regarder un point de la carte à une échelle donnée (sans les limites du zoom), avec le chargement des images qui va avec
  const look = (x, y, sc) => { const l = camLimits(); cam.s = sc; cam.x = l.vw / 2 - x * sc; cam.y = l.vh / 2 - y * sc;
    worldEl.style.transform = "translate(" + cam.x + "px," + cam.y + "px) scale(" + sc + ")"; markersEl.style.setProperty("--inv", 1 / sc); updateView(); };
  // calques dessinés comme objets (triés avec les chats), tous styles confondus : meow/lowres.py les range dans des planches
  function objKeys() {
    const out = new Set(), effs = [() => 0, () => 1, () => null];
    SLOTS.forEach(s => {
      const n = s.styles ? s.styles.length : 1;
      for (let k = 0; k < n; k++) {
        ((s.parts && s.parts[k]) || []).forEach(o => { if (o.patch) out.add(o.patch); });
        if (s.depth) effs.forEach(e => { let p = patchOf(s, k); if (typeof p === "function") p = p(e); if (p) out.add(p); });
      }
    });
    DECOS.forEach(d => d.parts.forEach(o => { if (o.patch) out.add(o.patch); }));
    return Object.keys(PATCH).filter(k => out.has(PATCH[k]));
  }
  window.__ronron = { objKeys: objKeys, slots: () => SLOTS.map(x => ({ id: x.id, name: x.name, short: x.short, room: x.room, zone: zoneOf(x) || "gardien", poi: x.poi, at: x.at, styles: (x.styles || []).length })), state: () => S, level: () => L, nav: () => navFree, look: look, layers: () => shownList.map(p => [p.src, Object.keys(chunks).some(c => chunks[c].key === layersKey && hit(geom(+c), p)) ? p.src : ""]), shown: () => shownList.map(p => [p.src, p.x, p.y, p.w, p.h]), painted: painted, paintStats: () => paintStats, diag: () => diag, mem: () => ({ chunks: Object.keys(chunks).length, chunkPx: Object.keys(chunks).reduce((s, c) => s + chunks[c].cv.width * chunks[c].cv.height, 0), cachePx: bmPx, cached: bmCache.size }), far: () => [farKey === layersKey, farEl ? !farEl.hidden : false], path: (a, b) => pathTo(a, b), cats: () => catRT, cell: cellOf,
    navCount: () => [navHouse.length, navGarden.length, navGate.length, navAllee.length, navManoir.length, navSalon.length, navCour.length, navHall.length, navChats.length, navAile.length, navBiblio.length, navEst.length, navEstIn.length, navPerron.length, navEtang.length, navLaby.length, navSerre.length], pois: () => poiList(), sortItems: () => Array.from(document.querySelectorAll('#objects > *')).map(n => n.dataset.cat || (n.classList.contains('wall') ? 'mur' : (n.getAttribute('href') || '').split('/').pop().replace('.webp', ''))), hidden: () => Object.keys(catRT).filter(k => catRT[k].hidden).length,
    audio: () => ({ ctx: AC ? AC.state : null, playing: !!(musicSrc && !musicSrc.pending), track: musicIdx % MUSIC.length, pref: audioPref }), sfx: sfx, sfxNames: () => Object.keys(SFX), sfxRaw: name => SFX[name](),
    walls: () => (WALLS ? WALLS.strips.filter(st => st.node && st.node.parentNode).length : -1), wallsReady: () => !!wallCanvas,
    hedges: () => (HEDGES ? HEDGES.strips.filter(st => st.node && st.node.parentNode).length : -1) };
})();
