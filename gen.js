/* Maison Ronron — générateur de niveaux.
   Chaque niveau est reconstruit à partir de son numéro : le niveau 37 est toujours le même.
   Un niveau n'est accepté que si le solveur logique ci-dessous le résout en entier,
   ce qui garantit une solution unique et trouvable sans deviner. */
(function (root) {
  "use strict";

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Taille de la grille selon le numéro du niveau.
  const TIERS = [
    { from: 1, n: 5 }, { from: 6, n: 6 }, { from: 21, n: 7 },
    { from: 51, n: 8 }, { from: 101, n: 9 }, { from: 151, n: 10 }
  ];
  function tierFor(level) {
    let i = 0;
    while (i + 1 < TIERS.length && level >= TIERS[i + 1].from) i++;
    const t = TIERS[i];
    const end = i + 1 < TIERS.length ? TIERS[i + 1].from : t.from + 700;
    // progression de 0 à 1 à l'intérieur du palier
    const p = Math.min(1, (level - t.from) / Math.max(1, end - t.from - 1));
    return { n: t.n, p: p, index: i };
  }

  function shuffle(a, rnd) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // Une position de chats valide : un par ligne et par colonne, jamais voisins.
  function randomSolution(n, rnd) {
    const sol = new Array(n).fill(-1), used = new Array(n).fill(false);
    function rec(r) {
      if (r === n) return true;
      const cols = shuffle([...Array(n).keys()], rnd);
      for (const c of cols) {
        if (used[c]) continue;
        if (r > 0 && Math.abs(sol[r - 1] - c) <= 1) continue;
        used[c] = true; sol[r] = c;
        if (rec(r + 1)) return true;
        used[c] = false;
      }
      return false;
    }
    rec(0);
    return sol;
  }

  // Zones : on part de chaque chat et on étend de proche en proche.
  // « even » proche de 1 donne des zones de tailles voisines (plus dur), proche de 0 des zones très inégales.
  function growRegions(n, sol, rnd, even, block) {
    const g = new Int8Array(n * n).fill(-1);
    const size = new Array(n).fill(1);
    for (let r = 0; r < n; r++) g[r * n + sol[r]] = r;
    let left = n * n - n;
    if (block) for (let i = 0; i < n * n; i++) if (block[i]) { g[i] = -2; left--; }   // trous : hors de toute zone
    const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (left > 0) {
      // cases libres voisines de chaque zone
      const front = [];
      for (let z = 0; z < n; z++) front.push([]);
      for (let i = 0; i < n * n; i++) {
        if (g[i] !== -1) continue;
        const r = (i / n) | 0, c = i % n;
        const seen = new Set();
        for (const [dr, dc] of DIRS) {
          const rr = r + dr, cc = c + dc;
          if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
          const z = g[rr * n + cc];
          if (z >= 0 && !seen.has(z)) { seen.add(z); front[z].push(i); }
        }
      }
      let total = 0; const w = [];
      for (let z = 0; z < n; z++) {
        const wz = front[z].length ? (1 - even) * size[z] + even / size[z] : 0;
        w.push(wz); total += wz;
      }
      if (total <= 0) return null;          // cases coupées de toutes les zones
      let pick = rnd() * total, z = 0;
      for (; z < n - 1; z++) { pick -= w[z]; if (pick <= 0 && w[z] > 0) break; }
      while (!front[z].length) z = (z + 1) % n;
      const cell = front[z][Math.floor(rnd() * front[z].length)];
      g[cell] = z; size[z]++; left--;
    }
    return g;
  }

  /* Solveur logique. Il n'utilise que des raisonnements qu'un joueur peut faire :
     1. une ligne, colonne ou zone n'a plus qu'une case possible ;
     2. k zones enfermées dans k lignes (ou colonnes) : ces lignes leur sont réservées, et inversement ;
     3. une case qui, occupée, viderait une ligne, une colonne ou une zone est impossible.
     Renvoie { solved, score } : le score mesure la difficulté. */
  // opt.clues : pelotes [[case, nombre de chats autour]] ; une pelote ou un trou (zone < 0) ne reçoit jamais de chat.
  function logicSolve(n, g, opt) {
    const N = n * n;
    const cand = new Uint8Array(N).fill(1);
    const rowDone = new Uint8Array(n), colDone = new Uint8Array(n), regDone = new Uint8Array(n);
    const cats = new Int8Array(n).fill(-1), catAt = new Uint8Array(N);
    let placed = 0, score = 0, hard = 0;
    for (let i = 0; i < N; i++) if (g[i] < 0) cand[i] = 0;
    const CL = opt && opt.clues ? opt.clues.map(q => { cand[q[0]] = 0; return [q[0], q[1], around(n, q[0])]; }) : null;

    // Règle des pelotes : autour d'une pelote, juste le nombre de chats indiqué.
    function clueStep() {
      if (!CL) return 0;
      for (const [, v, nb] of CL) {
        let have = 0, free = 0;
        for (const j of nb) { if (catAt[j]) have++; else if (cand[j]) free++; }
        if (have > v || have + free < v) return -1;
        if (!free) continue;
        if (have === v) { for (const j of nb) cand[j] = 0; score += 1; return 1; }
        if (have + free === v) { for (const j of nb) if (cand[j]) { place(j); score += 1; return 1; } }
      }
      return 0;
    }

    function place(i) {
      const r = (i / n) | 0, c = i % n, z = g[i];
      for (let k = 0; k < n; k++) { cand[r * n + k] = 0; cand[k * n + c] = 0; }
      for (let j = 0; j < N; j++) if (g[j] === z) cand[j] = 0;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const rr = r + dr, cc = c + dc;
        if (rr >= 0 && cc >= 0 && rr < n && cc < n) cand[rr * n + cc] = 0;
      }
      rowDone[r] = 1; colDone[c] = 1; regDone[z] = 1; cats[r] = c; catAt[i] = 1; placed++;
    }

    // Compte les cases possibles de chaque unité ; renvoie false s'il y a une contradiction.
    function counts(cd) {
      const rc = new Int16Array(n), cc = new Int16Array(n), zc = new Int16Array(n);
      for (let i = 0; i < N; i++) if (cd[i]) { rc[(i / n) | 0]++; cc[i % n]++; zc[g[i]]++; }
      return { rc, cc, zc };
    }

    function singles() {
      const { rc, cc, zc } = counts(cand);
      for (let k = 0; k < n; k++) {
        if ((!rowDone[k] && rc[k] === 0) || (!colDone[k] && cc[k] === 0) || (!regDone[k] && zc[k] === 0)) return -1;
      }
      for (let i = 0; i < N; i++) {
        if (!cand[i]) continue;
        const r = (i / n) | 0, c = i % n;
        if (rc[r] === 1 || cc[c] === 1 || zc[g[i]] === 1) { place(i); return 1; }
      }
      return 0;
    }

    // Règle 2, sur les lignes (byRow = true) ou les colonnes.
    function confine(byRow) {
      let changed = false;
      const lo = new Int8Array(n).fill(127), hi = new Int8Array(n).fill(-1);
      for (let i = 0; i < N; i++) if (cand[i]) {
        const line = byRow ? (i / n) | 0 : i % n, z = g[i];
        if (line < lo[z]) lo[z] = line;
        if (line > hi[z]) hi[z] = line;
      }
      const done = byRow ? rowDone : colDone;
      for (let a = 0; a < n; a++) for (let b = a; b < n; b++) {
        let k = 0;
        for (let l = a; l <= b; l++) if (!done[l]) k++;
        if (k === 0 || k === n - placed) continue;
        let inside = 0, touching = 0;
        for (let z = 0; z < n; z++) {
          if (regDone[z]) continue;
          if (lo[z] >= a && hi[z] <= b) inside++;
          if (lo[z] <= b && hi[z] >= a) {
            // la zone a-t-elle vraiment une case possible dans la bande ?
            let any = false;
            for (let i = 0; i < N && !any; i++) if (cand[i] && g[i] === z) {
              const line = byRow ? (i / n) | 0 : i % n;
              if (line >= a && line <= b) any = true;
            }
            if (any) touching++;
          }
        }
        if (inside === k) {
          for (let i = 0; i < N; i++) if (cand[i]) {
            const line = byRow ? (i / n) | 0 : i % n, z = g[i];
            if (line >= a && line <= b && !(lo[z] >= a && hi[z] <= b)) { cand[i] = 0; changed = true; }
          }
        }
        if (touching === k) {
          for (let i = 0; i < N; i++) if (cand[i]) {
            const line = byRow ? (i / n) | 0 : i % n, z = g[i];
            if ((line < a || line > b) && lo[z] <= b && hi[z] >= a) {
              // la zone touche la bande : ses cases hors bande sont impossibles
              let any = false;
              for (let j = 0; j < N && !any; j++) if (cand[j] && g[j] === z) {
                const l2 = byRow ? (j / n) | 0 : j % n;
                if (l2 >= a && l2 <= b) any = true;
              }
              if (any) { cand[i] = 0; changed = true; }
            }
          }
        }
        if (changed) { score += k === 1 ? 1 : 2 + k; if (k > 2) hard++; return true; }
      }
      return false;
    }

    // Règle 3.
    function lookahead() {
      for (let i = 0; i < N; i++) {
        if (!cand[i]) continue;
        const r = (i / n) | 0, c = i % n, z = g[i];
        const cd = cand.slice();
        for (let k = 0; k < n; k++) { cd[r * n + k] = 0; cd[k * n + c] = 0; }
        for (let j = 0; j < N; j++) if (g[j] === z) cd[j] = 0;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          const rr = r + dr, cc = c + dc;
          if (rr >= 0 && cc >= 0 && rr < n && cc < n) cd[rr * n + cc] = 0;
        }
        const k = counts(cd);
        let dead = false;
        for (let u = 0; u < n && !dead; u++) {
          if (!rowDone[u] && u !== r && k.rc[u] === 0) dead = true;
          if (!colDone[u] && u !== c && k.cc[u] === 0) dead = true;
          if (!regDone[u] && u !== z && k.zc[u] === 0) dead = true;
        }
        if (!dead && CL) for (const [, v, nb] of CL) {
          let have = 0, free = 0;
          for (const j of nb) { if (catAt[j] || j === i) have++; else if (cd[j]) free++; }
          if (have > v || have + free < v) { dead = true; break; }
        }
        if (dead) { cand[i] = 0; score += 3; hard++; return true; }
      }
      return false;
    }

    let guard = 0;
    while (placed < n && guard++ < 2000) {
      const s = singles();
      if (s === -1) return { solved: false, score: score, hard: hard, left: 9999 };
      if (s === 1) continue;
      const q = clueStep();
      if (q === -1) return { solved: false, score: score, hard: hard, left: 9999 };
      if (q === 1) continue;
      if (confine(true) || confine(false)) continue;
      if (lookahead()) continue;
      break;
    }
    let left = 0;
    for (let i = 0; i < N; i++) if (cand[i]) left++;
    return { solved: placed === n, score: score, hard: hard, cats: cats, left: left + (n - placed) * 2 };
  }

  // Les 8 cases autour d'une case.
  function around(n, i) {
    const r = (i / n) | 0, c = i % n, out = [];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const rr = r + dr, cc = c + dc;
      if ((dr || dc) && rr >= 0 && cc >= 0 && rr < n && cc < n) out.push(rr * n + cc);
    }
    return out;
  }

  // Nombre de solutions (plafonné à 2), utilisé seulement par les tests. opt : comme pour logicSolve.
  function countSolutions(n, g, opt) {
    const CL = opt && opt.clues ? opt.clues.map(q => [q[0], q[1], around(n, q[0])]) : [];
    const banned = new Uint8Array(n * n); CL.forEach(q => { banned[q[0]] = 1; });
    const at = new Uint8Array(n * n);
    const clueOk = full => CL.every(([, v, nb]) => { let h = 0, f = 0; nb.forEach(j => { if (at[j]) h++; else if (!full && ((j / n) | 0) >= rowNow) f++; }); return h <= v && h + f >= v && (!full || h === v); });
    let rowNow = 0;
    let count = 0;
    const cols = new Uint8Array(n), regs = new Uint8Array(n), pos = [];
    (function rec(r) {
      if (count > 1) return;
      if (r === n) { count++; return; }
      for (let c = 0; c < n; c++) {
        const z = g[r * n + c];
        if (z < 0 || banned[r * n + c] || cols[c] || regs[z]) continue;
        if (r > 0 && Math.abs(pos[r - 1] - c) <= 1) continue;
        cols[c] = 1; regs[z] = 1; pos.push(c); at[r * n + c] = 1; rowNow = r + 1;
        if (clueOk(r + 1 === n)) rec(r + 1);
        cols[c] = 0; regs[z] = 0; pos.pop(); at[r * n + c] = 0; rowNow = r;
      }
    })(0);
    return count;
  }

  // La zone z reste-t-elle d'un seul tenant si on lui retire la case « out » ?
  function staysConnected(n, g, z, out) {
    let start = -1, total = 0;
    for (let i = 0; i < n * n; i++) if (g[i] === z && i !== out) { total++; if (start < 0) start = i; }
    if (total === 0) return false;
    const seen = new Uint8Array(n * n); const stack = [start]; seen[start] = 1; let got = 1;
    while (stack.length) {
      const i = stack.pop(), r = (i / n) | 0, c = i % n;
      const nb = [r > 0 ? i - n : -1, r < n - 1 ? i + n : -1, c > 0 ? i - 1 : -1, c < n - 1 ? i + 1 : -1];
      for (const j of nb) if (j >= 0 && !seen[j] && j !== out && g[j] === z) { seen[j] = 1; got++; stack.push(j); }
    }
    return got === total;
  }

  // Déplace une case frontière vers une zone voisine. Renvoie [case, ancienne zone] ou null.
  function mutate(n, g, sol, rnd) {
    for (let tries = 0; tries < 30; tries++) {
      const i = Math.floor(rnd() * n * n), r = (i / n) | 0, c = i % n;
      if (sol[r] === c || g[i] < 0) continue;
      const nb = [r > 0 ? i - n : -1, r < n - 1 ? i + n : -1, c > 0 ? i - 1 : -1, c < n - 1 ? i + 1 : -1];
      const j = nb[Math.floor(rnd() * 4)];
      if (j < 0 || g[j] < 0 || g[j] === g[i]) continue;
      if (!staysConnected(n, g, g[i], i)) continue;
      const old = g[i]; g[i] = g[j];
      return [i, old];
    }
    return null;
  }

  /* Type de niveau : un mini-boss tous les 5 niveaux, un boss tous les 10, un boss géant à deux chats tous les 20.
     Entre les deux, la difficulté va en dents de scie : deux niveaux faciles, un moyen, un dur. */
  // Passé le niveau 200, le niveau « dur » de chaque cycle de 5 se joue lui aussi avec deux chats.
  /* Niveaux spéciaux : tous les 7 niveaux (sauf s'il tombe sur un mini-boss, un boss ou un boss géant), à tour de rôle.
     rafale : 5 petites grilles 5 × 5 en 3 minutes ; trouee : des cases bloquées par des meubles ;
     zero : un seul poisson, récompense triplée ; pelotes : des pelotes disent combien de chats les entourent. */
  const SPECIALS = ["rafale", "trouee", "zero", "pelotes"];
  function kindOf(level) {
    if (level % 20 === 0) return "geant";
    if (level % 10 === 0) return "boss";
    if (level % 5 === 0) return "mini";
    if (level % 7 === 0) return SPECIALS[(level / 7) % 4];
    return level > 200 && level % 5 === 4 ? "double" : "normal";
  }
  const REWARDS = { normal: 1, double: 1, mini: 3, boss: 5, geant: 10, rafale: 3, trouee: 2, zero: 6, pelotes: 2 };
  function rewardFor(level) { return REWARDS[kindOf(level)]; }
  function sizeFor(level) {
    const t = tierFor(level), kind = kindOf(level);
    if (kind === "boss") return Math.min(10, t.n + 1);                 // le boss se joue sur la grille du palier suivant
    if (kind === "geant") return level < 100 ? 8 : level < 160 ? 9 : 10; // deux chats par ligne : il faut de la place
    if (kind === "double") return 10;
    if (kind === "rafale") return 5;
    if (kind === "pelotes" || kind === "trouee") return Math.max(6, Math.min(9, t.n));    // assez de place, pas trop long à fabriquer
    return t.n;
  }

  /* Difficulté visée pour un niveau : le « score » du solveur (nombre et poids des raisonnements nécessaires). */
  const TARGETS = [[2, 10], [6, 18], [8, 24], [10, 32], [12, 40], [15, 50]];
  const SAW = [1, 0.7, 0.85, 1.05, 1.3];                 // position dans le cycle de 5 : facile, facile, moyen, dur (puis le mini-boss)
  function baseTarget(index, p) { const r = TARGETS[index]; return r[0] + (r[1] - r[0]) * p; }
  function targetFor(level) {
    const t = tierFor(level), kind = kindOf(level);
    const wobble = 0.92 + 0.16 * mulberry32(level * 2654435761 + 17)();
    if (kind === "mini") return Math.round(baseTarget(t.index, t.p) * 1.45 * wobble);
    if (kind === "boss") return Math.round(baseTarget(Math.min(5, t.index + 1), t.p) * (t.index === 5 ? 1.5 : 1.25) * wobble);
    if (kind === "geant") return Math.round((42 + 40 * Math.min(1, level / 500)) * wobble);
    if (kind === "double") return Math.round((40 + 20 * Math.min(1, level / 600)) * wobble);
    if (kind === "zero") return Math.round(baseTarget(t.index, t.p) * 0.95 * wobble);
    const capped = t.index >= 5 ? baseTarget(4, 1) : baseTarget(t.index, t.p);          // grilles plafonnées à 9 × 9
    if (kind === "trouee") return Math.round(capped * 1.3 * wobble);
    if (kind === "pelotes") return Math.round(capped * 1.1 * wobble);
    if (kind === "rafale") return 8;
    return Math.max(1, Math.round(baseTarget(t.index, t.p) * SAW[level % 5] * wobble));
  }

  // Une grille à un chat de taille n, la plus proche possible de la difficulté visée. Même suite d'essais pour une même graine.
  function makeBasic(seed, n, target, even, tries) {
    const tol = Math.max(2, Math.round(target * 0.15));
    let best = null, solved = 0;
    for (let attempt = 0; attempt < 40 && solved < tries; attempt++) {
      const rnd = mulberry32(seed * 7919 + attempt * 104729 + 13);
      const sol = randomSolution(n, rnd);
      // une grille sur deux vise des zones plus régulières (plus dur), l'autre plus inégales (plus facile)
      const g = growRegions(n, sol, rnd, Math.max(0.05, Math.min(0.9, even + (attempt % 3 - 1) * 0.2)));
      let res = logicSolve(n, g);
      for (let it = 0; !res.solved && it < 40 * n; it++) {
        const m = mutate(n, g, sol, rnd);
        if (!m) break;
        const res2 = logicSolve(n, g);
        if (res2.left <= res.left) res = res2; else g[m[0]] = m[1];
      }
      if (!res.solved) continue;
      solved++;
      const cand = { regions: Array.from(g), solution: sol, stars: sol.map((c, r) => r * n + c), score: res.score };
      if (!best || Math.abs(cand.score - target) < Math.abs(best.score - target)) best = cand;
      if (Math.abs(best.score - target) <= tol) break;
    }
    return best;
  }

  function makeLevel(level) {
    const kind = kindOf(level);
    if (kind === "geant" || kind === "double") return makeLevel2(level);
    if (kind === "rafale") return makeRafale(level);
    if (kind === "trouee" || kind === "pelotes") return makeSpecial(level);
    const t = tierFor(level);
    const n = sizeFor(level), target = targetFor(level);
    const even = Math.min(0.85, 0.1 + 0.55 * t.p + 0.04 * t.index + (kind === "normal" ? 0 : 0.15));
    // On fabrique plusieurs grilles et on garde celle dont la difficulté mesurée est la plus proche de la cible.
    const tries = n >= 10 ? 6 : n >= 9 ? 7 : n >= 8 ? 9 : 10;   // moins d'essais sur les grandes grilles, longues à calculer
    const b = makeBasic(level, n, target, even, tries);
    return b ? Object.assign({ n: n, k: 1, kind: kind, reward: REWARDS[kind], level: level, target: target }, b) : null;
  }

  // Rafale : cinq grilles 5 × 5 à enchaîner, de plus en plus dures, en 3 minutes (2:30 passé le niveau 150).
  function makeRafale(level) {
    const grids = [];
    for (let j = 0; j < 5; j++) {
      const b = makeBasic(level * 131 + j * 977 + 5, 5, [5, 6, 7, 8, 10][j], 0.35 + 0.1 * j, 6);
      if (!b) return null;
      grids.push({ regions: b.regions, stars: b.stars });
    }
    return { n: 5, k: 1, kind: "rafale", reward: REWARDS.rafale, level: level, grids: grids, regions: grids[0].regions, stars: grids[0].stars,
             limit: level > 150 ? 150 : 180 };
  }

  // Les cases libres (hors trous) restent-elles d'un seul tenant ?
  function freeConnected(n, block) {
    const N = n * n; let start = -1, total = 0;
    for (let i = 0; i < N; i++) if (!block[i]) { total++; if (start < 0) start = i; }
    const seen = new Uint8Array(N), stack = [start]; seen[start] = 1; let got = 1;
    while (stack.length) {
      const i = stack.pop(), r = (i / n) | 0, c = i % n;
      const nb = [r > 0 ? i - n : -1, r < n - 1 ? i + n : -1, c > 0 ? i - 1 : -1, c < n - 1 ? i + 1 : -1];
      for (const j of nb) if (j >= 0 && !seen[j] && !block[j]) { seen[j] = 1; got++; stack.push(j); }
    }
    return got === total;
  }

  // Grille trouée (des meubles bloquent des cases) ou grille à pelotes (des indices remplacent une partie du raisonnement).
  function makeSpecial(level) {
    const kind = kindOf(level), n = sizeFor(level), target = targetFor(level), N = n * n;
    const tries = n >= 9 ? 3 : n >= 8 ? 4 : 6;
    let best = null, solved = 0;
    for (let attempt = 0; attempt < 30 && solved < tries; attempt++) {
      const rnd = mulberry32(level * 7919 + attempt * 104729 + (kind === "trouee" ? 41 : 53));
      const sol = randomSolution(n, rnd);
      const isSol = new Uint8Array(N); sol.forEach((c, r) => { isSol[r * n + c] = 1; });
      const others = shuffle([...Array(N).keys()].filter(i => !isSol[i]), rnd);
      let block = null, clues = null, res;
      if (kind === "trouee") {
        block = new Uint8Array(N);
        const want = Math.round(N * (0.13 + 0.05 * rnd()));
        let got = 0;
        for (const i of others) {
          if (got >= want) break;
          block[i] = 1;
          if (freeConnected(n, block)) got++; else block[i] = 0;
        }
      }
      const g = growRegions(n, sol, rnd, 0.25 + 0.5 * rnd(), block);
      if (!g) continue;
      if (kind === "trouee") {
        res = logicSolve(n, g);
        for (let it = 0; !res.solved && it < 40 * n; it++) {
          const m = mutate(n, g, sol, rnd);
          if (!m) break;
          const res2 = logicSolve(n, g);
          if (res2.left <= res.left) res = res2; else g[m[0]] = m[1];
        }
      } else {
        clues = [];
        res = logicSolve(n, g, { clues: clues });
        if (res.solved) continue;                         // les pelotes doivent servir à quelque chose
        const count = i => around(n, i).reduce((a, j) => a + isSol[j], 0);
        let pool = others.slice();
        while (!res.solved && clues.length < n + 2 && pool.length) {
          let pick = -1, pickRes = null;
          for (const q of pool.slice(0, 14)) {
            clues.push([q, count(q)]);
            const r2 = logicSolve(n, g, { clues: clues });
            clues.pop();
            if (r2.left < 9999 && (!pickRes || r2.left < pickRes.left)) { pick = q; pickRes = r2; }
          }
          if (pick < 0) break;
          clues.push([pick, count(pick)]); res = pickRes;
          pool = shuffle(pool.filter(q => q !== pick), rnd);
        }
      }
      if (!res.solved) continue;
      solved++;
      const cand = { n: n, k: 1, kind: kind, reward: REWARDS[kind], level: level, regions: Array.from(g), solution: sol,
        stars: sol.map((c, r) => r * n + c), score: res.score, target: target };
      if (block) cand.block = [...Array(N).keys()].filter(i => block[i]);
      if (clues) cand.clues = clues.slice().sort((a, b) => a[0] - b[0]);
      if (!best || Math.abs(cand.score - target) < Math.abs(best.score - target)) best = cand;
      if (Math.abs(best.score - target) <= Math.max(2, target * 0.2)) break;
    }
    return best;
  }


  /* ===== Grilles à deux chats : deux par ligne, par colonne et par zone, jamais voisins ===== */
  function randomSolution2(n, rnd) {
    const rows = [], cnt = new Int8Array(n);
    const pairs = [];
    for (let a = 0; a < n; a++) for (let b = a + 2; b < n; b++) pairs.push([a, b]);
    let budget = 20000;
    function rec(r) {
      if (r === n) return true;
      if (--budget < 0) return false;
      const rem = n - r - 1;
      for (const [a, b] of shuffle(pairs.slice(), rnd)) {
        if (cnt[a] >= 2 || cnt[b] >= 2) continue;
        if (r > 0) { const p = rows[r - 1]; if (Math.abs(p[0] - a) <= 1 || Math.abs(p[1] - a) <= 1 || Math.abs(p[0] - b) <= 1 || Math.abs(p[1] - b) <= 1) continue; }
        cnt[a]++; cnt[b]++; rows.push([a, b]);
        let ok = true;
        for (let c = 0; c < n && ok; c++) { const need = 2 - cnt[c]; if (need > Math.ceil(rem / 2) || (need === 2 && (c === a || c === b))) ok = false; }
        if (ok && rec(r + 1)) return true;
        cnt[a]--; cnt[b]--; rows.pop();
      }
      return false;
    }
    return rec(0) ? rows.flatMap((p, r) => [r * n + p[0], r * n + p[1]]) : null;
  }

  // Zones : on relie les chats deux par deux par un chemin, puis on étend chaque zone de proche en proche.
  function regions2(n, stars, rnd, even) {
    const N = n * n, g = new Int8Array(N).fill(-1), isStar = new Uint8Array(N), done = new Uint8Array(N);
    stars.forEach(i => { isStar[i] = 1; });
    const nbr = i => { const r = (i / n) | 0, c = i % n; return [r > 0 ? i - n : -1, r < n - 1 ? i + n : -1, c > 0 ? i - 1 : -1, c < n - 1 ? i + 1 : -1].filter(j => j >= 0); };
    const size = []; let z = 0;
    for (const a of shuffle(stars.slice(), rnd)) {
      if (done[a]) continue;
      // chemin le plus court vers un autre chat libre, par des cases libres
      const prev = new Int32Array(N).fill(-2); prev[a] = -1; const q = [a]; let b = -1;
      for (let h = 0; h < q.length && b < 0; h++) {
        for (const j of shuffle(nbr(q[h]), rnd)) {
          if (prev[j] !== -2 || g[j] !== -1) continue;
          if (isStar[j]) { if (!done[j]) { prev[j] = q[h]; b = j; break; } continue; }
          prev[j] = q[h]; q.push(j);
        }
      }
      if (b < 0) return null;
      let k = 0;
      for (let j = b; j !== -1; j = prev[j]) { g[j] = z; k++; }
      done[a] = done[b] = 1; size.push(k); z++;
    }
    let left = 0; for (let i = 0; i < N; i++) if (g[i] === -1) left++;
    while (left > 0) {
      const front = []; for (let k = 0; k < n; k++) front.push([]);
      for (let i = 0; i < N; i++) {
        if (g[i] !== -1) continue;
        const seen = new Set();
        for (const j of nbr(i)) { const zz = g[j]; if (zz !== -1 && !seen.has(zz)) { seen.add(zz); front[zz].push(i); } }
      }
      let total = 0; const w = [];
      for (let k = 0; k < n; k++) { const wk = front[k].length ? (1 - even) * size[k] + even / size[k] : 0; w.push(wk); total += wk; }
      if (total === 0) return null;
      let pick = rnd() * total, k = 0;
      for (; k < n - 1; k++) { pick -= w[k]; if (pick <= 0 && w[k] > 0) break; }
      while (!front[k].length) k = (k + 1) % n;
      const cell = front[k][Math.floor(rnd() * front[k].length)];
      g[cell] = k; size[k]++; left--;
    }
    return g;
  }

  /* Solveur logique à deux chats, avec les mêmes raisonnements qu'un joueur :
     1. une unité (ligne, colonne, zone) n'a plus que les cases qu'il lui faut ;
     2. des zones enfermées dans une bande de lignes (ou de colonnes) qui demandent autant de chats qu'elle : la bande leur est réservée, et inversement ;
     3. une case qui, occupée, rendrait une unité impossible à compléter est exclue. */
  function logicSolve2(n, g) {
    const N = n * n, K = 2;
    const units = [];                                   // 0..n-1 lignes, n..2n-1 colonnes, 2n..3n-1 zones
    for (let u = 0; u < 3 * n; u++) units.push([]);
    for (let i = 0; i < N; i++) { units[(i / n) | 0].push(i); units[n + i % n].push(i); units[2 * n + g[i]].push(i); }
    const unitsOf = i => [(i / n) | 0, n + i % n, 2 * n + g[i]];
    let cand = new Uint8Array(N).fill(1); const star = new Uint8Array(N); let got = new Int8Array(3 * n);
    let placed = 0, score = 0, hard = 0;
    function put(cd, gt, i) {
      cd[i] = 0;
      const r = (i / n) | 0, c = i % n;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const rr = r + dr, cc = c + dc; if (rr >= 0 && cc >= 0 && rr < n && cc < n) cd[rr * n + cc] = 0;
      }
      for (const u of unitsOf(i)) { gt[u]++; if (gt[u] >= K) for (const j of units[u]) cd[j] = 0; }
    }
    function place(i) { star[i] = 1; put(cand, got, i); placed++; }
    // ce qu'une unité peut encore accueillir au plus (sur une ligne ou une colonne, deux cases voisines ne comptent qu'une fois)
    function room(cd, u) {
      let k = 0, last = -9;
      if (u < 2 * n) { for (let p = 0; p < n; p++) { const i = units[u][p]; if (cd[i] && p - last > 1) { k++; last = p; } } return k; }
      for (const i of units[u]) if (cd[i]) k++;
      return k;
    }
    function dead(cd, gt) { for (let u = 0; u < 3 * n; u++) if (gt[u] < K && room(cd, u) < K - gt[u]) return true; return false; }
    function singles() {
      if (dead(cand, got)) return -1;
      for (let u = 0; u < 3 * n; u++) {
        const need = K - got[u]; if (need <= 0) continue;
        const c = units[u].filter(i => cand[i]);
        if (c.length === need) { place(c[0]); return 1; }
      }
      return 0;
    }
    function confine(byRow) {
      const line = i => byRow ? (i / n) | 0 : i % n, lu = byRow ? 0 : n;
      const lo = new Int8Array(n).fill(127), hi = new Int8Array(n).fill(-1);
      for (let i = 0; i < N; i++) if (cand[i]) { const z = g[i], l = line(i); if (l < lo[z]) lo[z] = l; if (l > hi[z]) hi[z] = l; }
      for (let a = 0; a < n; a++) for (let b = a; b < n; b++) {
        let B = 0; for (let l = a; l <= b; l++) B += K - got[lu + l];
        if (B <= 0) continue;
        let I = 0, T = 0; const inside = new Uint8Array(n), touch = new Uint8Array(n);
        for (let z = 0; z < n; z++) {
          const need = K - got[2 * n + z]; if (need <= 0 || hi[z] < 0) continue;
          if (lo[z] >= a && hi[z] <= b) { inside[z] = 1; I += need; }
          let any = false; for (const i of units[2 * n + z]) if (cand[i] && line(i) >= a && line(i) <= b) { any = true; break; }
          if (any) { touch[z] = 1; T += need; }
        }
        let changed = false;
        if (I === B) for (let i = 0; i < N; i++) if (cand[i] && line(i) >= a && line(i) <= b && !inside[g[i]]) { cand[i] = 0; changed = true; }
        if (T === B) for (let i = 0; i < N; i++) if (cand[i] && touch[g[i]] && (line(i) < a || line(i) > b)) { cand[i] = 0; changed = true; }
        if (changed) { const k = b - a + 1; score += k === 1 ? 1 : 2 + k; if (k > 2) hard++; return true; }
      }
      return false;
    }
    function lookahead() {
      for (let i = 0; i < N; i++) {
        if (!cand[i]) continue;
        const cd = cand.slice(), gt = got.slice(); put(cd, gt, i);
        if (dead(cd, gt)) { cand[i] = 0; score += 3; hard++; return true; }
      }
      return false;
    }
    let guard = 0;
    while (placed < K * n && guard++ < 4000) {
      const s = singles();
      if (s === -1) return { solved: false, score: score, hard: hard, left: 9999 };
      if (s === 1) continue;
      if (confine(true) || confine(false)) continue;
      if (lookahead()) continue;
      break;
    }
    let left = 0; for (let i = 0; i < N; i++) if (cand[i]) left++;
    return { solved: placed === K * n, score: score, hard: hard, left: left + (K * n - placed) * 2 };
  }

  function mutate2(n, g, isStar, rnd) {
    for (let tries = 0; tries < 30; tries++) {
      const i = Math.floor(rnd() * n * n), r = (i / n) | 0, c = i % n;
      if (isStar[i]) continue;
      const nb = [r > 0 ? i - n : -1, r < n - 1 ? i + n : -1, c > 0 ? i - 1 : -1, c < n - 1 ? i + 1 : -1];
      const j = nb[Math.floor(rnd() * 4)];
      if (j < 0 || g[j] === g[i]) continue;
      if (!staysConnected(n, g, g[i], i)) continue;
      const old = g[i]; g[i] = g[j];
      return [i, old];
    }
    return null;
  }

  function makeLevel2(level) {
    const n = sizeFor(level), target = targetFor(level);
    let best = null, solved = 0;
    for (let attempt = 0; attempt < 30 && solved < 4; attempt++) {
      const rnd = mulberry32(level * 7919 + attempt * 104729 + 29);
      const stars = randomSolution2(n, rnd);
      if (!stars) continue;
      const g = regions2(n, stars, rnd, [0.35, 0.6, 0.8][attempt % 3]);
      if (!g) continue;
      const isStar = new Uint8Array(n * n); stars.forEach(i => { isStar[i] = 1; });
      let res = logicSolve2(n, g);
      for (let it = 0; !res.solved && it < 25 * n; it++) {
        const m = mutate2(n, g, isStar, rnd);
        if (!m) break;
        const res2 = logicSolve2(n, g);
        if (res2.left <= res.left) res = res2; else g[m[0]] = m[1];
      }
      if (!res.solved) continue;
      solved++;
      const cand = { n: n, k: 2, kind: kindOf(level), reward: REWARDS[kindOf(level)], level: level, regions: Array.from(g), stars: stars.slice().sort((a, b) => a - b), score: res.score, target: target };
      if (!best || Math.abs(cand.score - target) < Math.abs(best.score - target)) best = cand;
      if (Math.abs(best.score - target) <= Math.max(3, target * 0.15)) break;
    }
    return best;
  }

  // Nombre de solutions à deux chats (plafonné à 2), utilisé seulement par les tests.
  function countSolutions2(n, g) {
    let count = 0; const col = new Int8Array(n), reg = new Int8Array(n), rows = [];
    (function rec(r) {
      if (count > 1) return;
      if (r === n) { if (col.every(v => v === 2) && reg.every(v => v === 2)) count++; return; }
      for (let a = 0; a < n; a++) for (let b = a + 2; b < n; b++) {
        const za = g[r * n + a], zb = g[r * n + b];
        if (col[a] >= 2 || col[b] >= 2 || reg[za] >= 2 || reg[zb] >= 2 || (za === zb && reg[za] >= 1)) continue;
        if (r > 0) { const p = rows[r - 1]; if (Math.abs(p[0] - a) <= 1 || Math.abs(p[1] - a) <= 1 || Math.abs(p[0] - b) <= 1 || Math.abs(p[1] - b) <= 1) continue; }
        col[a]++; col[b]++; reg[za]++; reg[zb]++; rows.push([a, b]);
        rec(r + 1);
        col[a]--; col[b]--; reg[za]--; reg[zb]--; rows.pop();
      }
    })(0);
    return count;
  }

  /* Indice : la prochaine case qu'on peut trouver par logique, à partir des chats déjà posés par le joueur.
     Même raisonnement que logicSolve (qui, lui, reste tel quel : il sert à fabriquer les niveaux), mais on s'arrête au premier chat trouvé
     et on note la dernière règle avancée qui a servi, pour l'expliquer en une phrase.
     g : zone de chaque case (< 0 : pot de fleurs), have : cases où un chat est déjà posé, opt.clues : pelotes [[case, nombre]].
     Renvoie { i, unit: "zone" | "row" | "col" | "clue", at, v?, rule, cats, alone } ou null si aucune déduction ne mène à un chat. */
  // Pour expliquer l'indice, chaque case écartée garde sa raison : why[j] = -1 si un chat posé l'exclut, k ≥ 0 si c'est la déduction steps[k].
  // Le résultat donne les cases écartées de l'unité (no : [case, -1 ou rang dans steps]) et les déductions qui y ont servi (steps).
  function hintResult(n, g, i, unit, at, cand, why, catAt, steps, extra) {
    const N = n * n, no = [], used = [];
    for (let j = 0; j < N; j++) {
      const inU = unit === "zone" ? g[j] === at : unit === "row" ? ((j / n) | 0) === at : unit === "col" ? j % n === at : around(n, at).indexOf(j) >= 0;
      if (!inU || catAt[j] || cand[j] || why[j] === -2) continue;
      if (why[j] >= 0 && used.indexOf(why[j]) < 0) used.push(why[j]);
      no.push([j, why[j]]);
    }
    used.sort((x, y) => x - y);
    return Object.assign({ i: i, unit: unit, at: at, no: no.map(q => [q[0], q[1] < 0 ? -1 : used.indexOf(q[1])]), steps: used.map(t => steps[t]) }, extra);
  }
  function hintStep(n, g, have, opt) {
    const N = n * n, cand = new Uint8Array(N).fill(1), why = new Int16Array(N).fill(-2), steps = [];
    const rowDone = new Uint8Array(n), colDone = new Uint8Array(n), regDone = new Uint8Array(n), catAt = new Uint8Array(N);
    for (let i = 0; i < N; i++) if (g[i] < 0) cand[i] = 0;
    const CL = opt && opt.clues ? opt.clues.map(q => { cand[q[0]] = 0; return [q[0], q[1], around(n, q[0])]; }) : null;
    let last = null;
    const cut = (j, t) => { if (cand[j]) { cand[j] = 0; why[j] = t; } };
    function place(i) {
      const r = (i / n) | 0, c = i % n, z = g[i];
      for (let k = 0; k < n; k++) { cut(r * n + k, -1); cut(k * n + c, -1); }
      for (let j = 0; j < N; j++) if (g[j] === z) cut(j, -1);
      for (const j of around(n, i)) cut(j, -1);
      cut(i, -1); rowDone[r] = 1; colDone[c] = 1; regDone[z] = 1; catAt[i] = 1;
    }
    have.forEach(place);
    function counts(cd) {
      const rc = new Int16Array(n), cc = new Int16Array(n), zc = new Int16Array(n);
      for (let i = 0; i < N; i++) if (cd[i]) { rc[(i / n) | 0]++; cc[i % n]++; zc[g[i]]++; }
      return { rc, cc, zc };
    }
    const lineOf = (i, byRow) => (byRow ? (i / n) | 0 : i % n);
    function confine(byRow) {
      const lo = new Int8Array(n).fill(127), hi = new Int8Array(n).fill(-1);
      for (let i = 0; i < N; i++) if (cand[i]) { const l = lineOf(i, byRow), z = g[i]; if (l < lo[z]) lo[z] = l; if (l > hi[z]) hi[z] = l; }
      const done = byRow ? rowDone : colDone;
      let free = 0; for (let l = 0; l < n; l++) if (!done[l]) free++;
      const inBand = (z, a, b) => { for (let i = 0; i < N; i++) if (cand[i] && g[i] === z) { const l = lineOf(i, byRow); if (l >= a && l <= b) return true; } return false; };
      for (let a = 0; a < n; a++) for (let b = a; b < n; b++) {
        let k = 0; for (let l = a; l <= b; l++) if (!done[l]) k++;
        if (k === 0 || k === free) continue;
        const zin = [], ztouch = [];
        for (let z = 0; z < n; z++) {
          if (regDone[z] || hi[z] < 0) continue;
          if (lo[z] >= a && hi[z] <= b) zin.push(z);
          if (lo[z] <= b && hi[z] >= a && inBand(z, a, b)) ztouch.push(z);
        }
        let changed = false; const t = steps.length;
        if (zin.length === k) for (let i = 0; i < N; i++) if (cand[i]) {
          const l = lineOf(i, byRow), z = g[i];
          if (l >= a && l <= b && !(lo[z] >= a && hi[z] <= b)) { cut(i, t); changed = true; }
        }
        if (changed) { last = { rule: "inside", byRow: byRow, a: a, b: b, k: k, zs: zin }; steps.push(last); return true; }
        if (ztouch.length === k) for (let i = 0; i < N; i++) if (cand[i]) {
          const l = lineOf(i, byRow), z = g[i];
          if ((l < a || l > b) && lo[z] <= b && hi[z] >= a && inBand(z, a, b)) { cut(i, t); changed = true; }
        }
        if (changed) { last = { rule: "touch", byRow: byRow, a: a, b: b, k: k, zs: ztouch }; steps.push(last); return true; }
      }
      return false;
    }
    function lookahead() {
      for (let i = 0; i < N; i++) {
        if (!cand[i]) continue;
        const r = (i / n) | 0, c = i % n, z = g[i], cd = cand.slice();
        for (let k = 0; k < n; k++) { cd[r * n + k] = 0; cd[k * n + c] = 0; }
        for (let j = 0; j < N; j++) if (g[j] === z) cd[j] = 0;
        for (const j of around(n, i)) cd[j] = 0;
        const k = counts(cd);
        let kill = null;
        for (let u = 0; u < n && !kill; u++) {
          if (!rowDone[u] && u !== r && k.rc[u] === 0) kill = { unit: "row", at: u };
          else if (!colDone[u] && u !== c && k.cc[u] === 0) kill = { unit: "col", at: u };
          else if (!regDone[u] && u !== z && k.zc[u] === 0) kill = { unit: "zone", at: u };
        }
        if (!kill && CL) for (const [q, v, nb] of CL) {
          let h = 0, f = 0;
          for (const j of nb) { if (catAt[j] || j === i) h++; else if (cd[j]) f++; }
          if (h > v || h + f < v) { kill = { unit: "clue", at: q }; break; }
        }
        if (kill) { cut(i, steps.length); last = { rule: "look", cell: i, kill: kill }; steps.push(last); return true; }
      }
      return false;
    }
    const alone = z => { let s = 0; for (let i = 0; i < N; i++) if (g[i] === z) s++; return s === 1; };
    const done = (i, unit, at, x) => hintResult(n, g, i, unit, at, cand, why, catAt, steps, Object.assign({ rule: last, cats: have.length }, x));
    for (let guard = 0; guard < 600; guard++) {
      const { rc, cc, zc } = counts(cand);
      for (let u = 0; u < n; u++) if ((!rowDone[u] && rc[u] === 0) || (!colDone[u] && cc[u] === 0) || (!regDone[u] && zc[u] === 0)) return null;
      // une seule case possible : d'abord dans une zone (c'est le plus parlant), puis dans une ligne, puis dans une colonne
      for (let i = 0; i < N; i++) if (cand[i] && zc[g[i]] === 1) return done(i, "zone", g[i], { alone: alone(g[i]) });
      for (let i = 0; i < N; i++) if (cand[i] && rc[(i / n) | 0] === 1) return done(i, "row", (i / n) | 0);
      for (let i = 0; i < N; i++) if (cand[i] && cc[i % n] === 1) return done(i, "col", i % n);
      let step = false;
      if (CL) for (const [q, v, nb] of CL) {
        let h = 0, f = 0;
        for (const j of nb) { if (catAt[j]) h++; else if (cand[j]) f++; }
        if (h > v || h + f < v) return null;
        if (!f) continue;
        if (h === v) { const t = steps.length; for (const j of nb) cut(j, t); last = { rule: "clue", at: q, v: v }; steps.push(last); step = true; break; }
        if (h + f === v) for (const j of nb) if (cand[j]) return done(j, "clue", q, { v: v });
      }
      if (step) continue;
      if (confine(true) || confine(false)) continue;
      if (lookahead()) continue;
      break;
    }
    return null;
  }
  // Indice à deux chats par zone, ligne et colonne : même raisonnement que logicSolve2, arrêté au premier chat trouvé.
  function hintStep2(n, g, have) {
    const N = n * n, K = 2, units = [];                  // 0..n-1 lignes, n..2n-1 colonnes, 2n..3n-1 zones
    for (let u = 0; u < 3 * n; u++) units.push([]);
    for (let i = 0; i < N; i++) { units[(i / n) | 0].push(i); units[n + i % n].push(i); if (g[i] >= 0) units[2 * n + g[i]].push(i); }
    const unitsOf = i => [(i / n) | 0, n + i % n, 2 * n + g[i]];
    const cand = new Uint8Array(N).fill(1), got = new Int8Array(3 * n), why = new Int16Array(N).fill(-2), steps = [], catAt = new Uint8Array(N);
    for (let i = 0; i < N; i++) if (g[i] < 0) cand[i] = 0;
    let last = null;
    function put(cd, gt, i, mark) {
      const k = j => { if (mark && cd[j]) why[j] = -1; cd[j] = 0; };
      k(i);
      for (const j of around(n, i)) k(j);
      for (const u of unitsOf(i)) { gt[u]++; if (gt[u] >= K) for (const j of units[u]) k(j); }
    }
    have.forEach(i => { catAt[i] = 1; put(cand, got, i, true); });
    const cut = (j, t) => { if (cand[j]) { cand[j] = 0; why[j] = t; } };
    function room(cd, u) {
      let k = 0, lastp = -9;
      if (u < 2 * n) { for (let p = 0; p < n; p++) { const i = units[u][p]; if (cd[i] && p - lastp > 1) { k++; lastp = p; } } return k; }
      for (const i of units[u]) if (cd[i]) k++;
      return k;
    }
    function deadU(cd, gt) { for (let u = 0; u < 3 * n; u++) if (gt[u] < K && room(cd, u) < K - gt[u]) return u; return -1; }
    const dead = (cd, gt) => deadU(cd, gt) >= 0;
    function confine(byRow) {
      const line = i => byRow ? (i / n) | 0 : i % n, lu = byRow ? 0 : n;
      const lo = new Int8Array(n).fill(127), hi = new Int8Array(n).fill(-1);
      for (let i = 0; i < N; i++) if (cand[i]) { const z = g[i], l = line(i); if (l < lo[z]) lo[z] = l; if (l > hi[z]) hi[z] = l; }
      for (let a = 0; a < n; a++) for (let b = a; b < n; b++) {
        let B = 0; for (let l = a; l <= b; l++) B += K - got[lu + l];
        if (B <= 0) continue;
        let I = 0, T = 0, zi = 0, zt = 0; const inside = new Uint8Array(n), touch = new Uint8Array(n);
        for (let z = 0; z < n; z++) {
          const need = K - got[2 * n + z]; if (need <= 0 || hi[z] < 0) continue;
          if (lo[z] >= a && hi[z] <= b) { inside[z] = 1; I += need; zi++; }
          let any = false; for (const i of units[2 * n + z]) if (cand[i] && line(i) >= a && line(i) <= b) { any = true; break; }
          if (any) { touch[z] = 1; T += need; zt++; }
        }
        let changed = false; const t = steps.length, zl = f => { const o = []; for (let z = 0; z < n; z++) if (f[z]) o.push(z); return o; };
        if (I === B) for (let i = 0; i < N; i++) if (cand[i] && line(i) >= a && line(i) <= b && !inside[g[i]]) { cut(i, t); changed = true; }
        if (changed) { last = { rule: "inside", byRow: byRow, a: a, b: b, k: zi, zs: zl(inside) }; steps.push(last); return true; }
        if (T === B) for (let i = 0; i < N; i++) if (cand[i] && touch[g[i]] && (line(i) < a || line(i) > b)) { cut(i, t); changed = true; }
        if (changed) { last = { rule: "touch", byRow: byRow, a: a, b: b, k: zt, zs: zl(touch) }; steps.push(last); return true; }
      }
      return false;
    }
    function lookahead() {
      for (let i = 0; i < N; i++) {
        if (!cand[i]) continue;
        const cd = cand.slice(), gt = got.slice(); put(cd, gt, i);
        const u = deadU(cd, gt);
        if (u >= 0) { cut(i, steps.length); last = { rule: "look", cell: i, kill: { unit: u >= 2 * n ? "zone" : u >= n ? "col" : "row", at: u >= 2 * n ? u - 2 * n : u % n } }; steps.push(last); return true; }
      }
      return false;
    }
    const order = [];
    for (let u = 2 * n; u < 3 * n; u++) order.push(u);          // zones d'abord, puis lignes, puis colonnes
    for (let u = 0; u < 2 * n; u++) order.push(u);
    for (let guard = 0; guard < 4000; guard++) {
      if (dead(cand, got)) return null;
      for (const u of order) {
        const need = K - got[u]; if (need <= 0) continue;
        const c = units[u].filter(i => cand[i]);
        if (c.length === need) return hintResult(n, g, c[0], u >= 2 * n ? "zone" : u >= n ? "col" : "row", u >= 2 * n ? u - 2 * n : u % n, cand, why, catAt, steps, { need: need, rule: last, cats: have.length });
      }
      if (confine(true) || confine(false)) continue;
      if (lookahead()) continue;
      break;
    }
    return null;
  }
  const api = { makeLevel, logicSolve, around, SPECIALS, logicSolve2, countSolutions, countSolutions2, tierFor, targetFor, sizeFor, kindOf, rewardFor, mulberry32, hintStep, hintStep2 };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RonronGen = api;
  // Utilisé comme tâche de fond : on reçoit un numéro de niveau, on renvoie le niveau.
  if (typeof WorkerGlobalScope !== "undefined" && root instanceof WorkerGlobalScope) {
    root.onmessage = function (e) { root.postMessage(makeLevel(e.data) || { level: e.data, failed: true }); };
  }
})(typeof self !== "undefined" ? self : this);
