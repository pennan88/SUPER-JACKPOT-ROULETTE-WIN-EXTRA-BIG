// 🐉 DRAGON RUSH WIN BIG: the maths. Pure functions, no DOM, so it can be simulated in node.
// 7×7 grid, CLUSTER PAYS (5+ touching, up/down/left/right), TUMBLES, and MULTIPLIER SPOTS:
// a spot is marked the first time a winning symbol explodes on it, then becomes ×2 and doubles
// on every further explosion, up to ×1024. Cluster wins are multiplied by the sum of the spots under them.
// Base game spots reset every spin; in FREE SPINS they stick for the whole bonus.

export const COLS = 7;
export const ROWS = 7;
export const MULT_MAX = 1024;
export const MIN_CLUSTER = 5;

// low → high. 'pearl' is the scatter: the flaming pearl the dragon chases.
export const SYMS = ['sapph', 'amethyst', 'jade', 'amber', 'lantern', 'ingot', 'dragon'];

// ✨ SPECIAL MARKERS: they never form clusters, they DO things.
//   🧧 envelope     (free spins only) end of spin: +1/+2/+3 free spins each
//   🥠 cookie       when the tumbles stop: +2 free spins, a ×2 spot, or a useless fortune
//   🔔 gong         (base game only) end of spin: a free RESPIN that keeps your multiplier spots
//   🧨 firecracker  when the tumbles stop: blows up the 3×3 around it, chains into other firecrackers
//   🥚 egg          cracks on the next tumble, HATCHES on the one after: a ✚ of baby dragon WILDS
//   🪁 kite         when the tumbles stop: flies off with every copy of the most common symbol
//   🐱 cat          waves on every win: a random marked spot goes ×2, or a lit one doubles (sometimes: nothing)
//   🌕 moon         when the tumbles stop: gathers every multiplier into one giant spot under it
//   🐼 panda        when the tumbles stop: wakes up grumpy, every spot around it goes up a level
//   🧾 taxman       end of spin: takes 10% of the win, refunds you in free spins
// 'wild' only ever comes out of an egg; it joins any cluster it touches.
export const SPECIALS = ['envelope', 'cookie', 'gong', 'firecracker', 'egg', 'kite', 'cat', 'moon', 'panda', 'taxman'];
export const WEIGHTS = {
  sapph: 16, amethyst: 16, jade: 15, amber: 14, lantern: 13, ingot: 12, dragon: 11, pearl: 0.55,
  cookie: 0.02, gong: 0.06, firecracker: 0.12, egg: 0.1, kite: 0.08, cat: 0.1, moon: 0.06, panda: 0.08, taxman: 0.01,
};
// free spins are lumpier: more clusters, so the sticky multiplier spots actually grow
export const FS_WEIGHTS = {
  sapph: 25, amethyst: 21, jade: 17, amber: 14, lantern: 9.5, ingot: 6.5, dragon: 4.5, pearl: 0.5,
  envelope: 0.03, cookie: 0.01, firecracker: 0.05, egg: 0.06, kite: 0.03, cat: 0.03, moon: 0.02, panda: 0.03, taxman: 0.01,
};
const REGULAR = new Set(SYMS);
export const isRegular = (s) => REGULAR.has(s);
export const isEgg = (s) => s === 'egg' || s === 'egg1';
export const EGG_NEXT = { egg: 'egg1', egg1: 'wild' };
// what's inside a fortune cookie
export const COOKIE_SPINS = 2;
export const TAX_RATE = 0.1;
export const TAX_SPINS = { base: 2, free: 1 };

// pays × total bet for cluster size 5, 6, … 15+
const CURVE = [1, 1.5, 2, 3, 4, 6, 8, 12, 20, 40, 100];
const BASE = { sapph: 0.2, amethyst: 0.25, jade: 0.3, amber: 0.4, lantern: 0.6, ingot: 1, dragon: 1.5 };
// symbol pays were trimmed by a quarter when the markers arrived: they hand the difference back
export const SCALE = 2.5;
export const PAYS = Object.fromEntries(
  SYMS.map((s) => [s, CURVE.map((c) => Math.round(BASE[s] * c * SCALE * 100) / 100)]),
);
export const payFor = (sym, size) => PAYS[sym][Math.min(size, 15) - MIN_CLUSTER] || 0;

// scatters anywhere on the final grid → free spins
// BUY BONUS menu. Simulated over 20k bonuses each:
//   FREE SPINS: 10 spins, averages ~96× bet  → costs 100×
//   SUPER FREE SPINS: 10 spins with every spot already ×2, averages ~577× bet → costs 600×
export const BUYS = [
  { id: 'normal', name: 'FREE SPINS', cost: 100, spins: 10, start: 0, blurb: '10 free spins. Multiplier spots stick all bonus.' },
  { id: 'super', name: 'SUPER FREE SPINS', cost: 580, spins: 10, start: 2, blurb: '10 free spins and EVERY spot starts at ×2. Absolute chaos.' },
];
// simulated over 400k spins: base game ~65%, free spins ~31%, total ~96% return
export const FREE_SPINS = { 3: 10, 4: 12, 5: 15, 6: 20, 7: 30 };
export const freeSpinsFor = (n) => (n >= 3 ? FREE_SPINS[Math.min(n, 7)] : 0);

export const rand01 = () => {
  const b = new Uint32Array(1);
  crypto.getRandomValues(b);
  return b[0] / 2 ** 32;
};

const table = (w) => ({ w, ids: Object.keys(w), total: Object.values(w).reduce((a, b) => a + b, 0) });
let BASE_T = table(WEIGHTS);
let FS_T = table(FS_WEIGHTS);
/** For the simulator: rebuild the roll tables after changing WEIGHTS / FS_WEIGHTS. */
export function reweigh() {
  BASE_T = table(WEIGHTS);
  FS_T = table(FS_WEIGHTS);
}
export function rollSym(rng = rand01, free = false) {
  const t = free ? FS_T : BASE_T;
  let r = rng() * t.total;
  for (const id of t.ids) if ((r -= t.w[id]) < 0) return id;
  return 'sapph';
}

// grid[c][r], r = 0 is the top row
export const newGrid = (rng = rand01, free = false) =>
  Array.from({ length: COLS }, () => Array.from({ length: ROWS }, () => rollSym(rng, free)));
export const newSpots = () => Array.from({ length: COLS }, () => Array(ROWS).fill(0));

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const inGrid = (c, r) => c >= 0 && r >= 0 && c < COLS && r < ROWS;

/** Clusters of 5+ touching (up/down/left/right). Wilds count as every symbol, so one wild can be in several. */
export function findClusters(grid) {
  const seen = newSpots();
  const out = [];
  for (let c = 0; c < COLS; c++)
    for (let r = 0; r < ROWS; r++) {
      const sym = grid[c][r];
      if (seen[c][r] || !REGULAR.has(sym)) continue;
      const cells = [];
      const wilds = new Set();
      const stack = [[c, r]];
      seen[c][r] = 1;
      while (stack.length) {
        const [x, y] = stack.pop();
        cells.push([x, y]);
        for (const [dx, dy] of DIRS) {
          const nx = x + dx;
          const ny = y + dy;
          if (!inGrid(nx, ny)) continue;
          const s = grid[nx][ny];
          if (s === sym && !seen[nx][ny]) seen[nx][ny] = 1;
          else if (s === 'wild' && !wilds.has(nx * ROWS + ny)) wilds.add(nx * ROWS + ny);
          else continue;
          stack.push([nx, ny]);
        }
      }
      if (cells.length >= MIN_CLUSTER) out.push({ sym, cells, wild: wilds.size });
    }
  return out;
}
const cellsWhere = (grid, test) => {
  const out = [];
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) if (test(grid[c][r])) out.push([c, r]);
  return out;
};
const uniqCells = (cells) => {
  const seen = new Set();
  return cells.filter(([c, r]) => !seen.has(c * ROWS + r) && seen.add(c * ROWS + r));
};
const pick = (rng, list) => list[Math.floor(rng() * list.length)];
// a spot that gets "upgraded" by a marker: unlit/marked → ×2, lit → doubles
const upgradeSpot = (v) => (v < 2 ? 2 : Math.min(MULT_MAX, v * 2));

// the multiplier a spot contributes (0 = none)
export const spotMult = (v) => (v >= 2 ? v : 0);
export const bumpSpot = (v) => (v === 0 ? 1 : v === 1 ? 2 : Math.min(MULT_MAX, v * 2));

/** Remove cells, let survivors fall, fill from the top. Returns the new grid and the moves to animate. */
export function tumble(grid, removed, rng = rand01, free = false) {
  const gone = new Set(removed.map(([c, r]) => c * ROWS + r));
  const next = [];
  const moves = []; // {c, from, to}
  const fresh = []; // {c, r, sym, drop}  drop = how many cells above the grid it starts
  for (let c = 0; c < COLS; c++) {
    const keep = [];
    for (let r = 0; r < ROWS; r++) if (!gone.has(c * ROWS + r)) keep.push(r);
    const n = ROWS - keep.length;
    const col = [];
    for (let i = 0; i < n; i++) {
      const sym = rollSym(rng, free);
      col.push(sym);
      fresh.push({ c, r: i, sym, drop: n });
    }
    keep.forEach((r, i) => {
      col.push(grid[c][r]);
      if (r !== n + i) moves.push({ c, from: r, to: n + i });
    });
    next.push(col);
  }
  return { grid: next, moves, fresh };
}

// a winning step: pay the clusters, light the spots under them, then the lucky cats wave
function winStep(grid, clusters, spots, bet, rng) {
  let win = 0;
  for (const cl of clusters) {
    const mult = cl.cells.reduce((s, [c, r]) => s + spotMult(spots[c][r]), 0) || 1;
    cl.base = payFor(cl.sym, cl.cells.length) * bet;
    cl.mult = mult;
    cl.win = cl.base * mult;
    win += cl.win;
  }
  const removed = uniqCells(clusters.flatMap((cl) => cl.cells));
  // spots change after the wins are counted
  const spotChanges = removed.map(([c, r]) => {
    spots[c][r] = bumpSpot(spots[c][r]);
    return { c, r, v: spots[c][r] };
  });
  // 🐱 every cat still on the board waves: a random marked spot goes ×2 / a lit one doubles
  // (a quarter of the time it waves at nothing. It's a cat.)
  const cats = cellsWhere(grid, (s) => s === 'cat').map(([c, r]) => {
    const lit = cellsWhere(spots, (v) => v >= 1 && v < MULT_MAX);
    if (!lit.length || rng() < 0.25) return { c, r, to: null };
    const [tc, tr] = pick(rng, lit);
    spots[tc][tr] = upgradeSpot(spots[tc][tr]);
    return { c, r, to: { c: tc, r: tr, v: spots[tc][tr] } };
  });
  return { type: 'win', clusters, win, spotChanges, cats, removed };
}

// when the tumbles run dry, the markers take turns (one kind per step, in this order)
const ACTIONS = ['cookie', 'panda', 'firecracker', 'kite', 'moon'];
function actionStep(grid, spots, rng) {
  const kind = ACTIONS.find((k) => cellsWhere(grid, (s) => s === k).length);
  if (!kind) return null;
  const at = cellsWhere(grid, (s) => s === kind);
  const step = { type: kind, at, win: 0, spotChanges: [], removed: [...at], extraSpins: 0 };
  const setSpot = (c, r, v) => {
    spots[c][r] = v;
    step.spotChanges.push({ c, r, v });
  };
  if (kind === 'cookie') {
    // 🥠 25% free spins · 40% a ×2 spot right where it was · 35% a fortune (nothing)
    step.cookies = at.map(([c, r]) => {
      const u = rng();
      if (u < 0.25) {
        step.extraSpins += COOKIE_SPINS;
        return { c, r, prize: 'spins', spins: COOKIE_SPINS };
      }
      if (u < 0.65) {
        setSpot(c, r, upgradeSpot(spots[c][r]));
        return { c, r, prize: 'spot', v: spots[c][r] };
      }
      return { c, r, prize: 'dud' };
    });
  } else if (kind === 'panda') {
    // 🐼 every spot in the 3×3 around it goes up a level (unlit → marked → ×2 → ×4 …)
    for (const [c, r] of at)
      for (let dc = -1; dc <= 1; dc++)
        for (let dr = -1; dr <= 1; dr++) if (inGrid(c + dc, r + dr)) setSpot(c + dc, r + dr, bumpSpot(spots[c + dc][r + dr]));
  } else if (kind === 'firecracker') {
    // 🧨 3×3 blast; firecrackers caught in it go off too
    const lit = new Set(at.map(([c, r]) => c * ROWS + r));
    const queue = [...at];
    step.chain = [];
    while (queue.length) {
      const [c, r] = queue.shift();
      step.chain.push([c, r]);
      for (let dc = -1; dc <= 1; dc++)
        for (let dr = -1; dr <= 1; dr++) {
          const x = c + dc;
          const y = r + dr;
          if (!inGrid(x, y) || lit.has(x * ROWS + y)) continue;
          const s = grid[x][y];
          if (s === 'firecracker') {
            lit.add(x * ROWS + y);
            queue.push([x, y]);
            step.removed.push([x, y]);
          } else if (REGULAR.has(s) || s === 'wild') {
            lit.add(x * ROWS + y);
            step.removed.push([x, y]);
          }
        }
    }
  } else if (kind === 'kite') {
    // 🪁 each kite flies off with every copy of the most common symbol left (ties: the better one)
    const taken = new Set();
    step.kites = at.map(([c, r]) => {
      const counts = {};
      for (const col of grid) for (const s of col) if (REGULAR.has(s) && !taken.has(s)) counts[s] = (counts[s] || 0) + 1;
      const sym = Object.keys(counts).sort((a, b) => counts[b] - counts[a] || SYMS.indexOf(b) - SYMS.indexOf(a))[0];
      if (!sym) return { c, r, sym: null, cells: [] };
      taken.add(sym);
      const cells = cellsWhere(grid, (s) => s === sym);
      step.removed.push(...cells);
      return { c, r, sym, cells };
    });
  } else if (kind === 'moon') {
    // 🌕 every lit multiplier is added into one giant spot under the (first) moon; the rest go back to marked
    const lit = cellsWhere(spots, (v) => v >= 2);
    if (lit.length >= 2) {
      const [mc, mr] = at[0];
      const sum = Math.min(MULT_MAX, lit.reduce((s, [c, r]) => s + spots[c][r], 0));
      step.from = lit.filter(([c, r]) => c !== mc || r !== mr);
      for (const [c, r] of step.from) setSpot(c, r, 1);
      setSpot(mc, mr, sum);
      step.target = { c: mc, r: mr, v: sum };
    }
  }
  return step;
}

/**
 * Play one whole spin (all tumbles + markers). `spots` is mutated (pass the free-spin spots to keep them).
 * Returns every step so the UI can animate it, plus the total.
 * Step types: 'win' (clusters paid) or a marker action ('cookie' 'panda' 'firecracker' 'kite' 'moon').
 * After every step's refill the eggs crack (`eggs`) and maybe hatch (`hatch`).
 */
export function playSpin({ bet, spots = newSpots(), rng = rand01, free = false, grid = newGrid(rng, free) }) {
  const start = grid;
  const steps = [];
  let total = 0;
  let extraSpins = 0;
  for (let guard = 0; guard < 100; guard++) {
    const clusters = findClusters(grid);
    const step = clusters.length ? winStep(grid, clusters, spots, bet, rng) : actionStep(grid, spots, rng);
    if (!step) break;
    const t = tumble(grid, step.removed, rng, free);
    // 🥚 eggs that were already on the board crack; the 2nd crack hatches a ✚ of wilds
    const fresh = new Set(t.fresh.map((f) => f.c * ROWS + f.r));
    step.eggs = [];
    step.hatch = [];
    for (const [c, r] of cellsWhere(t.grid, isEgg)) {
      if (fresh.has(c * ROWS + r)) continue;
      const next = EGG_NEXT[t.grid[c][r]];
      if (next !== 'wild') {
        t.grid[c][r] = next;
        step.eggs.push({ c, r, id: next });
        continue;
      }
      const cells = [[c, r], ...DIRS.map(([dx, dy]) => [c + dx, r + dy]).filter(([x, y]) => inGrid(x, y) && REGULAR.has(t.grid[x][y]))];
      for (const [x, y] of cells) t.grid[x][y] = 'wild';
      step.hatch.push({ c, r, cells });
    }
    Object.assign(step, t);
    steps.push(step);
    total += step.win;
    extraSpins += step.extraSpins || 0;
    grid = t.grid;
  }

  // end of spin: scatters, envelopes, the gong, and the tax man
  const pearls = cellsWhere(grid, (s) => s === 'pearl').length;
  const envelopes = free
    ? cellsWhere(grid, (s) => s === 'envelope').map(([c, r]) => {
        const u = rng();
        return { c, r, spins: u < 0.6 ? 1 : u < 0.9 ? 2 : 3 };
      })
    : [];
  extraSpins += envelopes.reduce((s, e) => s + e.spins, 0);
  const respin = !free && cellsWhere(grid, (s) => s === 'gong').length > 0;
  let tax = null;
  const taxmen = cellsWhere(grid, (s) => s === 'taxman');
  if (taxmen.length) {
    const gross = total;
    const amount = total > 0 ? Math.round(total * TAX_RATE * 100) / 100 : 0;
    const spins = total > 0 ? TAX_SPINS[free ? 'free' : 'base'] : 0;
    total -= amount;
    extraSpins += spins;
    tax = { cells: taxmen, gross, amount, spins };
  }
  return { start, steps, total, final: grid, pearls, spots, envelopes, respin, tax, extraSpins };
}
