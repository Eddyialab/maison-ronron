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
  WORLD.start = g([1380, 640]);

  /* Chantiers. « at » : position de la bulle sur la carte. « need » : chantiers à terminer avant.
     « patch » : image superposée au terrain une fois le chantier fait { src, x, y, w, h }.
     Un chantier sans image reste visible mais n'est pas encore achetable. */
  const PATCH = window.RONRON_PATCHES || {};
  const DEPTH_PLANTE = 4916 + 1079;   // bas du pot de la plante de l'entrée
  // L'ordre de cette liste est aussi l'ordre d'empilement des calques : sol, tapis, murs, fenêtre, meubles.
  const SLOTS = [
    { id: "salon_menage", room: "Maison du gardien", name: "Dépoussiérer le salon", verb: "Nettoyer", cost: 1, icon: "broom", at: g([1395, 590]),
      desc: "Toiles d'araignée, cartons, gravats : on vide tout avant de commencer les travaux.", patch: PATCH.menage },
    { id: "salon_sol", room: "Maison du gardien", name: "Poser un nouveau sol", short: "Sol du salon", verb: "Poser", cost: 3, icon: "plus", need: ["salon_menage"], at: g([1370, 650]),
      desc: "Le plancher est troué. Choisis le parquet qui le remplace.",
      styles: [{ name: "Chêne miel", sw: "#D9953F", patch: PATCH.chene }, { name: "Noyer en chevrons", sw: "#7A5A44", patch: PATCH.noyer }] },
    { id: "salon_tapis", room: "Maison du gardien", name: "Poser un tapis", short: "Tapis", verb: "Poser", cost: 2, icon: "plus", need: ["salon_sol"], at: g([1385, 630]),
      desc: "Un tapis au milieu du salon, parfait pour les siestes.",
      styles: [{ name: "Berbère", sw: "#EFE7D6", patch: PATCH.tapis_berbere }, { name: "Oriental rouge", sw: "#A5403F", patch: PATCH.tapis_rouge }] },
    { id: "salon_murs", room: "Maison du gardien", name: "Refaire les murs", short: "Murs du salon", verb: "Peindre", cost: 4, icon: "hammer", need: ["salon_menage"], at: g([1130, 420]),
      desc: "Papier peint décollé, fissures, briques à nu : on rebouche et on repeint.",
      styles: [{ name: "Vert sauge", sw: "#A9BFA3", patch: PATCH.murs_sauge }, { name: "Terracotta", sw: "#E0A07E", patch: PATCH.murs_terracotta }] },
    { id: "salon_fenetre", room: "Maison du gardien", name: "Réparer la fenêtre", verb: "Réparer", cost: 3, icon: "hammer", need: ["salon_menage"], at: g([1550, 400]),
      desc: "On retire les planches et on remplace les vitres cassées.",
      // le pourtour de la fenêtre suit la couleur des murs
      patch: eff => { const m = eff("salon_murs"); return m == null ? PATCH.fenetre : [PATCH.fenetre_sauge, PATCH.fenetre_terracotta][m]; } },
    { id: "salon_tableau", room: "Maison du gardien", name: "Accrocher un tableau", short: "Tableau", verb: "Accrocher", cost: 2, icon: "plus", need: ["salon_murs"], at: g([1160, 380]),
      desc: "Un tableau sur le grand mur du salon.",
      styles: [{ name: "Paysage doré", sw: "#C9A24B", patch: PATCH.tableau_paysage }, { name: "Abstrait", sw: "#3A3340", patch: PATCH.tableau_abstrait }] },
    { id: "salon_rideaux", room: "Maison du gardien", name: "Poser des rideaux", short: "Rideaux", verb: "Poser", cost: 2, icon: "plus", need: ["salon_fenetre"], at: g([1560, 330]),
      desc: "Une tringle et deux rideaux pour habiller la fenêtre.",
      styles: [{ name: "Lin naturel", sw: "#EFE8D8", patch: PATCH.rideaux_lin }, { name: "Velours moutarde", sw: "#D9A62E", patch: PATCH.rideaux_moutarde }] },
    { id: "salon_lampe", room: "Maison du gardien", name: "Placer un lampadaire", short: "Lampadaire", verb: "Placer", cost: 2, icon: "plus", need: ["salon_sol"], at: g([1365, 420]),
      desc: "Un lampadaire dans l'angle du salon.",
      styles: [{ name: "Laiton et crème", sw: "#E8D9A8", patch: PATCH.lampe_laiton }, { name: "Noir", sw: "#2E2D31", patch: PATCH.lampe_noire }] },
    { id: "salon_canape", room: "Maison du gardien", name: "Installer un canapé", short: "Canapé", verb: "Installer", cost: 4, icon: "plus", need: ["salon_sol"], at: g([1540, 600]),
      desc: "Le canapé se place sous la fenêtre. Les chats viendront y faire la sieste.",
      poi: { x: 1475, y: 4916 + 600, pose: "dort", dir: -1, min: 14000, max: 32000 },
      styles: [{ name: "Velours vert", sw: "#3F7A55", patch: PATCH.vert }, { name: "Lin corail", sw: "#EE7F78", patch: PATCH.corail }] },
    // « depth » : objet debout au milieu d'une pièce ; il est trié avec les chats pour qu'ils passent derrière ou devant lui
    { id: "salon_arbre", room: "Maison du gardien", name: "Monter un arbre à chat", short: "Arbre à chat", verb: "Monter", cost: 4, icon: "plus", need: ["salon_sol"], at: g([890, 640]), depth: 5740,
      desc: "Griffoir, niche et perchoir : il s'installe dans la petite pièce de gauche.",
      poi: { x: 866, y: 4916 + 580, pose: "assis", dir: 1, depth: 5741, min: 9000, max: 20000 },
      styles: [{ name: "Beige", sw: "#D9C4A0", patch: PATCH.arbrechat_naturel }, { name: "Gris et bois", sw: "#6E7078", patch: PATCH.arbrechat_gris }] },

    { id: "entree_balai", room: "Maison du gardien", name: "Balayer l'entrée", verb: "Balayer", cost: 1, icon: "broom", need: ["salon_menage"], at: g([1330, 1050]),
      desc: "Des années de feuilles mortes se sont accumulées sur les dalles." , patch: PATCH.entree_balai },
    { id: "entree_sol", room: "Maison du gardien", name: "Refaire le sol de l'entrée", short: "Sol de l'entrée", verb: "Poser", cost: 3, icon: "plus", need: ["entree_balai"], at: g([1330, 1050]),
      desc: "Les vieilles dalles sont usées. Choisis le sol qui accueillera les visiteurs.",
      styles: [{ name: "Pierre claire", sw: "#E6DCC6", patch: PATCH.entree_pierre }, { name: "Carreaux de ciment", sw: "#8FA0B5", patch: PATCH.entree_ciment }] },
    { id: "entree_banc", room: "Maison du gardien", name: "Installer un banc d'entrée", short: "Banc d'entrée", verb: "Installer", cost: 2, icon: "plus", need: ["entree_sol"], at: g([1240, 950]),
      desc: "De quoi s'asseoir pour se déchausser. Chaque banc a son coin.",
      styles: [{ name: "Chêne", sw: "#C9A26B", patch: PATCH.banc_chene }, { name: "Vert bouteille", sw: "#3F6B4A", patch: PATCH.banc_vert }] },
    { id: "entree_plante", room: "Maison du gardien", name: "Ajouter une plante", short: "Plante de l'entrée", verb: "Ajouter", cost: 2, icon: "plus", need: ["entree_balai"], at: g([1600, 940]), depth: DEPTH_PLANTE,
      desc: "Un peu de verdure pour accueillir les visiteurs.",
      styles: [{ name: "Monstera", sw: "#4E9B4A", patch: PATCH.plante_monstera }, { name: "Olivier", sw: "#A9B8A0", patch: PATCH.plante_olivier }] },

    { id: "cuisine_sol", room: "Maison du gardien", name: "Carreler la cuisine", short: "Sol de la cuisine", verb: "Poser", cost: 3, icon: "plus", need: ["entree_balai"], at: g([1780, 860]),
      desc: "Le vieux carrelage est taché et fendu. Choisis le nouveau.",
      styles: [{ name: "Damier", sw: "#33312E", patch: PATCH.cuisine_damier }, { name: "Tomettes", sw: "#C96F4E", patch: PATCH.cuisine_tomettes }] },
    { id: "cuisine_murs", room: "Maison du gardien", name: "Refaire les murs de la cuisine", short: "Murs de la cuisine", verb: "Peindre", cost: 4, icon: "hammer", need: ["entree_balai"], at: g([1940, 610]),
      desc: "On rebouche les fissures et on repeint.",
      styles: [{ name: "Crème", sw: "#F2E6C8", patch: PATCH.cuisine_creme }, { name: "Bleu poudré", sw: "#A9BEDD", patch: PATCH.cuisine_bleu }] },
    { id: "cuisine_meubles", room: "Maison du gardien", name: "Installer la cuisine", short: "Meubles de cuisine", verb: "Installer", cost: 5, icon: "plus", need: ["cuisine_sol"], at: g([1850, 740]),
      desc: "Des placards, un évier et une cuisinière, le long des murs du fond.",
      styles: [{ name: "Chêne et blanc", sw: "#C8944F", patch: PATCH.meubles_chene }, { name: "Bleu pétrole", sw: "#3F6F7C", patch: PATCH.meubles_bleus }] },

    { id: "jardin_debrousse", room: "Jardin du gardien", name: "Débroussailler le jardin", verb: "Débroussailler", cost: 2, icon: "broom", need: ["salon_menage"], at: g([650, 760]),
      desc: "Ronces, branches mortes, vieux sacs et gravats : on évacue tout. Les chats pourront enfin sortir dans le jardin.", patch: PATCH.jardin_debrousse },
    { id: "jardin_pelouse", room: "Jardin du gardien", name: "Semer une pelouse", verb: "Semer", cost: 3, icon: "plus", need: ["jardin_debrousse"], at: g([650, 760]),
      desc: "Une vraie pelouse à la place de l'herbe sèche. Le reste du jardin se construira dessus.", patch: PATCH.jardin_pelouse },
    { id: "jardin_allee", room: "Jardin du gardien", name: "Refaire l'allée", short: "Allée", verb: "Refaire", cost: 3, icon: "hammer", need: ["jardin_pelouse"], at: g([900, 1290]),
      desc: "Il manque des dalles entre le portail et le perron.",
      styles: [{ name: "Pavés clairs", sw: "#E6DCC0", patch: PATCH.allee_paves }, { name: "Gravier et briques", sw: "#B5553C", patch: PATCH.allee_gravier }] },
    { id: "jardin_fontaine", room: "Jardin du gardien", name: "Restaurer la fontaine", short: "Fontaine", verb: "Restaurer", cost: 4, icon: "hammer", need: ["jardin_pelouse"], at: g([2140, 1160]), depth: 4916 + 1240,
      desc: "La fontaine est à sec et envahie d'herbes. On la remet en eau.",
      poi: { x: 2070, y: 4916 + 1278, pose: "assis", dir: 1, depth: 4916 + 1241, min: 7000, max: 15000 },
      styles: [{ name: "Pierre claire", sw: "#7FB5DA", patch: PATCH.fontaine_pierre }, { name: "Mosaïque bleue", sw: "#2F7FB0", patch: PATCH.fontaine_mosaique }] },
    { id: "jardin_cloture", room: "Jardin du gardien", name: "Refaire la clôture", short: "Clôture", verb: "Refaire", cost: 5, icon: "hammer", need: ["jardin_pelouse"], at: g([330, 1150]),
      desc: "Piquets cassés, portail rouillé : on refait tout le tour du jardin.",
      styles: [{ name: "Bois naturel", sw: "#D9A860", patch: PATCH.cloture_bois }, { name: "Blanche", sw: "#F0EFEA", patch: PATCH.cloture_blanche }],
      // le portail neuf remplace l'ancien : son image dépend de la clôture choisie et du sol qu'on voit entre ses barreaux
      extra: eff => PATCH["portail_" + (eff("jardin_cloture") ? "blanche" : "bois") + "_" + (eff("jardin_allee") == null ? "herbe" : eff("jardin_allee") ? "gravier" : "paves")] },
    // posé après la clôture : l'arbre est devant elle
    { id: "jardin_arbre", room: "Jardin du gardien", name: "Faire revivre le grand arbre", short: "Grand arbre", verb: "Soigner", cost: 3, icon: "plus", need: ["jardin_pelouse"], at: g([860, 330]),
      desc: "Le vieil arbre derrière la maison n'a plus une feuille. Choisis ce qu'il deviendra.",
      styles: [{ name: "Cerisier en fleurs", sw: "#F2B6CF", patch: PATCH.arbre_cerisier }, { name: "Pommier", sw: "#5E9E48", patch: PATCH.arbre_pommier }] },

    /* ----- Objets pour chats. « poi » : là où un chat vient s'installer (pattes au point x, y, en pixels du monde).
       Pour les objets triés avec les chats, « depth » peut dépendre du style : le transat et l'herbe ne sont pas posés au même endroit. ----- */
    { id: "objet_panier", room: "Maison du gardien", name: "Installer un panier", short: "Panier", verb: "Installer", cost: 6, icon: "plus", need: ["salon_sol"], at: g([1158, 575]),
      desc: "Un panier douillet dans le salon. Les chats viendront s'y rouler en boule.",
      poi: { x: 1158, y: 4916 + 640, pose: "dort", dir: 1, min: 15000, max: 35000 },
      styles: [{ name: "Osier", sw: "#C9A063", patch: PATCH.panier_osier }, { name: "Tissu bleu", sw: "#8FB3D9", patch: PATCH.panier_bleu }] },
    { id: "objet_griffoir", room: "Maison du gardien", name: "Monter un griffoir", short: "Griffoir", verb: "Monter", cost: 6, icon: "plus", need: ["salon_sol"], at: g([1095, 760]), depth: 4916 + 852,
      desc: "Pour se faire les griffes ailleurs que sur le canapé.",
      poi: { x: 1150, y: 4916 + 860, pose: "griffe", dir: -1, min: 4000, max: 8000 },
      styles: [{ name: "Sisal", sw: "#D8C08A", patch: PATCH.griffoir_sisal }, { name: "Cactus", sw: "#4E9A45", patch: PATCH.griffoir_cactus }] },
    { id: "objet_gamelles", room: "Maison du gardien", name: "Préparer les gamelles", short: "Gamelles", verb: "Préparer", cost: 5, icon: "plus", need: ["cuisine_sol"], at: g([1815, 870]),
      desc: "Croquettes et eau fraîche dans la cuisine. Les chats passeront manger.",
      poi: { x: 1705, y: 4916 + 915, pose: "assis", dir: 1, min: 5000, max: 10000 },
      styles: [{ name: "Céramique bleue", sw: "#5A86C5", patch: PATCH.gamelles_ceramique }, { name: "Inox sur support", sw: "#C7CCD1", patch: PATCH.gamelles_inox }] },
    { id: "objet_transat", room: "Jardin du gardien", name: "Installer un transat pour chat", short: "Transat", verb: "Installer", cost: 8, icon: "plus", need: ["jardin_pelouse"], at: g([520, 990]),
      depth: [4916 + 1108, 4916 + 1046],
      desc: "Un transat à leur taille, pour la sieste au soleil.",
      poi: [{ x: 572, y: 4916 + 1052, pose: "dort", dir: 1, depth: 4916 + 1109, min: 15000, max: 35000 }, { x: 468, y: 4916 + 1000, pose: "dort", dir: 1, depth: 4916 + 1047, min: 15000, max: 35000 }],
      styles: [{ name: "Bois rayé", sw: "#D9534F", patch: PATCH.transat_bois }, { name: "Rotin", sw: "#E9B949", patch: PATCH.transat_rotin }] },
    { id: "objet_herbe", room: "Jardin du gardien", name: "Planter de l'herbe à chat", short: "Herbe à chat", verb: "Planter", cost: 6, icon: "plus", need: ["jardin_pelouse"], at: g([1680, 1250]),
      depth: [4916 + 1421, 4916 + 1434],
      desc: "Les chats adorent la mâchonner.",
      poi: [{ x: 1425, y: 4916 + 1325, pose: "assis", dir: 1, min: 5000, max: 11000 }, { x: 1472, y: 4916 + 1345, pose: "assis", dir: 1, min: 5000, max: 11000 }],
      styles: [{ name: "Bac en bois", sw: "#8A6238", patch: PATCH.herbe_bac }, { name: "Pot en terre", sw: "#C46A3C", patch: PATCH.herbe_pot }] },

    /* ----- Zone 3 : l'allée du manoir, au-dessus de la grille. Ses sols sont posés AVANT ceux de la grille, qui les recouvrent
       dans la bande commune aux deux zones ; ses objets (rond-point, arche, lampadaires, statue) sont à la fin de la liste. ----- */
    { id: "allee_debrousse", room: "Allée du manoir", name: "Débroussailler l'allée", verb: "Débroussailler", cost: 7, icon: "broom", need: ["grille_pelouse"], at: z3([1350, 930]),
      desc: "Herbes folles, branches mortes et gravats jusqu'au perron du manoir.", patch: PATCH.allee_debrousse },
    { id: "allee_pelouse", room: "Allée du manoir", name: "Semer la pelouse de l'allée", verb: "Semer", cost: 8, icon: "plus", need: ["allee_debrousse"], at: z3([1000, 960]),
      desc: "Une grande pelouse entre le labyrinthe et le manoir, dans la continuité de celle de l'entrée.", patch: PATCH.allee_pelouse },
    { id: "allee_chemin", room: "Allée du manoir", name: "Prolonger le chemin", verb: "Prolonger", cost: 14, icon: "hammer", need: ["allee_pelouse", "grille_chemin"], at: z3([2420, 1040]),
      desc: "Le chemin de l'entrée continue jusqu'au perron du manoir, dans le revêtement choisi à la grille.",
      patch: eff => PATCH["allee_chemin_" + (eff("grille_chemin") ? "gravier" : "paves")] },
    { id: "allee_sentier", room: "Allée du manoir", name: "Refaire le sentier du labyrinthe", short: "Sentier", verb: "Refaire", cost: 10, icon: "hammer", need: ["allee_pelouse"], at: z3([900, 470]),
      desc: "Les vieilles pierres du sentier sont usées et disjointes.",
      styles: [{ name: "Dalles claires", sw: "#EFE6CF", patch: PATCH.sentier_dalles }, { name: "Briques", sw: "#C9603E", patch: PATCH.sentier_briques }] },
    { id: "allee_massif", room: "Allée du manoir", name: "Planter un grand massif", short: "Grand massif", verb: "Planter", cost: 9, icon: "plus", need: ["allee_pelouse"], at: z3([1380, 1100]),
      desc: "Un massif ovale au milieu de la grande pelouse.",
      styles: [{ name: "Hortensias", sw: "#8FA8E8", patch: PATCH.massif_hortensias }, { name: "Tulipes", sw: "#E2483A", patch: PATCH.massif_tulipes }] },

    /* ----- Zone 4 : l'aile d'entrée du manoir, à droite de l'allée. Le grand salon s'ouvre aux chats, qui y entrent par la porte du perron.
       Le piano et les meubles du coin salon sont triés avec les chats ; le tapis et la cheminée restent à plat. ----- */
    { id: "manoir_debrousse", room: "Manoir", name: "Débroussailler le devant du manoir", verb: "Débroussailler", cost: 8, icon: "broom", need: ["allee_pelouse"], at: z4([1300, 1000]),
      desc: "Herbes folles, buissons secs et cailloux tout le long de la façade.", patch: PATCH.manoir_debrousse },
    { id: "manoir_pelouse", room: "Manoir", name: "Semer la pelouse du manoir", verb: "Semer", cost: 10, icon: "plus", need: ["manoir_debrousse"], at: z4([1950, 1060]),
      desc: "La grande pelouse de l'allée fait le tour de l'aile.", patch: PATCH.manoir_pelouse },
    { id: "manoir_chemin", room: "Manoir", name: "Prolonger le chemin le long du manoir", short: "Chemin du manoir", verb: "Prolonger", cost: 14, icon: "hammer", need: ["manoir_pelouse", "allee_chemin"], at: z4([1250, 1390]),
      desc: "Le chemin longe la façade jusqu'au perron, dans le revêtement choisi à la grille.",
      patch: eff => PATCH["manoir_chemin_" + (eff("grille_chemin") ? "gravier" : "paves")] },
    { id: "manoir_fenetres", room: "Manoir", name: "Restaurer les fenêtres", short: "Fenêtres", verb: "Restaurer", cost: 12, icon: "hammer", need: ["manoir_debrousse"], at: z4([1080, 690]),
      desc: "Châssis pourris et vitres sales sur toute la façade.",
      styles: [{ name: "Blanches", sw: "#F2F1EC", patch: PATCH.manoir_fenetres_blanches }, { name: "Volets verts", sw: "#2F6B45", patch: PATCH.manoir_volets_verts }] },
    { id: "manoir_salon", room: "Manoir", name: "Déblayer le grand salon", verb: "Déblayer", cost: 10, icon: "broom", need: ["manoir_debrousse"], at: z4([1480, 600]),
      desc: "Chaise cassée, planches, gravats : on vide la pièce et on remonte le mur effondré. Les chats pourront y entrer.", patch: PATCH.manoir_salon },
    { id: "manoir_sol", room: "Manoir", name: "Poser le sol du grand salon", short: "Sol du grand salon", verb: "Poser", cost: 14, icon: "plus", need: ["manoir_salon"], at: z4([1560, 680]),
      desc: "Le vieux plancher est fichu. Choisis le sol de la plus belle pièce du manoir.",
      styles: [{ name: "Chêne en chevrons", sw: "#D99A4E", patch: PATCH.manoir_sol_chevrons }, { name: "Damier de marbre", sw: "#2E2E33", patch: PATCH.manoir_sol_marbre }] },
    { id: "manoir_murs", room: "Manoir", name: "Habiller les murs du grand salon", short: "Murs du grand salon", verb: "Habiller", cost: 12, icon: "hammer", need: ["manoir_salon"], at: z4([1650, 330]),
      desc: "Du papier peint ou des boiseries, sur les grands murs du salon.",
      styles: [{ name: "Papier peint vert", sw: "#A8BC94", patch: PATCH.manoir_murs_papier }, { name: "Boiseries bleues", sw: "#9FC3C9", patch: PATCH.manoir_murs_boiseries }] },
    { id: "manoir_cheminee", room: "Manoir", name: "Construire une cheminée", short: "Cheminée", verb: "Construire", cost: 14, icon: "plus", need: ["manoir_sol"], at: z4([1300, 430]),
      desc: "Un bon feu dans le grand salon. Les chats viendront dormir devant.",
      poi: [{ x: 4368 + 1345, y: 3687 + 642, pose: "dort", dir: 1, min: 15000, max: 35000 }, { x: 4368 + 1425, y: 3687 + 655, pose: "dort", dir: 1, min: 15000, max: 35000 }],
      styles: [{ name: "Marbre blanc", sw: "#ECEAE6", patch: PATCH.manoir_cheminee_marbre }, { name: "Pierre et chêne", sw: "#8C7A66", patch: PATCH.manoir_cheminee_pierre }] },
    { id: "manoir_canapes", room: "Manoir", name: "Meubler le coin salon", short: "Coin salon", verb: "Meubler", cost: 14, icon: "plus", need: ["manoir_sol"], at: z4([1770, 520]),
      desc: "Un canapé, deux fauteuils, une table basse et un tapis. Les chats viendront faire la sieste sur le canapé.",
      poi: [{ x: 4368 + 1745, y: 3687 + 597, pose: "dort", dir: -1, depth: 4389, min: 15000, max: 35000 },
            { x: 4368 + 1752, y: 3687 + 575, pose: "dort", dir: -1, depth: 4384, min: 15000, max: 35000 }],
      styles: [{ name: "Chesterfield", sw: "#5A3B2E", patch: PATCH.manoir_canapes_chesterfield }, { name: "Velours", sw: "#1F6E6E", patch: PATCH.manoir_canapes_velours }],
      // le tapis reste à plat ; chaque meuble est redessiné à part et trié avec les chats, qui passent derrière la table ou un fauteuil
      parts: ["chesterfield", "velours"].map(n => [["fauteuil", [4312, 4363]], ["canape", [4388, 4383]], ["table", [4395, 4364]]].map(([p, dp], k) => ({ patch: PATCH["manoir_canapes_" + n + "_" + p], depth: dp[n === "velours" ? 1 : 0] }))) },
    { id: "manoir_piano", room: "Manoir", name: "Installer un piano à queue", short: "Piano", verb: "Installer", cost: 16, icon: "plus", need: ["manoir_sol"], at: z4([1500, 380]), depth: 3687 + 588,
      desc: "Un grand piano dans le coin du salon. Les chats adorent s'asseoir sur le clavier.",
      poi: [{ x: 4368 + 1468, y: 3687 + 474, pose: "assis", dir: 1, depth: 3687 + 589, min: 8000, max: 18000 },
            { x: 4368 + 1462, y: 3687 + 484, pose: "assis", dir: 1, depth: 3687 + 589, min: 8000, max: 18000 }],
      styles: [{ name: "Laqué noir", sw: "#1E1E22", patch: PATCH.manoir_piano_noir }, { name: "Laqué blanc", sw: "#F4F3EF", patch: PATCH.manoir_piano_blanc }] },
    { id: "manoir_bureau", room: "Manoir", name: "Aménager le bureau", short: "Bureau", verb: "Aménager", cost: 10, icon: "hammer", need: ["manoir_debrousse"], at: z4([2000, 270]),
      desc: "La petite pièce aux deux portes devient un bureau.",
      styles: [{ name: "Bois sombre", sw: "#6B3A26", patch: PATCH.manoir_bureau_bois }, { name: "Blanc et rotin", sw: "#F3F0E8", patch: PATCH.manoir_bureau_blanc }] },

    /* ----- Zone 2 : la grille d'entrée. Ordre d'empilement : sol, chemin, mur, massif, abri, banc, grille, lanternes. ----- */
    { id: "grille_debrousse", room: "Grille d'entrée", name: "Débroussailler l'entrée", verb: "Débroussailler", cost: 5, icon: "broom", need: ["jardin_pelouse"], at: z2([1250, 1000]),
      desc: "Lierre sur le mur, ronces, caisses cassées : l'entrée du domaine disparaît sous la friche.", patch: PATCH.grille_debrousse },
    { id: "grille_pelouse", room: "Grille d'entrée", name: "Semer la pelouse de l'entrée", verb: "Semer", cost: 6, icon: "plus", need: ["grille_debrousse"], at: z2([1500, 330]),
      desc: "Une grande pelouse de part et d'autre du mur. Tout le reste de l'entrée se posera dessus.", patch: PATCH.grille_pelouse },
    { id: "grille_chemin", room: "Grille d'entrée", name: "Refaire le chemin", short: "Chemin", verb: "Refaire", cost: 10, icon: "hammer", need: ["grille_pelouse"], at: z2([1350, 1280]),
      desc: "Le chemin de terre est défoncé jusqu'au manoir. Choisis son revêtement.",
      styles: [{ name: "Pavés clairs", sw: "#CDBF9E", patch: PATCH.chemin_paves }, { name: "Gravier doré", sw: "#E9CF8E", patch: PATCH.chemin_gravier }] },
    { id: "grille_mur", room: "Grille d'entrée", name: "Restaurer le mur", short: "Mur", verb: "Restaurer", cost: 10, icon: "hammer", need: ["grille_pelouse"], at: z2([800, 560]),
      desc: "Pierres fendues, joints partis : le mur et ses piliers ont besoin d'une vraie remise en état.",
      styles: [{ name: "Pierre claire", sw: "#EADDB8", patch: PATCH.mur_pierre }, { name: "Chaulé blanc", sw: "#F3EBDD", patch: PATCH.mur_chaule }] },
    { id: "grille_massif", room: "Grille d'entrée", name: "Planter un massif", short: "Massif", verb: "Planter", cost: 6, icon: "plus", need: ["grille_pelouse"], at: z2([860, 1010]),
      desc: "Un long massif au pied du mur, bordé de pierres.",
      styles: [{ name: "Rosiers", sw: "#E46A8C", patch: PATCH.massif_roses }, { name: "Lavande", sw: "#8A63C9", patch: PATCH.massif_lavande }] },
    { id: "grille_abri", room: "Grille d'entrée", name: "Installer un abri à chats", short: "Abri à chats", verb: "Installer", cost: 8, icon: "plus", need: ["grille_pelouse"], at: z2([1320, 800]),
      desc: "Une petite cabane avec son coussin, pour les chats qui montent la garde.",
      poi: [{ x: 3460, y: 5882, pose: "dort", dir: 1, min: 12000, max: 26000 }, { x: 3487, y: 5836, pose: "dort", dir: 1, min: 12000, max: 26000 }],
      styles: [{ name: "Bois", sw: "#8A6238", patch: PATCH.abri_bois }, { name: "Bleu pastel", sw: "#B9CDE6", patch: PATCH.abri_bleu }] },
    { id: "grille_banc", room: "Grille d'entrée", name: "Poser un banc", short: "Banc", verb: "Poser", cost: 6, icon: "plus", need: ["grille_pelouse"], at: z2([1570, 220]),
      desc: "Un banc derrière le mur, face à l'allée.",
      poi: [{ x: 3790, y: 5185, pose: "dort", dir: 1, min: 12000, max: 26000 }, { x: 3800, y: 5178, pose: "dort", dir: 1, min: 12000, max: 26000 }],
      styles: [{ name: "Bois", sw: "#B5733A", patch: PATCH.bancjardin_bois }, { name: "Fer blanc", sw: "#DAD9D2", patch: PATCH.bancjardin_fer }] },
    { id: "grille_portail", room: "Grille d'entrée", name: "Remplacer la grille", short: "Grille", verb: "Remplacer", cost: 12, icon: "hammer", need: ["grille_chemin"], at: z2([1930, 760]),
      desc: "La vieille grille rouillée ne ferme plus. La nouvelle sera la première chose qu'on voit du domaine.",
      // on voit le chemin entre les barreaux : l'image dépend du revêtement choisi
      styles: [{ name: "Noir et or", sw: "#2A2A30", patch: eff => PATCH["grille_noire_" + (eff("grille_chemin") ? "gravier" : "paves")] },
               { name: "Vert anglais", sw: "#1F5A3E", patch: eff => PATCH["grille_verte_" + (eff("grille_chemin") ? "gravier" : "paves")] }] },
    { id: "grille_lanternes", room: "Grille d'entrée", name: "Accrocher des lanternes", short: "Lanternes", verb: "Accrocher", cost: 6, icon: "plus", need: ["grille_pelouse"], at: z2([2260, 930]),
      desc: "Une lanterne sur chaque pilier de la grille.",
      styles: [{ name: "Laiton", sw: "#C9A24B", patch: PATCH.lanternes_laiton }, { name: "Fer noir", sw: "#33333A", patch: PATCH.lanternes_noires }] },
    { id: "allee_rondpoint", room: "Allée du manoir", name: "Créer un rond-point", short: "Rond-point", verb: "Créer", cost: 12, icon: "plus", need: ["allee_pelouse"], at: z3([2080, 780]),
      desc: "Un îlot planté devant le perron, pour que les voitures tournent autour.",
      styles: [{ name: "Buis et rosier", sw: "#B3262E", patch: PATCH.rondpoint_buis }, { name: "Cadran solaire", sw: "#B9B29C", patch: PATCH.rondpoint_cadran }] },
    { id: "allee_arche", room: "Allée du manoir", name: "Dresser une arche fleurie", short: "Arche", verb: "Dresser", cost: 11, icon: "plus", need: ["allee_pelouse"], at: z3([1540, 330]),
      desc: "Une arche au bout du sentier du labyrinthe.",
      styles: [{ name: "Roses", sw: "#F0A9C0", patch: PATCH.arche_roses }, { name: "Glycine", sw: "#9B6AD6", patch: PATCH.arche_glycine }] },
    { id: "allee_lampadaires", room: "Allée du manoir", name: "Installer des lampadaires", short: "Lampadaires", verb: "Installer", cost: 10, icon: "plus", need: ["allee_pelouse"], at: z3([1740, 640]),
      desc: "Trois lampadaires à l'ancienne le long de l'allée.",
      styles: [{ name: "Fonte noire", sw: "#2B2B30", patch: PATCH.lampadaires_noirs }, { name: "Vert anglais", sw: "#1F5A3E", patch: PATCH.lampadaires_verts }] },
    { id: "allee_statue", room: "Allée du manoir", name: "Restaurer la statue", short: "Statue", verb: "Restaurer", cost: 9, icon: "hammer", need: ["allee_pelouse"], at: z3([2110, 1060]),
      desc: "La statue est grise de mousse et son socle est fendu.",
      styles: [{ name: "Marbre blanc", sw: "#F2EFE8", patch: PATCH.statue_marbre }, { name: "Bronze", sw: "#B8852E", patch: PATCH.statue_bronze }] }
  ];
  const SLOT = {}; SLOTS.forEach(s => { SLOT[s.id] = s; });

  /* Déplacements des chats : une grille de cases praticables couvre tout le sol de la maison du gardien.
     Chaque meuble posé retire les cases qu'il occupe. */
  const NAV = window.RONRON_NAV;

  const BREEDS = [
    { id: "roux", name: "Gouttière roux", price: 3, fur: "#F2A24A", dark: "#D9812A", belly: "#FFF1DC", stripes: true },
    { id: "tigre", name: "Européen tigré", price: 5, fur: "#A9A197", dark: "#6F685F", belly: "#EFE9DF", stripes: true },
    { id: "smoking", name: "Chat smoking", price: 6, fur: "#3F3D45", dark: "#2A282E", belly: "#FFFFFF", bib: true },
    { id: "siamois", name: "Siamois", price: 8, fur: "#F1E3CC", dark: "#6B4A3A", points: true, eye: "#3F95CF" },
    { id: "chartreux", name: "Chartreux", price: 10, fur: "#8E99A8", dark: "#727D8C", eye: "#D99A22" },
    { id: "mainecoon", name: "Maine coon", price: 15, fur: "#B07A4A", dark: "#7E5230", belly: "#F3E3CC", stripes: true, big: true },
    { id: "noir", name: "Chat noir", price: 10, fur: "#26242A", dark: "#141316", eye: "#C9D94A" },
    { id: "blanc", name: "Chat blanc", price: 15, fur: "#F4F1EC", dark: "#D8D3CC", eye: "#5FA4DD" },
    { id: "tricolore", name: "Tricolore", price: 20, fur: "#F6F2EC", dark: "#E07A2E", belly: "#FFFFFF", eye: "#7DAA3C" },
    { id: "scottish", name: "Scottish fold", price: 25, fur: "#B3B6BE", dark: "#8A8D96", belly: "#E9E6E2", stripes: true, eye: "#E08A1E" },
    { id: "birman", name: "Sacré de Birmanie", price: 30, fur: "#F1E2CB", dark: "#5A3F33", points: true, eye: "#4D7FD0", big: true },
    { id: "bengal", name: "Bengal", price: 35, fur: "#D39A4E", dark: "#6B4423", belly: "#F3DFC0", stripes: true, eye: "#3DAA4E" },
    { id: "persan", name: "Persan", price: 40, fur: "#F2E6D2", dark: "#D9C8AE", eye: "#D97A1E", big: true },
    { id: "sphynx", name: "Sphynx", price: 45, fur: "#E8B9AA", dark: "#C98F80", eye: "#2EB8A6" },
    { id: "bengalneige", name: "Bengal des neiges", price: 50, fur: "#E2E4E8", dark: "#6E727C", belly: "#F4EDE2", stripes: true, eye: "#3FA4E0" },
    { id: "or", name: "Chat d'or", price: 60, fur: "#E2B43A", dark: "#B9822A", belly: "#F4D27A", stripes: true, eye: "#1FA060" }
  ];
  const BREED = {}; BREEDS.forEach(b => { BREED[b.id] = b; });
  /* Chats peints : quatre poses par race (debout, marche, assis, dort), tournées vers la droite.
     Une race sans images retombe sur le chat dessiné en code. */
  const CATS = window.RONRON_CATS || {};
  BREEDS.forEach(b => { if (CATS[b.id]) b.sprite = b.id; });
  const SPRITE_SCALE = 0.46;
  /* Vêtements : le roux et le Maine coon ont une image complète par accessoire (« race-accessoire ») ;
     les autres races, qui ont les mêmes poses que le roux, reçoivent l'accessoire seul par-dessus. */
  const ACC_IMG = window.RONRON_ACC || {};
  function catLook(breed, wear, pose) {
    const full = wear && CATS[breed + "-" + wear] ? breed + "-" + wear : breed;
    const over = wear && full === breed && ACC_IMG[wear] ? ACC_IMG[wear][pose] : null;
    return { src: "assets/c/" + full + "-" + pose + ".webp", q: CATS[full][pose],
             accSrc: over ? "assets/c/acc-" + wear + "-" + pose + ".webp" : null, k: over };
  }

  const ACCS = [
    { id: "grelot", name: "Collier à grelot", price: 1 },
    { id: "noeud", name: "Nœud papillon", price: 2 },
    { id: "echarpe", name: "Écharpe", price: 2 },
    { id: "bonnet", name: "Bonnet", price: 3 },
    { id: "couronne", name: "Couronne", price: 6 }
  ];
  const CAT_NAMES = ["Mochi", "Caramel", "Pixel", "Noisette", "Gribouille", "Plume", "Biscotte", "Ziggy", "Pépite", "Olive", "Câlin", "Praline",
    "Réglisse", "Nougat", "Filou", "Sushi", "Cannelle", "Moka"];
  const MAX_CATS = 16;

  /* ================= 2. Sauvegarde et vies ================= */

  function freshSave() {
    return { v: 1, level: 1, kibble: 0, lives: MAX_LIVES, lifeAt: 0, house: {}, cats: [], nextCat: 1, inLevel: null };
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
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let view = "home", pendingReload = false;
  function show(name) {
    if (pendingReload && name !== "level") { pendingReload = false; save(); location.reload(); return; }
    view = name;
    ["home", "level", "shop"].forEach(v => { $("#screen-" + v).hidden = v !== name; });
    app.classList.toggle("inlevel", name === "level");
    $("#tab-home").setAttribute("aria-current", name === "home" ? "page" : "false");
    $("#tab-shop").setAttribute("aria-current", name === "shop" ? "page" : "false");
    if (name === "home") renderHome();
    if (name === "shop") renderShop();
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
    wear: () => chime([880, 1319], 0, 0.07, 0.28, 0.13)
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

  let lastKibble = -1;
  function updateHud() {
    syncLives();
    $("#kibble-count").textContent = S.kibble;
    if (lastKibble !== -1 && lastKibble !== S.kibble) {
      const p = $("#hud-kibble"); p.classList.remove("bump"); void p.offsetWidth; p.classList.add("bump");
    }
    lastKibble = S.kibble;
    $("#lives-count").textContent = S.lives;
    $("#lives-timer").textContent = S.lives < MAX_LIVES ? "+1 dans " + clock(nextLifeIn()) : "";
    const play = $("#tab-play");
    play.classList.toggle("nolife", S.lives <= 0);
    $("#play-sub").textContent = S.lives <= 0 ? "Vie dans " + clock(nextLifeIn()) : "Niveau " + S.level;
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
  let L = null;          // partie en cours : { lv, n, st, fish, placed, over }
  // État d'une case : 0 vide, 1 croix du joueur, 3 chat, 4 erreur (2, ancienne croix automatique, n'est plus utilisé).

  function renderFishes(left) {
    let h = "";
    for (let k = 0; k < 3; k++) h += '<svg viewBox="0 0 28 20"' + (k >= left ? ' class="lost"' : "") + '><use href="#i-fish"/></svg>';
    const f = $("#fishes"); f.innerHTML = h; f.setAttribute("aria-label", plural(left, "poisson") + " sur 3");
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
    L = { lv: lv, n: n, st: new Uint8Array(n * n), fish: 3, placed: 0, over: false };
    S.inLevel = { level: lv.level, fishLost: 0 }; save();
    $("#level-size").textContent = "Grille " + n + " × " + n;
    // couleurs mélangées selon le niveau
    const rnd = window.RonronGen.mulberry32(lv.level * 31 + 7);
    const cols = ZONE_COLORS.slice();
    for (let i = cols.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = cols[i]; cols[i] = cols[j]; cols[j] = t; }
    board.className = "board";
    board.style.setProperty("--n", n);
    board.style.setProperty("--gap", (n <= 6 ? 7 : n <= 8 ? 5 : 3) + "px");
    board.style.setProperty("--rc", (n <= 6 ? 11 : n <= 8 ? 8 : 6) + "px");
    let h = "";
    for (let i = 0; i < n * n; i++) {
      h += '<div class="cell" data-i="' + i + '" data-s="0" style="--zone:' + cols[lv.regions[i]] + '">' +
        '<svg class="c"><use href="#i-cat"/></svg><svg class="x"><use href="#i-cross"/></svg></div>';
    }
    board.innerHTML = h;
    L.cells = $$(".cell", board);
    renderFishes(3);
    $("#level-hint").textContent = lv.level <= 2
      ? "Un chat par zone, par ligne et par colonne, jamais côte à côte. Un tap : croix. Deux taps : chat."
      : "Un tap : une croix. Deux taps rapides : un chat.";
  }

  function setCell(i, s) { L.st[i] = s; L.cells[i].dataset.s = s; }

  function tryCat(i) {
    if (!L || L.over) return;
    const s = L.st[i];
    if (s >= 2) return;
    const n = L.n, r = (i / n) | 0, c = i % n;
    if (L.lv.solution[r] === c) {
      setCell(i, 3); L.placed++; buzz(12); sfx("cat");      // les croix restent à la main du joueur : rien n'est rempli à sa place
      if (L.placed === n) win();
    } else {
      setCell(i, 4);
      const el = L.cells[i]; el.classList.remove("shake"); void el.offsetWidth; el.classList.add("shake");
      L.fish--; S.inLevel.fishLost++; save();
      renderFishes(L.fish); buzz([30, 40, 30]); sfx("wrong");
      if (L.fish <= 0) lose();
    }
  }

  function win() {
    L.over = true;
    const done = S.level;
    S.kibble++; S.level++; S.inLevel = null; save(); updateHud();
    setTimeout(() => sfx("win"), 260);
    setTimeout(() => {
      if (view !== "level") return;
      openSheet(
        '<span class="tag">Niveau ' + done + " réussi</span>" +
        '<div class="big">' + ico("kibble") + "+1 croquette</div>" +
        "<p>Tu as maintenant <strong>" + plural(S.kibble, "croquette") + "</strong> à dépenser dans la maison.</p>" +
        '<div class="row"><button class="btn ghost" id="w-home" type="button">La maison</button>' +
        '<button class="btn" id="w-next" type="button">Niveau suivant</button></div>',
        { sticky: true });
      $("#w-next").onclick = () => startLevel();
      $("#w-home").onclick = () => { closeSheet(); show("home"); };
    }, 550);
  }

  function lose() {
    L.over = true;
    loseLife(); S.inLevel = null; save(); updateHud();
    setTimeout(() => sfx("lose"), 320);
    setTimeout(() => {
      if (view !== "level") return;
      const none = S.lives <= 0;
      openSheet(
        '<span class="tag">Niveau ' + S.level + "</span><h2>Plus de poissons</h2>" +
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

  function showRules() {
    openSheet(
      "<h2>Règles</h2><ul>" +
      "<li>Place <strong>un chat dans chaque zone</strong> de couleur.</li>" +
      "<li>Un seul chat par ligne et par colonne.</li>" +
      "<li>Deux chats ne se touchent jamais, même en diagonale.</li>" +
      "<li>Un chat mal placé te coûte un poisson. À zéro poisson, le niveau est perdu et tu perds une vie.</li>" +
      "</ul><p><strong>Un tap</strong> pose ou retire une croix ; tu peux glisser le doigt pour en tracer plusieurs. " +
      "<strong>Deux taps rapides</strong> sur une case y posent un chat.</p>" +
      '<button class="btn block" id="r-ok" type="button">Compris</button>');
    $("#r-ok").onclick = () => closeSheet();
  }

  /* ================= 5. Carte du domaine ================= */

  const mapEl = $("#map"), worldEl = $("#world"), layersEl = $("#layers"), markersEl = $("#markers");
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
    worldEl.style.transform = "translate(" + cam.x.toFixed(1) + "px," + cam.y.toFixed(1) + "px) scale(" + cam.s.toFixed(4) + ")";
    worldEl.style.setProperty("--inv", (1 / cam.s).toFixed(3));
    loadTiles(l);
  }

  // On n'affiche que les dalles proches de l'écran : la carte entière ne tiendrait pas en mémoire sur un téléphone.
  // En vue très éloignée, le plan d'ensemble suffit : on n'en charge aucune.
  const tilesEl = $("#tiles"), tileNodes = {};
  function loadTiles(l) {
    const far = cam.s < 0.26, m = 500;
    const x0 = -cam.x / cam.s - m, y0 = -cam.y / cam.s - m, x1 = (l.vw - cam.x) / cam.s + m, y1 = (l.vh - cam.y) / cam.s + m;
    TILES.forEach((t, i) => {
      const near = !far && t.x < x1 && t.x + t.w > x0 && t.y < y1 && t.y + t.h > y0;
      const keep = !far && t.x < x1 + 1500 && t.x + t.w > x0 - 1500 && t.y < y1 + 1500 && t.y + t.h > y0 - 1500;
      if (near && !tileNodes[i]) {
        const im = document.createElement("img");
        im.className = "tile"; im.alt = ""; im.decoding = "async"; im.draggable = false;
        im.style.cssText = "left:" + t.x + "px;top:" + t.y + "px;width:" + t.w + "px;height:" + t.h + "px";
        im.src = t.src;
        tilesEl.appendChild(im); tileNodes[i] = im;
      } else if (!keep && tileNodes[i]) { tileNodes[i].remove(); delete tileNodes[i]; }
    });
  }
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
  function liftFinger(e) { fingers.delete(e.pointerId); if (fingers.size < 2) pinchDist = 0; }
  window.addEventListener("pointerup", liftFinger);
  window.addEventListener("pointercancel", liftFinger);
  mapEl.addEventListener("wheel", e => {
    e.preventDefault();
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
  function catSprite(breed, wear) {
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
    if (wear === "grelot") s += '<path d="M5.6 -12.6 Q10 -9.4 16.6 -11.8" stroke="#D8434B" stroke-width="1.8" fill="none" stroke-linecap="round"/><circle cx="10.6" cy="-9.4" r="1.7" fill="#F6C453"/>';
    if (wear === "noeud") s += '<path d="M10.8 -10.4 L6.6 -13 V-7.8 Z M10.8 -10.4 L15 -13 V-7.8 Z" fill="#D8434B"/><circle cx="10.8" cy="-10.4" r="1.2" fill="#A82E36"/>';
    if (wear === "echarpe") s += '<path d="M5.4 -12.4 Q10.6 -8.6 17 -11.6" stroke="#4FA6DC" stroke-width="3.2" fill="none" stroke-linecap="round"/><rect x="6" y="-11" width="3" height="6.4" rx="1.2" fill="#3F8FC2"/>';
    if (wear === "bonnet") s += '<path d="M5.4 -22 Q11.8 -32.5 18.2 -22 Z" fill="#E5484D"/><rect x="4.8" y="-23" width="14" height="2.6" rx="1.3" fill="#fff"/><circle cx="11.8" cy="-29.6" r="2" fill="#fff"/>';
    if (wear === "couronne") s += '<path d="M6.6 -23.4 L6 -28.6 L9.2 -26 L11.8 -30 L14.4 -26 L17.6 -28.6 L17 -23.4 Z" fill="#F6C453" stroke="#D99A22" stroke-width="0.5"/>';
    s += '<text class="zzz" x="20" y="-26">z</text></g>';
    return s;
  }
  function portrait(breed, wear) {
    if (BREED[breed] && BREED[breed].sprite) {
      const L = catLook(breed, wear, "assis"), q = L.q;
      let x0 = -q.ax * q.w, y0 = -q.ay * q.h, x1 = x0 + q.w, y1 = y0 + q.h;
      let h = '<image href="' + L.src + '" x="' + x0.toFixed(1) + '" y="' + y0.toFixed(1) + '" width="' + q.w + '" height="' + q.h + '"/>';
      if (L.k) {
        const ax = -L.k.ax * L.k.w, ay = -L.k.ay * L.k.h;
        h += '<image href="' + L.accSrc + '" x="' + ax.toFixed(1) + '" y="' + ay.toFixed(1) + '" width="' + L.k.w + '" height="' + L.k.h + '"/>';
        x0 = Math.min(x0, ax); y0 = Math.min(y0, ay); x1 = Math.max(x1, ax + L.k.w); y1 = Math.max(y1, ay + L.k.h);
      }
      return '<svg class="portrait sp" viewBox="' + [x0, y0, x1 - x0, y1 - y0].map(v => v.toFixed(1)).join(" ") + '" aria-hidden="true">' + h + "</svg>";
    }
    return '<svg class="portrait" viewBox="-27 -36 56 40" aria-hidden="true">' + catSprite(breed, wear) + "</svg>";
  }

  const catRT = {};   // état d'animation de chaque chat, par identifiant
  const rand = (a, b) => a + Math.random() * (b - a);
  // cases libres (1 maison, 2 jardin du gardien, 3 entrée du domaine, 4 passage caché dans la haie),
  // recalculées quand un meuble est posé ou qu'un chantier se termine
  let navFree = null;
  let navHouse = [], navGarden = [], navGate = [], navAllee = [], navManoir = [], navSalon = [];
  const HIDDEN = v => v === 4 || v === 6 || v === 9;   // passages où le chat se faufile sans être vu (haie, sous la grille, porte du manoir)
  function buildNav() {
    navFree = new Uint8Array(NAV.w * NAV.h);
    const garden = isDone("jardin_debrousse");      // tant que le jardin est en friche, les chats restent à l'intérieur
    const gate = garden && isDone("grille_debrousse");   // même règle pour l'entrée, qu'ils rejoignent par un trou dans la haie
    const allee = gate && isDone("allee_debrousse");     // et pour l'allée du manoir, où ils passent sous la grille
    const manoir = allee && isDone("manoir_debrousse");  // puis le devant du manoir
    const salon = manoir && isDone("manoir_salon");      // et le grand salon, par la porte du perron
    for (let r = 0; r < NAV.h; r++) for (let c = 0; c < NAV.w; c++) {
      const v = NAV.rows[r].charCodeAt(c) - 48;
      navFree[r * NAV.w + c] = v === 1 || (v === 2 && garden) || ((v === 3 || v === 4) && gate) || ((v === 5 || v === 6) && allee) ||
        (v === 7 && manoir) || ((v === 8 || v === 9) && salon) ? v : 0;
    }
    Object.keys(NAV.blocks).forEach(id => {
      if (isDone(id)) (NAV.blocks[id][S.house[id].style | 0] || NAV.blocks[id][0] || []).forEach(i => { navFree[i] = 0; });
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
    navHouse = []; navGarden = []; navGate = []; navAllee = []; navManoir = []; navSalon = [];
    for (let i = 0; i < navFree.length; i++) {
      if (comp[i] !== best) navFree[i] = 0;
      else if (navFree[i] === 1) navHouse.push(i);
      else if (navFree[i] === 2) navGarden.push(i);
      else if (navFree[i] === 3) navGate.push(i);       // les passages cachés (4, 6, 9) ne sont jamais une destination
      else if (navFree[i] === 5) navAllee.push(i);
      else if (navFree[i] === 7) navManoir.push(i);
      else if (navFree[i] === 8) navSalon.push(i);
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
    const pools = [[navHouse, 0.3], [navGarden, 0.2], [navGate, 0.11], [navAllee, 0.13], [navManoir, 0.1], [navSalon, 0.16]].filter(p => p[0].length);
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
      const k = S.house[s.id].style | 0, p = Array.isArray(s.poi) ? (s.poi[k] || s.poi[0]) : s.poi;
      list.push(Object.assign({ id: s.id }, p));
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
      ? '<g class="cat idle" data-cat="' + c.id + '"><ellipse class="sh" cx="0" cy="-3" rx="30" ry="8" fill="#1E1A14" opacity=".3"/><image class="spr"/><image class="acc"/></g>'
      : '<g class="cat idle" data-cat="' + c.id + '"><ellipse cx="1" cy="0" rx="14" ry="3.6" fill="#1E1A14" opacity=".28"/>' + catSprite(c.breed, c.wear) + "</g>").join("");
  }
  function putImage(im, src, q) {
    const w = q.w * SPRITE_SCALE, h = q.h * SPRITE_SCALE;
    im.setAttribute("href", src);
    im.setAttribute("x", (-w * q.ax).toFixed(1)); im.setAttribute("y", (-h * q.ay).toFixed(1));
    im.setAttribute("width", w.toFixed(1)); im.setAttribute("height", h.toFixed(1));
    im.removeAttribute("display");
  }
  function setPose(cat, r, pose) {
    const tag = pose + "|" + (cat.wear || "");
    if (r.shown === tag) return;
    r.shown = tag;
    const L = catLook(cat.breed, cat.wear, pose), acc = r.node.querySelector(".acc");
    putImage(r.node.querySelector(".spr"), L.src, L.q);
    if (L.k) putImage(acc, L.accSrc, L.k); else acc.setAttribute("display", "none");
    r.node.querySelector(".sh").setAttribute("rx", pose === "dort" ? 34 : pose === "assis" ? 24 : 30);
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
    const sc = CAT_SCALE * (BREED[cat.breed] && BREED[cat.breed].big ? 1.18 : 1);
    r.node.setAttribute("transform", "translate(" + r.x.toFixed(1) + "," + r.y.toFixed(1) + ") scale(" + (r.dir * sc).toFixed(2) + "," + sc.toFixed(2) + ")");
    const cls = "cat " + r.state;
    if (r.node.getAttribute("class") !== cls) r.node.setAttribute("class", cls);
  }
  /* Murs devant les chats. Les murs font partie de l'image de fond : quand un chat passe derrière l'un d'eux,
     on redessine par-dessus lui la bande de mur concernée, découpée dans ce qui est affiché à cet instant. */
  const WALLS = window.RONRON_WALLS || null;
  let wallCanvas = null, wallBox = null, wallStamp = 0, wallKey = "";
  const imgCache = {};
  function loadImg(src) {
    if (!imgCache[src]) imgCache[src] = new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
    return imgCache[src];
  }
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
    const key = layers.map(p => p.src).join("|");
    if (key === wallKey) return;
    wallKey = key;
    const stamp = ++wallStamp, B = wallBox;
    const list = TILES.filter(t => t.x < B.x + B.w && t.x + t.w > B.x && t.y < B.y + B.h && t.y + t.h > B.y).concat(layers);
    Promise.all(list.map(p => loadImg(p.src))).then(ims => {
      if (stamp !== wallStamp) return;
      const cv = document.createElement("canvas"); cv.width = B.w; cv.height = B.h;
      const ctx = cv.getContext("2d");
      list.forEach((p, i) => { if (ims[i]) ctx.drawImage(ims[i], p.x - B.x, p.y - B.y, p.w, p.h); });
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
    if (view !== "home" || reducedMotion) return;
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
  const available = s => !isDone(s.id) && (s.need || []).every(isDone);
  const patchOf = (s, k) => (s.styles ? s.styles[k | 0] && s.styles[k | 0].patch : s.patch);
  const hasArt = s => (s.styles ? s.styles.some(st => st.patch) : !!s.patch);

  // Style affiché pour un chantier : celui qu'on essaie dans la feuille de choix, sinon celui qui est posé.
  function effStyle(id) {
    if (preview && preview.id === id) return preview.style;
    return isDone(id) ? (S.house[id].style | 0) : null;
  }
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
    layersEl.innerHTML = shown.map(p => '<img class="layer" alt="" draggable="false" src="' + p.src + '" style="left:' + p.x + "px;top:" + p.y + "px;width:" + p.w + "px;height:" + p.h + 'px">').join("");
    refreshWalls(shown);
    renderDepth();
  }
  // Objets triés en profondeur avec les chats : ils vivent dans le même calque qu'eux.
  function renderDepth() {
    const layer = $("#objects");
    if (!layer) return;
    Array.from(layer.querySelectorAll(".obj")).forEach(n => n.remove());
    let h = "";
    SLOTS.forEach(s => {
      const k = effStyle(s.id);
      if (k == null) return;
      const img = (p, dp) => { if (p) h += '<image class="obj" data-depth="' + dp + '" href="' + p.src + '" x="' + p.x + '" y="' + p.y + '" width="' + p.w + '" height="' + p.h + '"/>'; };
      // « parts » : morceaux d'un chantier posé à plat, redessinés un par un à leur profondeur
      if (s.parts) (s.parts[k] || []).forEach(o => img(o.patch, o.depth));
      if (s.depth) img(patchOf(s, k), Array.isArray(s.depth) ? s.depth[k] : s.depth);
    });
    if (h) layer.insertAdjacentHTML("beforeend", h);
    sortCats();
  }
  function renderMarkers() {
    markersEl.innerHTML = preview ? "" : SLOTS.filter(available).map(s =>
      '<button class="mk' + (S.kibble < s.cost || !hasArt(s) ? " poor" : "") + '" type="button" data-slot="' + s.id + '" style="left:' + s.at[0] + "px;top:" + s.at[1] +
      'px" aria-label="' + esc(s.name) + ", " + plural(s.cost, "croquette") + '"><span class="bob">' + ico(s.icon) + "<b>" + s.cost + "</b></span></button>").join("");
  }

  function renderHome() {
    renderLayers(); renderMarkers(); renderCats();
    if (!cam.placed && mapEl.clientWidth) { cam.placed = true; centerOn(WORLD.start[0], WORLD.start[1], 0.5); }
    else applyCam();
    const done = SLOTS.filter(s => isDone(s.id)).length, open = SLOTS.filter(available);
    let hint;
    if (done === SLOTS.length) hint = "Tous les chantiers disponibles sont terminés. Les suivants arrivent avec leurs images.";
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
    if (styles.length) { preview = { id: slot.id, style: sel }; renderLayers(); renderMarkers(); }
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
    openSheet(h, { onClose: () => { preview = null; if (view === "home") renderHome(); }, noFocus: true });
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
      }
      buildNav(); settleCats();
      save(); closeSheet(); buzz(15); sfx(restyle ? "wear" : "build");
      if (!restyle) toast(slot.name + " : c'est fait !");
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
    if (m && dragDist < 10) openSlot(SLOT[m.dataset.slot]);
  });

  /* ================= 8. Boutique ================= */

  function renderShop() {
    const full = S.cats.length >= MAX_CATS;
    $("#shop-breeds").innerHTML = BREEDS.map(b => {
      const poor = S.kibble < b.price;
      return '<div class="card">' + portrait(b.id, null) + '<div class="name">' + esc(b.name) + "</div>" +
        '<button class="btn small block" type="button" data-breed="' + b.id + '"' + (poor || full ? " disabled" : "") + ">" +
        (full ? "Maison pleine" : "Adopter · " + b.price + " " + ico("kibble")) + "</button></div>";
    }).join("");
    $("#mycats-title").textContent = "Mes chats (" + S.cats.length + ")";
    $("#shop-cats").innerHTML = S.cats.length ? S.cats.map(c => {
      const owned = c.owned || [];
      return '<div class="catrow" data-cat="' + c.id + '">' + portrait(c.breed, c.wear) +
        '<div><input id="cat-name-' + c.id + '" type="text" maxlength="14" value="' + esc(c.name) + '" aria-label="Nom du chat">' +
        '<div class="breed">' + esc((BREED[c.breed] || {}).name || "") + "</div></div>" +
        '<div class="chips">' + ACCS.map(a => {
          const has = owned.indexOf(a.id) >= 0;
          return '<button class="chip" type="button" data-acc="' + a.id + '" aria-pressed="' + (c.wear === a.id) + '"' +
            (!has && S.kibble < a.price ? " disabled" : "") + ">" + esc(a.name) + (has ? "" : " · " + a.price + " " + ico("kibble")) + "</button>";
        }).join("") + "</div></div>";
    }).join("") : '<p class="empty">Aucun chat pour l\'instant. Le premier coûte 3 croquettes : il viendra se promener dans la maison.</p>';
    updateHud();
  }

  $("#shop-breeds").addEventListener("click", e => {
    const b = e.target.closest ? e.target.closest("button[data-breed]") : null;
    if (!b || b.disabled) return;
    const breed = BREED[b.dataset.breed];
    if (S.kibble < breed.price || S.cats.length >= MAX_CATS) return;
    S.kibble -= breed.price;
    const used = S.cats.map(c => c.name);
    const name = CAT_NAMES.find(n => used.indexOf(n) < 0) || "Chat " + S.nextCat;
    S.cats.push({ id: S.nextCat++, breed: breed.id, name: name, owned: [], wear: null });
    save(); renderShop(); buzz(15); sfx("buy");
    toast(name + " a rejoint la maison.");
  });
  $("#shop-cats").addEventListener("click", e => {
    const b = e.target.closest ? e.target.closest("button[data-acc]") : null;
    if (!b || b.disabled) return;
    const cat = S.cats.find(c => c.id === +b.closest(".catrow").dataset.cat), acc = ACCS.find(a => a.id === b.dataset.acc);
    cat.owned = cat.owned || [];
    if (cat.owned.indexOf(acc.id) < 0) {
      if (S.kibble < acc.price) return;
      S.kibble -= acc.price; cat.owned.push(acc.id); cat.wear = acc.id;
    } else cat.wear = cat.wear === acc.id ? null : acc.id;
    save(); renderShop(); sfx("wear");
  });
  $("#shop-cats").addEventListener("change", e => {
    if (e.target.tagName !== "INPUT") return;
    const cat = S.cats.find(c => c.id === +e.target.closest(".catrow").dataset.cat);
    cat.name = e.target.value.trim() || cat.name; e.target.value = cat.name; save();
  });

  /* ================= 9. Réglages ================= */

  function openSettings() {
    openSheet(
      "<h2>Maison Ronron</h2><p>Version 0.10." + (memoryOnly ? " <strong>La sauvegarde est indisponible dans ce navigateur : la partie sera perdue à la fermeture.</strong>" : " La partie est enregistrée sur cet appareil.") + "</p>" +
      '<span class="tag">Son</span>' +
      '<label class="vol"><span>Musique</span><input id="v-music" type="range" min="0" max="100" step="5" value="' + Math.round(audioPref.music * 100) + '"><output id="o-music">' + Math.round(audioPref.music * 100) + '</output></label>' +
      '<label class="vol"><span>Bruitages</span><input id="v-sfx" type="range" min="0" max="100" step="5" value="' + Math.round(audioPref.sfx * 100) + '"><output id="o-sfx">' + Math.round(audioPref.sfx * 100) + '</output></label>' +
      '<span class="tag">Sauvegarde</span>' +
      '<p>Copie ce code et garde-le quelque part (une note, un message) : il permet de retrouver ta partie sur un autre téléphone ou après une réinstallation.</p>' +
      '<textarea class="code" id="b-code" rows="3" spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="Code de sauvegarde"></textarea>' +
      '<div class="row"><button class="btn ghost small" id="b-copy" type="button">Copier mon code</button>' +
      '<button class="btn ghost small" id="b-load" type="button">Restaurer ce code</button></div>' +
      '<span class="tag">Outils de test</span>' +
      '<div class="row"><button class="btn ghost small" id="t-kibble" type="button">+10 croquettes</button>' +
      '<button class="btn ghost small" id="t-lives" type="button">Recharger les vies</button></div>' +
      '<div class="field"><input id="t-level" type="number" min="1" max="99999" inputmode="numeric" value="' + S.level + '" aria-label="Numéro de niveau">' +
      '<button class="btn ghost small" id="t-go" type="button">Aller à ce niveau</button></div>' +
      '<button class="btn danger small" id="t-reset" type="button">Tout recommencer</button>');
    $("#v-music").oninput = e => { setAudio("music", e.target.value / 100); $("#o-music").textContent = e.target.value; };
    $("#v-sfx").oninput = e => { setAudio("sfx", e.target.value / 100); $("#o-sfx").textContent = e.target.value; };
    $("#v-sfx").onchange = () => sfx("cat");               // un exemple à entendre quand on relâche le curseur
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
      S = next; Object.keys(catRT).forEach(k => delete catRT[k]); buildNav();
      syncLives(); save(); closeSheet(); show("home"); toast("Partie restaurée : niveau " + S.level);
    };
    $("#t-kibble").onclick = () => { S.kibble += 10; save(); refresh(); toast("+10 croquettes"); };
    $("#t-lives").onclick = () => { S.lives = MAX_LIVES; S.lifeAt = 0; save(); refresh(); toast("Vies rechargées"); };
    $("#t-go").onclick = () => {
      const v = Math.max(1, Math.min(99999, parseInt($("#t-level").value, 10) || 1));
      S.level = v; save(); refresh(); toast("Prochain niveau : " + v);
    };
    let armed = false;
    $("#t-reset").onclick = e => {
      if (!armed) { armed = true; e.currentTarget.textContent = "Confirmer : tout effacer"; return; }
      S = freshSave(); Object.keys(catRT).forEach(k => delete catRT[k]); buildNav();
      save(); closeSheet(); show("home"); toast("Partie remise à zéro");
    };
  }
  function refresh() {
    updateHud();
    if (view === "home") renderHome();
    if (view === "shop") renderShop();
  }

  /* ================= 10. Démarrage ================= */

  load();
  $("#tab-home").onclick = () => show("home");
  $("#tab-shop").onclick = () => show("shop");
  $("#tab-play").onclick = () => startLevel();
  $("#btn-settings").onclick = () => openSettings();
  $("#btn-quit").onclick = () => quitLevel();
  $("#btn-rules").onclick = () => showRules();
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !sheetSticky) closeSheet(); });

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
      if (view === "level") pendingReload = true; else location.reload();
    });
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then(reg => {
        // l'app reste souvent ouverte en arrière-plan : on revérifie quand elle revient au premier plan
        document.addEventListener("visibilitychange", () => { if (!document.hidden) reg.update().catch(() => {}); });
      }).catch(() => {});
    });
  }
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (e) { /* sans importance */ }

  window.__ronron = { state: () => S, level: () => L, nav: () => navFree, path: (a, b) => pathTo(a, b), cats: () => catRT, cell: cellOf,
    navCount: () => [navHouse.length, navGarden.length, navGate.length, navAllee.length, navManoir.length, navSalon.length], pois: () => poiList(), sortItems: () => Array.from(document.querySelectorAll('#objects > *')).map(n => n.dataset.cat || (n.classList.contains('wall') ? 'mur' : (n.getAttribute('href') || '').split('/').pop().replace('.webp', ''))), hidden: () => Object.keys(catRT).filter(k => catRT[k].hidden).length,
    audio: () => ({ ctx: AC ? AC.state : null, playing: !!(musicSrc && !musicSrc.pending), track: musicIdx % MUSIC.length, pref: audioPref }), sfx: sfx, sfxNames: () => Object.keys(SFX), sfxRaw: name => SFX[name](),
    walls: () => (WALLS ? WALLS.strips.filter(st => st.node && st.node.parentNode).length : -1), wallsReady: () => !!wallCanvas };
})();
