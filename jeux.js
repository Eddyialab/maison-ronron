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
    const won = st => st.goals.every(g => g.left <= 0);
    return { W: W, H: H, N: N, CAT: CAT, SP_H: SP_H, SP_V: SP_V, SP_B: SP_B, SP_C: SP_C, TYPES: TYPES, config: config, make: make, play: play, legal: legal,
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

  const J = { M3: M3, TM: TM, mulberry32: mulberry32 };
  if (typeof module !== "undefined" && module.exports) { module.exports = J; return; }
  window.RonronJeux = J;

  /* ======================= Affichage ======================= */
  let C = null;                        // contexte donné par app.js : S, save, updateHud, sfx, buzz, openSheet, closeSheet, show, toast, ico, plural, esc
  const $ = (s, r) => (r || document).querySelector(s);
  const wait = ms => new Promise(res => setTimeout(res, ms));
  J.init = ctx => { C = ctx; };
  const REWARD = 3;                    // croquettes pour une partie gagnée (et une boîte de thon de plus tous les 10 niveaux)
  const RESCUE = 2;                    // boîtes de thon pour un coup de pouce
  const games = () => { const S = C.S(); S.games = S.games || {}; return S.games; };
  const tickets = () => C.S().tickets || 0;

  /* ---------- La salle de jeux ---------- */
  const GAMES = [
    { id: "m3", name: "Friandises", desc: "Échange deux friandises voisines pour en aligner trois. Remplis les objectifs avant la fin des coups.",
      art: '<span class="gt" style="--i:0">' + treat(1) + '</span><span class="gt" style="--i:1">' + treat(2) + '</span><span class="gt" style="--i:2">' + treat(0) + "</span>" },
    { id: "tm", name: "Le panier à trier", desc: "Touche les chats du dessus pour les mettre dans le panier. Trois pareils s'en vont ; ne remplis pas les 7 places.",
      art: '<span class="gt tile" style="--i:0">' + catIcon("roux") + '</span><span class="gt tile" style="--i:1">' + catIcon("nuage") + '</span><span class="gt tile" style="--i:2">' + catIcon("roux") + "</span>" }
  ];
  J.renderHub = function () {
    const el = $("#screen-games"), n = tickets(), g = games();
    el.innerHTML = '<h2>Salle de jeux</h2>' +
      '<div class="tickets"><svg class="ico"><use href="#i-ticket"/></svg><strong>' + C.plural(n, "ticket") + '</strong>' +
      '<span>1 ticket par niveau de puzzle réussi. Une partie coûte 1 ticket ; gagnée, elle rapporte ' + REWARD + " croquettes.</span></div>" +
      GAMES.map(x => '<div class="gamecard"><div class="gameart">' + x.art + '</div><div class="gameinfo"><strong>' + x.name + "</strong><p>" + x.desc +
        '</p><span class="glevel">Niveau ' + (g[x.id] || 1) + ((g[x.id] || 1) % 10 === 0 ? " · niveau difficile, +1 boîte de thon" : "") + '</span></div>' +
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
    $("#b-title").textContent = (id === "m3" ? "Friandises" : "Le panier à trier") + " · niveau " + level;
    $("#b-sub").textContent = (level % 10 === 0 ? "Niveau difficile · " : "") + "à gagner : " + C.plural(REWARD, "croquette") + (level % 10 === 0 ? " et 1 boîte de thon" : "");
    if (id === "m3") m3Start(level); else tmStart(level);
  }
  // Fin de partie : le ticket est dépensé ; gagnée, des croquettes et le niveau suivant.
  function finish(win) {
    if (!cur || cur.over) return;
    cur.over = true;
    const S = C.S(); S.tickets = Math.max(0, (S.tickets || 0) - 1);
    const g = games(), lv = cur.level, tuna = win && lv % 10 === 0 ? 1 : 0, extra = win && cur.bonus ? cur.bonus : 0;
    if (win) { S.kibble += REWARD + extra; S.tuna += tuna; g[cur.game] = lv + 1; }
    C.save(); C.updateHud();
    setTimeout(() => C.sfx(win ? "win" : "lose"), 200);
    setTimeout(() => {
      C.openSheet((win ? '<span class="tag">Niveau ' + lv + " réussi</span><h2>Bravo !</h2>" +
          '<div class="big">' + C.ico("kibble") + "+" + C.plural(REWARD + extra, "croquette") + "</div>" +
          (extra ? '<p class="timeline">Dont <strong>+' + extra + "</strong> pour les coups qui restaient.</p>" : "") +
          (tuna ? '<div class="big tuna">' + C.ico("tuna") + "+1 boîte de thon</div>" : "")
        : '<span class="tag">Niveau ' + lv + "</span><h2>Perdu…</h2><p>Le ticket est parti, mais tu peux retenter ce niveau avec un autre ticket.</p>") +
        "<p>Il te reste <strong>" + C.plural(S.tickets || 0, "ticket") + "</strong>.</p>" +
        '<div class="row"><button class="btn ghost" id="bj-hub" type="button">La salle de jeux</button>' +
        '<button class="btn" id="bj-again" type="button"' + ((S.tickets || 0) ? "" : " disabled") + ">" + (win ? "Niveau suivant" : "Rejouer") + "</button></div>", { sticky: true });
      $("#bj-hub").onclick = () => { C.closeSheet(); leave(); };
      $("#bj-again").onclick = () => { C.closeSheet(); start(cur.game); };
    }, 700);
  }
  function leave() { stopAll(); cur = null; C.show("games"); }
  function stopAll() { clearTimeout(hintTimer); $("#b-stage").innerHTML = ""; $("#b-goals").innerHTML = ""; $("#b-tools").innerHTML = ""; }
  J.quit = function () {
    if (!cur || cur.over) { leave(); return; }
    C.openSheet("<h2>Abandonner la partie ?</h2><p>Le ticket de cette partie sera perdu.</p>" +
      '<div class="row"><button class="btn ghost" id="bq-stay" type="button">Continuer</button><button class="btn danger" id="bq-go" type="button">Abandonner</button></div>');
    $("#bq-stay").onclick = () => C.closeSheet();
    $("#bq-go").onclick = () => { C.closeSheet(); const S = C.S(); S.tickets = Math.max(0, (S.tickets || 0) - 1); C.save(); C.updateHud(); cur.over = true; leave(); };
  };
  J.active = () => !!(cur && !cur.over);
  J.peek = () => ({ cur: cur, m3: m3, tm: tm });             // pour les tests

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
    m3Goals(); m3Moves(); bindM3();
    const has = k => cfg.goals.some(g => g.k === k);
    $("#b-tools").innerHTML = '<p class="hint">' + (has("box") ? "Les cartons s'abîment quand on aligne juste à côté (deux fois pour ceux qui sont scotchés en croix). " : "") +
      (has("mud") ? "Une tache part quand on aligne la friandise posée dessus. " : "") +
      (level <= 3 || (!has("box") && !has("mud")) ? "Fais glisser une friandise vers sa voisine (ou touche-les l'une après l'autre). 4 alignées : une rayée. En L : un paquet. 5 alignées : un chaton qui emporte toute une sorte." : "") + "</p>";
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
    board.addEventListener("pointerup", e => {
      if (!down) return;
      const d = down; down = null;
      if (d.moved || m3.busy) return;
      if (m3.sel >= 0 && M3.adjacent(m3.sel, d.i)) { const a = m3.sel; select(-1); tryMove(a, d.i); }
      else select(m3.sel === d.i ? -1 : d.i);
    });
    board.addEventListener("pointercancel", () => { down = null; });
  }
  function select(i) {
    if (m3.sel >= 0) { const el = m3.els.get(m3.st.id[m3.sel]); if (el) el.classList.remove("sel"); }
    m3.sel = M3.piece(m3.st, i) ? i : -1;
    if (m3.sel >= 0) { const el = m3.els.get(m3.st.id[m3.sel]); if (el) el.classList.add("sel"); }
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
    m3.busy = false;
    m3Goals();
    if (M3.won(st)) { m3Win(); return; }
    if (st.moves <= 0) { m3Out(); return; }
    armHint();
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
    cur.bonus = m3.st.moves >= 5 ? 1 : 0;
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
})();
