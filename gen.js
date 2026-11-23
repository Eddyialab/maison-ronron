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

  /* Type de niveau : un mini-boss tous les 5 niveaux, un boss tous les 10, un boss géant à deux chats tous les 20.
     Entre les deux, la difficulté va en dents de scie : deux niveaux faciles, un moyen, un dur. */
  // Passé le niveau 200, le niveau « dur » de chaque cycle de 5 se joue lui aussi avec deux chats.
  function kindOf(level) { return level % 20 === 0 ? "geant" : level % 10 === 0 ? "boss" : level % 5 === 0 ? "mini" : level > 200 && level % 5 === 4 ? "double" : "normal"; }
  const REWARDS = { normal: 1, double: 1, mini: 3, boss: 5, geant: 10 };
  function rewardFor(level) { return REWARDS[kindOf(level)]; }
  function sizeFor(level) {
    const t = tierFor(level), kind = kindOf(level);
    if (kind === "boss") return Math.min(10, t.n + 1);                 // le boss se joue sur la grille du palier suivant
    if (kind === "geant") return level < 100 ? 8 : level < 160 ? 9 : 10; // deux chats par ligne : il faut de la place
    if (kind === "double") return 10;
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
    return Math.max(1, Math.round(baseTarget(t.index, t.p) * SAW[level % 5] * wobble));
  }

  function makeLevel(level) {
    if (kindOf(level) === "geant" || kindOf(level) === "double") return makeLevel2(level);
    const t = tierFor(level), kind = kindOf(level);
    const n = sizeFor(level), target = targetFor(level);
    const even = Math.min(0.85, 0.1 + 0.55 * t.p + 0.04 * t.index + (kind === "normal" ? 0 : 0.15));
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
      const cand = { n: n, k: 1, kind: kind, reward: REWARDS[kind], level: level, regions: Array.from(g), solution: sol,
        stars: sol.map((c, r) => r * n + c), score: res.score, target: target };
      if (!best || Math.abs(cand.score - target) < Math.abs(best.score - target)) best = cand;
      if (Math.abs(best.score - target) <= tol) break;
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

  const api = { makeLevel, logicSolve, logicSolve2, countSolutions, countSolutions2, tierFor, targetFor, sizeFor, kindOf, rewardFor, mulberry32 };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RonronGen = api;
  // Utilisé comme tâche de fond : on reçoit un numéro de niveau, on renvoie le niveau.
  if (typeof WorkerGlobalScope !== "undefined" && root instanceof WorkerGlobalScope) {
    root.onmessage = function (e) { root.postMessage(makeLevel(e.data) || { level: e.data, failed: true }); };
  }
})(typeof self !== "undefined" ? self : this);
