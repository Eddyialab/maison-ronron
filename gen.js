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
    { from: 51, n: 8 }, { from: 121, n: 9 }, { from: 301, n: 10 }
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
  function growRegions(n, sol, rnd, even) {
    const g = new Int8Array(n * n).fill(-1);
    const size = new Array(n).fill(1);
    for (let r = 0; r < n; r++) g[r * n + sol[r]] = r;
    let left = n * n - n;
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
          if (z !== -1 && !seen.has(z)) { seen.add(z); front[z].push(i); }
        }
      }
      let total = 0; const w = [];
      for (let z = 0; z < n; z++) {
        const wz = front[z].length ? (1 - even) * size[z] + even / size[z] : 0;
        w.push(wz); total += wz;
      }
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
  function logicSolve(n, g) {
    const N = n * n;
    const cand = new Uint8Array(N).fill(1);
    const rowDone = new Uint8Array(n), colDone = new Uint8Array(n), regDone = new Uint8Array(n);
    const cats = new Int8Array(n).fill(-1);
    let placed = 0, score = 0, hard = 0;

    function place(i) {
      const r = (i / n) | 0, c = i % n, z = g[i];
      for (let k = 0; k < n; k++) { cand[r * n + k] = 0; cand[k * n + c] = 0; }
      for (let j = 0; j < N; j++) if (g[j] === z) cand[j] = 0;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const rr = r + dr, cc = c + dc;
        if (rr >= 0 && cc >= 0 && rr < n && cc < n) cand[rr * n + cc] = 0;
      }
      rowDone[r] = 1; colDone[c] = 1; regDone[z] = 1; cats[r] = c; placed++;
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
        if (dead) { cand[i] = 0; score += 3; hard++; return true; }
      }
      return false;
    }

    let guard = 0;
    while (placed < n && guard++ < 2000) {
      const s = singles();
      if (s === -1) return { solved: false, score: score, hard: hard, left: 9999 };
      if (s === 1) continue;
      if (confine(true) || confine(false)) continue;
      if (lookahead()) continue;
      break;
    }
    let left = 0;
    for (let i = 0; i < N; i++) if (cand[i]) left++;
    return { solved: placed === n, score: score, hard: hard, cats: cats, left: left + (n - placed) * 2 };
  }

  // Nombre de solutions (plafonné à 2), utilisé seulement par les tests.
  function countSolutions(n, g) {
    let count = 0;
    const cols = new Uint8Array(n), regs = new Uint8Array(n), pos = [];
    (function rec(r) {
      if (count > 1) return;
      if (r === n) { count++; return; }
      for (let c = 0; c < n; c++) {
        const z = g[r * n + c];
        if (cols[c] || regs[z]) continue;
        if (r > 0 && Math.abs(pos[r - 1] - c) <= 1) continue;
        cols[c] = 1; regs[z] = 1; pos.push(c);
        rec(r + 1);
        cols[c] = 0; regs[z] = 0; pos.pop();
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
      if (sol[r] === c) continue;
      const nb = [r > 0 ? i - n : -1, r < n - 1 ? i + n : -1, c > 0 ? i - 1 : -1, c < n - 1 ? i + 1 : -1];
      const j = nb[Math.floor(rnd() * 4)];
      if (j < 0 || g[j] === g[i]) continue;
      if (!staysConnected(n, g, g[i], i)) continue;
      const old = g[i]; g[i] = g[j];
      return [i, old];
    }
    return null;
  }

  /* Difficulté visée pour un niveau : le « score » du solveur (nombre et poids des raisonnements nécessaires).
     Elle monte régulièrement dans chaque palier de taille, redescend un peu quand la grille s'agrandit,
     et varie légèrement d'un niveau à l'autre pour éviter la monotonie. */
  const TARGETS = [[2, 10], [6, 18], [8, 24], [10, 32], [12, 40], [15, 50]];
  function targetFor(level) {
    const t = tierFor(level), r = TARGETS[t.index];
    const wobble = 0.85 + 0.3 * mulberry32(level * 2654435761 + 17)();
    const breather = level > 10 && level % 5 === 0 ? 0.7 : 1;      // un niveau plus léger tous les cinq
    return Math.max(1, Math.round((r[0] + (r[1] - r[0]) * t.p) * wobble * breather));
  }

  function makeLevel(level) {
    const t = tierFor(level);
    const n = t.n, target = targetFor(level);
    const even = Math.min(0.8, 0.1 + 0.55 * t.p + 0.04 * t.index);
    const tol = Math.max(2, Math.round(target * 0.15));
    let best = null, solved = 0;
    // On fabrique plusieurs grilles et on garde celle dont la difficulté mesurée est la plus proche de la cible.
    const tries = n >= 10 ? 6 : n >= 9 ? 7 : n >= 8 ? 9 : 10;   // moins d'essais sur les grandes grilles, longues à calculer
    for (let attempt = 0; attempt < 40 && solved < tries; attempt++) {
      const rnd = mulberry32(level * 7919 + attempt * 104729 + 13);
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
      const cand = { n: n, level: level, regions: Array.from(g), solution: sol, score: res.score, target: target };
      if (!best || Math.abs(cand.score - target) < Math.abs(best.score - target)) best = cand;
      if (Math.abs(best.score - target) <= tol) break;
    }
    return best;
  }

  const api = { makeLevel, logicSolve, countSolutions, tierFor, targetFor, mulberry32 };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RonronGen = api;
  // Utilisé comme tâche de fond : on reçoit un numéro de niveau, on renvoie le niveau.
  if (typeof WorkerGlobalScope !== "undefined" && root instanceof WorkerGlobalScope) {
    root.onmessage = function (e) { root.postMessage(makeLevel(e.data) || { level: e.data, failed: true }); };
  }
})(typeof self !== "undefined" ? self : this);
