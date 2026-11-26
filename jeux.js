/* Maison Ronron : la salle de jeux. Deux jeux bonus payés en tickets (1 ticket par niveau de puzzle réussi, 1 ticket par partie).
   - Friandises : match-3 (échanger deux friandises voisines pour en aligner 3 ou plus), objectifs et coups comptés.
   - Le panier à trier : tuiles empilées, on en met 3 identiques dans le panier (7 places) pour les faire partir.
   Les moteurs (M3, TM) n'affichent rien : ils tournent aussi sous Node pour les tests et le réglage des niveaux (tests/jeux_sim.js). */
(function () {
  "use strict";
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ======================= Friandises : moteur ======================= */
  const M3 = (function () {
    const W = 8, H = 8, N = W * H, CAT = 9;
    const SP_H = 1, SP_V = 2, SP_B = 3, SP_C = 4;           // rayé ligne, rayé colonne, paquet (3 × 3), chaton (toute une sorte)
    const TYPES = ["croquette", "poisson", "pelote", "souris", "herbe", "gamelle"];
    const MOVES = "--/,/,,.,,97;3>:@=EA<E=7;;><8<=9>D=>@;CE?BA>BEA=DADP>AD=@@@;D;;A<?@?A<;>D:D=?@F6??=BG<AI>=E6?BABF=>;=>G7>BC<F8;D:>C<<I9>CJAF>=D>=>@B?CC@8BC=DIA?D:?B6=DB=?C@N@CDC>BOBE9>E5BD5ECE=E<<F9>BA@ACA<8?C@;<@=B<?CD?B>DD<;C?<DGCA:=D?AGI?@7@@6BD>:FI@AD=E@AF?A>BBA6ADE?@8AH;@?<CAF@H8BB;AI9@B<AA6?DC=AC@A>D@M>?>EJ@=FECFE?H;@F=>FA=QH>CKDA;?KF@G<;=@?AI;<G@B=@?KAAA=N:=B>@IL>H9=>A@@=9A8?>:AJB>HA?B:@G>@MGD>9@?DAF<<ECAH>;FGA=7@D:DH>?<A@FH;";                                         // un caractère par niveau (1 à 420) : coups = code - 32
    const rc = i => [(i / W) | 0, i % W];
    // Niveau : sortes de friandises, coups, objectifs, cartons (piles posées en bas des colonnes), taches (sous les friandises), coins absents.
    // Au-delà du niveau 420, les plateaux des niveaux 61 à 420 reviennent (mêmes formes, friandises tirées à nouveau).
    const base = level => (level > 420 ? 61 + ((level - 61) % 360) : level);
    function config(lv) {
      const level = base(lv), r = mulberry32(level * 7919 + 13), ri = (a, b) => a + Math.floor(r() * (b - a + 1));
      const types = level < 10 ? 5 : 6;
      const box = new Int8Array(N), mud = new Uint8Array(N), hole = new Uint8Array(N);
      const kinds = level <= 2 ? ["t"] : level === 3 ? ["box"] : level === 4 ? ["mud"]
        : level < 12 ? [["t", "box", "mud"][level % 3]]
        : [["t", "box", "mud"][level % 3], ["box", "mud", "t"][(level + 1) % 3]];
      // coins absents (symétriques), à partir du niveau 7, un niveau sur deux
      if (level >= 7 && level % 2) {
        const top = r() < 0.5, k = ri(1, 2);
        for (let a = 0; a < k; a++) for (let b = 0; b < k - a; b++) {
          const row = top ? a : H - 1 - a;
          hole[row * W + b] = 1; hole[row * W + (W - 1 - b)] = 1;
        }
      }
      const goals = [];
      const step = Math.min(1, (level - 1) / 40);               // 0 au niveau 1, 1 au niveau 41
      if (kinds.indexOf("box") >= 0) {
        const hmax = 1 + Math.round(step * 2), hard = level >= 16, boxCap = 8 + Math.round(step * 8);
        const half = [];
        for (let c = 0; c < W / 2; c++) half.push(ri(0, hmax) + (c >= 1 && c <= 2 ? 1 : 0));
        let n = 0;
        for (let c = 0; c < W; c++) {
          const hc = Math.min(4, half[c < W / 2 ? c : W - 1 - c]);
          let put = 0;
          for (let row = H - 1; row >= 0 && put < hc; row--) {
            const i = row * W + c; if (hole[i] || n >= boxCap) continue;
            box[i] = hard && put === 0 && r() < 0.35 ? 2 : 1; put++; n++;
          }
        }
        if (n < 4) for (let c = 2; c < 6; c++) { const i = (H - 1) * W + c; if (!hole[i] && !box[i]) { box[i] = 1; n++; } }
        goals.push({ k: "box", n: n });
      }
      if (kinds.indexOf("mud") >= 0) {
        const want = 8 + Math.round(step * 10); let n = 0;
        for (let guard = 0; guard < 400 && n < want; guard++) {
          const row = ri(1, H - 2), c = ri(0, W / 2 - 1), a = row * W + c, b = row * W + (W - 1 - c);
          if (hole[a] || box[a] || mud[a]) continue;
          mud[a] = mud[b] = 1; n += 2;
        }
        goals.push({ k: "mud", n: n });
      }
      if (kinds.indexOf("t") >= 0) {
        const two = kinds.length === 1 && level >= 5 && (level % 2 === 0 || level > 20), first = ri(0, types - 1);
        const per = (two ? 14 : 20) + Math.round(step * (two ? 12 : 16));
        goals.push({ k: "t", t: first, n: per });
        if (two) goals.push({ k: "t", t: (first + 1 + ri(0, types - 2)) % types, n: per });
      }
      // coups : mesurés pour chaque plateau avec un joueur automatique (tests/m3_coups.js), sinon estimés
      const est = Math.round(8.4 + goals.reduce((s, g) => s + (g.k === "t" ? g.n * 0.18 + 1.2 : g.k === "box" ? g.n * 1.1 : g.n * 0.45), 0));
      const moves = MOVES.charCodeAt(level - 1) - 32 || est;
      return { level: lv, types: types, moves: moves, goals: goals, box: box, mud: mud, hole: hole, hard: lv % 10 === 0 };
    }
    function make(cfg, rnd) {
      const st = { t: new Int8Array(N).fill(-1), sp: new Int8Array(N), id: new Int32Array(N), box: Int8Array.from(cfg.box), mud: Uint8Array.from(cfg.mud),
        hole: cfg.hole, types: cfg.types, rnd: rnd, nextId: 1, moves: cfg.moves, goals: cfg.goals.map(g => Object.assign({ left: g.n }, g)) };
      for (let i = 0; i < N; i++) {
        if (st.hole[i] || st.box[i]) continue;
        const [r, c] = rc(i); let t;
        for (let k = 0; k < 30; k++) {
          t = Math.floor(rnd() * st.types);
          if (c >= 2 && st.t[i - 1] === t && st.t[i - 2] === t) continue;
          if (r >= 2 && st.t[i - W] === t && st.t[i - 2 * W] === t) continue;
          break;
        }
        st.t[i] = t; st.id[i] = st.nextId++;
      }
      if (!hasMove(st)) shuffle(st);
      return st;
    }
    const piece = (st, i) => i >= 0 && i < N && !st.hole[i] && !st.box[i] && st.t[i] >= 0;
    const colorOf = (st, i) => (piece(st, i) && st.t[i] !== CAT ? st.t[i] : -1);
    function clone(st) {
      return { t: Int8Array.from(st.t), sp: Int8Array.from(st.sp), id: Int32Array.from(st.id), box: Int8Array.from(st.box), mud: Uint8Array.from(st.mud),
        hole: st.hole, types: st.types, rnd: st.rnd, nextId: st.nextId, moves: st.moves, goals: st.goals.map(g => Object.assign({}, g)) };
    }
    // Alignements : groupes de cases reliées par des lignes de 3 ou plus de la même friandise.
    function findGroups(st, focus) {
      const runs = [];
      for (let r = 0; r < H; r++) for (let c = 0; c < W;) {
        const t = colorOf(st, r * W + c); let e = c + 1;
        if (t >= 0) while (e < W && colorOf(st, r * W + e) === t) e++;
        if (t >= 0 && e - c >= 3) { const cells = []; for (let k = c; k < e; k++) cells.push(r * W + k); runs.push({ dir: "h", cells: cells, t: t }); }
        c = Math.max(e, c + 1);
      }
      for (let c = 0; c < W; c++) for (let r = 0; r < H;) {
        const t = colorOf(st, r * W + c); let e = r + 1;
        if (t >= 0) while (e < H && colorOf(st, e * W + c) === t) e++;
        if (t >= 0 && e - r >= 3) { const cells = []; for (let k = r; k < e; k++) cells.push(k * W + c); runs.push({ dir: "v", cells: cells, t: t }); }
        r = Math.max(e, r + 1);
      }
      if (!runs.length) return [];
      const par = runs.map((_, k) => k), find = k => (par[k] === k ? k : (par[k] = find(par[k])));
      const owner = new Int16Array(N).fill(-1);
      runs.forEach((run, k) => run.cells.forEach(i => { if (owner[i] >= 0) par[find(k)] = find(owner[i]); else owner[i] = k; }));
      const by = {};
      runs.forEach((run, k) => { const root = find(k); (by[root] = by[root] || []).push(run); });
      return Object.keys(by).map(key => {
        const rs = by[key], set = new Set(); rs.forEach(run => run.cells.forEach(i => set.add(i)));
        const cells = Array.from(set), longest = rs.reduce((a, b) => (b.cells.length > a.cells.length ? b : a));
        const hs = rs.filter(x => x.dir === "h"), vs = rs.filter(x => x.dir === "v");
        let sp = 0, at = -1;
        if (longest.cells.length >= 5) sp = SP_C;
        else if (hs.length && vs.length) { sp = SP_B; at = hs[0].cells.find(i => vs.some(v => v.cells.indexOf(i) >= 0)); }
        else if (longest.cells.length === 4) sp = longest.dir === "h" ? SP_H : SP_V;
        if (sp && at < 0) at = (focus || []).find(i => cells.indexOf(i) >= 0);
        if (sp && (at === undefined || at < 0)) at = longest.cells[(longest.cells.length / 2) | 0];
        return { cells: cells, t: longest.t, sp: sp, at: sp ? at : -1 };
      });
    }
    // Ce que fait une friandise spéciale quand elle part.
    function blast(st, i, sp, set) {
      const [r, c] = rc(i), add = j => { if (j >= 0 && j < N && !st.hole[j]) set.add(j); };
      if (sp === SP_H) for (let k = 0; k < W; k++) add(r * W + k);
      else if (sp === SP_V) for (let k = 0; k < H; k++) add(k * W + c);
      else if (sp === SP_B) for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { if (r + a >= 0 && r + a < H && c + b >= 0 && c + b < W) add((r + a) * W + c + b); }
      else if (sp === SP_C) {
        const cnt = new Array(st.types).fill(0); for (let j = 0; j < N; j++) if (colorOf(st, j) >= 0) cnt[st.t[j]]++;
        const best = cnt.indexOf(Math.max.apply(null, cnt)); for (let j = 0; j < N; j++) if (colorOf(st, j) === best) add(j);
      }
    }
    // Enlève un ensemble de cases (et ce que déclenchent les spéciales touchées). Renvoie l'étape à animer.
    function clearSet(st, base, created, hitBoxesNear, keep) {
      const set = new Set(base), done = new Set(), queue = Array.from(set), effects = [];
      while (queue.length) {
        const i = queue.shift(); if (done.has(i)) continue; done.add(i);
        if (piece(st, i) && st.sp[i] && !(keep && keep.has(i))) {
          const before = set.size, s2 = new Set(); blast(st, i, st.sp[i], s2);
          effects.push({ i: i, sp: st.sp[i] });
          s2.forEach(j => { if (!set.has(j)) { set.add(j); queue.push(j); } });
          if (set.size === before) { /* rien de plus */ }
        }
      }
      const gone = [], boxes = [], muds = [], hitB = new Set();
      set.forEach(i => {
        if (st.box[i]) { hitB.add(i); return; }
        if (!piece(st, i) || (keep && keep.has(i))) { if (keep && keep.has(i) && st.mud[i]) { st.mud[i] = 0; muds.push(i); } return; }
        gone.push({ i: i, id: st.id[i], t: st.t[i] });
        st.goals.forEach(g => { if (g.k === "t" && g.t === st.t[i] && g.left > 0) g.left--; });
        if (st.mud[i]) { st.mud[i] = 0; muds.push(i); }
        st.t[i] = -1; st.sp[i] = 0; st.id[i] = 0;
      });
      (hitBoxesNear || []).forEach(i => {
        const [r, c] = rc(i);
        [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].forEach(([a, b]) => { if (a >= 0 && a < H && b >= 0 && b < W && st.box[a * W + b]) hitB.add(a * W + b); });
      });
      hitB.forEach(i => { st.box[i]--; boxes.push({ i: i, hp: st.box[i] }); if (!st.box[i]) st.goals.forEach(g => { if (g.k === "box" && g.left > 0) g.left--; }); });
      muds.forEach(() => st.goals.forEach(g => { if (g.k === "mud" && g.left > 0) g.left--; }));
      return { kind: "clear", gone: gone, created: created || [], boxes: boxes, muds: muds, effects: effects };
    }
    // Chute : verticale entre les cartons, puis en biais sous un carton, puis nouvelles friandises en haut des colonnes ; on recommence tant que ça bouge.
    function fall(st) {
      const spawns = [], moved = new Map();
      const mv = (a, b) => {
        st.t[b] = st.t[a]; st.sp[b] = st.sp[a]; st.id[b] = st.id[a]; st.t[a] = -1; st.sp[a] = 0; st.id[a] = 0;
        moved.set(st.id[b], b);
      };
      const open = i => !st.hole[i] && !st.box[i];
      const topDepth = new Int8Array(W);            // combien de friandises sont déjà nées dans chaque colonne (pour les faire partir de plus haut)
      for (let round = 0; round < 60; round++) {
        let any = false;
        for (let pass = 0; pass < 40; pass++) {
          let v = false;
          for (let c = 0; c < W; c++) for (let r = H - 1; r >= 0; r--) {
            const i = r * W + c; if (!open(i) || st.t[i] >= 0) continue;
            let k = r - 1; while (k >= 0 && st.hole[k * W + c]) k--;      // on passe à travers les coins absents
            if (k >= 0 && !st.box[k * W + c] && st.t[k * W + c] >= 0) { mv(k * W + c, i); v = true; }
          }
          if (v) { any = true; continue; }
          // une case vide sous un carton : une voisine du dessus glisse en biais
          let d = false;
          for (let r = H - 1; r >= 1 && !d; r--) for (let c = 0; c < W && !d; c++) {
            const i = r * W + c; if (!open(i) || st.t[i] >= 0 || !blockedAbove(st, r, c)) continue;
            for (const dc of [-1, 1]) {
              const cc = c + dc; if (cc < 0 || cc >= W) continue;
              const j = (r - 1) * W + cc;
              if (open(j) && st.t[j] >= 0) { mv(j, i); d = true; break; }
            }
          }
          if (!d) break;
          any = true;
        }
        // une nouvelle friandise dans chaque case vide tout en haut de sa colonne
        let born = false;
        for (let c = 0; c < W; c++) {
          let top = -1;
          for (let r = 0; r < H; r++) { const i = r * W + c; if (st.hole[i]) continue; top = i; break; }
          if (top < 0 || st.box[top] || st.t[top] >= 0) continue;
          st.t[top] = Math.floor(st.rnd() * st.types); st.sp[top] = 0; st.id[top] = st.nextId++;
          topDepth[c]++; spawns.push({ id: st.id[top], col: c, from: -topDepth[c] }); born = true;
        }
        if (!born && !any) break;
      }
      const moves = [];
      const pos = new Map(); for (let i = 0; i < N; i++) if (st.id[i]) pos.set(st.id[i], i);
      moved.forEach((to, id) => { if (pos.has(id) && !spawns.some(p => p.id === id)) moves.push({ id: id, to: pos.get(id) }); });
      return { kind: "fall", moves: moves, spawns: spawns.map(p => ({ id: p.id, to: pos.get(p.id), t: st.t[pos.get(p.id)], from: p.from })).filter(p => p.to !== undefined) };
    }
    function blockedAbove(st, r, c) {
      for (let k = r - 1; k >= 0; k--) { const j = k * W + c; if (st.hole[j]) continue; return !!st.box[j]; }
      return false;
    }
    // Les cascades après un coup : on enlève, on fait tomber, on recommence tant qu'il y a des alignements.
    function cascade(st, steps, focus) {
      for (let round = 0; round < 40; round++) {
        const groups = findGroups(st, round === 0 ? focus : null);
        if (!groups.length) break;
        const base = new Set(), near = [], created = [], keep = new Set();
        groups.forEach(g => {
          g.cells.forEach(i => { base.add(i); near.push(i); });
          if (g.sp) keep.add(g.at);
        });
        // une spéciale qui sert à en créer une autre part quand même (on garde la nouvelle à sa place)
        const pre = [];
        keep.forEach(i => { if (st.sp[i]) pre.push({ i: i, sp: st.sp[i] }); });
        const extra = new Set();
        pre.forEach(p => blast(st, p.i, p.sp, extra));
        extra.forEach(i => base.add(i));
        const step = clearSet(st, base, null, near, keep);
        pre.forEach(p => step.effects.push(p));
        groups.forEach(g => {
          if (!g.sp) return;
          const i = g.at;
          st.sp[i] = g.sp; if (g.sp === SP_C) st.t[i] = CAT; else st.t[i] = g.t;
          if (!st.id[i]) st.id[i] = st.nextId++;
          step.created.push({ i: i, id: st.id[i], sp: g.sp, t: st.t[i] });
        });
        steps.push(step);
        steps.push(fall(st));
      }
      if (!hasMove(st)) { shuffle(st); steps.push({ kind: "shuffle", t: Array.from(st.t), sp: Array.from(st.sp), id: Array.from(st.id) }); }
    }
    function adjacent(a, b) { const [r1, c1] = rc(a), [r2, c2] = rc(b); return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1; }
    function swapCells(st, a, b) {
      const t = st.t[a], s = st.sp[a], d = st.id[a];
      st.t[a] = st.t[b]; st.sp[a] = st.sp[b]; st.id[a] = st.id[b]; st.t[b] = t; st.sp[b] = s; st.id[b] = d;
    }
    function legal(st, a, b) {
      if (!adjacent(a, b) || !piece(st, a) || !piece(st, b)) return false;
      if (st.sp[a] === SP_C || st.sp[b] === SP_C || (st.sp[a] && st.sp[b])) return true;
      swapCells(st, a, b);
      const ok = lineAt(st, a) || lineAt(st, b);
      swapCells(st, a, b);
      return ok;
    }
    function lineAt(st, i) {
      const t = colorOf(st, i); if (t < 0) return false;
      const [r, c] = rc(i); let h = 1, v = 1;
      for (let k = c - 1; k >= 0 && colorOf(st, r * W + k) === t; k--) h++;
      for (let k = c + 1; k < W && colorOf(st, r * W + k) === t; k++) h++;
      for (let k = r - 1; k >= 0 && colorOf(st, k * W + c) === t; k--) v++;
      for (let k = r + 1; k < H && colorOf(st, k * W + c) === t; k++) v++;
      return h >= 3 || v >= 3;
    }
    function allMoves(st) {
      const out = [];
      for (let i = 0; i < N; i++) {
        const [r, c] = rc(i);
        if (c < W - 1 && legal(st, i, i + 1)) out.push([i, i + 1]);
        if (r < H - 1 && legal(st, i, i + W)) out.push([i, i + W]);
      }
      return out;
    }
    function hasMove(st) {
      for (let i = 0; i < N; i++) {
        const [r, c] = rc(i);
        if (c < W - 1 && legal(st, i, i + 1)) return true;
        if (r < H - 1 && legal(st, i, i + W)) return true;
      }
      return false;
    }
    function shuffle(st) {
      const idx = []; for (let i = 0; i < N; i++) if (piece(st, i) && !st.sp[i]) idx.push(i);
      for (let tries = 0; tries < 200; tries++) {
        const vals = idx.map(i => st.t[i]);
        for (let k = vals.length - 1; k > 0; k--) { const j = Math.floor(st.rnd() * (k + 1)); const x = vals[k]; vals[k] = vals[j]; vals[j] = x; }
        idx.forEach((i, k) => { st.t[i] = vals[k]; });
        if (!findGroups(st).length && hasMove(st)) return;
      }
      idx.forEach(i => { st.t[i] = Math.floor(st.rnd() * st.types); });
    }
    // Joue un coup. Renvoie la liste des étapes à animer, ou null si le coup n'est pas permis (les deux friandises reviennent).
    function play(st, a, b) {
      if (!legal(st, a, b)) return null;
      const steps = [{ kind: "swap", a: a, b: b, ida: st.id[a], idb: st.id[b] }];
      swapCells(st, a, b); st.moves--;
      const sa = st.sp[a], sb = st.sp[b];
      if (sa === SP_C || sb === SP_C) {
        const catAt = sa === SP_C ? a : b, other = catAt === a ? b : a, set = new Set([catAt]);
        st.sp[catAt] = 0;
        if (st.sp[other] === SP_C) { st.sp[other] = 0; for (let j = 0; j < N; j++) if (!st.hole[j]) set.add(j); }
        else {
          const t = st.t[other], osp = st.sp[other];
          for (let j = 0; j < N; j++) if (colorOf(st, j) === t) {
            set.add(j);
            if (osp && osp !== SP_C && !st.sp[j]) st.sp[j] = osp === SP_B ? SP_B : (j % 2 ? SP_H : SP_V);   // la sorte entière devient spéciale
          }
        }
        const step = clearSet(st, set, null, []);
        step.effects.unshift({ i: catAt, sp: SP_C });
        steps.push(step); steps.push(fall(st));
      } else if (sa && sb) {
        const set = new Set([a, b]), [r, c] = rc(b), add = j => { if (j >= 0 && j < N && !st.hole[j]) set.add(j); };
        const bombs = (sa === SP_B) + (sb === SP_B);
        if (bombs === 2) { for (let x = -2; x <= 2; x++) for (let y = -2; y <= 2; y++) if (r + x >= 0 && r + x < H && c + y >= 0 && c + y < W) add((r + x) * W + c + y); }
        else if (bombs === 1) { for (let x = -1; x <= 1; x++) { if (r + x >= 0 && r + x < H) for (let k = 0; k < W; k++) add((r + x) * W + k); if (c + x >= 0 && c + x < W) for (let k = 0; k < H; k++) add(k * W + c + x); } }
        else { for (let k = 0; k < W; k++) add(r * W + k); for (let k = 0; k < H; k++) add(k * W + c); }
        st.sp[a] = 0; st.sp[b] = 0;
        const step = clearSet(st, set, null, []);
        step.effects.unshift({ i: b, sp: bombs === 2 ? 5 : bombs ? 6 : 7 });
        steps.push(step); steps.push(fall(st));
      }
      cascade(st, steps, [a, b]);
      return steps;
    }
    // Deux taps sur une friandise spéciale : elle part sur place (rayée, paquet ; le chaton emporte la sorte la plus nombreuse). Ça compte un coup.
    function activate(st, i) {
      if (!piece(st, i) || !st.sp[i]) return null;
      st.moves--;
      const step = clearSet(st, new Set([i]), null, [i]), steps = [step];
      steps.push(fall(st));
      cascade(st, steps, null);
      return steps;
    }
    // Bonus de départ (après deux essais ratés sur un niveau) : une rayée et un paquet posés sur deux friandises du milieu du plateau, écartées l'une de l'autre.
    // La sorte des friandises ne change pas : aucun alignement n'apparaît.
    function boost(st) {
      const pick = (avoid) => {
        const c = [];
        for (let i = 0; i < N; i++) {
          const [r, cc] = rc(i);
          if (!piece(st, i) || st.sp[i] || r < 2 || r > 5 || cc < 1 || cc > 6) continue;
          if (avoid >= 0) { const [r2, c2] = rc(avoid); if (Math.abs(r - r2) + Math.abs(cc - c2) < 3) continue; }
          c.push(i);
        }
        if (!c.length) for (let i = 0; i < N; i++) if (piece(st, i) && !st.sp[i] && i !== avoid) c.push(i);
        return c.length ? c[Math.floor(st.rnd() * c.length)] : -1;
      };
      const a = pick(-1); if (a < 0) return [];
      st.sp[a] = st.rnd() < 0.5 ? SP_H : SP_V;
      const b = pick(a); if (b >= 0) st.sp[b] = SP_B;
      return b >= 0 ? [a, b] : [a];
    }
    const won = st => st.goals.every(g => g.left <= 0);
    return { W: W, H: H, N: N, CAT: CAT, SP_H: SP_H, SP_V: SP_V, SP_B: SP_B, SP_C: SP_C, TYPES: TYPES, config: config, make: make, play: play, activate: activate, boost: boost, legal: legal,
      allMoves: allMoves, hasMove: hasMove, clone: clone, won: won, piece: piece, adjacent: adjacent };
  })();

  /* ======================= Le panier à trier : moteur ======================= */
  const TM = (function () {
    // 14 robes faciles à distinguer, dans l'ordre où elles arrivent
    const COATS = ["roux", "noir", "blanc", "siamois", "chartreux", "tricolore", "rose", "menthe", "lavande", "nuage", "chocolat", "bengal", "smoking", "or"];
    const TRAY = 7;
    function config(level) {
      const step = Math.min(1, (level - 1) / 45);
      return {
        level: level,
        kinds: Math.min(COATS.length, 5 + Math.round(step * 6) + (level % 10 === 0 ? 1 : 0)),
        layers: Math.min(5, 2 + Math.floor((level + 1) / 5)),
        cols: Math.min(7, 5 + Math.round(step * 2)),
        rows: Math.min(8, 5 + Math.round(step * 3)),
        target: Math.min(99, 27 + Math.round(step * 57) + (level % 10 === 0 ? 9 : 0)),
        hard: level % 10 === 0
      };
    }
    // Tuiles en demi-cases : (x, y) en demi-largeurs, z = étage. Une tuile en cache une autre si elle est plus haute et qu'elles se chevauchent.
    function layout(cfg, rnd) {
      const tiles = [], C = cfg.cols, R = cfg.rows;
      const sym = (keepP, shiftX, shiftY, cols, rows, z, below) => {
        for (let r = 0; r < rows; r++) for (let c = 0; c < Math.ceil(cols / 2); c++) {
          if (rnd() > keepP) continue;
          const xs = [c, cols - 1 - c].filter((v, k, a) => a.indexOf(v) === k);
          xs.forEach(cc => {
            const x = 2 * cc + shiftX, y = 2 * r + shiftY;
            if (below && !below.some(t => Math.abs(t.x - x) < 2 && Math.abs(t.y - y) < 2)) return;   // posée sur au moins une tuile
            tiles.push({ x: x, y: y, z: z });
          });
        }
      };
      sym(0.86, 0, 0, C, R, 0, null);
      for (let z = 1; z < cfg.layers; z++) {
        const odd = z % 2, below = tiles.filter(t => t.z === z - 1);
        const cols = C - odd - 2 * Math.floor(z / 2), rows = R - odd - 2 * Math.floor(z / 2), off = odd + 2 * Math.floor(z / 2);
        if (cols < 1 || rows < 1) break;
        sym(0.78 - z * 0.06, off, off, cols, rows, z, below);
      }
      // juste ce qu'il faut : on retire, par paires symétriques quand c'est possible, des tuiles que rien ne recouvre (aucune ne reste en l'air)
      // jusqu'à un multiple de 3 proche de la cible ; le plateau garde ainsi des piles, avec des trous autour.
      const want = Math.max(18, Math.min(tiles.length - (tiles.length % 3), cfg.target - (cfg.target % 3)));
      let maxX = 0; tiles.forEach(t => { maxX = Math.max(maxX, t.x); });
      const uncovered = t => !tiles.some(u => covers(u, t)), supports = t => tiles.some(u => u.z === t.z + 1 && Math.abs(u.x - t.x) < 2 && Math.abs(u.y - t.y) < 2);
      for (let guard = 0; guard < 400 && tiles.length > want; guard++) {
        const can = tiles.filter(t => uncovered(t) && !supports(t));
        if (!can.length) break;
        const t = can[Math.floor(rnd() * can.length)];
        tiles.splice(tiles.indexOf(t), 1);
        if (tiles.length - want >= 1 && t.x !== maxX - t.x) {
          const m = tiles.find(u => u.z === t.z && u.y === t.y && u.x === maxX - t.x);
          if (m && uncovered(m) && !supports(m)) tiles.splice(tiles.indexOf(m), 1);
        }
      }
      while (tiles.length > want) tiles.splice(tiles.indexOf(tiles.reduce((a, b) => (b.z > a.z ? b : a))), 1);
      return tiles;
    }
    const covers = (a, b) => a.z > b.z && Math.abs(a.x - b.x) < 2 && Math.abs(a.y - b.y) < 2;
    function freeList(tiles) {
      const out = [];
      for (let i = 0; i < tiles.length; i++) {
        const t = tiles[i]; if (t.gone) continue;                  // dans le panier, parti, ou mis à part
        let free = true;
        for (let j = 0; j < tiles.length && free; j++) if (j !== i && !tiles[j].gone && covers(tiles[j], t)) free = false;
        if (free) out.push(i);
      }
      return out;
    }
    // Sortes posées en remontant une partie gagnante tirée au hasard : il y a toujours au moins une façon de finir.
    function make(level, rnd) {
      const cfg = config(level), tiles = layout(cfg, rnd), n = tiles.length;
      const triples = n / 3, kinds = [];
      for (let k = 0; k < triples; k++) kinds.push(k % cfg.kinds);
      for (let k = kinds.length - 1; k > 0; k--) { const j = Math.floor(rnd() * (k + 1)); const x = kinds[k]; kinds[k] = kinds[j]; kinds[j] = x; }
      const sim = tiles.map(t => ({ x: t.x, y: t.y, z: t.z, gone: false }));
      for (let k = 0; k < triples; k++) for (let m = 0; m < 3; m++) {
        const f = freeList(sim), i = f[Math.floor(rnd() * f.length)];
        sim[i].gone = true; tiles[i].k = kinds[k];
      }
      tiles.forEach((t, i) => { t.id = i; t.gone = false; });
      return { cfg: cfg, tiles: tiles, tray: [], aside: [], over: false };
    }
    // Prendre une tuile libre : elle va dans le panier, à côté de ses pareilles ; trois pareilles s'en vont.
    function take(g, i) {
      const t = g.tiles[i], asideAt = g.aside.indexOf(i);
      if (!t || g.over || g.tray.indexOf(i) >= 0) return null;
      if (asideAt < 0 && (t.gone || freeList(g.tiles).indexOf(i) < 0)) return null;
      if (asideAt >= 0) { g.aside.splice(asideAt, 1); t.aside = false; }
      t.gone = true;
      let at = g.tray.length;
      for (let k = g.tray.length - 1; k >= 0; k--) if (g.tiles[g.tray[k]].k === t.k) { at = k + 1; break; }
      g.tray.splice(at, 0, i);
      const same = g.tray.filter(j => g.tiles[j].k === t.k), cleared = same.length >= 3 ? same.slice(0, 3) : [];
      if (cleared.length) g.tray = g.tray.filter(j => cleared.indexOf(j) < 0);
      const left = g.tiles.some(x => !x.gone) || g.aside.length;
      const res = { i: i, at: at, cleared: cleared, win: !left && !g.tray.length, lose: false };
      if (!cleared.length && g.tray.length >= TRAY) res.lose = true;
      if (res.win || res.lose) g.over = true;
      return res;
    }
    // Coup de pouce (contre du thon) : les 3 premières tuiles du panier sortent et attendent à part, on peut les reprendre.
    function popOut(g) {
      const out = g.tray.splice(0, 3);
      out.forEach(i => { g.tiles[i].aside = true; g.aside.push(i); });      // toujours hors du plateau (gone), mais on peut les reprendre
      g.over = false;
      return out;
    }
    return { COATS: COATS, TRAY: TRAY, config: config, make: make, freeList: freeList, take: take, popOut: popOut, covers: covers };
  })();


  /* ======================= Pelotes : moteur ======================= */
  // Grille en nid d'abeille : rangées paires de 9 pelotes, rangées impaires de 8 décalées d'une demi-pelote. Unité : le diamètre d'une pelote (1).
  // On tire une pelote depuis le bas ; elle rebondit sur les côtés et se colle à la première pelote touchée (ou au plafond).
  // 3 pelotes pareilles reliées ou plus s'en vont ; celles qui ne tiennent plus au plafond tombent. Des chatons sont pris dans certaines pelotes : les libérer tous.
  const PB = (function () {
    const COLS = 9, ROWS = 13, RH = Math.sqrt(3) / 2;             // ROWS : rangées possibles (la dernière est interdite)
    const COLORS = ["rouge", "bleu", "vert", "jaune", "violet", "rose"];
    const W = COLS, SHOOT = { x: COLS / 2, y: (ROWS - 1) * RH + 0.5 + 1.25 };
    const rowLen = r => (r % 2 ? COLS - 1 : COLS);
    const cx = (r, c) => c + (r % 2 ? 1 : 0.5), cy = r => r * RH + 0.5;
    const key = (r, c) => r * COLS + c;
    function neighbors(r, c) {
      const o = r % 2, out = [[r, c - 1], [r, c + 1], [r - 1, c - 1 + o], [r - 1, c + o], [r + 1, c - 1 + o], [r + 1, c + o]];
      return out.filter(([a, b]) => a >= 0 && a < ROWS && b >= 0 && b < rowLen(a));
    }
    // Au-delà du niveau 420, les plateaux des niveaux 61 à 420 reviennent.
    const base = level => (level > 420 ? 61 + ((level - 61) % 360) : level);
    const SHOTS = "3-3233022+*0::50,2759;8.75GF8=@;@,<BMG=JBF9IBDM@MDD9GC@[RA?:IQOAEP?KRLWEAAIN\\BFOCH=A<>EANE:\\MIN9BGA>7J>KIJTAH>H>CQFIHAD<;FJEH<<ACC8@EE;BLINHJAMJF4<H:?BTH-NC\\NF?QK9JAK:;=@NAA=WFIL7IQE<H=8CAGB?RDDC6>MC@G=LNB@PPABHAUTDQHXE@;4FB:KGCCK\\BURIRAN5JLG=IK<<NA48;?N7D=@Q8BZ@C?<VBIWJLE[?</>FEJIOCG=?TOAIA;WIS?FG9RKFGPW@EQF@AM>H>EBD<EFQL?RD=P7I=<CFOBCND86D<BWARAH:NAFONW/COAF8JTET?LGACSBDQGCHNKNDO\\?CTGEBFBEAIAGOAN:@WA=NMIJAI?L>9F>HB";                                               // un caractère par niveau (1 à 420) : tirs = code - 32 (tests/pb_tirs.js)
    function config(lv) {
      const level = base(lv), step = Math.min(1, (level - 1) / 45), hard = lv % 10 === 0;
      const colors = Math.min(6, 4 + Math.round(step * 2) + (hard && level > 12 ? 1 : 0));
      const rows = Math.min(10, 7 + Math.round(step * 3) + (hard ? 1 : 0));
      const kittens = Math.min(6, 3 + Math.round(step * 3) + (hard ? 1 : 0));
      const est = Math.round(8 + rows * 1.6 + colors * 2.5);
      return { level: lv, seed: level, colors: colors, rows: rows, kittens: kittens, glue: 0.4 - step * 0.15, shots: SHOTS.charCodeAt(level - 1) - 32 || est, hard: hard };
    }
    function make(cfg, rnd) {
      const lay = mulberry32(cfg.seed * 9173 + 7);                  // forme du plateau : toujours la même pour un niveau
      const g = new Int8Array(COLS * ROWS).fill(-1), kit = new Uint8Array(COLS * ROWS);
      for (let r = 0; r < cfg.rows; r++) for (let c = 0; c < rowLen(r); c++) {
        // couleurs en grappes : souvent celle d'une voisine déjà posée
        const nb = neighbors(r, c).filter(([a, b]) => g[key(a, b)] >= 0);
        g[key(r, c)] = nb.length && lay() < cfg.glue ? g[key.apply(null, nb[Math.floor(lay() * nb.length)])] : Math.floor(lay() * cfg.colors);
      }
      // des trous dans les dernières rangées (le bas du plateau n'est pas plat)
      for (let r = Math.max(1, cfg.rows - 3); r < cfg.rows; r++) for (let c = 0; c < rowLen(r); c++) if (lay() < 0.16 + (r - cfg.rows + 3) * 0.12) g[key(r, c)] = -1;
      dropFloating(g, []);
      // chatons : tout en haut (les deux premières rangées), écartés les uns des autres ; il faut creuser jusqu'à eux
      const cells = []; for (let r = 0; r < Math.min(2, cfg.rows); r++) for (let c = 0; c < rowLen(r); c++) if (g[key(r, c)] >= 0) cells.push([r, c]);
      cells.sort(() => lay() - 0.5);
      const used = new Set();
      for (const [r, c] of cells) { if (used.size >= cfg.kittens) break; if ([...used].some(k => Math.abs(k % COLS - c) < 2 && Math.abs(((k / COLS) | 0) - r) < 2)) continue; used.add(key(r, c)); }
      used.forEach(k => { kit[k] = 1; });
      const st = { g: g, kit: kit, colors: cfg.colors, rnd: rnd, shots: cfg.shots, freed: 0, kittens: used.size, cur: -1, next: -1 };
      st.cur = pickColor(st); st.next = pickColor(st);
      return st;
    }
    function present(st) { const s = new Set(); for (let i = 0; i < st.g.length; i++) if (st.g[i] >= 0) s.add(st.g[i]); return Array.from(s); }
    function pickColor(st) { const p = present(st); return p.length ? p[Math.floor(st.rnd() * p.length)] : Math.floor(st.rnd() * st.colors); }
    // pelotes qui ne tiennent plus au plafond : elles tombent
    function dropFloating(g, out) {
      const seen = new Uint8Array(g.length), stack = [];
      for (let c = 0; c < COLS; c++) if (g[c] >= 0) { seen[c] = 1; stack.push([0, c]); }
      while (stack.length) { const [r, c] = stack.pop(); neighbors(r, c).forEach(([a, b]) => { const k = key(a, b); if (g[k] >= 0 && !seen[k]) { seen[k] = 1; stack.push([a, b]); } }); }
      for (let k = 0; k < g.length; k++) if (g[k] >= 0 && !seen[k]) { out.push({ r: (k / COLS) | 0, c: k % COLS, color: g[k] }); g[k] = -1; }
      return out;
    }
    // Trajectoire : la pelote avance en ligne droite, rebondit sur les côtés ; elle s'arrête au contact d'une autre (distance < 0,86) ou du plafond.
    function trace(st, angle) {
      let x = SHOOT.x, y = SHOOT.y, dx = Math.cos(angle), dy = -Math.sin(angle);
      const pts = [[x, y]], R = 0.5, stepLen = 0.08, hitD = 0.86;
      for (let n = 0; n < 2000; n++) {
        x += dx * stepLen; y += dy * stepLen;
        if (x < R) { x = 2 * R - x; dx = -dx; pts.push([x, y]); }
        if (x > W - R) { x = 2 * (W - R) - x; dx = -dx; pts.push([x, y]); }
        if (y <= R) { pts.push([x, R]); return { x: x, y: R, pts: pts, top: true }; }
        // pelotes proches seulement
        const r0 = Math.max(0, Math.floor((y - 1.2) / RH)), r1 = Math.min(ROWS - 1, Math.ceil((y + 1.2) / RH));
        for (let r = r0; r <= r1; r++) for (let c = 0; c < rowLen(r); c++) {
          if (st.g[key(r, c)] < 0) continue;
          const ddx = cx(r, c) - x, ddy = cy(r) - y;
          if (ddx * ddx + ddy * ddy < hitD * hitD) { pts.push([x, y]); return { x: x, y: y, pts: pts, hit: [r, c] }; }
        }
        if (y > SHOOT.y + 1) break;
      }
      pts.push([x, y]); return { x: x, y: y, pts: pts };
    }
    // case libre la plus proche du point d'arrêt (voisine de la pelote touchée, ou au plafond)
    function snap(st, t) {
      let best = null, bd = 1e9;
      const cand = [];
      if (t.hit) neighbors(t.hit[0], t.hit[1]).forEach(x => cand.push(x));
      const rr = Math.max(0, Math.min(ROWS - 1, Math.round((t.y - 0.5) / RH)));
      for (let r = Math.max(0, rr - 1); r <= Math.min(ROWS - 1, rr + 1); r++) for (let c = 0; c < rowLen(r); c++) cand.push([r, c]);
      cand.forEach(([r, c]) => {
        if (st.g[key(r, c)] >= 0) return;
        if (r > 0 && !neighbors(r, c).some(([a, b]) => st.g[key(a, b)] >= 0)) return;      // collée à quelque chose (ou au plafond)
        const d = (cx(r, c) - t.x) ** 2 + (cy(r) - t.y) ** 2;
        if (d < bd) { bd = d; best = [r, c]; }
      });
      return best;
    }
    function group(st, r, c) {
      const col = st.g[key(r, c)], seen = new Set([key(r, c)]), stack = [[r, c]], out = [];
      while (stack.length) {
        const [a, b] = stack.pop(); out.push([a, b]);
        neighbors(a, b).forEach(([x, y]) => { const k = key(x, y); if (!seen.has(k) && st.g[k] === col) { seen.add(k); stack.push([x, y]); } });
      }
      return out;
    }
    // Un tir. Renvoie ce qu'il faut animer : trajet, case, pelotes parties, pelotes tombées, chatons libérés.
    function shoot(st, angle) {
      const color = st.cur, t = trace(st, angle), cell = snap(st, t);
      st.shots--;
      const res = { color: color, pts: t.pts, cell: cell, popped: [], dropped: [], freed: 0, lose: false };
      if (!cell) { res.lose = true; return res; }
      const [r, c] = cell;
      if (r >= ROWS - 1) { st.g[key(r, c)] = color; res.lose = true; return res; }   // la pile touche le bas
      st.g[key(r, c)] = color;
      const grp = group(st, r, c);
      if (grp.length >= 3) {
        grp.forEach(([a, b]) => { const k = key(a, b); res.popped.push({ r: a, c: b, color: st.g[k], kit: !!st.kit[k] }); if (st.kit[k]) { st.kit[k] = 0; res.freed++; } st.g[k] = -1; });
        dropFloating(st.g, res.dropped);
        res.dropped.forEach(d => { const k = key(d.r, d.c); d.kit = !!st.kit[k]; if (st.kit[k]) { st.kit[k] = 0; res.freed++; } });
      }
      st.freed += res.freed;
      st.cur = st.next; if (present(st).indexOf(st.cur) < 0) st.cur = pickColor(st);
      st.next = pickColor(st);
      return res;
    }
    function swap(st) { const x = st.cur; st.cur = st.next; st.next = x; }
    const won = st => st.freed >= st.kittens;
    function clone(st) { return { g: Int8Array.from(st.g), kit: Uint8Array.from(st.kit), colors: st.colors, rnd: st.rnd, shots: st.shots, freed: st.freed, kittens: st.kittens, cur: st.cur, next: st.next }; }
    return { COLS: COLS, ROWS: ROWS, RH: RH, COLORS: COLORS, SHOOT: SHOOT, rowLen: rowLen, cx: cx, cy: cy, key: key, neighbors: neighbors,
      config: config, make: make, trace: trace, snap: snap, shoot: shoot, swap: swap, won: won, clone: clone, present: present };
  })();

  const J = { M3: M3, TM: TM, PB: PB, mulberry32: mulberry32 };
  if (typeof module !== "undefined" && module.exports) { module.exports = J; return; }
  window.RonronJeux = J;

  /* ======================= Affichage ======================= */
  let C = null;                        // contexte donné par app.js : S, save, updateHud, sfx, buzz, openSheet, closeSheet, show, toast, ico, plural, esc
  const $ = (s, r) => (r || document).querySelector(s);
  const wait = ms => new Promise(res => setTimeout(res, ms));
  J.init = ctx => { C = ctx; };
  const REWARD = 1;                    // une croquette par partie gagnée (et une boîte de thon de plus tous les 10 niveaux)
  const RESCUE = 2;                    // boîtes de thon pour un coup de pouce
  const games = () => { const S = C.S(); S.games = S.games || {}; return S.games; };
  const tickets = () => C.S().tickets || 0;

  /* ---------- La salle de jeux ---------- */
  const GAMES = [
    { id: "m3", name: "Friandises", desc: "Échange deux friandises voisines pour en aligner trois. Remplis les objectifs avant la fin des coups.",
      art: '<span class="gt" style="--i:0">' + treat(1) + '</span><span class="gt" style="--i:1">' + treat(2) + '</span><span class="gt" style="--i:2">' + treat(0) + "</span>" },
    { id: "tm", name: "Le panier à trier", desc: "Touche les chats du dessus pour les mettre dans le panier. Trois pareils s'en vont ; ne remplis pas les 7 places.",
      art: '<span class="gt tile" style="--i:0">' + catIcon("roux") + '</span><span class="gt tile" style="--i:1">' + catIcon("nuage") + '</span><span class="gt tile" style="--i:2">' + catIcon("roux") + "</span>" },
    { id: "pb", name: "Pelotes", desc: "Vise et tire des pelotes de laine : trois pareilles s'en vont. Libère les chatons coincés tout en haut.",
      art: [["#E8574C", "#A8322A"], ["#4C8FE0", "#2A5E9E"], ["#F2C14E", "#B9862A"]].map((c, i) => '<span class="gt" style="--i:' + i + '"><svg class="tr" viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" fill="' + c[0] +
        '" stroke="' + c[1] + '" stroke-width="2"/><g fill="none" stroke="' + c[1] + '" stroke-width="1.8" stroke-linecap="round"><path d="M7 13 C15 13 24 18 28 33"/><path d="M5 21 C12 20 19 25 21 35.5"/><path d="M13 5.5 C19 9 26 16 27 29"/></g></svg></span>').join("") },
    { id: "df", name: "Les différences", desc: "Deux images d'une pièce de ta maison : trouve ce qui a changé avant la fin du temps.",
      art: '<span class="gt frame" style="--i:0">' + catIcon("roux", 30) + '</span><span class="gt frame" style="--i:2">' + catIcon("roux", 30) + '<i class="ring"></i></span>' }
  ];
  J.renderHub = function () {
    const el = $("#screen-games"), n = tickets(), g = games();
    el.innerHTML = '<h2>Salle de jeux</h2>' +
      '<div class="tickets"><svg class="ico"><use href="#i-ticket"/></svg><strong>' + C.plural(n, "ticket") + '</strong>' +
      '<span>1 ticket par niveau de puzzle réussi. Une partie coûte 1 ticket ; gagnée, elle rapporte ' + C.plural(REWARD, "croquette") + ".</span></div>" +
      GAMES.map(x => '<div class="gamecard"><div class="gameart">' + x.art + '</div><div class="gameinfo"><strong>' + x.name + "</strong><p>" + x.desc +
        '</p><span class="glevel">Niveau ' + (g[x.id] || 1) + ((g[x.id] || 1) % 10 === 0 ? " · niveau difficile, +1 boîte de thon" : "") + '</span>' +
        (x.id === "m3" && (g.m3f || 0) >= 2 ? '<span class="gboost">Bonus de départ : une rayée et un paquet</span>' : "") + "</div>" +
        '<button class="btn" type="button" data-g="' + x.id + '"' + (n ? "" : " disabled") + '>Jouer · 1 <svg class="ico"><use href="#i-ticket"/></svg></button></div>').join("") +
      (n ? "" : '<p class="hint">Plus de ticket : réussis un niveau du puzzle (bouton Jouer) pour en gagner un.</p>');
    el.querySelectorAll("[data-g]").forEach(b => { b.onclick = () => start(b.dataset.g); });
  };
  let cur = null;                       // partie en cours : { game, level, over, ... }
  function start(id) {
    if (!tickets()) return;
    C.show("bonus");
    const level = games()[id] || 1;
    cur = { game: id, level: level, over: false, rescued: false };
    $("#screen-bonus").dataset.game = id;
    $("#b-title").textContent = GAMES.find(x => x.id === id).name + " · niveau " + level;
    $("#b-sub").textContent = (level % 10 === 0 ? "Niveau difficile · " : "") + "à gagner : " + C.plural(REWARD, "croquette") + (level % 10 === 0 ? " et 1 boîte de thon" : "");
    if (id === "m3") m3Start(level); else if (id === "pb") pbStart(level); else if (id === "df") dfStart(level); else tmStart(level);
  }
  // Fin de partie : le ticket est dépensé ; gagnée, des croquettes et le niveau suivant.
  function finish(win) {
    if (!cur || cur.over) return;
    cur.over = true;
    const S = C.S(); S.tickets = Math.max(0, (S.tickets || 0) - 1);
    const g = games(), lv = cur.level, tuna = win && lv % 10 === 0 ? 1 : 0;
    if (win) { S.kibble += REWARD; S.tuna += tuna; g[cur.game] = lv + 1; }
    if (cur.game === "m3") g.m3f = win ? 0 : (g.m3f || 0) + 1;            // essais ratés sur le niveau en cours (2 et plus : bonus de départ)
    const fails = cur.game === "m3" && !win ? g.m3f : 0;
    C.save(); C.updateHud();
    setTimeout(() => C.sfx(win ? "win" : "lose"), 200);
    setTimeout(() => {
      C.openSheet((win ? '<span class="tag">Niveau ' + lv + " réussi</span><h2>Bravo !</h2>" +
          '<div class="big">' + C.ico("kibble") + "+" + C.plural(REWARD, "croquette") + "</div>" +
          (tuna ? '<div class="big tuna">' + C.ico("tuna") + "+1 boîte de thon</div>" : "")
        : '<span class="tag">Niveau ' + lv + "</span><h2>Perdu…</h2><p>Le ticket est parti, mais tu peux retenter ce niveau avec un autre ticket.</p>" +
          (fails >= 2 ? '<p class="family boost"><span class="m3p special s1 mini">' + treat(1) + '<i class="sp h"></i></span><span>Au prochain essai, <strong>une rayée et un paquet</strong> t\'attendent sur le plateau.</span></p>'
            : fails === 1 ? "<p>Encore un essai raté sur ce niveau et tu auras un coup de pouce au départ : une rayée et un paquet.</p>" : "")) +
        "<p>Il te reste <strong>" + C.plural(S.tickets || 0, "ticket") + "</strong>.</p>" +
        '<div class="row"><button class="btn ghost" id="bj-hub" type="button">La salle de jeux</button>' +
        '<button class="btn" id="bj-again" type="button"' + ((S.tickets || 0) ? "" : " disabled") + ">" + (win ? "Niveau suivant" : "Rejouer") + "</button></div>", { sticky: true });
      $("#bj-hub").onclick = () => { C.closeSheet(); leave(); };
      $("#bj-again").onclick = () => { C.closeSheet(); start(cur.game); };
    }, 700);
  }
  function leave() { stopAll(); cur = null; C.show("games"); }
  function stopAll() { clearTimeout(hintTimer); if (pbRaf) cancelAnimationFrame(pbRaf); pbRaf = 0; pb = null; clearInterval(dfTimer); df = null; $("#b-stage").innerHTML = ""; $("#b-goals").innerHTML = ""; $("#b-tools").innerHTML = ""; }
  J.quit = function () {
    if (!cur || cur.over) { leave(); return; }
    C.openSheet("<h2>Abandonner la partie ?</h2><p>Le ticket de cette partie sera perdu.</p>" +
      '<div class="row"><button class="btn ghost" id="bq-stay" type="button">Continuer</button><button class="btn danger" id="bq-go" type="button">Abandonner</button></div>');
    $("#bq-stay").onclick = () => C.closeSheet();
    $("#bq-go").onclick = () => {
      C.closeSheet(); const S = C.S(); S.tickets = Math.max(0, (S.tickets || 0) - 1);
      if (cur.game === "m3") games().m3f = (games().m3f || 0) + 1;     // un abandon compte comme un essai raté
      C.save(); C.updateHud(); cur.over = true; leave();
    };
  };
  J.active = () => !!(cur && !cur.over);
  J.peek = () => ({ cur: cur, m3: m3, tm: tm, pb: pb, pbShoot: a => pbShoot(a), df: df });             // pour les tests

  /* ---------- Pictogrammes ---------- */
  function treat(t) { return '<svg class="tr" viewBox="0 0 40 40" aria-hidden="true"><use href="#t-' + M3.TYPES[t] + '"/></svg>'; }
  function catIcon(coat, hpx) {
    const CATS = window.RONRON_CATS || {}, q = CATS[coat] && CATS[coat].assis, hh = hpx || 34;
    if (!q) return "";
    const k = hh / q.h, w = q.w * k;
    return '<span class="cico" style="width:' + w.toFixed(1) + "px;height:" + hh + "px;background-image:url(assets/c/" + coat + ".webp);background-size:" +
      (q.sw * k).toFixed(1) + "px " + (q.sh * k).toFixed(1) + "px;background-position:-" + (q.sx * k).toFixed(1) + "px -" + ((q.sy || 0) * k).toFixed(1) + 'px"></span>';
  }

  /* ======================= Friandises : écran ======================= */
  let m3 = null, hintTimer = 0;
  function m3Start(level) {
    const cfg = M3.config(level), st = M3.make(cfg, Math.random);
    const boosted = (games().m3f || 0) >= 2 ? M3.boost(st) : [];
    const stage = $("#b-stage"), wpx = Math.min(stage.clientWidth || 360, 420), cs = Math.floor(wpx / M3.W);
    m3 = { st: st, cfg: cfg, cs: cs, els: new Map(), busy: false, sel: -1 };
    stage.innerHTML = '<div class="m3" style="width:' + cs * M3.W + "px;height:" + cs * M3.H + "px;--cs:" + cs + 'px"><div class="m3bg"></div><div class="m3pieces"></div></div>';
    const bg = $(".m3bg", stage);
    let h = "";
    for (let i = 0; i < M3.N; i++) {
      if (st.hole[i]) continue;
      const r = (i / M3.W) | 0, c = i % M3.W;
      h += '<div class="m3cell' + ((r + c) % 2 ? " alt" : "") + (st.mud[i] ? " mud" : "") + '" data-i="' + i + '" style="left:' + c * cs + "px;top:" + r * cs + 'px"></div>';
      if (st.box[i]) h += '<div class="m3box hp' + st.box[i] + '" data-b="' + i + '" style="left:' + c * cs + "px;top:" + r * cs + 'px"></div>';
    }
    bg.innerHTML = h;
    for (let i = 0; i < M3.N; i++) if (M3.piece(st, i)) addPiece(st.id[i], i, st.t[i], st.sp[i], null);
    if (boosted.length) {
      boosted.forEach(i => { const el = m3.els.get(st.id[i]); if (el) el.classList.add("born"); });
      setTimeout(() => C.toast("Coup de pouce après deux essais ratés : une rayée et un paquet t'attendent."), 400);
    }
    m3Goals(); m3Moves(); bindM3();
    const has = k => cfg.goals.some(g => g.k === k);
    $("#b-tools").innerHTML = '<p class="hint">' + (has("box") ? "Les cartons s'abîment quand on aligne juste à côté (deux fois pour ceux qui sont scotchés en croix). " : "") +
      (has("mud") ? "Une tache part quand on aligne la friandise posée dessus. " : "") +
      (level <= 3 || (!has("box") && !has("mud")) ? "Fais glisser une friandise vers sa voisine (ou touche-les l'une après l'autre). 4 alignées : une rayée. En L : un paquet. 5 alignées : un chaton qui emporte toute une sorte. " : "") +
      "Touche deux fois une spéciale pour la déclencher sur place (ça compte un coup).</p>";
    armHint();
  }
  const pos = (i, cs) => "translate(" + (i % M3.W) * cs + "px," + ((i / M3.W) | 0) * cs + "px)";
  function pieceHtml(t, sp) {
    if (sp === M3.SP_C) return '<svg class="tr" viewBox="0 0 100 100" aria-hidden="true"><use href="#i-cat"/></svg>';
    return treat(t) + (sp === M3.SP_H ? '<i class="sp h"></i>' : sp === M3.SP_V ? '<i class="sp v"></i>' : sp === M3.SP_B ? '<i class="sp b"></i>' : "");
  }
  function addPiece(id, i, t, sp, fromRow) {             // fromRow : rangée de départ (au-dessus du plateau) ; null = déjà en place
    const el = document.createElement("div");
    el.className = "m3p" + (sp ? " special s" + sp : "");
    el.innerHTML = pieceHtml(t, sp);
    const cs = m3.cs, c = i % M3.W;
    el.style.transform = fromRow !== null && fromRow !== undefined ? "translate(" + c * cs + "px," + fromRow * cs + "px)" : pos(i, cs);
    $(".m3pieces").appendChild(el); m3.els.set(id, el);
    return el;
  }
  function m3Goals() {
    const st = m3.st;
    $("#b-goals").innerHTML = st.goals.map(g => '<span class="goal' + (g.left <= 0 ? " done" : "") + '">' +
      (g.k === "t" ? treat(g.t) : g.k === "box" ? '<i class="gbox"></i>' : '<i class="gmud"></i>') + "<b>" + (g.left <= 0 ? "✓" : g.left) + "</b></span>").join("") +
      '<span class="moves"><b id="m3-moves">' + st.moves + "</b>coups</span>";
  }
  function m3Moves() { const el = $("#m3-moves"); if (el) { el.textContent = m3.st.moves; el.parentNode.classList.toggle("low", m3.st.moves <= 3); } }
  function bindM3() {
    const board = $(".m3");
    let down = null;
    const cellAt = e => {
      const r = board.getBoundingClientRect(), c = Math.floor((e.clientX - r.left) / m3.cs), w = Math.floor((e.clientY - r.top) / m3.cs);
      return c >= 0 && c < M3.W && w >= 0 && w < M3.H ? w * M3.W + c : -1;
    };
    board.addEventListener("pointerdown", e => {
      if (m3.busy || !cur || cur.over) return;
      const i = cellAt(e); if (i < 0) return;
      down = { i: i, x: e.clientX, y: e.clientY, moved: false };
      try { board.setPointerCapture(e.pointerId); } catch (x) { /* sans importance */ }
    });
    board.addEventListener("pointermove", e => {
      if (!down || down.moved) return;
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < m3.cs * 0.35) return;
      down.moved = true;
      const i = down.i, c = i % M3.W, r = (i / M3.W) | 0;
      const j = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? (c < M3.W - 1 ? i + 1 : -1) : (c > 0 ? i - 1 : -1)) : (dy > 0 ? (r < M3.H - 1 ? i + M3.W : -1) : (r > 0 ? i - M3.W : -1));
      select(-1);
      if (j >= 0) tryMove(i, j);
    });
    let last = { i: -1, t: 0 };                        // tap précédent, pour reconnaître un double tap
    board.addEventListener("pointerup", e => {
      if (!down) return;
      const d = down; down = null;
      if (d.moved || m3.busy) { last = { i: -1, t: 0 }; return; }
      const now = Date.now(), twice = last.i === d.i && now - last.t < 450;
      last = { i: d.i, t: now };
      if (twice && m3.st.sp[d.i] && M3.piece(m3.st, d.i)) { last = { i: -1, t: 0 }; select(-1); tryActivate(d.i); return; }
      if (m3.sel >= 0 && M3.adjacent(m3.sel, d.i)) { const a = m3.sel; select(-1); last = { i: -1, t: 0 }; tryMove(a, d.i); }
      else select(m3.sel === d.i && !m3.st.sp[d.i] ? -1 : d.i);
    });
    board.addEventListener("pointercancel", () => { down = null; });
  }
  function select(i) {
    if (m3.sel >= 0) { const el = m3.els.get(m3.st.id[m3.sel]); if (el) el.classList.remove("sel"); }
    m3.sel = M3.piece(m3.st, i) ? i : -1;
    if (m3.sel >= 0) { const el = m3.els.get(m3.st.id[m3.sel]); if (el) el.classList.add("sel"); }
  }
  async function tryActivate(i) {
    if (m3.busy || !cur || cur.over) return;
    const st = m3.st;
    clearTimeout(hintTimer); $$(".m3p.hint").forEach(el => el.classList.remove("hint"));
    const steps = M3.activate(st, i); if (!steps) return;
    m3.busy = true; C.sfx("tap");
    m3Moves();
    await playSteps(steps);
    afterMove();
  }
  function afterMove() {
    const st = m3.st;
    m3.busy = false;
    m3Goals();
    if (M3.won(st)) { m3Win(); return; }
    if (st.moves <= 0) { m3Out(); return; }
    armHint();
  }
  async function tryMove(a, b) {
    if (m3.busy || !cur || cur.over) return;
    const st = m3.st;
    if (!M3.piece(st, a) || !M3.piece(st, b)) return;
    clearTimeout(hintTimer); $$(".m3p.hint").forEach(el => el.classList.remove("hint"));
    m3.busy = true;
    const steps = M3.play(st, a, b);
    if (!steps) {                                   // pas d'alignement : aller-retour
      const ea = m3.els.get(st.id[a]), eb = m3.els.get(st.id[b]);
      ea.style.transform = pos(b, m3.cs); eb.style.transform = pos(a, m3.cs); C.sfx("uncross");
      await wait(150); ea.style.transform = pos(a, m3.cs); eb.style.transform = pos(b, m3.cs); await wait(160);
      m3.busy = false; armHint(); return;
    }
    m3Moves();
    await playSteps(steps);
    afterMove();
  }
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  async function playSteps(steps) {
    let combo = 0;
    for (const s of steps) {
      if (s.kind === "swap") {
        const ea = m3.els.get(s.ida), eb = m3.els.get(s.idb);
        ea.style.transform = pos(s.b, m3.cs); eb.style.transform = pos(s.a, m3.cs); C.sfx("tap");
        await wait(150);
      } else if (s.kind === "clear") {
        combo++;
        s.effects.forEach(f => flash(f.i, f.sp));
        if (s.effects.length) { C.sfx("zap"); C.buzz(15); } else C.sfx(combo > 1 ? "pop2" : "pop");
        s.gone.forEach(g => { const el = m3.els.get(g.id); if (el) { el.classList.add("gone"); m3.els.delete(g.id); setTimeout(() => el.remove(), 220); } });
        s.created.forEach(x => {
          const el = m3.els.get(x.id) || addPiece(x.id, x.i, x.t, 0, null);
          el.className = "m3p special s" + x.sp + " born"; el.innerHTML = pieceHtml(x.t, x.sp); el.style.transform = pos(x.i, m3.cs);
        });
        if (s.created.length && !games().tipSp) { games().tipSp = 1; C.save(); setTimeout(() => C.toast("Touche deux fois une friandise spéciale pour la déclencher sur place."), 600); }
        s.boxes.forEach(b => {
          const el = $('.m3box[data-b="' + b.i + '"]');
          if (el) { el.className = "m3box hp" + b.hp + " hit"; if (!b.hp) setTimeout(() => el.remove(), 260); }
        });
        s.muds.forEach(i => { const el = $('.m3cell[data-i="' + i + '"]'); if (el) el.classList.remove("mud"); });
        m3Goals();
        await wait(230);
      } else if (s.kind === "fall") {
        let far = 0;
        s.moves.forEach(m => { const el = m3.els.get(m.id); if (el) el.style.transform = pos(m.to, m3.cs); });
        s.spawns.forEach(p => { addPiece(p.id, p.to, p.t, 0, p.from); far = Math.max(far, -p.from); });
        await wait(30);
        s.spawns.forEach(p => { const el = m3.els.get(p.id); if (el) el.style.transform = pos(p.to, m3.cs); });
        await wait(170 + Math.min(4, far) * 25);
      } else if (s.kind === "shuffle") {
        C.toast("Plus de coup possible : on mélange !");
        m3.els.forEach(el => el.remove()); m3.els.clear();
        for (let i = 0; i < M3.N; i++) if (s.t[i] >= 0 && !m3.st.hole[i] && s.id[i]) addPiece(s.id[i], i, s.t[i], s.sp[i], null);
        await wait(300);
      }
    }
  }
  function flash(i, sp) {
    const board = $(".m3"), cs = m3.cs, r = (i / M3.W) | 0, c = i % M3.W, el = document.createElement("div");
    el.className = "m3fx f" + sp;
    if (sp === M3.SP_H || sp === 7) { el.style.cssText = "left:0;top:" + r * cs + "px;width:100%;height:" + cs + "px"; }
    if (sp === M3.SP_V) { el.style.cssText = "top:0;left:" + c * cs + "px;height:100%;width:" + cs + "px"; }
    if (sp === M3.SP_B || sp === 5 || sp === 6) { const k = sp === 5 ? 2 : sp === 6 ? 4 : 1; el.style.cssText = "left:" + (c - k) * cs + "px;top:" + (r - k) * cs + "px;width:" + (2 * k + 1) * cs + "px;height:" + (2 * k + 1) * cs + "px"; }
    if (sp === M3.SP_C) { el.style.cssText = "left:0;top:0;width:100%;height:100%"; }
    board.appendChild(el); setTimeout(() => el.remove(), 420);
    if (sp === 7) { const v = document.createElement("div"); v.className = "m3fx f2"; v.style.cssText = "top:0;left:" + c * cs + "px;height:100%;width:" + cs + "px"; board.appendChild(v); setTimeout(() => v.remove(), 420); }
  }
  function armHint() {
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => {
      if (!m3 || m3.busy || !cur || cur.over || cur.game !== "m3") return;
      const mv = M3.allMoves(m3.st); if (!mv.length) return;
      const [a, b] = mv[Math.floor(Math.random() * mv.length)];
      [a, b].forEach(i => { const el = m3.els.get(m3.st.id[i]); if (el) el.classList.add("hint"); });
    }, 6000);
  }
  function m3Win() {
    clearTimeout(hintTimer);
    $$(".m3p").forEach((el, k) => setTimeout(() => el.classList.add("party"), k * 8));
    finish(true);
  }
  function m3Out() {
    clearTimeout(hintTimer);
    const S = C.S();
    if (!cur.rescued && S.tuna >= RESCUE) {
      C.openSheet("<h2>Plus de coups !</h2><p>Encore " + m3.st.goals.filter(g => g.left > 0).map(g => g.left).reduce((a, b) => a + b, 0) +
        " à faire. Continuer avec <strong>5 coups de plus</strong> pour " + RESCUE + " boîtes de thon ?</p>" +
        '<div class="row"><button class="btn ghost" id="m3-stop" type="button">Arrêter</button><button class="btn" id="m3-more" type="button">+5 coups · ' + RESCUE + " " + C.ico("tuna") + "</button></div>", { sticky: true });
      $("#m3-stop").onclick = () => { C.closeSheet(); finish(false); };
      $("#m3-more").onclick = () => { C.closeSheet(); S.tuna -= RESCUE; C.save(); C.updateHud(); cur.rescued = true; m3.st.moves += 5; m3Goals(); armHint(); };
    } else finish(false);
  }

  /* ======================= Le panier à trier : écran ======================= */
  let tm = null;
  function tmStart(level) {
    const g = TM.make(level, Math.random);
    const stage = $("#b-stage"), wpx = Math.min(stage.clientWidth || 360, 420);
    let maxX = 0, maxY = 0; g.tiles.forEach(t => { maxX = Math.max(maxX, t.x + 2); maxY = Math.max(maxY, t.y + 2); });
    const avail = Math.max(260, (stage.clientHeight || 520) - 92);
    const tw = Math.floor(Math.min(wpx / (maxX / 2 + 0.3), 58, (avail / (maxY / 2 + 0.3)) / 1.12)), th = Math.round(tw * 1.12), lift = Math.max(3, Math.round(tw * 0.08));
    const bw = (maxX / 2) * tw + lift * 4, bh = (maxY / 2) * th + lift * 4;
    // le panier : 7 places, les tuiles y sont un peu plus petites si l'écran est étroit
    const ts = Math.min(tw, Math.floor((wpx - 16) / TM.TRAY) - 4), k = ts / tw, trayW = TM.TRAY * (ts + 4) + 12;
    const tray = { x: Math.round((wpx - trayW) / 2), y: bh + 40, w: trayW, k: k, ts: ts, h: Math.round(th * k) };
    tm = { g: g, tw: tw, th: th, lift: lift, ox: Math.round((wpx - bw) / 2) + lift * 2, oy: lift * 4, els: [], busy: false, tray: tray, wpx: wpx };
    stage.innerHTML = '<div class="tm" style="width:' + wpx + "px;height:" + (tray.y + tray.h + 30) + 'px"><div class="tmtray" style="left:' + tray.x + "px;top:" + (tray.y - 8) + "px;width:" + tray.w + "px;height:" + (tray.h + 16) + 'px"></div></div>';
    const box = $(".tm");
    g.tiles.forEach((t, i) => {
      const el = document.createElement("div");
      el.className = "tmt"; el.dataset.i = i; el.style.width = tw + "px"; el.style.height = th + "px";
      el.innerHTML = '<span class="tmface">' + catIcon(TM.COATS[t.k], Math.round(th * 0.78)) + "</span>";
      el.onclick = () => tmTake(i);
      box.appendChild(el); tm.els[i] = el;
    });
    tmLayout(); tmGoals();
    $("#b-tools").innerHTML = '<p class="hint">Touche un chat qui n\'est pas recouvert : il va dans le panier. Trois chats pareils s\'en vont. Le panier a 7 places.</p>';
  }
  function tilePos(t) { return [tm.ox + (t.x / 2) * tm.tw + t.z * tm.lift, tm.oy + (t.y / 2) * tm.th - t.z * tm.lift]; }
  function tmLayout() {
    const g = tm.g, free = new Set(TM.freeList(g.tiles));
    $(".tm").style.height = (tm.tray.y + tm.tray.h + 30 + (g.aside.length ? tm.tray.h + 24 : 0)) + "px";      // les chats mis à part attendent sous le panier
    g.tiles.forEach((t, i) => {
      const el = tm.els[i]; if (!el || el.dataset.out) return;
      const k = g.tray.indexOf(i), a = g.aside.indexOf(i);
      if (t.gone && k < 0 && a < 0) return;
      let x, y, z, sc = tm.tray.k;
      if (k >= 0) { x = tm.tray.x + 8 + k * (tm.tray.ts + 4); y = tm.tray.y; z = 900 + k; el.classList.add("intray"); el.classList.remove("blocked"); }
      else if (a >= 0) { x = tm.tray.x + 8 + a * (tm.tray.ts + 8); y = tm.tray.y + tm.tray.h + 22; z = 800 + a; el.classList.remove("blocked", "intray"); }
      else { [x, y] = tilePos(t); z = t.z * 100 + t.y; sc = 1; el.classList.toggle("blocked", !free.has(i)); }
      el.style.transform = "translate(" + x + "px," + y + "px)" + (sc !== 1 ? " scale(" + sc.toFixed(3) + ")" : ""); el.style.zIndex = z;
    });
  }
  function tmGoals() {
    const g = tm.g, left = g.tiles.filter(t => !t.gone).length + g.aside.length;            // sur le plateau, plus ceux mis à part
    $("#b-goals").innerHTML = '<span class="goal"><span class="mini">' + catIcon("roux") + "</span><b>" + left + '</b></span><span class="moves"><b>' + g.tray.length + "/" + TM.TRAY + "</b>panier</span>";
  }
  async function tmTake(i) {
    if (!tm || tm.busy || !cur || cur.over) return;
    const g = tm.g, res = TM.take(g, i);
    if (!res) { const el = tm.els[i]; if (el) { el.classList.remove("nope"); void el.offsetWidth; el.classList.add("nope"); } C.sfx("uncross"); return; }
    tm.busy = true; C.sfx("tap");
    tmLayout();
    await wait(230);
    if (res.cleared.length) {
      C.sfx("pop"); C.buzz(12);
      res.cleared.forEach(j => { const el = tm.els[j]; el.dataset.out = "1"; el.classList.add("gone"); setTimeout(() => el.remove(), 260); });
      await wait(200); tmLayout(); await wait(120);
    }
    tmGoals(); tm.busy = false;
    if (res.win) { finish(true); return; }
    if (res.lose) tmFull();
  }
  function tmFull() {
    const S = C.S();
    if (!cur.rescued && S.tuna >= RESCUE) {
      C.openSheet("<h2>Le panier est plein !</h2><p>Sortir <strong>3 chats du panier</strong> (ils attendent à côté, tu pourras les reprendre) pour " + RESCUE + " boîtes de thon ?</p>" +
        '<div class="row"><button class="btn ghost" id="tm-stop" type="button">Arrêter</button><button class="btn" id="tm-pop" type="button">Sortir 3 chats · ' + RESCUE + " " + C.ico("tuna") + "</button></div>", { sticky: true });
      $("#tm-stop").onclick = () => { C.closeSheet(); finish(false); };
      $("#tm-pop").onclick = () => { C.closeSheet(); S.tuna -= RESCUE; C.save(); C.updateHud(); cur.rescued = true; TM.popOut(tm.g); tmLayout(); tmGoals(); };
    } else finish(false);
  }

  /* ======================= Pelotes : écran ======================= */
  // Couleurs des pelotes (même ordre que PB.COLORS) : teinte, foncé, clair ; et le sens des brins, différent pour chaque couleur.
  const PBC = [["#E8574C", "#A8322A", "#F6A29A", 0.2], ["#4C8FE0", "#2A5E9E", "#A8CCF4", 1.1], ["#5DB85C", "#327A33", "#AEE0A8", 2.0],
    ["#F2C14E", "#B9862A", "#FBE3A6", 2.8], ["#9B6BD6", "#653C9E", "#D3B8F2", 3.7], ["#F28DB8", "#B9527F", "#FBD0E2", 4.6]];
  const KIT_COATS = ["roux", "blanc", "siamois", "tricolore", "chartreux", "noir"];
  let pb = null, pbRaf = 0;
  const pbImgs = {};
  function pbSprite(coat) {
    if (pbImgs[coat]) return pbImgs[coat];
    const im = new Image(); im.src = "assets/c/" + coat + ".webp"; im.onload = () => { if (pb) pbDraw(); };
    return (pbImgs[coat] = im);
  }
  // une pelote dessinée une fois par couleur, puis recopiée
  function yarnCanvas(ci, px) {
    const cv = document.createElement("canvas"); cv.width = cv.height = px;
    const g = cv.getContext("2d"), r = px / 2 - 1, [base, dark, light, rot] = PBC[ci];
    const grd = g.createRadialGradient(px * 0.38, px * 0.34, r * 0.15, px / 2, px / 2, r);
    grd.addColorStop(0, light); grd.addColorStop(0.45, base); grd.addColorStop(1, dark);
    g.fillStyle = grd; g.beginPath(); g.arc(px / 2, px / 2, r, 0, Math.PI * 2); g.fill();
    g.save(); g.beginPath(); g.arc(px / 2, px / 2, r, 0, Math.PI * 2); g.clip();
    g.translate(px / 2, px / 2); g.rotate(rot); g.strokeStyle = dark; g.globalAlpha = 0.55; g.lineWidth = Math.max(1, px * 0.045); g.lineCap = "round";
    for (let k = -2; k <= 2; k++) { g.beginPath(); g.ellipse(k * r * 0.34, 0, r * 0.32, r * 1.05, 0, -Math.PI / 2, Math.PI / 2); g.stroke(); }
    g.rotate(1.2); g.globalAlpha = 0.35;
    for (let k = -1; k <= 1; k++) { g.beginPath(); g.ellipse(0, k * r * 0.4, r * 1.0, r * 0.3, 0, 0, Math.PI); g.stroke(); }
    g.restore();
    g.strokeStyle = dark; g.lineWidth = Math.max(1, px * 0.03); g.beginPath(); g.arc(px / 2, px / 2, r - g.lineWidth / 2, 0, Math.PI * 2); g.stroke();
    g.fillStyle = "rgba(255,255,255,0.55)"; g.beginPath(); g.ellipse(px * 0.36, px * 0.3, r * 0.26, r * 0.14, -0.6, 0, Math.PI * 2); g.fill();
    return cv;
  }
  function pbStart(level) {
    const cfg = PB.config(level), st = PB.make(cfg, Math.random);
    const stage = $("#b-stage"), wpx = Math.min(stage.clientWidth || 360, 420);
    const availH = Math.max(380, (stage.clientHeight || 560) - 4);
    const d = Math.floor(Math.min(wpx / PB.COLS, availH / (PB.SHOOT.y + 1.05)));
    const W = d * PB.COLS, H = Math.ceil(d * (PB.SHOOT.y + 1.05)), dpr = Math.min(2, window.devicePixelRatio || 1);
    stage.innerHTML = '<div class="pbwrap" style="width:' + W + "px;height:" + H + 'px"><canvas class="pb" width="' + Math.round(W * dpr) + '" height="' + Math.round(H * dpr) + '" style="width:' + W + "px;height:" + H + 'px"></canvas></div>';
    const cv = $(".pb", stage);
    // chaque chaton a sa robe
    const coats = {}; let n = 0;
    for (let k = 0; k < st.g.length; k++) if (st.kit[k]) coats[k] = KIT_COATS[n++ % KIT_COATS.length];
    Object.keys(coats).forEach(k => pbSprite(coats[k]));
    pb = { st: st, cfg: cfg, d: d, W: W, H: H, dpr: dpr, cv: cv, ctx: cv.getContext("2d"), yarn: PBC.map((_, i) => yarnCanvas(i, Math.ceil(d * dpr))), coats: coats,
      aim: null, busy: false, fx: [], flying: null };
    pbGoals(); pbDraw(); bindPB();
    $("#b-tools").innerHTML = '<p class="hint">Vise en glissant le doigt au-dessus du lanceur, lâche pour tirer : la pelote rebondit sur les côtés. Trois pelotes pareilles ou plus s\'en vont, ' +
      "et celles qui ne tiennent plus tombent. Libère tous les chatons (tout en haut). Touche la pelote suivante pour l'échanger.</p>";
  }
  const pbXY = (r, c) => [PB.cx(r, c) * pb.d, PB.cy(r) * pb.d];
  function pbGoals() {
    const st = pb.st;
    $("#b-goals").innerHTML = '<span class="goal' + (st.freed >= st.kittens ? " done" : "") + '"><span class="mini">' + catIcon("roux", 28) + "</span><b>" + st.freed + "/" + st.kittens + "</b></span>" +
      '<span class="moves' + (st.shots <= 3 ? " low" : "") + '"><b id="pb-shots">' + st.shots + "</b>tirs</span>";
  }
  function drawKitten(g, x, y, d, coat) {
    const q = window.RONRON_CATS && window.RONRON_CATS[coat] && window.RONRON_CATS[coat].assis, im = pbImgs[coat];
    g.save(); g.beginPath(); g.arc(x, y, d * 0.4, 0, Math.PI * 2); g.fillStyle = "rgba(255,250,240,0.92)"; g.fill(); g.clip();
    if (q && im && im.complete && im.naturalWidth) {
      const k = im.naturalWidth / (q.sw || im.naturalWidth), sh = q.h * 0.62, sc = (d * 0.86) / sh;      // la tête et le haut du corps
      g.drawImage(im, (q.sx || 0) * k, (q.sy || 0) * k, q.w * k, sh * k, x - (q.w * sc) / 2, y - d * 0.36, q.w * sc, sh * sc);
    }
    g.restore();
  }
  function pbDraw() {
    if (!pb) return;
    const g = pb.ctx, d = pb.d, st = pb.st;
    g.setTransform(pb.dpr, 0, 0, pb.dpr, 0, 0);
    g.clearRect(0, 0, pb.W, pb.H);
    // ligne à ne pas dépasser
    const ly = (PB.ROWS - 1) * PB.RH * d;
    g.strokeStyle = "rgba(224,82,74,0.35)"; g.setLineDash([6, 6]); g.lineWidth = 2; g.beginPath(); g.moveTo(0, ly); g.lineTo(pb.W, ly); g.stroke(); g.setLineDash([]);
    for (let r = 0; r < PB.ROWS; r++) for (let c = 0; c < PB.rowLen(r); c++) {
      const k = PB.key(r, c), col = st.g[k]; if (col < 0) continue;
      const [x, y] = pbXY(r, c);
      g.drawImage(pb.yarn[col], x - d / 2, y - d / 2, d, d);
      if (st.kit[k]) drawKitten(g, x, y, d, pb.coats[k]);
    }
    // visée : tout le trajet jusqu'à la pelote touchée, puis la case où elle se posera
    if (pb.aim != null && !pb.busy) {
      const t = PB.trace(st, pb.aim), cell = PB.snap(st, t);
      g.strokeStyle = "rgba(58,51,64,0.55)"; g.lineWidth = 3; g.setLineDash([2, 9]); g.lineCap = "round";
      g.beginPath(); t.pts.forEach(([x, y], i) => (i ? g.lineTo(x * d, y * d) : g.moveTo(x * d, y * d))); g.stroke(); g.setLineDash([]);
      if (cell) { const [x, y] = pbXY(cell[0], cell[1]); g.globalAlpha = 0.35; g.drawImage(pb.yarn[st.cur], x - d / 2, y - d / 2, d, d); g.globalAlpha = 1; }
    }
    // effets : pelotes qui éclatent, qui tombent, chatons qui s'envolent
    pb.fx.forEach(f => {
      if (f.kind === "pop") { g.globalAlpha = Math.max(0, 1 - f.t / 220); const s = d * (1 + f.t / 400); g.drawImage(pb.yarn[f.color], f.x - s / 2, f.y - s / 2, s, s); g.globalAlpha = 1; }
      if (f.kind === "drop") { g.drawImage(pb.yarn[f.color], f.x - d / 2, f.y - d / 2, d, d); if (f.coat) drawKitten(g, f.x, f.y, d, f.coat); }
      if (f.kind === "kit") { g.globalAlpha = Math.max(0, 1 - f.t / 900); drawKitten(g, f.x, f.y, d * 1.25, f.coat); g.globalAlpha = 1; }
    });
    // lanceur
    const sx = PB.SHOOT.x * d, sy = PB.SHOOT.y * d;
    g.fillStyle = "#E9DCCB"; g.beginPath(); g.ellipse(sx, sy + d * 0.42, d * 0.85, d * 0.26, 0, 0, Math.PI * 2); g.fill();
    if (pb.flying) g.drawImage(pb.yarn[pb.flying.color], pb.flying.x * d - d / 2, pb.flying.y * d - d / 2, d, d);
    else g.drawImage(pb.yarn[st.cur], sx - d / 2, sy - d / 2, d, d);
    // pelote suivante, plus petite, à gauche
    const nx = sx - d * 2.1, ny = sy + d * 0.15;
    g.drawImage(pb.yarn[st.next], nx - d * 0.36, ny - d * 0.36, d * 0.72, d * 0.72);
    g.fillStyle = "#8A8190"; g.font = "700 " + Math.round(d * 0.28) + "px Nunito, sans-serif"; g.textAlign = "center"; g.fillText("suivante", nx, ny + d * 0.66);
  }
  function bindPB() {
    const cv = pb.cv;
    const at = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / pb.d, (e.clientY - r.top) / pb.d]; };
    const angleTo = ([x, y]) => {
      const a = Math.atan2(PB.SHOOT.y - y, x - PB.SHOOT.x);
      return Math.max(Math.PI * 0.06, Math.min(Math.PI * 0.94, a));
    };
    const nearNext = ([x, y]) => Math.hypot(x - (PB.SHOOT.x - 2.1), y - (PB.SHOOT.y + 0.15)) < 0.7;
    let down = false;
    cv.addEventListener("pointerdown", e => {
      if (!pb || pb.busy || !cur || cur.over) return;
      const p = at(e);
      if (nearNext(p)) { PB.swap(pb.st); C.sfx("tap"); pbDraw(); return; }
      if (p[1] > PB.SHOOT.y + 0.3) return;
      down = true; pb.aim = angleTo(p); pbDraw();
      try { cv.setPointerCapture(e.pointerId); } catch (x) { /* sans importance */ }
    });
    cv.addEventListener("pointermove", e => { if (!down || !pb) return; pb.aim = angleTo(at(e)); pbDraw(); });
    cv.addEventListener("pointerup", e => {
      if (!down || !pb) return;
      down = false; const p = at(e), a = angleTo(p);
      pb.aim = null;
      if (p[1] > PB.SHOOT.y - 0.2) { pbDraw(); return; }           // relâché sur le lanceur : on ne tire pas
      pbShoot(a);
    });
    cv.addEventListener("pointercancel", () => { down = false; if (pb) { pb.aim = null; pbDraw(); } });
  }
  function pbAnimate(stepFn) {
    return new Promise(res => {
      let last = performance.now();
      const tick = now => {
        const dt = Math.min(40, now - last); last = now;
        const more = stepFn(dt);
        pbDraw();
        if (more) pbRaf = requestAnimationFrame(tick); else { pbRaf = 0; res(); }
      };
      pbRaf = requestAnimationFrame(tick);
    });
  }
  async function pbShoot(angle) {
    if (!pb || pb.busy || !cur || cur.over) return;
    const st = pb.st, d = pb.d;
    pb.busy = true; C.sfx("tap");
    const res = PB.shoot(st, angle);
    $("#pb-shots").textContent = st.shots;
    // vol de la pelote le long du trajet
    const pts = res.pts.slice(), seg = []; let total = 0;
    for (let i = 1; i < pts.length; i++) { const L = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(L); total += L; }
    if (res.cell) { const [x, y] = [PB.cx(res.cell[0], res.cell[1]), PB.cy(res.cell[0])]; const L = Math.hypot(x - pts[pts.length - 1][0], y - pts[pts.length - 1][1]); pts.push([x, y]); seg.push(L); total += L; }
    // la pelote posée n'est dessinée qu'à l'arrivée
    const k = res.cell ? PB.key(res.cell[0], res.cell[1]) : -1, placed = k >= 0 ? st.g[k] : -1;
    if (k >= 0) st.g[k] = -1;
    const back = []; res.popped.concat(res.dropped).forEach(o => { const kk = PB.key(o.r, o.c); back.push([kk, o.color, o.kit]); st.g[kk] = o.color; if (o.kit) st.kit[kk] = 1; });
    let dist = 0; const speed = 0.024;                         // pelotes par milliseconde
    pb.flying = { color: res.color, x: pts[0][0], y: pts[0][1] };
    await pbAnimate(dt => {
      dist = Math.min(total, dist + speed * dt);
      let rem = dist, i = 0;
      while (i < seg.length && rem > seg[i]) { rem -= seg[i]; i++; }
      if (i >= seg.length) { pb.flying.x = pts[pts.length - 1][0]; pb.flying.y = pts[pts.length - 1][1]; return false; }
      const u = seg[i] ? rem / seg[i] : 1;
      pb.flying.x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * u; pb.flying.y = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * u;
      return dist < total;
    });
    pb.flying = null;
    if (k >= 0) st.g[k] = placed;
    back.forEach(([kk]) => { st.g[kk] = -1; st.kit[kk] = 0; });
    if (res.popped.length || res.dropped.length) {
      // celles qui éclatent, puis celles qui tombent
      res.popped.forEach(o => { const [x, y] = pbXY(o.r, o.c); pb.fx.push({ kind: "pop", color: o.color, x: x, y: y, t: 0 }); if (o.kit) pb.fx.push({ kind: "kit", coat: pb.coats[PB.key(o.r, o.c)], x: x, y: y, t: 0 }); });
      res.dropped.forEach(o => { const [x, y] = pbXY(o.r, o.c); pb.fx.push({ kind: "drop", color: o.color, coat: o.kit ? pb.coats[PB.key(o.r, o.c)] : null, x: x, y: y, vy: -0.05 - Math.random() * 0.1, vx: (Math.random() - 0.5) * 0.08, t: 0 }); });
      C.sfx(res.dropped.length ? "pop2" : "pop"); C.buzz(res.freed ? 25 : 10);
      if (res.freed) { setTimeout(() => C.sfx("cat"), 120); pbGoals(); }
      await pbAnimate(dt => {
        let alive = false;
        pb.fx.forEach(f => {
          f.t += dt;
          if (f.kind === "drop") { f.vy += 0.0016 * dt; f.y += f.vy * dt; f.x += f.vx * dt; if (f.y > pb.H + d) { if (f.coat) { pb.fx.push({ kind: "kit", coat: f.coat, x: f.x, y: pb.H - d, t: 0 }); f.coat = null; } f.dead = true; } }
          if (f.kind === "kit") { f.y -= 0.12 * dt; }
          if (f.kind === "pop" && f.t > 220) f.dead = true;
          if (f.kind === "kit" && f.t > 900) f.dead = true;
          if (!f.dead) alive = true;
        });
        pb.fx = pb.fx.filter(f => !f.dead);
        return alive;
      });
    } else C.sfx("cross");
    pb.busy = false; pbDraw(); pbGoals();
    if (PB.won(st)) { finish(true); return; }
    if (res.lose) { C.toast("Les pelotes ont touché le bas !"); finish(false); return; }
    if (st.shots <= 0) pbOut();
  }
  function pbOut() {
    const S = C.S();
    if (!cur.rescued && S.tuna >= RESCUE) {
      C.openSheet("<h2>Plus de pelotes !</h2><p>Encore " + C.plural(pb.st.kittens - pb.st.freed, "chaton") + " à libérer. Continuer avec <strong>5 pelotes de plus</strong> pour " + RESCUE + " boîtes de thon ?</p>" +
        '<div class="row"><button class="btn ghost" id="pb-stop" type="button">Arrêter</button><button class="btn" id="pb-more" type="button">+5 pelotes · ' + RESCUE + " " + C.ico("tuna") + "</button></div>", { sticky: true });
      $("#pb-stop").onclick = () => { C.closeSheet(); finish(false); };
      $("#pb-more").onclick = () => { C.closeSheet(); S.tuna -= RESCUE; C.save(); C.updateHud(); cur.rescued = true; pb.st.shots += 5; pbGoals(); };
    } else finish(false);
  }

  /* ======================= Le jeu des différences ======================= */
  // Deux fois la même vue de la maison (avec ses chantiers et ses styles), mais dans l'une, quelques détails changent :
  // un objet a disparu, un autre a pris un autre style ou une autre couleur, un chat est là ou pas. On touche les différences avant la fin du temps.
  const DF = {
    count: lv => (lv < 12 ? 5 : lv < 40 ? 6 : 7),                       // visé ; la vue choisie en a parfois une de moins
    // temps : par différence trouvée dans la vue, de 28 s au début à 16 s (un peu moins aux niveaux difficiles)
    time: (lv, k) => Math.round(k * Math.max(16, 28 - lv * 0.3) * (lv % 10 === 0 ? 0.85 : 1)),
    PENALTY: 5, EXTRA: 30
  };
  let df = null, dfTimer = 0;
  const COATS_ALL = ["roux", "tigre", "smoking", "siamois", "chartreux", "noir", "blanc", "tricolore", "bengal", "persan", "lavande", "menthe", "nuage", "rose"];
  const inBox = (b, r, m) => r.x >= b.x + m && r.y >= b.y + m && r.x + r.w <= b.x + b.w - m && r.y + r.h <= b.y + b.h - m;
  const overlaps = (a, b, m) => a.x < b.x + b.w + m && b.x < a.x + a.w + m && a.y < b.y + b.h + m && b.y < a.y + a.h + m;
  // deux différences trop proches : elles se recouvrent beaucoup, ou leurs centres sont voisins (on doit pouvoir toucher l'une sans l'autre)
  const tooClose = (a, b) => {
    const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    if (w > 0 && h > 0 && w * h > 0.3 * Math.min(a.w * a.h, b.w * b.h)) return true;
    return Math.hypot(a.x + a.w / 2 - b.x - b.w / 2, a.y + a.h / 2 - b.y - b.h / 2) < 70;
  };
  function bboxOf(list) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    list.forEach(p => { if (!p) return; x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x + p.w); y1 = Math.max(y1, p.y + p.h); });
    return x1 > x0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
  }
  const variantPatches = v => v.flat.concat(v.objs.map(o => o.p));
  function catBox(H, breed, poi) {
    const L = H.look(breed, poi.pose === "griffe" ? "assis" : poi.pose), q = L.q, k = H.spriteScale, w = q.w * k, h = q.h * k;
    return { x: poi.x - w * q.ax, y: poi.y - h * q.ay, w: w, h: h };
  }
  // Choix de la vue et des différences
  function dfPlan(level, bw, bh) {
    const H = C.house, sc = H.scene(), W = sc.world, n = DF.count(level), rnd = Math.random, area = bw * bh;
    // un chantier peut changer s'il n'est ni trop petit ni trop grand : disparaître (objets moyens), changer de couleur ou de style (jusqu'à un bon tiers de l'image)
    const items = sc.slots.map(s => {
      const cb = bboxOf(variantPatches(s.cur)); if (!cb) return null;
      const a = cb.w * cb.h, ok = Math.min(cb.w, cb.h) >= 50 && a >= 4500;
      const kinds = [];
      if (ok && a <= area * 0.18) kinds.push("hide");
      if (ok && a <= area * 0.45) kinds.push("hue");
      if (s.alts.length) { const ab = bboxOf(variantPatches(s.cur).concat(variantPatches(s.alts[0]))); if (ab && ok && ab.w * ab.h <= area * 0.5) kinds.push("style"); }
      return kinds.length ? { s: s, bb: cb, kinds: kinds } : null;
    }).filter(Boolean);
    const mostlyIn = (b, r) => { const w = Math.min(r.x + r.w, b.x + b.w) - Math.max(r.x, b.x), h = Math.min(r.y + r.h, b.y + b.h) - Math.max(r.y, b.y); return w > 0 && h > 0 && w * h >= r.w * r.h * 0.8; };
    const clip = (b, r) => { const x = Math.max(r.x, b.x), y = Math.max(r.y, b.y); return { x: x, y: y, w: Math.min(r.x + r.w, b.x + b.w) - x, h: Math.min(r.y + r.h, b.y + b.h) - y }; };
    const breeds = sc.cats.length ? sc.cats : ["roux"];
    // vues possibles : centrées sur les chantiers faits
    const centers = [], seen = new Set();
    sc.slots.forEach(s => { if (!s.at) return; const k = Math.round(s.at[0] / 250) + "," + Math.round(s.at[1] / 250); if (!seen.has(k)) { seen.add(k); centers.push(s.at); } });
    const recent = games().dfLast || [];
    let views = centers.map(c => {
      const b = { x: Math.max(0, Math.min(W.w - bw, c[0] - bw / 2)), y: Math.max(0, Math.min(W.h - bh, c[1] - bh / 2)), w: bw, h: bh };
      const its = items.filter(it => mostlyIn(b, it.bb)).map(it => Object.assign({}, it, { bb: clip(b, it.bb) }));
      const pois = sc.pois.filter(p => p.x > b.x + 60 && p.x < b.x + bw - 60 && p.y > b.y + 90 && p.y < b.y + bh - 20);
      return { b: b, its: its, pois: pois, score: its.length + Math.min(2, pois.length), key: Math.round(b.x) + "," + Math.round(b.y) };
    }).filter(v => v.its.length >= 2);
    if (!views.length) return null;
    views.sort((a, b) => b.score - a.score);
    // pour une vue : des chats posés dans les deux images (le décor), peut-être un chat en plus dans une seule, puis les chantiers qui changent
    const build = v => {
      const pois = v.pois.slice().sort(() => rnd() - 0.5), cats = [], diffs = [];
      const catFor = poi => ({ breed: breeds[Math.floor(rnd() * breeds.length)], poi: poi });
      pois.slice(0, Math.min(2, Math.max(0, pois.length - 1))).forEach(poi => cats.push(catFor(poi)));
      const taken = cats.map(c => catBox(H, c.breed, c.poi));
      for (let j = cats.length; j < pois.length && j < cats.length + (n >= 7 ? 2 : 1); j++) {     // un chat (deux pour 7 différences) dans une seule image
        if (rnd() > 0.8) continue;
        const c = catFor(pois[j]), bb = catBox(H, c.breed, c.poi);
        if (!taken.some(t => tooClose(t, bb)) && !diffs.some(d => tooClose(d.bb, bb))) diffs.push({ kind: "cat", cat: c, bb: bb, side: rnd() < 0.5 ? 0 : 1 });
      }
      if (cats.length && rnd() < 0.6) {                // un chat du décor a une autre robe dans l'une des images
        const j = Math.floor(rnd() * cats.length), c = cats[j], others = COATS_ALL.filter(x => x !== c.breed);
        diffs.push({ kind: "coat", j: j, breed: others[Math.floor(rnd() * others.length)], bb: taken[j], side: rnd() < 0.5 ? 0 : 1 });
      }
      const its = v.its.slice().sort(() => rnd() - 0.5);
      for (const it of its) {
        if (diffs.length >= n) break;
        if (diffs.some(d => tooClose(d.bb, it.bb)) || taken.some(t => tooClose(t, it.bb))) continue;
        const pref = it.kinds.indexOf("style") >= 0 && rnd() < 0.55 ? "style" : it.kinds[Math.floor(rnd() * it.kinds.length)];
        const d = { kind: pref, id: it.s.id, bb: it.bb, side: rnd() < 0.5 ? 0 : 1 };
        if (pref === "style") {
          d.alt = it.s.alts[Math.floor(rnd() * it.s.alts.length)]; d.bb = bboxOf(variantPatches(it.s.cur).concat(variantPatches(d.alt)));
          if (diffs.some(o => tooClose(o.bb, d.bb))) continue;
        }
        if (pref === "hue") d.hue = 100 + Math.floor(rnd() * 160);
        diffs.push(d);
      }
      return { v: v, cats: cats, diffs: diffs };
    };
    // on essaie plusieurs vues (les plus riches, pas les dernières jouées) et on garde la première qui a assez de différences
    const near = (v, k) => { const [x, y] = k.split(",").map(Number); return Math.hypot(v.b.x - x, v.b.y - y) < 500; };
    // les vues les plus riches d'abord (au hasard parmi elles), celles qu'on vient de jouer à la fin ; on garde la première qui a assez de différences
    const rich = views.slice(0, Math.max(8, Math.ceil(views.length / 3))).sort(() => rnd() - 0.5), rest = views.slice(rich.length);
    const order = rich.concat(rest).sort((a, b2) => (recent.some(k => near(a, k)) ? 1 : 0) - (recent.some(k => near(b2, k)) ? 1 : 0));
    let best = null;
    for (const v of order.slice(0, 16)) { const r = build(v); if (!best || r.diffs.length > best.diffs.length) best = r; if (r.diffs.length >= n) break; }
    const v = best.v, cats = best.cats, diffs = best.diffs;
    games().dfLast = [v.key].concat(recent).slice(0, 4);
    return { box: v.b, scene: sc, cats: cats, diffs: diffs };
  }
  // Dessin d'une vue : dalles, calques à plat dans l'ordre, puis objets et chats par profondeur.
  async function dfRender(cv, plan, side) {
    const H = C.house, b = plan.box, g = cv.getContext("2d"), k = cv.width / b.w;
    g.fillStyle = "#EDE3D3"; g.fillRect(0, 0, cv.width, cv.height);
    const mods = {}; plan.diffs.forEach(d => { if (d.side === side && d.id) mods[d.id] = d; });
    const hit = p => p && p.x < b.x + b.w && p.x + p.w > b.x && p.y < b.y + b.h && p.y + p.h > b.y;
    const draws = [];                                  // [patch, teinte]
    plan.scene.tiles.forEach(p => { if (hit(p)) draws.push([p, 0]); });
    const objs = [];
    plan.scene.slots.forEach(s => {
      const m = mods[s.id];
      if (m && m.kind === "hide") return;
      const v = m && m.kind === "style" ? m.alt : s.cur, hue = m && m.kind === "hue" ? m.hue : 0;
      v.flat.forEach(p => { if (hit(p)) draws.push([p, hue]); });
      v.objs.forEach(o => { if (hit(o.p)) objs.push({ p: o.p, d: o.d, hue: hue }); });
    });
    plan.cats.forEach((c, j) => {
      const m = plan.diffs.find(d => d.kind === "coat" && d.j === j && d.side === side);
      objs.push({ cat: m ? { breed: m.breed, poi: c.poi } : c, d: c.poi.depth || c.poi.y });
    });
    plan.diffs.forEach(d => { if (d.kind === "cat" && d.side === side) objs.push({ cat: d.cat, d: d.cat.poi.depth || d.cat.poi.y }); });
    objs.sort((a, b2) => a.d - b2.d);
    for (const [p, hue] of draws) await drawPatch(g, p, b, k, hue);
    for (const o of objs) { if (o.cat) await drawCat(g, o.cat, b, k); else await drawPatch(g, o.p, b, k, o.hue); }
  }
  async function drawPatch(g, p, b, k, hue) {
    const H = C.house, bm = await H.bitmap(H.imgOf(p)); if (!bm) return;
    let sx = 0, sy = 0, sw = bm.width, sh = bm.height;
    if (p.pk) { sx = p.pk[1]; sy = p.pk[2]; sw = p.w; sh = p.h; }
    else if (p.fw) { const f = bm.width / p.fw; sx = p.sx * f; sy = p.sy * f; sw = p.w * f; sh = p.h * f; }
    const x0 = Math.max(p.x, b.x), y0 = Math.max(p.y, b.y), x1 = Math.min(p.x + p.w, b.x + b.w), y1 = Math.min(p.y + p.h, b.y + b.h);
    if (x1 <= x0 || y1 <= y0) return;
    const kx = sw / p.w, ky = sh / p.h, dx = (x0 - b.x) * k, dy = (y0 - b.y) * k, dw = (x1 - x0) * k, dh = (y1 - y0) * k;
    const src = [sx + (x0 - p.x) * kx, sy + (y0 - p.y) * ky, (x1 - x0) * kx, (y1 - y0) * ky];
    if (!hue) { g.drawImage(bm, src[0], src[1], src[2], src[3], dx, dy, dw, dh); return; }
    // autre couleur : on tourne la teinte des pixels (et on colore un peu ce qui est gris)
    const t = document.createElement("canvas"); t.width = Math.max(1, Math.round(dw)); t.height = Math.max(1, Math.round(dh));
    const tg = t.getContext("2d"); tg.drawImage(bm, src[0], src[1], src[2], src[3], 0, 0, t.width, t.height);
    const im = tg.getImageData(0, 0, t.width, t.height), a = im.data, rot = hue / 360;
    for (let i = 0; i < a.length; i += 4) {
      if (a[i + 3] < 8) continue;
      let r = a[i] / 255, gg = a[i + 1] / 255, bb = a[i + 2] / 255;
      const mx = Math.max(r, gg, bb), mn = Math.min(r, gg, bb), l = (mx + mn) / 2;
      let h = 0, s2 = 0;
      if (mx !== mn) { const dd = mx - mn; s2 = l > 0.5 ? dd / (2 - mx - mn) : dd / (mx + mn); h = mx === r ? (gg - bb) / dd + (gg < bb ? 6 : 0) : mx === gg ? (bb - r) / dd + 2 : (r - gg) / dd + 4; h /= 6; }
      h = (h + rot) % 1; if (s2 < 0.2) { s2 = 0.42; h = rot; }
      const q2 = l < 0.5 ? l * (1 + s2) : l + s2 - l * s2, p2 = 2 * l - q2;
      const f = tt => { tt = (tt + 1) % 1; return tt < 1 / 6 ? p2 + (q2 - p2) * 6 * tt : tt < 0.5 ? q2 : tt < 2 / 3 ? p2 + (q2 - p2) * (2 / 3 - tt) * 6 : p2; };
      a[i] = f(h + 1 / 3) * 255; a[i + 1] = f(h) * 255; a[i + 2] = f(h - 1 / 3) * 255;
    }
    tg.putImageData(im, 0, 0); g.drawImage(t, dx, dy, dw, dh);
  }
  async function drawCat(g, c, b, k) {
    const H = C.house, L = H.look(c.breed, c.poi.pose === "griffe" ? "assis" : c.poi.pose), q = L.q, bm = await H.bitmap(L.src); if (!bm) return;
    const f = bm.width / (q.sw || q.w), bb = catBox(H, c.breed, c.poi);
    g.save();
    if ((c.poi.dir || 1) < 0) { g.translate((c.poi.x - b.x) * k * 2, 0); g.scale(-1, 1); }
    g.drawImage(bm, (q.sx || 0) * f, (q.sy || 0) * f, q.w * f, q.h * f, (bb.x - b.x) * k, (bb.y - b.y) * k, bb.w * k, bb.h * k);
    g.restore();
  }
  async function dfStart(level) {
    const stage = $("#b-stage"), wpx = Math.min(stage.clientWidth || 360, 440), hAvail = Math.max(420, (stage.clientHeight || 600) - 6);
    const iw = wpx, ih = Math.floor(Math.min(iw * 0.86, (hAvail - 10) / 2)), dpr = Math.min(2, window.devicePixelRatio || 1);
    const bw = Math.round(Math.max(860, Math.min(1150, 1000 * (iw / 358)))), bh = Math.round(bw * ih / iw);
    stage.innerHTML = '<div class="dfwrap"><p class="dfload">On prépare les deux images…</p></div>';
    const plan = dfPlan(level, bw, bh);
    if (!plan || plan.diffs.length < 3) {
      stage.innerHTML = '<p class="hint">Il faut encore quelques chantiers dans la maison pour ce jeu. Reviens après en avoir fini quelques-uns !</p>';
      cur.over = true; return;
    }
    df = { plan: plan, found: plan.diffs.map(() => false), left: DF.time(level, plan.diffs.length), level: level, running: false, hint: 1 };
    stage.innerHTML = '<div class="dfwrap">' + [0, 1].map(i => '<div class="dfimg" data-side="' + i + '" style="width:' + iw + "px;height:" + ih + 'px"><canvas width="' + Math.round(iw * dpr) + '" height="' + Math.round(ih * dpr) +
      '" style="width:' + iw + "px;height:" + ih + 'px"></canvas><div class="dfmarks"></div></div>').join("") + '<p class="dfload">On prépare les deux images…</p></div>';
    const cvs = $$(".dfimg canvas", stage);
    $("#b-tools").innerHTML = '<div class="dftools"><button class="btn ghost small" id="df-hint" type="button">' + C.ico("eye") + "Indice (1)</button><span>Touche les différences sur l'une ou l'autre image. Une erreur : −" + DF.PENALTY + " s.</span></div>";
    dfGoals();
    await Promise.all([dfRender(cvs[0], plan, 0), dfRender(cvs[1], plan, 1)]);
    if (!df || df.plan !== plan) return;
    const ld = $(".dfload", stage); if (ld) ld.remove();
    $$(".dfimg", stage).forEach(el => bindDF(el));
    $("#df-hint").onclick = dfHint;
    df.running = true; df.t0 = performance.now();
    clearInterval(dfTimer); dfTimer = setInterval(dfTick, 250);
  }
  function dfGoals() {
    const n = df.found.filter(Boolean).length, s = Math.max(0, Math.ceil(df.left));
    $("#b-goals").innerHTML = '<span class="goal' + (n === df.found.length ? " done" : "") + '">' + C.ico("eye") + "<b>" + n + "/" + df.found.length + "</b></span>" +
      '<span class="moves' + (s <= 15 ? " low" : "") + '"><b id="df-time">' + Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0") + "</b>restant</span>";
  }
  function dfTick() {
    if (!df || !df.running || !cur || cur.over) return;
    const now = performance.now(); df.left -= (now - (df.last || now)) / 1000; df.last = now;
    if (document.querySelector("#sheet:not([hidden])") && !$("#bq-go")) { /* une feuille ouverte (autre que l'abandon) */ }
    const s = Math.max(0, Math.ceil(df.left)), el = $("#df-time");
    if (el) { el.textContent = Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); el.parentNode.classList.toggle("low", s <= 15); }
    if (df.left <= 0) { df.running = false; clearInterval(dfTimer); dfOut(); }
  }
  function bindDF(el) {
    let down = null;
    el.addEventListener("pointerdown", e => { down = { x: e.clientX, y: e.clientY }; });
    el.addEventListener("pointerup", e => {
      if (!down || !df || !df.running || !cur || cur.over) return;
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 14) { down = null; return; }
      down = null;
      const r = el.getBoundingClientRect(), b = df.plan.box, k = r.width / b.w, wx = b.x + (e.clientX - r.left) / k, wy = b.y + (e.clientY - r.top) / k;
      // la zone de chaque différence, un peu agrandie (et jamais trop petite)
      let best = -1, bd = 1e9;
      df.plan.diffs.forEach((d, i) => {
        if (df.found[i]) return;
        const m = Math.max(16, (70 - Math.min(d.bb.w, d.bb.h)) / 2), bb = d.bb;
        if (wx >= bb.x - m && wx <= bb.x + bb.w + m && wy >= bb.y - m && wy <= bb.y + bb.h + m) {
          const dd = Math.hypot(wx - (bb.x + bb.w / 2), wy - (bb.y + bb.h / 2)); if (dd < bd) { bd = dd; best = i; }
        }
      });
      if (best >= 0) dfFound(best);
      else dfMiss(el, e.clientX - r.left, e.clientY - r.top);
    });
  }
  function dfMark(i, cls) {
    const d = df.plan.diffs[i], b = df.plan.box;
    $$(".dfimg").forEach(el => {
      const k = el.clientWidth / b.w, rr = Math.max(18, Math.max(d.bb.w, d.bb.h) * k / 2 + 6), x = (d.bb.x + d.bb.w / 2 - b.x) * k, y = (d.bb.y + d.bb.h / 2 - b.y) * k;
      const m = document.createElement("i"); m.className = "dfmark " + cls; m.style.cssText = "left:" + (x - rr) + "px;top:" + (y - rr) + "px;width:" + 2 * rr + "px;height:" + 2 * rr + "px";
      el.querySelector(".dfmarks").appendChild(m);
      if (cls === "hint") setTimeout(() => m.remove(), 2600);
    });
  }
  function dfFound(i) {
    df.found[i] = true; dfMark(i, "ok"); C.sfx("cat"); C.buzz(12); dfGoals();
    if (df.found.every(Boolean)) { df.running = false; clearInterval(dfTimer); setTimeout(() => finish(true), 500); }
  }
  function dfMiss(el, x, y) {
    df.left -= DF.PENALTY; C.sfx("wrong"); C.buzz([20, 40, 20]);
    const m = document.createElement("i"); m.className = "dfmiss"; m.textContent = "−" + DF.PENALTY + " s"; m.style.cssText = "left:" + x + "px;top:" + y + "px";
    el.querySelector(".dfmarks").appendChild(m); setTimeout(() => m.remove(), 900);
    dfTick();
  }
  function dfHint() {
    if (!df || !df.running || df.hint <= 0) return;
    const left = df.found.map((f, i) => (f ? -1 : i)).filter(i => i >= 0); if (!left.length) return;
    df.hint--; dfMark(left[Math.floor(Math.random() * left.length)], "hint"); C.sfx("tap");
    const b = $("#df-hint"); if (b) { b.disabled = true; b.innerHTML = C.ico("eye") + "Indice (0)"; }
  }
  function dfOut() {
    const S = C.S();
    if (!cur.rescued && S.tuna >= RESCUE) {
      C.openSheet("<h2>Le temps est écoulé !</h2><p>Encore " + C.plural(df.found.filter(f => !f).length, "différence") + " à trouver. Continuer avec <strong>" + DF.EXTRA + " secondes de plus</strong> pour " + RESCUE + " boîtes de thon ?</p>" +
        '<div class="row"><button class="btn ghost" id="df-stop" type="button">Arrêter</button><button class="btn" id="df-more" type="button">+' + DF.EXTRA + " s · " + RESCUE + " " + C.ico("tuna") + "</button></div>", { sticky: true });
      $("#df-stop").onclick = () => { C.closeSheet(); dfReveal(); finish(false); };
      $("#df-more").onclick = () => { C.closeSheet(); S.tuna -= RESCUE; C.save(); C.updateHud(); cur.rescued = true; df.left = DF.EXTRA; df.last = performance.now(); df.running = true; dfGoals(); clearInterval(dfTimer); dfTimer = setInterval(dfTick, 250); };
    } else { dfReveal(); finish(false); }
  }
  function dfReveal() { df.found.forEach((f, i) => { if (!f) dfMark(i, "missed"); }); }
})();
