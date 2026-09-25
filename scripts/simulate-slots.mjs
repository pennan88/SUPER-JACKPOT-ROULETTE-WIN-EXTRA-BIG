// Dev only: simulate DRAGON RUSH WIN BIG to check the return and tune the markers.
//   node scripts/simulate-slots.mjs [base spins] [bonuses per buy] [--zero=cat,moon]
// Plays rounds the way slots.js does: gong respins keep the spots, free spins (from pearls, cookies,
// the tax man) are played out with sticky spots, envelopes and retriggers add spins.
// --zero switches markers off, to see what each one is worth.
import { BUYS, FS_WEIGHTS, WEIGHTS, freeSpinsFor, newSpots, playSpin, reweigh } from '../js/rush-math.js';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const zero = process.argv.find((a) => a.startsWith('--zero='))?.slice(7).split(',') || [];
for (const k of zero) {
  if (k in WEIGHTS) WEIGHTS[k] = 0;
  if (k in FS_WEIGHTS) FS_WEIGHTS[k] = 0;
}
reweigh();
const SPINS = Number(args[0]) || 300000;
const BONUSES = Number(args[1]) || 20000;
if (zero.length) console.log(`(without ${zero.join(', ')})`);
const rng = Math.random;
const events = {};
const count = (k, n = 1) => (events[k] = (events[k] || 0) + n);

function tally(res) {
  for (const s of res.steps) {
    count(`step:${s.type}`);
    if (s.hatch.length) count('egg hatched', s.hatch.length);
    if (s.cats) count('cat waves', s.cats.filter((c) => c.to).length);
    if (s.cookies) for (const k of s.cookies) count(`cookie:${k.prize}`);
    if (s.clusters?.some((cl) => cl.wild)) count('wild wins');
  }
  if (res.envelopes.length) count('envelopes', res.envelopes.length);
  if (res.tax) count(res.tax.spins ? 'taxed' : 'tax man (nothing to tax)');
  if (res.respin) count('gong respin');
}

function bonus(spins, start = 0) {
  const spots = newSpots();
  if (start) for (const col of spots) col.fill(start);
  let left = spins;
  let played = 0;
  let win = 0;
  while (left > 0 && played < 1000) {
    left--;
    played++;
    const res = playSpin({ bet: 1, spots, rng, free: true });
    tally(res);
    win += res.total;
    left += freeSpinsFor(res.pearls) + res.extraSpins;
  }
  return { win, played };
}

let base = 0;
let respinWin = 0;
let bonusWin = 0;
let bonuses = 0;
let bonusSpins = 0;
let hits = 0;
let best = 0;
for (let i = 0; i < SPINS; i++) {
  const spots = newSpots();
  let round = 0;
  for (let first = true; ; first = false) {
    const res = playSpin({ bet: 1, spots, rng });
    tally(res);
    if (first) base += res.total;
    else respinWin += res.total;
    round += res.total;
    const fs = freeSpinsFor(res.pearls) + res.extraSpins;
    if (fs) {
      const b = bonus(fs);
      bonusWin += b.win;
      round += b.win;
      bonuses++;
      bonusSpins += b.played;
      break;
    }
    if (!res.respin) break;
  }
  if (round > 0) hits++;
  best = Math.max(best, round);
}

const pct = (x) => `${((x / SPINS) * 100).toFixed(1)}%`;
console.log(`\n🐉 ${SPINS.toLocaleString()} base spins`);
console.log(`  RETURN ${pct(base + respinWin + bonusWin)}  (base ${pct(base)} · gong respins ${pct(respinWin)} · free spins ${pct(bonusWin)})`);
console.log(`  hit rate ${pct(hits)} · a bonus every ${(SPINS / Math.max(1, bonuses)).toFixed(0)} spins · avg ${(bonusSpins / Math.max(1, bonuses)).toFixed(1)} spins, ${(bonusWin / Math.max(1, bonuses)).toFixed(1)}× · best round ${best.toFixed(0)}×`);
console.log('\n  markers (per 1000 base spins, bonus spins included):');
for (const [k, v] of Object.entries(events).sort()) console.log(`    ${k.padEnd(26)} ${((v / SPINS) * 1000).toFixed(1)}`);

console.log(`\n💸 buys (${BONUSES.toLocaleString()} each)`);
for (const b of BUYS) {
  let win = 0;
  let spins = 0;
  for (let i = 0; i < BONUSES; i++) {
    const r = bonus(b.spins, b.start);
    win += r.win;
    spins += r.played;
  }
  const avg = win / BONUSES;
  console.log(`  ${b.name.padEnd(18)} avg ${avg.toFixed(1)}× (costs ${b.cost}× → ${((avg / b.cost) * 100).toFixed(1)}% return) · avg ${(spins / BONUSES).toFixed(1)} spins`);
}
