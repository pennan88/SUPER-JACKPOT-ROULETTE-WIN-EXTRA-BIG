import { RouletteWheel, colorOf, RED } from './wheel.js';
import { celebrate, youDied, winLevel, fxActive, dismissFx, setWinFlair } from './fx.js';
import { LobbyMusic } from './music.js';
import { startWaiter } from './drinks.js';
import { createBar } from './booze.js';
import { watchAd } from './ads.js';
import { createSlots } from './slots.js';
import { createVip } from './vip.js';
import { createTab } from './tab.js';
import { createDave } from './dave.js';
import { createHangover } from './hangover.js';
import { createSettings } from './settings.js';
import { createCourier } from './courier.js';
import { createPhone } from './phone.js';
import { createFlair } from './flair3d.js';
import { createLevels, itemLevel } from './levels.js';
import { createWallet, dailyLimit, RATE } from './wallet.js';
import { CATALOG } from './avatar.js';
import { createGoals, PERKS, BOOTH_DISCOUNT } from './goals.js';
import { emit } from './events.js';
import { createPerkDecor } from './perks3d.js';
import { createRoadmap } from './roadmap.js';
import { createMap } from './map.js';
import { createBank } from './bank.js';
import { createBlackjack } from './blackjack.js';
import { createTableLife } from './tablelife.js';
import { createGirlfriend, WHO } from './girlfriend.js';
import { createNight } from './night.js';

const rand = (a, b) => a + Math.random() * (b - a);

// ---------- persistence ----------
const store = {
  get(k, d) {
    try {
      const v = localStorage.getItem(k);
      return v == null ? d : JSON.parse(v);
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {}
  },
};

const START_BALANCE = 1000;
const CHIPS = [1, 5, 25, 100, 500, 1000];

let balance = store.get('fr.balance', START_BALANCE);
let history = store.get('fr.history', []);
let session = 0;

// ---------- ⭐ levels, and 👛 the wallet (the only money the store takes) ----------
const levels = createLevels({ store, onGain: (xp) => gainedXp(xp), onLevelUp: (l) => levelledUp(l) });
// 📰 what happened tonight, for tomorrow morning's paper
const night = createNight({ store });
const wallet = createWallet({ store, level: () => levels.level() });
let pendingCash = 0; // cashed out, but still flying into the wallet
let bets = new Map();      // betKey -> amount
let actions = [];          // undo stack: { key, amount }
let lastBets = null;
let chipValue = 25;
let spinning = false;
let slots = null;          // the slot machine room, created further down
let blackjack = null;      // the blackjack room, likewise

// only one 3D room renders at a time: the phone, settings etc. pause whichever room you're in
function pause3dRooms() {
  wheel.pause();
  blackjack?.pause();
}
function resume3dRooms() {
  if (blackjack?.isOpen()) blackjack.resume();
  else if (!slots?.isOpen()) wheel.resume();
}

const $ = (id) => document.getElementById(id);
const money = (n) =>
  (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
const short = (n) => (n >= 1000 ? (n / 1000).toFixed(n % 1000 ? 1 : 0).replace('.0', '') + 'k' : String(n));

// ---------- sound ----------
const sound = {
  ctx: null,
  muted: store.get('fr.muted', false),
  ensure() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.buildDrunkBus();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },
  /** Everything (effects + music) goes through here, so being drunk warps it all. */
  bus() {
    this.ensure();
    return this.master;
  },
  // input → wobbling delay (pitch warble) → drive → muffle → out, plus a swimmy echo send
  buildDrunkBus() {
    const c = this.ctx;
    const input = (this.master = c.createGain());
    const warble = c.createDelay(0.1);
    warble.delayTime.value = 0.02;
    const lfoA = c.createOscillator();
    const lfoB = c.createOscillator();
    lfoA.frequency.value = 0.37;
    lfoB.frequency.value = 0.93;
    this.wobA = c.createGain();
    this.wobB = c.createGain();
    this.wobA.gain.value = this.wobB.gain.value = 0;
    lfoA.connect(this.wobA).connect(warble.delayTime);
    lfoB.connect(this.wobB).connect(warble.delayTime);
    lfoA.start();
    lfoB.start();

    const drive = (this.drive = c.createWaveShaper());
    drive.oversample = '2x';
    const muffle = (this.muffle = c.createBiquadFilter());
    muffle.type = 'lowpass';
    muffle.frequency.value = 20000;
    muffle.Q.value = 0.9;

    const echo = c.createDelay(1);
    echo.delayTime.value = 0.29;
    const feedback = c.createGain();
    feedback.gain.value = 0.42;
    this.echoSend = c.createGain();
    this.echoSend.gain.value = 0;

    input.connect(warble).connect(drive).connect(muffle).connect(c.destination);
    muffle.connect(this.echoSend).connect(echo).connect(feedback).connect(echo);
    echo.connect(c.destination);
    this.setDrunk(this.drunkLevel || 0);
  },
  setDrunk(level) {
    this.drunkLevel = level;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    //            sober   tipsy   buzzed  drunk   wasted
    const wob =   [0,     0.0012, 0.003,  0.0055, 0.009][level];
    const cut =   [20000, 9000,   4200,   2200,   1300][level];
    const wet =   [0,     0.06,   0.14,   0.24,   0.36][level];
    const crunch = [0,    0,      0,      8,      30][level];
    this.wobA.gain.setTargetAtTime(wob, t, 0.4);
    this.wobB.gain.setTargetAtTime(wob * 0.45, t, 0.4);
    this.muffle.frequency.setTargetAtTime(cut, t, 0.4);
    this.echoSend.gain.setTargetAtTime(wet, t, 0.4);
    if (crunch) {
      const curve = new Float32Array(1024);
      for (let i = 0; i < curve.length; i++) {
        const x = (i / (curve.length - 1)) * 2 - 1;
        curve[i] = ((1 + crunch / 10) * x) / (1 + (crunch / 10) * Math.abs(x));
      }
      this.drive.curve = curve;
    } else {
      this.drive.curve = null;
    }
  },
  blip(freq, dur, type = 'sine', vol = 0.2, delay = 0) {
    if (this.muted) return;
    const c = this.ensure();
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.bus());
    o.start(t);
    o.stop(t + dur);
  },
  tick(v) { this.blip(2200 + Math.random() * 800, 0.025, 'square', 0.03 + 0.05 * v); },
  chip() { this.blip(1100, 0.05, 'triangle', 0.15); this.blip(1600, 0.04, 'triangle', 0.08, 0.02); },
  win(level = 0) {
    // rising arpeggio, then a held major chord; bigger wins go higher and ring longer
    const notes = [523, 659, 784, 1047, 1319, 1568].slice(0, 4 + level);
    notes.forEach((f, i) => this.blip(f, 0.25, 'triangle', 0.16, i * 0.09));
    const end = notes.length * 0.09;
    [523, 659, 784, 1047].forEach((f) => this.blip(f * (level >= 2 ? 2 : 1), 1 + level * 0.4, 'triangle', 0.09, end));
    for (let i = 0; i < 6 + level * 8; i++) this.blip(rand(2200, 3600), 0.12, 'sine', 0.05, end + i * 0.07);
    if (level >= 2) this.boom(0.35);
  },
  // Continuous ball-on-wood roll: filtered noise whose level, pitch and wobble follow the ball speed.
  roll: null,
  noiseBuf() {
    const c = this.ensure();
    if (!this._noise) {
      this._noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
      const d = this._noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return this._noise;
  },
  rollUpdate(speed, trackPos) {
    const on = speed > 0 && !this.muted;
    if (!this.roll) {
      if (!on) return;
      const c = this.ensure();
      const src = c.createBufferSource();
      src.buffer = this.noiseBuf();
      src.loop = true;
      // bright "whirr" of the ball on the polished track
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 1.4;
      const whirr = c.createGain();
      whirr.gain.value = 0;
      // low rumble through the wooden bowl
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 160;
      const rumble = c.createGain();
      rumble.gain.value = 0;
      // wobble once per lap, as the ball passes you
      const wob = c.createGain();
      const lfo = c.createOscillator();
      const lfoDepth = c.createGain();
      lfoDepth.gain.value = 0.35;
      lfo.connect(lfoDepth).connect(wob.gain);
      src.connect(bp).connect(whirr).connect(wob);
      src.connect(lp).connect(rumble).connect(wob);
      wob.connect(this.bus());
      src.start();
      lfo.start();
      this.roll = { c, src, lfo, bp, whirr, rumble };
    }
    const { c, bp, whirr, rumble, lfo } = this.roll;
    const t = c.currentTime;
    const s = on ? speed : 0;
    whirr.gain.setTargetAtTime(on ? 0.025 + 0.13 * s * (0.5 + 0.5 * trackPos) : 0, t, 0.06);
    rumble.gain.setTargetAtTime(on ? 0.15 + 0.3 * s : 0, t, 0.08);
    bp.frequency.setTargetAtTime(500 + 2600 * s * (0.6 + 0.4 * trackPos), t, 0.08);
    lfo.frequency.setTargetAtTime(1 + 4 * s, t, 0.1);
    if (!on) {
      const r = this.roll;
      this.roll = null;
      setTimeout(() => { r.src.stop(); r.lfo.stop(); }, 400);
    }
  },
  clack() {
    // wooden "tock" as the ball hits a diamond deflector
    if (this.muted) return;
    const c = this.ensure();
    const t = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf();
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1500;
    bp.Q.value = 3;
    const g = c.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    src.connect(bp).connect(g).connect(this.bus());
    src.start(t, Math.random(), 0.1);
    this.blip(820, 0.06, 'sine', 0.2);
    this.blip(1250, 0.05, 'triangle', 0.1, 0.09);
  },
  boom(vol = 0.5, delay = 0) {
    if (this.muted) return;
    const c = this.ensure();
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(30, t + 1.2);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    o.connect(g).connect(this.bus());
    o.start(t);
    o.stop(t + 1.6);
  },
  died() {
    // deep impact followed by a slow, mournful drone
    if (this.muted) return;
    this.boom(0.7);
    const c = this.ensure();
    const t = c.currentTime + 0.15;
    [[73.4, 'sawtooth', 0.05], [110, 'triangle', 0.08], [87.3, 'sine', 0.1]].forEach(([f, type, vol]) => {
      const o = c.createOscillator();
      const g = c.createGain();
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 600;
      o.type = type;
      o.frequency.setValueAtTime(f, t);
      o.frequency.linearRampToValueAtTime(f * 0.94, t + 3.5);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.9);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 3.8);
      o.connect(lp).connect(g).connect(this.bus());
      o.start(t);
      o.stop(t + 3.9);
    });
  },
  cash() { [880, 1320, 1760].forEach((f, i) => this.blip(f, 0.15, 'sine', 0.15, i * 0.07)); },
  clink() { [2637, 3136, 2349].forEach((f, i) => this.blip(f, 0.22, 'sine', 0.05, i * 0.06)); },
  armed() {
    // two-tone alarm as the ALL IN button is armed
    for (let i = 0; i < 4; i++) this.blip(i % 2 ? 660 : 880, 0.14, 'square', 0.07, i * 0.15);
  },
  allIn() {
    // rising whoosh into a big impact
    if (this.muted) return;
    const c = this.ensure();
    const t = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(1400, t + 0.45);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.connect(g).connect(this.bus());
    o.start(t);
    o.stop(t + 0.52);
    this.boom(0.8, 0.45);
    [262, 330, 392, 523].forEach((f) => this.blip(f, 0.9, 'sawtooth', 0.04, 0.45));
  },
};

// ---------- bet definitions ----------
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const ALL = range(1, 36);
const BETS = {};
for (let n = 0; n <= 36; n++) BETS['n' + n] = { label: String(n), covers: [n], pays: 35 };
Object.assign(BETS, {
  low:    { label: '1 to 18',  covers: range(1, 18), pays: 1 },
  high:   { label: '19 to 36', covers: range(19, 36), pays: 1 },
  even:   { label: 'EVEN',     covers: ALL.filter((n) => n % 2 === 0), pays: 1 },
  odd:    { label: 'ODD',      covers: ALL.filter((n) => n % 2 === 1), pays: 1 },
  red:    { label: 'RED',      covers: ALL.filter((n) => RED.has(n)), pays: 1 },
  black:  { label: 'BLACK',    covers: ALL.filter((n) => !RED.has(n)), pays: 1 },
  dozen1: { label: '1st 12',   covers: range(1, 12), pays: 2 },
  dozen2: { label: '2nd 12',   covers: range(13, 24), pays: 2 },
  dozen3: { label: '3rd 12',   covers: range(25, 36), pays: 2 },
  col1:   { label: '2 to 1',   covers: ALL.filter((n) => n % 3 === 1), pays: 2 },
  col2:   { label: '2 to 1',   covers: ALL.filter((n) => n % 3 === 2), pays: 2 },
  col3:   { label: '2 to 1',   covers: ALL.filter((n) => n % 3 === 0), pays: 2 },
});
// Inside bets on the lines. Board rows run 3-6-9… (top) to 1-4-7… (bottom),
// so n's upper neighbour is n+1 and its right-hand neighbour is n+3.
const split = (a, b) => (BETS[`s${a}-${b}`] = { label: `Split ${a}/${b}`, covers: [a, b], pays: 17 });
for (let n = 1; n <= 36; n++) {
  if (n <= 33) split(n, n + 3);
  if (n % 3 !== 0) split(n, n + 1);
  if (n % 3 !== 0 && n <= 33) {
    BETS['c' + n] = { label: `Corner ${n}/${n + 1}/${n + 3}/${n + 4}`, covers: [n, n + 1, n + 3, n + 4], pays: 8 };
  }
}
[1, 2, 3].forEach((n) => split(0, n));
// Streets (a column of three) and six-lines (two neighbouring columns), keyed by their lowest number
for (let n = 1; n <= 34; n += 3) {
  BETS['st' + n] = { label: `Street ${n}–${n + 2}`, covers: range(n, n + 2), pays: 11 };
  if (n <= 31) BETS['sl' + n] = { label: `Six line ${n}–${n + 5}`, covers: range(n, n + 5), pays: 5 };
}

// ---------- board ----------
const board = $('board');
const cells = {};

// Each cell gets two grid placements: the wide landscape table (--col/--row) and the
// portrait phone table (--vcol/--vrow), where 0 sits on top and numbers run down in rows of three.
function addCell(key, [col, row], [vcol, vrow], cls = '') {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'cell ' + cls;
  el.dataset.key = key;
  el.style.setProperty('--col', col);
  el.style.setProperty('--row', row);
  el.style.setProperty('--vcol', vcol);
  el.style.setProperty('--vrow', vrow);
  el.innerHTML = `<span class="label">${BETS[key].label}</span><span class="stack"></span>`;
  board.appendChild(el);
  cells[key] = el;
}

addCell('n0', ['1', '1 / 4'], ['3 / 6', '1'], 'num green zero');
for (let n = 1; n <= 36; n++) {
  addCell(
    'n' + n,
    [String(Math.ceil(n / 3) + 1), String(3 - ((n - 1) % 3))],
    [String(3 + ((n - 1) % 3)), String(1 + Math.ceil(n / 3))],
    'num ' + colorOf(n)
  );
}
addCell('col3', ['14', '1'], ['5', '14'], 'outside');
addCell('col2', ['14', '2'], ['4', '14'], 'outside');
addCell('col1', ['14', '3'], ['3', '14'], 'outside');
[1, 2, 3].forEach((k) =>
  addCell('dozen' + k, [`${4 * k - 2} / ${4 * k + 2}`, '4'], ['2', `${4 * k - 2} / span 4`], 'outside side')
);
['low', 'even', 'red', 'black', 'odd', 'high'].forEach((k, i) =>
  addCell(
    k,
    [`${2 + 2 * i} / ${4 + 2 * i}`, '5'],
    ['1', `${2 + 2 * i} / span 2`],
    'outside side ' + (k === 'red' || k === 'black' ? 'swatch ' + k : '')
  )
);
cells.red.querySelector('.label').innerHTML = '<i class="diamond red"></i>';
cells.black.querySelector('.label').innerHTML = '<i class="diamond black"></i>';

// Hotspots sitting on the lines of a number cell (right edge, top edge, top-right corner, left edge)
function addHotspot(key, n, where) {
  const el = document.createElement('span');
  el.className = 'hot ' + where;
  el.dataset.key = key;
  el.innerHTML = '<span class="stack"></span>';
  cells['n' + n].appendChild(el);
  cells[key] = el;
}
for (let n = 1; n <= 36; n++) {
  if (n <= 33) addHotspot(`s${n}-${n + 3}`, n, 'edge-r');
  if (n % 3 !== 0) addHotspot(`s${n}-${n + 1}`, n, 'edge-t');
  if (BETS['c' + n]) addHotspot('c' + n, n, 'corner');
}
[1, 2, 3].forEach((n) => addHotspot(`s0-${n}`, n, 'edge-l'));
// Streets / six-lines sit on the bottom edge of the bottom row (1, 4, 7 …)
for (let n = 1; n <= 34; n += 3) {
  addHotspot('st' + n, n, 'edge-b');
  if (BETS['sl' + n]) addHotspot('sl' + n, n, 'corner-b');
}

const betTarget = (e) => e.target.closest('[data-key]');
board.addEventListener('click', (e) => {
  const t = betTarget(e);
  if (!t) return;
  let key = t.dataset.key;
  // a drunk hand doesn't always land where it aimed
  if (!spinning && Math.random() < booze.missChance()) {
    const missed = drunkMiss(key);
    if (missed !== key) {
      key = missed;
      toast(`*hic* ${BETS[key].label}… close enough 🥴`);
    }
  }
  if (allIn) return goAllIn(key);
  let amount = chipValue;
  if (booze.level() >= 3 && Math.random() < 0.25) {
    const up = CHIPS[CHIPS.indexOf(chipValue) + 1];
    if (up && up <= balance) {
      amount = up;
      toast(`Big spender! You meant ${money(up)}, right? 🥴`);
    }
  }
  placeBet(key, amount);
});
// Where a wobbly chip ends up: a neighbouring number, or some other even-money bet
function drunkMiss(key) {
  const b = BETS[key];
  if (b.covers.length > 6) return pick(['red', 'black', 'odd', 'even', 'low', 'high'].filter((k) => k !== key));
  const n = b.covers[0];
  const near = n === 0 ? [1, 2, 3] : [n - 3, n + 3, n % 3 !== 0 ? n + 1 : n - 1, n % 3 !== 1 ? n - 1 : n + 1].filter((v) => v >= 1 && v <= 36);
  return 'n' + pick(near);
}
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
board.addEventListener('contextmenu', (e) => {
  const t = betTarget(e);
  if (!t) return;
  e.preventDefault();
  removeBet(t.dataset.key);
});
board.addEventListener('mouseover', (e) => {
  const t = betTarget(e);
  board.querySelectorAll('.covered').forEach((c) => c.classList.remove('covered'));
  if (t && BETS[t.dataset.key].covers.length > 1) {
    BETS[t.dataset.key].covers.forEach((n) => cells['n' + n].classList.add('covered'));
  }
});
board.addEventListener('mouseleave', () =>
  board.querySelectorAll('.covered').forEach((c) => c.classList.remove('covered'))
);

// ---------- chips: rack, spot stacks, flying chips ----------
// What is *drawn* can lag the real state while chips are in the air; once nothing
// is flying, render() snaps the drawing back to the real balance and bets.
const shown = { bank: balance, spots: new Map() };
let inflight = 0;

const DESC = [...CHIPS].reverse();
function breakdown(amount) {
  const out = [];
  let a = Math.floor(amount);
  for (const c of DESC) while (a >= c) { out.push(c); a -= c; }
  return out;
}
function countsOf(amount) {
  const m = {};
  let a = Math.floor(Math.max(0, amount));
  for (const c of DESC) { m[c] = Math.floor(a / c); a -= m[c] * c; }
  return m;
}
// Split an amount into at most `max` flying chips (the last one carries any remainder)
function pieces(amount, max = 6) {
  const b = breakdown(amount);
  if (b.length <= max) return b.map((v) => ({ value: v, denom: v }));
  const head = b.slice(0, max - 1).map((v) => ({ value: v, denom: v }));
  head.push({ value: b.slice(max - 1).reduce((s, v) => s + v, 0), denom: b[max - 1] });
  return head;
}

// Rack: one column per denomination, doubling as the chip picker
const rackCols = {};
const RACK_VISIBLE = 14;
CHIPS.forEach((v) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'rack-col';
  b.dataset.value = v;
  b.innerHTML = `<span class="rack-stack"></span><span class="rack-count"></span>`;
  b.addEventListener('click', () => {
    chipValue = v;
    renderRack();
  });
  $('rackCols').appendChild(b);
  rackCols[v] = b;
});

function renderRack() {
  const counts = countsOf(shown.bank);
  CHIPS.forEach((v) => {
    const col = rackCols[v];
    const vis = Math.min(counts[v], RACK_VISIBLE);
    const stack = col.querySelector('.rack-stack');
    if (stack.childElementCount !== vis) {
      stack.innerHTML = Array.from({ length: vis }, (_, i) => `<i class="pchip c${v}" style="--i:${i}"></i>`).join('');
    }
    col.querySelector('.rack-count').innerHTML = `<b>${short(v)}</b>×${counts[v]}`;
    col.classList.toggle('active', v === chipValue);
    col.classList.toggle('empty', v > balance);
    col.title = `${money(v)} chips: ${counts[v]}`;
  });
  $('rackTotal').textContent = money(shown.bank);
}

function renderSpot(key) {
  const amt = shown.spots.get(key) || 0;
  const stack = cells[key].querySelector('.stack');
  if (amt <= 0) {
    stack.innerHTML = '';
    return;
  }
  const chips = breakdown(amt).slice(0, 7).reverse(); // biggest chip on top
  stack.innerHTML =
    chips.map((c, i) => `<i class="schip c${c}" style="--i:${i}"></i>`).join('') +
    `<span class="stack-label" style="--n:${chips.length - 1}">${short(amt)}</span>`;
}
function addSpot(key, v) {
  shown.spots.set(key, (shown.spots.get(key) || 0) + v);
  renderSpot(key);
}
function addBank(v) {
  shown.bank += v;
  renderRack();
}

const centerOf = (el) => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};
const rackPoint = (v) => () => {
  const r = rackCols[v].querySelector('.rack-stack').getBoundingClientRect();
  const n = Math.min(countsOf(shown.bank)[v], RACK_VISIBLE);
  return { x: r.left + r.width / 2, y: r.bottom - 12 - n * 5 };
};
const dealerPoint = () => {
  const r = $('wheel').getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height * 0.5 };
};
const resolvePoint = (p) => (p instanceof Element ? centerOf(p) : typeof p === 'function' ? p() : p);

/** Throw one chip along an arc from `from` to `to` (elements, points or point getters). */
function fly(from, to, denom, { delay = 0, onStart, onLand, fade = false } = {}) {
  inflight++;
  setTimeout(() => {
    onStart?.();
    const a = resolvePoint(from);
    const b = resolvePoint(to);
    const el = document.createElement('i');
    el.className = `fly-chip c${denom}`;
    document.body.appendChild(el);
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const mid = { x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - Math.min(170, 50 + dist * 0.25) };
    const spin = (Math.random() < 0.5 ? -1 : 1) * 360;
    const frames = [];
    for (let k = 0; k <= 10; k++) {
      const t = k / 10;
      const x = (1 - t) ** 2 * a.x + 2 * (1 - t) * t * mid.x + t * t * b.x;
      const y = (1 - t) ** 2 * a.y + 2 * (1 - t) * t * mid.y + t * t * b.y;
      const s = 1 + 0.35 * Math.sin(Math.PI * t);
      frames.push({
        transform: `translate(${x - 17}px, ${y - 17}px) scale(${s}) rotate(${spin * t}deg)`,
        opacity: fade && t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1,
      });
    }
    const dur = 380 + Math.min(260, dist * 0.25);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      el.remove();
      onLand?.();
      if (--inflight === 0) render();
    };
    el.animate(frames, { duration: dur, easing: 'cubic-bezier(0.4, 0, 0.3, 1)' }).onfinish = finish;
    setTimeout(finish, dur + 400); // in case animations are throttled (background tab)
  }, delay);
}

/** Chips leave the rack and land on a betting spot. */
function throwToSpot(key, amount, delay = 0, maxChips = 6) {
  addBank(-amount);
  pieces(amount, maxChips).forEach((p, i) =>
    fly(rackPoint(p.denom)(), cells[key], p.denom, {
      delay: delay + i * 70,
      onLand: () => {
        addSpot(key, p.value);
        sound.chip();
      },
    })
  );
}
/** Chips on a spot go back to the rack. */
function returnToRack(key, amount, delay = 0) {
  pieces(amount).forEach((p, i) =>
    fly(cells[key], rackPoint(p.denom), p.denom, {
      delay: delay + i * 60,
      onStart: () => addSpot(key, -p.value),
      onLand: () => {
        addBank(p.value);
        sound.chip();
      },
    })
  );
}

// ---------- betting actions ----------
const totalBets = () => [...bets.values()].reduce((a, b) => a + b, 0);

function clearHighlights() {
  board.querySelectorAll('.winner, .won, .lost').forEach((c) => c.classList.remove('winner', 'won', 'lost'));
}

function placeBet(key, amount = chipValue, record = true, delay = 0, maxChips = 6) {
  if (spinning) return false;
  if (balance < amount) {
    toast('Not enough balance: add some fake funds in the 📱 🏦 Bank');
    nudgeBank();
    return false;
  }
  clearHighlights();
  balance -= amount;
  bets.set(key, (bets.get(key) || 0) + amount);
  if (record) actions.push({ key, amount });
  throwToSpot(key, amount, delay, maxChips);
  render();
  return true;
}

function removeBet(key) {
  if (spinning || !bets.has(key)) return;
  const amt = bets.get(key);
  balance += amt;
  bets.delete(key);
  actions = actions.filter((a) => a.key !== key);
  returnToRack(key, amt);
  render();
}

$('undoBtn').addEventListener('click', () => {
  if (spinning || !actions.length) return;
  const { key, amount } = actions.pop();
  const left = bets.get(key) - amount;
  left > 0 ? bets.set(key, left) : bets.delete(key);
  balance += amount;
  returnToRack(key, amount);
  render();
});

$('clearBtn').addEventListener('click', () => {
  if (spinning) return;
  [...bets.entries()].forEach(([key, amt], i) => returnToRack(key, amt, i * 50));
  balance += totalBets();
  bets.clear();
  actions = [];
  render();
});

$('rebetBtn').addEventListener('click', () => {
  if (spinning || !lastBets) return;
  const need = [...lastBets.values()].reduce((a, b) => a + b, 0);
  if (need > balance) return toast(`Rebet needs ${money(need)} — you have ${money(balance)}`);
  [...lastBets.entries()].forEach(([key, amt], i) => placeBet(key, amt, true, i * 90));
});

// ---------- ALL IN ----------
let allIn = false;
function setAllIn(on) {
  allIn = on;
  const b = $('allInBtn');
  b.classList.toggle('armed', on);
  b.setAttribute('aria-pressed', String(on));
  board.classList.toggle('allin-armed', on);
  b.disabled = !on && (spinning || balance < 1);
}
$('allInBtn').addEventListener('click', () => {
  if (spinning) return;
  if (allIn) return setAllIn(false);
  if (balance < 1) return toast('Nothing left to go all in with — add some fake funds');
  setAllIn(true);
  sound.armed();
  toast(`ALL IN armed — your next spot gets all ${money(balance)}`);
});
function goAllIn(key) {
  const amount = balance;
  setAllIn(false);
  if (amount < 1) return;
  placeBet(key, amount, true, 0, 12);
  sound.allIn();
  document.querySelectorAll('header, main').forEach((el) => {
    el.classList.remove('shake-2');
    void el.offsetWidth;
    el.classList.add('shake-2');
    setTimeout(() => el.classList.remove('shake-2'), 1000);
  });
  toast(`ALL IN! ${money(amount)} on ${BETS[key].label}`);
}

$('doubleBtn').addEventListener('click', () => {
  if (spinning || !bets.size) return;
  const need = totalBets();
  if (need > balance) return toast(`Doubling needs another ${money(need)}`);
  [...bets.entries()].forEach(([key, amt], i) => placeBet(key, amt, true, i * 90));
});

// ---------- spin ----------
const wheel = new RouletteWheel($('wheel'), {
  onTick: (v) => sound.tick(v),
  onRoll: (speed, trackPos) => sound.rollUpdate(speed, trackPos),
  onClack: () => sound.clack(),
});
// Frames stop while the tab is hidden, so don't leave the roll droning
document.addEventListener('visibilitychange', () => document.hidden && sound.rollUpdate(0, 0));

function randomNumber() {
  // unbiased 0..36 using the crypto RNG
  const buf = new Uint32Array(1);
  const limit = Math.floor(0xffffffff / 37) * 37;
  do crypto.getRandomValues(buf);
  while (buf[0] >= limit);
  return buf[0] % 37;
}

$('spinBtn').addEventListener('click', spin);
document.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && allIn) return setAllIn(false);
  if ((e.code === 'Space' || e.code === 'Escape') && fxActive()) {
    e.preventDefault();
    return dismissFx();
  }
  if (blackjack?.isOpen()) return blackjack.key(e);
  if (slots?.isOpen()) {
    // in the slots room: Space pulls the lever, Escape walks back to roulette
    if (e.code === 'Space') {
      e.preventDefault();
      slots.spin(true);
    } else if (e.code === 'Escape') slots.hide();
    return;
  }
  if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT') {
    e.preventDefault();
    spin();
  }
});

async function spin() {
  if (spinning) return;
  if (!bets.size) return toast('Place a bet first');
  const min = perkMin();
  if (totalBets() < min) return toast(`${goals.perk('whale') ? '🐋 Whale mode' : '🎩 The high-roller table'}: minimum ${money(min)} a spin. You have ${money(totalBets())} down.`);
  sound.ensure();
  setAllIn(false);
  spinning = true;
  lastBets = new Map(bets);
  hideResult();
  render();
  // On phones the table sits below the wheel, so bring the wheel into view for the spin
  if (matchMedia('(max-width: 700px)').matches) {
    document.querySelector('.stage').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const result = await wheel.spin(randomNumber());
  settle(result);
}

function settle(n) {
  const staked = totalBets();
  const straight = bets.has('n' + n);
  let returned = 0;
  [...bets.entries()].forEach(([key, amt], k) => {
    const win = BETS[key].covers.includes(n);
    cells[key].classList.add(win ? 'won' : 'lost');
    if (win) {
      // dealer pays out onto the spot, then the whole stack comes home to the rack
      const payout = amt * BETS[key].pays;
      returned += amt + payout;
      pieces(payout, 5).forEach((p, i) =>
        fly(dealerPoint, cells[key], p.denom, {
          delay: 300 + k * 90 + i * 80,
          onLand: () => { addSpot(key, p.value); sound.chip(); },
        })
      );
      pieces(amt + payout, 8).forEach((p, i) =>
        fly(cells[key], rackPoint(p.denom), p.denom, {
          delay: 1500 + k * 90 + i * 70,
          onStart: () => addSpot(key, -p.value),
          onLand: () => { addBank(p.value); sound.chip(); },
        })
      );
    } else {
      // losing chips are swept off to the wheel
      pieces(amt, 5).forEach((p, i) =>
        fly(cells[key], dealerPoint, p.denom, {
          delay: 600 + k * 60 + i * 60,
          onStart: () => addSpot(key, -p.value),
          fade: true,
        })
      );
    }
  });
  bets.clear();
  actions = [];
  cells['n' + n].classList.add('winner');
  const net = returned - staked;
  balance += returned;
  session += net;
  levels.bet(net > 0 ? 'win' : net < 0 ? 'loss' : 'push', staked, returned / staked, perkMult() * life.xpMult());
  emit('spin', { game: 'roulette', net, staked, multiple: returned / staked, straight });
  life.onSpin(net);

  history.unshift(n);
  history = history.slice(0, 18);
  store.set('fr.history', history);

  showResult(n, net, returned);
  dave.onSpin(net);
  if (net > 0) {
    const level = winLevel(net, staked);
    const r = cells['n' + n].getBoundingClientRect();
    celebrate({ net, level, origin: { x: innerWidth / 2, y: Math.min(r.top, innerHeight * 0.4) } });
    wheel.flash(level);
    sound.win(level);
    music.duck(0.35, 2 + level);
  } else if (net < 0) {
    setTimeout(() => {
      youDied({ lost: -net, broke: balance < 1 });
      sound.died();
      music.duck(0, 4);
    }, 350);
  }

  setTimeout(() => {
    spinning = false;
    render();
    if (balance < 1) {
      emit('broke');
      toast('Out of chips! Watch an ad for $100, or top up with a fake card in the 📱 🏦 Bank 📺');
      nudgeBank();
    }
  }, 1800);
  render();
}

function showResult(n, net, returned) {
  const el = $('result');
  const c = colorOf(n);
  const text =
    net > 0 ? `<span>You win <b>${money(net)}</b></span>` :
    net < 0 ? (returned ? `<span>Back ${money(returned)} · net <b>${money(net)}</b></span>` : `<span>You lose <b>${money(-net)}</b></span>`) :
    '<span>Push — you broke even</span>';
  el.className = 'result show ' + (net > 0 ? 'win' : net < 0 ? 'lose' : '');
  el.innerHTML = `<div class="ball-num ${c}">${n}</div>
    <div class="result-text"><small>${c.toUpperCase()}${n ? ' · ' + (n % 2 ? 'ODD' : 'EVEN') : ''}</small>${text}</div>`;
}
function hideResult() {
  $('result').className = 'result';
}

// ---------- render ----------
function render() {
  $('balance').textContent = money(balance);
  $('onTable').textContent = money(totalBets());
  renderProgress();
  const s = $('session');
  s.textContent = (session > 0 ? '+' : '') + money(session);
  s.className = session > 0 ? 'pos' : session < 0 ? 'neg' : '';

  if (!inflight) {
    shown.bank = balance;
    shown.spots = new Map(bets);
  }
  for (const key in cells) {
    const amt = bets.get(key);
    renderSpot(key);
    cells[key].title = amt
      ? `${BETS[key].label}: ${money(amt)} (pays ${BETS[key].pays}:1)`
      : `${BETS[key].label} — pays ${BETS[key].pays}:1`;
  }

  $('history').innerHTML = history
    .map((n, i) => `<span class="h ${colorOf(n)}${i === 0 ? ' latest' : ''}">${n}</span>`)
    .join('');

  $('spinBtn').disabled = spinning || !bets.size;
  $('spinBtn').textContent = spinning ? 'No more bets…' : 'SPIN';
  $('undoBtn').disabled = spinning || !actions.length;
  $('clearBtn').disabled = spinning || !bets.size;
  $('rebetBtn').disabled = spinning || !lastBets;
  $('doubleBtn').disabled = spinning || !bets.size;
  board.classList.toggle('locked', spinning);
  $('allInBtn').disabled = !allIn && (spinning || balance < 1);
  // only shown when you're completely broke: $0 and nothing on the felt
  $('adBtn').hidden = !(balance === 0 && !bets.size && !spinning);
  slots?.refresh();
  renderRack();

  // Stakes still on the felt count as yours until the wheel is spun
  store.set('fr.balance', spinning ? balance : balance + totalBets());
}

// ---------- toast ----------
let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  // It's a popover, so it lives in the top layer. Re-showing it puts it back on top of any
  // modal dialog (like the drinks menu) that opened after it, instead of behind the backdrop.
  if (t.showPopover) {
    try {
      if (t.matches(':popover-open')) t.hidePopover();
      t.showPopover();
    } catch {}
  }
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

// ---------- sound effects and lobby music (switches in 📱 Settings) ----------
function setMuted(on) {
  sound.muted = on;
  store.set('fr.muted', on);
}
const music = new LobbyMusic(() => sound.ensure(), () => sound.bus());
let musicOn = store.get('fr.music', true);
function setMusic(on) {
  musicOn = on;
  store.set('fr.music', on);
  on ? music.start() : music.stop();
}
// Browsers only allow audio after a user gesture, so start on the first one.
const kickoff = () => {
  if (musicOn) music.start();
  removeEventListener('pointerdown', kickoff);
  removeEventListener('keydown', kickoff);
};
addEventListener('pointerdown', kickoff);
addEventListener('keydown', kickoff);

// ---------- 💳 fake funds (paid for in the 🏦 Bank app on your phone) ----------
function deposit(amount) {
  balance += amount;
  // once the phone is away, the cashier's chips fly into your rack
  pieces(amount, 10).forEach((p, i) =>
    fly($('phoneBtn'), rackPoint(p.denom), p.denom, {
      delay: 1950 + i * 90,
      onLand: () => { addBank(p.value); sound.chip(); },
    })
  );
  render();
}

function resetBalance() {
  if (spinning) return false;
  if (!confirm(`Reset balance to ${money(START_BALANCE)} and clear history?`)) return false;
  bets.clear();
  actions = [];
  lastBets = null;
  balance = START_BALANCE;
  session = 0;
  history = [];
  store.set('fr.history', history);
  clearHighlights();
  hideResult();
  render();
  return true;
}

// ---------- 🍸 free drinks (not for you) ----------
const booze = createBar({
  stage: document.querySelector('.stage'),
  store,
  sound,
  toast,
  getBalance: () => balance,
  spend: (v) => {
    balance -= v;
    render();
  },
});
startWaiter({
  stage: document.querySelector('.stage'),
  canWalk: () => !fxActive() && !document.body.classList.contains('bonus-active') && !['vip-party-on', 'kitchen-on', 'hangover-on', 'phone-on', 'in-blackjack'].some((c) => document.body.classList.contains(c)) && !slots?.isOpen(),
  onClink: () => sound.clink(),
  pickDrink: booze.pickDrink,
  getTarget: booze.target,
  onDrink: booze.add,
  onBusy: booze.blackedOut,
});

// ---------- 🧾 the bar tab (and the sink, for when you can't pay it) ----------
const tab = createTab({
  store,
  sound,
  music,
  toast,
  booze,
  getBalance: () => balance,
  spend: (v) => {
    balance -= v;
    render();
  },
  earn: (v) => {
    balance += v;
    render();
  },
  pause3d: () => pause3dRooms(),
  resume3d: () => resume3dRooms(),
  isBusy: () =>
    spinning || fxActive() || !!document.querySelector('dialog[open]') ||
    ['vip-party-on', 'bonus-active', 'hangover-on', 'phone-on', 'in-blackjack'].some((c) => document.body.classList.contains(c)),
});

// chips off your rack, flying to someone on screen (Dave, Grandma, a UFO), and back again
function takeChips(amount, to) {
  if (spinning || balance < amount) return false;
  balance -= amount;
  pieces(amount, 4).forEach((p, i) =>
    fly(rackPoint(p.denom), to, p.denom, { delay: i * 90, fade: true, onStart: () => addBank(-p.value) })
  );
  sound.chip();
  render();
  return true;
}
function giveChips(amount, from) {
  balance += amount;
  fly(from, rackPoint(1), 1, { onLand: () => { addBank(amount); sound.cash(); } });
  render();
}

// ---------- 🍺 Dave (he remembers you) ----------
const dave = createDave({
  wheel,
  stage: document.querySelector('.stage'),
  store,
  sound,
  toast,
  booze,
  getBalance: () => balance,
  // he takes chips straight off your rack. he's good for it.
  borrow: takeChips,
  repay: giveChips,
  // (an angry Dave doesn't care that your phone is out: he closes it and comes over anyway)
  isIdle: (ignorePhone = false) =>
    !spinning && !fxActive() && !slots?.isOpen() && !document.querySelector('dialog[open]') &&
    !['vip-party-on', 'bonus-active', 'kitchen-on', 'hangover-on', 'in-blackjack'].some((c) => document.body.classList.contains(c)) &&
    (ignorePhone || !document.body.classList.contains('phone-on')),
  onSpill: () => {
    document.body.classList.add('sticky-table');
    clearTimeout(stickyTimer);
    stickyTimer = setTimeout(() => document.body.classList.remove('sticky-table'), 40000);
  },
});
let stickyTimer = null;

// ---------- 🤕 the morning after ----------
const hangover = createHangover({
  store,
  sound,
  toast,
  booze,
  dave,
  getBalance: () => balance,
  spend: (v) => {
    balance -= v;
    render();
  },
  pause3d: () => pause3dRooms(),
  resume3d: () => resume3dRooms(),
  morning: () => morningInfo(),
  setLoud: (on) => {
    if (!sound.ctx) return;
    sound.master.gain.setTargetAtTime(on ? 1.9 : 1, sound.ctx.currentTime, 0.3);
  },
});

// ---------- 📱 your style, the store and the settings: apps on your phone ----------
const prefs = {
  banners: store.get('fr.pref.banners', true),
  reduceMotion: store.get('fr.pref.motion', false),
};
document.body.classList.toggle('reduce-motion', prefs.reduceMotion);
// your win style, flying out over every win (roulette and slots)
const flair = createFlair();
let phone = null; // created further down; the store plays ringtones through it

// ---------- 🏆 daily challenges, achievements, the loyalty card, level perks ----------
const goals = createGoals({
  store,
  levels,
  wallet,
  toast,
  sound,
  flair,
  onChange: () => {
    refreshApps();
    renderProgress();
  },
  onPerks: () => applyPerks(),
});
const decor = createPerkDecor(wheel);
// the high-roller table and whale mode: a minimum bet, more XP, and the look
const perkMin = () => (goals.perk('whale') ? 1000 : goals.perk('highroller') ? 100 : 0);
const perkMult = () => (goals.perk('whale') ? 2 : goals.perk('highroller') ? 1.5 : 1);
function applyPerks() {
  const hr = goals.perk('highroller');
  const whale = goals.perk('whale');
  decor.set({ highroller: hr, whale });
  document.body.classList.toggle('high-roller', hr);
  document.body.classList.toggle('whale-mode', whale);
}
applyPerks();

const settings = createSettings({
  preview: {
    tone: (id) => phone?.playTone(id),
    win: (id) => id !== 'classic' ? flair.burst(id, { x: innerWidth * 0.35, y: innerHeight * 0.45 }, 2) : toast('🪙 The classic: coins and confetti, like always.'),
  },
  store,
  sound,
  toast,
  wallet,
  levels,
  goals,
  openApp: (id) => phone?.open(id),
  prefs: [
    { id: 'sfx', label: '🔊 Sound effects', desc: 'Chips, spins, dings, Dave.', get: () => !sound.muted, set: (on) => setMuted(!on) },
    { id: 'music', label: '🎵 Lobby music', desc: 'The big band, and your bottle-party songs.', get: () => musicOn, set: (on) => setMusic(on) },
    {
      id: 'banners',
      label: "📱 Dave's text banners",
      desc: 'Pop-ups when Dave texts. His texts still land on your phone.',
      get: () => prefs.banners,
      set: (on) => {
        prefs.banners = on;
        store.set('fr.pref.banners', on);
      },
    },
    {
      id: 'dating',
      label: '💋 Who you date',
      desc: 'Girlfriend, boyfriend or partner: changes the names, looks and words.',
      options: WHO,
      get: () => store.get('fr.gf.who', 'her'),
      set: (v) => {
        store.set('fr.gf.who', v);
        gf?.restyle();
      },
    },
    {
      id: 'motion',
      label: '🌀 Reduce motion',
      desc: 'No screen shake, drunk swaying or walking head-bob.',
      get: () => prefs.reduceMotion,
      set: (on) => {
        prefs.reduceMotion = on;
        store.set('fr.pref.motion', on);
        document.body.classList.toggle('reduce-motion', on);
      },
    },
  ],
});
// the wallet or your level changed: redraw whichever app is showing
function refreshApps() {
  settings.refresh();
  phone?.refresh('bank');
}

setWinFlair(({ level, origin }) => {
  const style = settings.look().winFx;
  if (style && style !== 'classic') flair.burst(style, origin, level);
});

function renderProgress() {
  $('walletAmt').textContent = money(wallet.cash() - pendingCash);
  const p = levels.progress();
  const chip = $('lvlChip');
  chip.querySelector('b').textContent = p.level;
  chip.style.setProperty('--p', (p.into / p.need).toFixed(3));
  chip.title = `Level ${p.level} · ${p.into} / ${p.need} XP to level ${p.level + 1}. Tap for your goals.`;
}

// ---------- 🏦 JackpotBank, on your phone: cash out chips to your wallet, add (fake) funds ----------
const bank = createBank({
  sound,
  toast,
  wallet,
  levels,
  phone: () => phone,
  getBalance: () => balance,
  onTable: totalBets,
  pending: () => pendingCash,
  deposit,
  reset: resetBalance,
  startBalance: START_BALANCE,
  // chips → wallet money, up to today's limit: the bills fly into the wallet card
  cashOut(want, toEl) {
    const n = wallet.withdraw(Math.min(want, Math.floor(balance / RATE)));
    if (!n) return 0;
    balance -= n * RATE;
    pendingCash += n;
    render();
    sound.cash();
    emit('cashout', { amount: n });
    const to = toEl || $('walletBtn');
    flair.cashOut({
      fromEl: $('balance'),
      toEl: to,
      amount: n * RATE,
      onDone: () => {
        pendingCash -= n;
        renderProgress();
        refreshApps();
        sound.chip();
        to.animate([{ scale: 1 }, { scale: 1.08 }, { scale: 1 }], { duration: 350, easing: 'ease-out' });
      },
    });
    toast(`👛 ${money(n * RATE)} in chips swapped for ${money(n)} in your wallet. The store is open.`);
    return n;
  },
});
// you're broke: the Bank app gets a badge, and the phone button a nudge
function nudgeBank() {
  bank.nudge();
  const b = $('phoneBtn');
  b.classList.remove('pulse');
  void b.offsetWidth;
  b.classList.add('pulse');
}
$('walletBtn').addEventListener('click', () => phone.open('bank'));
$('lvlChip').addEventListener('click', () => phone.open('goals'));

// every bet: a little +XP by your level
function gainedXp(xp) {
  renderProgress();
  const r = $('lvlChip').getBoundingClientRect();
  if (!r.width) return;
  const f = document.createElement('div');
  f.className = 'xp-float';
  f.textContent = `+${xp} XP`;
  f.style.left = `${r.left + r.width / 2}px`;
  f.style.top = `${r.bottom + 2}px`;
  document.body.appendChild(f);
  f.animate(
    [
      { opacity: 0, transform: 'translate(-50%, 0)' },
      { opacity: 1, transform: 'translate(-50%, 6px)', offset: 0.2 },
      { opacity: 0, transform: 'translate(-50%, 26px)' },
    ],
    { duration: 1400, easing: 'ease-out' }
  ).onfinish = () => f.remove();
}

// a new level: a medal, a fanfare, and whatever it unlocked
function levelledUp(l) {
  const unlocked = CATALOG.filter((c) => c.price > 0 && itemLevel(c) === l);
  const perk = PERKS.find((p) => p.level === l);
  emit('level', { level: l });
  setTimeout(() => {
    flair.levelUp(l);
    [523, 659, 784, 1047].forEach((f, i) => sound.blip(f, 0.2, 'triangle', 0.12, i * 0.1));
    const names = unlocked.slice(0, 3).map((c) => `${c.emoji} ${c.name}`).join(', ');
    toast(
      `⭐ Level ${l}! You can cash out ${money(dailyLimit(l))} a day now.` +
        (unlocked.length ? ` Unlocked: ${names}${unlocked.length > 3 ? ` +${unlocked.length - 3} more` : ''}.` : '') +
        (perk ? ` New perk: ${perk.emoji} ${perk.name} (📱 → 🏆 Goals).` : '')
    );
    refreshApps();
    applyPerks();
  }, 1200);
}

// ---------- 📱 your phone (and Marco, who delivers food to roulette tables) ----------
const courier = createCourier({ wheel, dave });

// ---------- 🧓🔥🛸 Grandma, being on fire, and the occasional UFO ----------
const life = createTableLife({
  wheel,
  store,
  toast,
  sound,
  getBalance: () => balance,
  take: takeChips,
  give: giveChips,
  onUfo: (amount) => emit('ufo', { amount }),
  onGrandma: (amount) => emit('grandma', { amount }),
});

// the morning after: the paper (then a fresh night), your hotel room, and whoever you married
function morningInfo() {
  const paper = night.headlines();
  night.reset();
  return { paper, hotel: settings.look().hotel, spouse: gf.atHome() };
}
// ---------- 💋 your date (win a couple of spins and someone comes over) ----------
const gf = createGirlfriend({
  wheel,
  store,
  sound,
  toast,
  booze,
  flair,
  wallet,
  look: () => settings.look(),
  level: () => levels.level(),
  getBalance: () => balance,
  // dates are paid in chips
  spend: (v) => {
    if (spinning || balance < v) return false;
    balance -= v;
    render();
    return true;
  },
});

phone = createPhone({
  gf,
  button: $('phoneBtn'),
  store,
  sound,
  toast,
  booze,
  dave,
  hangover,
  settings,
  courier,
  getBalance: () => balance,
  spend: (v) => {
    balance -= v;
    render();
  },
  pause3d: () => pause3dRooms(),
  resume3d: () => resume3dRooms(),
  canOpen: () =>
    !spinning && !fxActive() && !document.querySelector('dialog[open]') &&
    !['vip-party-on', 'bonus-active', 'kitchen-on', 'hangover-on'].some((c) => document.body.classList.contains(c)),
  roomVisible: () => !slots?.isOpen() && !blackjack?.isOpen(),
  bannersOn: () => prefs.banners,
});

// ---------- 🍾 drinks menu + VIP bottle service ----------
createVip({
  tab,
  onDave: () => dave.meet('party'),
  button: $('drinksBtn'),
  sound,
  music,
  musicOn: () => musicOn,
  toast,
  booze,
  getBalance: () => balance,
  spend: (v) => {
    balance -= v;
    render();
  },
  onBroke: () => nudgeBank(),
  onBuy: (price, bottle) => {
    levels.drink(price, bottle);
    emit('drink', { price, bottle });
  },
  discount: () => (goals.perk('booth') ? BOOTH_DISCOUNT : 0),
});

// ---------- 🎰 SLOTS (DING DING DING) ----------
slots = createSlots({
  host: document.querySelector('main'),
  sound,
  music,
  toast,
  getBalance: () => balance,
  adjust: (delta) => {
    balance += delta;
    render();
  },
  onBet: (outcome, stake, multiple) => {
    levels.bet(outcome, stake, multiple);
    if (outcome !== 'placed') emit('spin', { game: 'slots', net: stake * multiple - stake, staked: stake, multiple });
  },
  onOpen: () => {
    setAllIn(false);
    // only one 3D room renders at a time
    setTimeout(() => slots.isOpen() && wheel.pause(), 1700);
  },
  onClose: () => wheel.resume(),
});
// ---------- 🃏 BLACKJACK, with a very smug dealer ----------
blackjack = createBlackjack({
  sound,
  toast,
  getBalance: () => balance,
  adjust: (delta) => {
    balance += delta;
    render();
  },
  onOpen: () => {
    setAllIn(false);
    wheel.pause(); // only one 3D room renders at a time
  },
  onClose: () => wheel.resume(),
  booze,
  highLimit: () => goals.perk('highlimit'),
  onRound: ({ net, staked, multiple, mult }) => {
    levels.bet(net > 0 ? 'win' : net < 0 ? 'loss' : 'push', staked, multiple, mult);
    emit('spin', { game: 'blackjack', net, staked, multiple });
    if (balance < 1) emit('broke');
  },
});

// ---------- 🗺️ getting around: the Map on your phone ----------
// You walk there on the map, so the room itself just whooshes past while the phone drops away.
function travelTo(id) {
  phone.close();
  if (blackjack.isOpen()) blackjack.close();
  if (id === 'blackjack') {
    slots.hide({ quick: true });
    scrollTo({ top: 0, behavior: 'smooth' });
    blackjack.open();
  } else if (id === 'slots') {
    scrollTo({ top: 0, behavior: 'smooth' });
    slots.show({ quick: true });
  } else if (id === 'roulette') slots.hide({ quick: true });
}

// every app on the phone (the grid, in order; dock apps sit along the bottom)
[
  settings.app('style'),
  settings.app('store'),
  settings.app('goals'),
  createRoadmap({ store, sound }),
  createMap({
    sound,
    toast,
    here: () => (blackjack.isOpen() ? 'blackjack' : slots.isOpen() ? 'slots' : 'roulette'),
    go: travelTo,
    blocked: (id) =>
      blackjack.busy() ? '🃏 Finish your hand first!' :
      slots.busy() ? '🐉 Let the reels finish first!' :
      id === 'blackjack' && spinning ? 'Hold on, the ball is still rolling! 🎡' :
      id === 'blackjack' && bets.size ? 'Take your chips off the roulette table first. 🃏' :
      '',
    look: () => settings.look(),
    daveMet: () => dave.met(),
  }),
  bank.app,
  settings.app('settings'),
].forEach((app) => phone.add(app));

// ---------- 📺 watch an ad for $100 (broke players only) ----------
const canWatchAd = () => balance === 0 && !bets.size && !spinning;
$('adBtn').addEventListener('click', () => {
  if (!canWatchAd()) return toast('Ads are only for the truly broke. Come back at $0.');
  setAllIn(false);
  watchAd({
    sound,
    music,
    onReward: (from, amount) => {
      balance += amount;
      pieces(amount, 8).forEach((p, i) =>
        fly(from, rackPoint(p.denom), p.denom, { delay: i * 80, onLand: () => { addBank(p.value); sound.chip(); } })
      );
      render();
      toast(`+${money(amount)} from our totally real sponsors 📺`);
    },
  });
});

render();
