// 🐉 DRAGON RUSH WIN BIG — the slots room. DING DING DING.
// 7×7 CLUSTER PAYS with TUMBLES and MULTIPLIER SPOTS up to ×1024, flaming-pearl FREE SPINS
// where the spots stick, a BUY FREE SPINS button, autoplay and turbo.
// The maths lives in rush-math.js (simulated at ~96% return), the 3D grid in slots3d.js.

import { celebrate, confetti } from './fx.js';
import { emit } from './events.js';
import { DragonRush3D, SYMBOL_INFO } from './slots3d.js';
import { BUYS, COOKIE_SPINS, MULT_MAX, PAYS, SYMS, TAX_SPINS, freeSpinsFor, isRegular, newGrid, newSpots, playSpin } from './rush-math.js';

const BETS = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000];

// ✨ what the special markers do (for the paytable)
const MARKERS = [
  ['envelope', `Free spins only. Every one left on the board at the end = <b>+1, +2 or +3 FREE SPINS</b>.`],
  ['cookie', `When the tumbles stop it cracks open: <b>+${COOKIE_SPINS} FREE SPINS</b>, a <b>×2 spot</b>, or a fortune. The fortune is free.`],
  ['gong', `Base game. On the board at the end = a free <b>RESPIN</b> that keeps your multiplier spots.`],
  ['firecracker', `When the tumbles stop: <b>BOOM</b>. Clears the 3×3 around it. Nearby firecrackers join in.`],
  ['egg', `Cracks on the next tumble, <b>hatches</b> on the one after into a ✚ of baby dragon WILDS.`],
  ['wild', `Counts as <b>any symbol</b>. Only ever comes out of an egg.`],
  ['kite', `When the tumbles stop it flies off with <b>every copy</b> of the most common symbol.`],
  ['cat', `Waves on every win: a marked spot goes <b>×2</b>, a lit one <b>doubles</b>. Sometimes it waves at nothing. It's a cat.`],
  ['moon', `When the tumbles stop it gathers <b>every multiplier</b> on the board into one giant spot.`],
  ['panda', `Asleep. When the tumbles stop it wakes up grumpy and <b>every spot around it goes up a level</b>.`],
  ['taxman', `Takes 10% of your spin win and refunds you in <b>FREE SPINS</b> (${TAX_SPINS.base}, or ${TAX_SPINS.free} in the bonus). Receipt included.`],
];
const FORTUNES = [
  'You will spin again.',
  'Luck is in your future. Not this one.',
  'Help, I am trapped in a slot machine.',
  'The dragon sees you. The dragon is unimpressed.',
  'Error 404: fortune not found.',
  'Soon you will have less money. Very soon.',
  'You will meet a tall, dark and handsome loss.',
  'That was the lucky cookie. Sorry.',
  'Your lucky numbers are 7, 7 and your bank PIN.',
];
// wins are paid in whole dollars (the balance is whole dollars)
const money = (n) => '$' + Math.round(n).toLocaleString('en-US');
const load = (k) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const save = (k, v) => {
  try {
    localStorage.setItem(k, v);
  } catch {}
};

/** @param onBet(outcome, stake, multiple)  a paid bet: 'win' | 'loss' | 'push', or 'placed' for a bonus buy */
export function createSlots({ host, sound, music, getBalance, adjust, toast, onOpen, onClose, onBet }) {
  const view = document.createElement('section');
  view.className = 'slots-view';
  view.setAttribute('aria-label', 'Dragon Rush Win Big slot machine');
  view.innerHTML = `
    <div class="dr-canvas"></div>
    <div class="dr-layout">
      <aside class="dr-left">
        <button type="button" class="dr-buy"><small>💸 BUY 💸</small>BONUS<b>FROM $0</b></button>
        <div class="dr-fs"><small>FREE SPINS LEFT</small><b>0</b><em>WIN $0</em></div>
        <ol class="dr-tally" aria-label="Wins this spin"></ol>
      </aside>
      <div class="dr-slot"></div>
      <aside class="dr-right">
        <h2 class="dr-logo" aria-label="Dragon Rush Win Big"><span class="l1">DRAGON</span><span class="l2">RUSH</span><span class="l3">WIN BIG</span></h2>
        <div class="dr-feature">🐉 CLUSTERS OF <b>5+</b> PAY<br>✨ SPOTS GROW TO <b>×1024</b><br>🔥 3+ PEARLS = <b>FREE SPINS</b><br>🧨 10 MARKERS THAT <b>DO STUFF</b></div>
      </aside>
      <footer class="dr-bar">
        <button type="button" class="dr-info" aria-label="Paytable and rules">i</button>
        <div class="dr-stat dr-cb"><span>CREDIT</span><b class="dr-credit">$0</b></div>
        <div class="dr-stat dr-bb"><span>BET</span><b class="dr-bet">$0</b></div>
        <div class="dr-winbox"><span class="dr-msg">PLACE YOUR BETS!</span><b class="dr-win">WIN $0</b></div>
        <div class="dr-spinwrap">
          <button type="button" class="dr-round dr-minus" aria-label="Lower bet">−</button>
          <button type="button" class="dr-spin" aria-label="Spin">
            <svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 10a22 22 0 0 1 20.8 14.8H46l9 11 9-11h-6.2A28 28 0 0 0 32 4zM32 54a22 22 0 0 1-20.8-14.8H18l-9-11-9 11h6.2A28 28 0 0 0 32 60z"/></svg>
          </button>
          <button type="button" class="dr-round dr-plus" aria-label="Raise bet">+</button>
        </div>
        <div class="dr-toggles">
          <button type="button" class="dr-auto">AUTO</button>
          <button type="button" class="dr-turbo">⚡ TURBO</button>
        </div>
      </footer>
    </div>
    <div class="dr-pops"></div>
    <div class="sm-winpop"></div>
    <div class="sm-banner"></div>
    <div class="dr-epic" hidden>
      <div class="de-rays"></div>
      <div class="de-flames"></div>
      <div class="de-content">
        <div class="de-kicker"></div>
        <div class="de-medal"><span>🐉</span></div>
        <div class="de-title"></div>
        <div class="de-num"></div>
        <div class="de-sub"></div>
        <button type="button" class="de-go">START!</button>
      </div>
    </div>
    <div class="dr-buymenu" hidden>
      <div class="dr-bm-card">
        <button type="button" class="dr-pt-close dr-bm-close" aria-label="Close">✕</button>
        <h3>💸 BUY BONUS 💸</h3>
        <p class="dr-bm-sub">Skip the waiting. Go straight to the good part. Your friends will be so proud.</p>
        <div class="dr-bm-options">
          ${BUYS.map((b) => `<button type="button" class="dr-bm-opt ${b.id}" data-buy="${b.id}"><strong>${b.name}</strong><span>${b.blurb}</span><b class="dr-bm-price"></b><em>BUY</em></button>`).join('')}
        </div>
      </div>
    </div>
    <div class="dr-paytable" hidden>
      <div class="dr-pt-card">
        <button type="button" class="dr-pt-close" aria-label="Close">✕</button>
        <h3>DRAGON RUSH WIN BIG · PAYTABLE</h3>
        <table><thead></thead><tbody></tbody></table>
        <ul>
          <li><b>Cluster pays:</b> 5 or more matching symbols touching up, down, left or right. Wins are × your total bet.</li>
          <li><b>Tumble:</b> winning symbols explode, everything falls, new symbols drop in. Repeat until no more wins.</li>
          <li><b>Multiplier spots:</b> a spot lights up the first time a win explodes on it. Next time it becomes <b>×2</b>, then doubles every hit up to <b>×1024</b>. A cluster over lit spots is multiplied by the sum of their multipliers.</li>
          <li><b>🔥 Flaming pearl (scatter):</b> 3/4/5/6/7 anywhere = <b>10/12/15/20/30 FREE SPINS</b>. In free spins the multiplier spots <b>stay for the whole bonus</b>. Retriggers welcome.</li>
          <li><b>Buy bonus:</b> ${BUYS.map((b) => `${b.name} for ${b.cost}× your bet`).join(', or ')}.</li>
          <li>Simulated return to player ≈ 96%. The money is fake. The dragon is real (in our hearts).</li>
        </ul>
        <h4 class="dr-pt-h">✨ SPECIAL MARKERS ✨</h4>
        <ul class="dr-pt-markers"></ul>
      </div>
    </div>`;
  host.appendChild(view);

  const $$ = (s) => view.querySelector(s);
  const spinBtn = $$('.dr-spin');
  const popEl = $$('.sm-winpop');
  const banner = $$('.sm-banner');
  const pops = $$('.dr-pops');
  const tally = $$('.dr-tally');
  const buyBtn = $$('.dr-buy');
  const autoBtn = $$('.dr-auto');
  const turboBtn = $$('.dr-turbo');
  const paytable = $$('.dr-paytable');
  const msg = $$('.dr-msg');
  const buyMenu = $$('.dr-buymenu');
  const epicEl = $$('.dr-epic');

  const machine = new DragonRush3D($$('.dr-canvas'), { slotEl: $$('.dr-slot'), onLeverDown: () => leverDown(), onLeverUp: () => leverUp() });
  machine.setGrid(newGrid().map((col) => col.map((s) => (isRegular(s) ? s : 'jade'))));

  let betIdx = 1;
  let busy = false;
  let open = false;
  let moving = false;
  let free = 0;
  let inBonus = false;
  let freeBet = 0;
  let freeWin = 0;
  let fsSpots = newSpots();
  let autoOn = false; // autoplay runs until you stop it or the money runs out
  let autoCount = 0;
  let turbo = load('fr.turbo') === '1';
  let joked = false;
  let shownWin = 0;
  let leverHeld = false;
  let leverTurbo = false;
  let holdTimer = 0;
  const applySpeed = () => (machine.speed = leverTurbo ? 2.8 : turbo ? 2.2 : 1);
  applySpeed();

  // icons (rendered once from the real 3D symbols) for the tally + paytable
  let icons = null;
  const icon = (id) => {
    try {
      icons ||= machine.icons();
    } catch {
      icons = {};
    }
    return icons[id] ? `<img src="${icons[id]}" alt="${SYMBOL_INFO[id].name}">` : '';
  };
  function buildPaytable() {
    const sizes = [5, 6, 7, 8, 9, 10, 12, 15];
    $$('.dr-paytable thead').innerHTML = `<tr><th></th>${sizes.map((n) => `<th>${n === 15 ? '15+' : n}</th>`).join('')}</tr>`;
    $$('.dr-paytable tbody').innerHTML =
      [...SYMS]
        .reverse()
        .map((id) => `<tr><td>${icon(id)}</td>${sizes.map((n) => `<td>${PAYS[id][Math.min(n, 15) - 5]}×</td>`).join('')}</tr>`)
        .join('') + `<tr><td>${icon('pearl')}</td><td colspan="${sizes.length}" class="dr-pt-scatter">3+ anywhere = FREE SPINS</td></tr>`;
    $$('.dr-pt-markers').innerHTML = MARKERS.map(([id, text]) => `<li>${icon(id)}<div><strong>${SYMBOL_INFO[id].name}</strong>${text}</div></li>`).join('');
  }

  function renderDisplay() {
    const bal = getBalance();
    if (!busy && !free) while (betIdx > 0 && BETS[betIdx] > bal) betIdx--;
    $$('.dr-credit').textContent = money(bal);
    $$('.dr-bet').textContent = money(inBonus ? freeBet : BETS[betIdx]);
    spinBtn.disabled = busy || moving || free > 0 || (!inBonus && bal < BETS[betIdx]);
    view.classList.toggle('busy', busy);
    view.classList.toggle('freespins', inBonus);
    $$('.dr-fs b').textContent = free;
    $$('.dr-fs em').textContent = `WIN ${money(freeWin)}`;
    buyBtn.querySelector('b').textContent = `FROM ${money(BUYS[0].cost * BETS[betIdx])}`;
    for (const b of BUYS) {
      const el = buyMenu.querySelector(`[data-buy="${b.id}"]`);
      el.querySelector('.dr-bm-price').textContent = money(b.cost * BETS[betIdx]);
      el.disabled = getBalance() < b.cost * BETS[betIdx];
    }
    buyBtn.disabled = busy || inBonus;
    autoBtn.textContent = autoOn ? `STOP (${autoCount})` : 'AUTO';
    autoBtn.classList.toggle('on', autoOn);
    turboBtn.classList.toggle('on', turbo);
    $$('.dr-minus').disabled = $$('.dr-plus').disabled = busy || inBonus;
  }
  const setMsg = (t) => (msg.textContent = t);
  const winEl = $$('.dr-win');
  let winRaf = 0;
  function setWin(target) {
    // a tumble chain calls this every step: one count-up at a time, not one per step
    cancelAnimationFrame(winRaf);
    const from = shownWin;
    shownWin = target;
    if (!target) {
      winEl.textContent = 'WIN $0';
      return;
    }
    const t0 = performance.now();
    (function count(now) {
      const u = Math.min((now - t0) / 450, 1);
      winEl.textContent = `WIN ${money(from + (target - from) * u)}`;
      if (u < 1) winRaf = requestAnimationFrame(count);
    })(t0);
  }

  // ---------- buttons ----------
  const bump = (f) => sound.blip(f, 0.06, 'square', 0.06);
  $$('.dr-minus').addEventListener('click', () => {
    if (busy || inBonus) return;
    betIdx = Math.max(0, betIdx - 1);
    bump(700);
    renderDisplay();
  });
  $$('.dr-plus').addEventListener('click', () => {
    if (busy || inBonus) return;
    if (betIdx < BETS.length - 1 && BETS[betIdx + 1] <= getBalance()) betIdx++;
    else toast('That is all the dragon will let you bet right now. 🐉');
    bump(900);
    renderDisplay();
  });
  spinBtn.addEventListener('click', () => spin());
  autoBtn.addEventListener('click', () => {
    if (autoOn) {
      autoOn = false;
      toast(`Autoplay stopped after ${autoCount} spins.`);
    } else {
      autoOn = true;
      autoCount = 0;
      toast('🤖 AUTOPLAY: until you stop it or the money runs out. Sit back and let the dragon cook.');
      if (!busy && !inBonus) spin();
    }
    renderDisplay();
  });
  turboBtn.addEventListener('click', () => {
    turbo = !turbo;
    applySpeed();
    save('fr.turbo', turbo ? '1' : '0');
    sound.blip(turbo ? 1400 : 600, 0.1, 'square', 0.07);
    toast(turbo ? '⚡ TURBO! Gravity doubled. Physics has left the chat.' : 'Turbo off. Gravity restored.');
    renderDisplay();
  });
  buyBtn.addEventListener('click', () => {
    if (busy || inBonus || moving) return;
    renderDisplay();
    buyMenu.hidden = false;
    sound.blip(700, 0.08, 'square', 0.06);
  });
  $$('.dr-bm-close').addEventListener('click', () => (buyMenu.hidden = true));
  buyMenu.addEventListener('click', (e) => e.target === buyMenu && (buyMenu.hidden = true));
  buyMenu.querySelectorAll('[data-buy]').forEach((el) =>
    el.addEventListener('click', () => {
      const opt = BUYS.find((b) => b.id === el.dataset.buy);
      const bet = BETS[betIdx];
      const cost = opt.cost * bet;
      if (busy || inBonus || moving) return;
      if (getBalance() < cost) {
        toast(`${opt.name} costs ${money(cost)}. Lower the bet, or… 📺`);
        return;
      }
      buyMenu.hidden = true;
      adjust(-cost);
      onBet?.('placed', cost);
      sound.cash?.();
      freeBet = bet;
      awardFree(opt.spins, opt.start ? '💎 SUPER BONUS BOUGHT 💎' : '💸 BONUS BOUGHT 💸', false, opt.start).then(
        () => setTimeout(() => open && !busy && free > 0 && spin(), 500),
      );
    }),
  );
  $$('.dr-info').addEventListener('click', () => {
    buildPaytable();
    paytable.hidden = false;
  });
  $$('.dr-pt-close').addEventListener('click', () => (paytable.hidden = true));
  paytable.addEventListener('click', (e) => e.target === paytable && (paytable.hidden = true));

  // ---------- sounds ----------
  const bell = (f, delay = 0, vol = 0.13) => {
    sound.blip(f, 0.9, 'sine', vol, delay);
    sound.blip(f * 2.76, 0.35, 'sine', vol * 0.35, delay);
    sound.blip(f * 5.4, 0.12, 'sine', vol * 0.15, delay);
  };
  const dingding = (n) => {
    for (let i = 0; i < n; i++) bell(i % 2 ? 1568 : 2093, i * 0.11, 0.12);
  };
  const gong = (delay = 0) => {
    sound.boom(0.6, delay);
    [110, 164, 247, 330].forEach((f, i) => sound.blip(f * (1 + Math.random() * 0.01), 2.4 - i * 0.4, 'sine', 0.08, delay));
  };
  const land = (c) => sound.blip(150 - c * 8, 0.08, 'triangle', 0.09);
  const pop = (n) => {
    const root = 523 * 2 ** (Math.min(n - 1, 10) / 12);
    [1, 1.25, 1.5, 2].forEach((k, i) => sound.blip(root * k, 0.18, 'square', 0.05, i * 0.035));
    sound.boom(0.25);
  };
  const chime = (v) => {
    const f = 660 * 2 ** (Math.log2(v) / 5);
    bell(f, 0, 0.12);
    bell(f * 1.5, 0.08, 0.1);
  };
  const roar = () => {
    sound.boom(0.9);
    for (let i = 0; i < 14; i++) sound.blip(90 + Math.random() * 60, 0.12, 'sawtooth', 0.07, i * 0.05);
  };
  const siren = () => {
    for (let i = 0; i < 10; i++) {
      sound.blip(660, 0.2, 'square', 0.05, i * 0.4);
      sound.blip(990, 0.2, 'square', 0.05, i * 0.4 + 0.2);
    }
  };
  // filtered-noise swoosh (sweeps a filter from f0 to f1)
  function noise({ dur = 0.3, f0 = 400, f1 = 3000, q = 1.2, vol = 0.3, delay = 0, type = 'bandpass' } = {}) {
    if (sound.muted) return;
    const c = sound.ensure();
    const t = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = sound.noiseBuf();
    const f = c.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.03, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(sound.bus());
    src.start(t, Math.random() * 0.5, dur + 0.05);
  }
  // a pitch-bending tone (boings, risers, womps)
  function bend(f0, f1, dur, type = 'sine', vol = 0.1, delay = 0) {
    if (sound.muted) return;
    const c = sound.ensure();
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(sound.bus());
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  const PENTA = [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568, 1760];
  const marimba = (f, delay = 0, vol = 0.09) => {
    sound.blip(f, 0.22, 'triangle', vol, delay);
    sound.blip(f * 4, 0.05, 'sine', vol * 0.4, delay);
  };
  const whoosh = () => {
    noise({ dur: 0.45, f0: 300, f1: 4000, vol: 0.35 });
    noise({ dur: 0.35, f0: 5000, f1: 600, vol: 0.18, delay: 0.25 });
    for (let i = 0; i < 8; i++) sound.blip(900 - i * 90, 0.05, 'triangle', 0.04, i * 0.02);
    // drum roll while the old symbols fall out
    for (let i = 0; i < 10; i++) sound.blip(120 + (i % 2) * 30, 0.05, 'square', 0.05, 0.05 + (i * 0.035) / machine.speed);
    sound.boom(0.35);
  };
  // every symbol clicks as it lands; each column plays the next note of a rising pentatonic run
  const tick = () => sound.blip(2400 + Math.random() * 1200, 0.018, 'square', 0.025);
  const shatter = (n) => {
    noise({ dur: 0.35, f0: 6000, f1: 2500, q: 0.7, vol: 0.4, type: 'highpass' });
    noise({ dur: 0.5, f0: 900, f1: 120, vol: 0.3, type: 'lowpass', delay: 0.02 });
    for (let i = 0; i < 6; i++) sound.blip(2000 + Math.random() * 3000, 0.05, 'sine', 0.05, 0.02 + i * 0.03);
    bend(300 * 2 ** ((n - 1) / 12), 1200 * 2 ** ((n - 1) / 12), 0.25, 'square', 0.04);
  };
  const cascade = (n) => {
    noise({ dur: 0.4, f0: 2500, f1: 300, vol: 0.2 });
    for (let i = 0; i < 5; i++) sound.blip(1400 - i * 180 + n * 40, 0.06, 'triangle', 0.05, i * 0.04);
  };
  const riser = (dur) => {
    bend(200, 1600, dur, 'sawtooth', 0.04);
    noise({ dur, f0: 300, f1: 6000, vol: 0.25 });
  };
  const womp = () => {
    bend(330, 250, 0.3, 'sawtooth', 0.05);
    bend(250, 170, 0.5, 'sawtooth', 0.05, 0.32);
  };
  // lever: ratchet clicks down, clunk at the bottom, boing on the way back
  const ratchet = () => {
    for (let i = 0; i < 7; i++) sound.blip(900 + i * 60, 0.02, 'square', 0.06, i * 0.022);
    sound.boom(0.4, 0.16);
    sound.blip(90, 0.12, 'square', 0.1, 0.16);
  };
  const boing = () => {
    bend(180, 520, 0.12, 'triangle', 0.1);
    bend(520, 260, 0.35, 'triangle', 0.07, 0.12);
    for (let i = 0; i < 4; i++) sound.blip(700 - i * 90, 0.03, 'square', 0.03, 0.05 + i * 0.03);
  };
  const turboRev = () => {
    bend(120, 900, 0.6, 'sawtooth', 0.06);
    bend(180, 1350, 0.6, 'square', 0.03);
    noise({ dur: 0.6, f0: 400, f1: 8000, vol: 0.3 });
  };
  // ✨ marker sounds
  const crunch = () => {
    noise({ dur: 0.18, f0: 3000, f1: 900, q: 0.8, vol: 0.45 });
    for (let i = 0; i < 5; i++) sound.blip(300 + Math.random() * 500, 0.03, 'square', 0.05, i * 0.03);
  };
  const bang = () => {
    sound.boom(0.9);
    noise({ dur: 0.25, f0: 7000, f1: 1500, q: 0.6, vol: 0.55, type: 'highpass' });
    noise({ dur: 0.6, f0: 1200, f1: 80, vol: 0.4, type: 'lowpass', delay: 0.02 });
  };
  const meow = () => {
    bend(620, 980, 0.12, 'triangle', 0.07);
    bend(980, 520, 0.3, 'triangle', 0.07, 0.12);
  };
  const crackle = () => {
    noise({ dur: 0.08, f0: 5000, f1: 3000, q: 1.5, vol: 0.5 });
    sound.blip(1800, 0.03, 'square', 0.05, 0.05);
  };
  const kiteSwoosh = () => {
    noise({ dur: 1.1, f0: 300, f1: 5000, vol: 0.3 });
    bend(300, 1400, 1, 'sine', 0.06);
    for (let i = 0; i < 6; i++) sound.blip(700 + i * 160, 0.12, 'triangle', 0.04, 0.3 + i * 0.09);
  };
  const shimmer = () => PENTA.forEach((f, i) => bell(f * 2, i * 0.05, 0.05));
  const grumble = () => {
    bend(180, 95, 0.45, 'sawtooth', 0.07);
    noise({ dur: 0.4, f0: 400, f1: 150, vol: 0.2, type: 'lowpass' });
  };
  const kaching = () => {
    [1800, 2700].forEach((f, i) => sound.blip(f, 0.3, 'triangle', 0.08, 0.08 + i * 0.06));
    noise({ dur: 0.12, f0: 2500, f1: 800, vol: 0.3 });
    sound.blip(160, 0.1, 'square', 0.08);
  };
  function footsteps(n, gap) {
    if (sound.muted) return;
    const c = sound.ensure();
    for (let i = 0; i < n; i++) {
      const t = c.currentTime + i * gap;
      const src = c.createBufferSource();
      src.buffer = sound.noiseBuf();
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 420 + (i % 2) * 160;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.7, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      src.connect(lp).connect(g).connect(sound.bus());
      src.start(t, Math.random(), 0.2);
      sound.blip(72 - (i % 2) * 9, 0.13, 'sine', 0.3, i * gap);
    }
  }

  // ---------- big slams + floating numbers ----------
  let bannerTimer;
  function slam(html, cls = '', ms = 1600) {
    banner.innerHTML = html;
    banner.className = `sm-banner show ${cls}`;
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => (banner.className = 'sm-banner'), ms);
    machine.kick(0.35);
  }
  // 🎆 the big cinematic bonus screens (intro + summary). Resolves when dismissed.
  let epicDone = null;
  function epic({ kicker = '', title, num = '', countTo = 0, sub = '', button = 'START!', cls = '', ms = 5200, medal = '🐉' }) {
    epicDone?.();
    return new Promise((resolve) => {
      epicEl.className = `dr-epic ${cls}`;
      epicEl.hidden = false;
      void epicEl.offsetWidth;
      epicEl.classList.add('show');
      $$('.de-kicker').textContent = kicker;
      $$('.de-kicker').hidden = !kicker;
      $$('.de-medal span').textContent = medal;
      $$('.de-title').textContent = title;
      $$('.de-num').textContent = countTo ? money(0) : num;
      $$('.de-sub').innerHTML = sub;
      $$('.de-go').textContent = button;
      machine.fireworks(14);
      machine.swoop();
      machine.kick(0.5);
      gong();
      setTimeout(() => {
        dingding(14);
        sound.boom(0.8);
        confetti(innerWidth / 2, innerHeight * 0.42, 160, 1.3);
      }, 380);
      if (countTo) {
        const t0 = performance.now() + 500;
        const dur = 2200;
        let lastTick = 0;
        (function count(now) {
          if (epicEl.hidden) return;
          const u = Math.max(0, Math.min((now - t0) / dur, 1));
          $$('.de-num').textContent = money(countTo * (1 - Math.pow(1 - u, 3)));
          if (now - lastTick > 70 && u < 1) {
            lastTick = now;
            sound.blip(900 + u * 900, 0.03, 'square', 0.04);
          }
          if (u < 1) requestAnimationFrame(count);
          else {
            dingding(8);
            machine.fireworks(8);
          }
        })(performance.now());
      }
      let timer;
      const close = () => {
        if (epicDone !== close) return;
        epicDone = null;
        clearTimeout(timer);
        epicEl.classList.add('out');
        setTimeout(() => {
          epicEl.hidden = true;
          epicEl.className = 'dr-epic';
        }, 380);
        sound.blip(1200, 0.08, 'square', 0.06);
        resolve();
      };
      epicDone = close;
      timer = setTimeout(close, ms);
    });
  }
  epicEl.addEventListener('click', () => epicDone?.());

  function floatPop(cl) {
    const el = document.createElement('div');
    el.className = 'dr-pop' + (cl.mult > 1 ? ' mult' : '');
    el.style.left = `${cl.at.x}px`;
    el.style.top = `${cl.at.y}px`;
    el.innerHTML = `${money(cl.win)}${cl.mult > 1 ? `<small>×${cl.mult}</small>` : ''}`;
    pops.appendChild(el);
    setTimeout(() => el.remove(), 1700);
  }
  function addTally(cl) {
    const li = document.createElement('li');
    li.innerHTML = `<span>${cl.cells.length}</span>${icon(cl.sym)}${cl.mult > 1 ? `<em>×${cl.mult}</em>` : ''}<b>${money(cl.win)}</b>`;
    tally.prepend(li);
    while (tally.children.length > 7) tally.lastChild.remove();
  }
  function addNote(html) {
    const li = document.createElement('li');
    li.className = 'note';
    li.innerHTML = html;
    tally.prepend(li);
    while (tally.children.length > 7) tally.lastChild.remove();
  }
  // a little floating caption over a cell (fortunes, CRACK!, +2 SPINS…)
  function floatNote(at, html, cls = '') {
    const el = document.createElement('div');
    el.className = `dr-pop note ${cls}`;
    el.style.left = `${at.x}px`;
    el.style.top = `${at.y}px`;
    el.innerHTML = html;
    pops.appendChild(el);
    setTimeout(() => el.remove(), cls.includes('fortune') ? 3400 : 1700);
  }
  const noteAt = (c, r, html, cls) => floatNote(machine.screenOf([[c, r]]), html, cls);

  // ---------- the spin ----------
  async function spin() {
    if (busy || !open || moving) return;
    paytable.hidden = true;
    const isFree = free > 0;
    const bet = isFree ? freeBet : BETS[betIdx];
    if (!isFree && getBalance() < bet) {
      toast(autoOn ? `🤖 Autoplay ran out of money after ${autoCount} spins. The dragon thanks you.` : 'Not enough credit! Lower the bet, or… 📺');
      autoOn = false;
      machine.kick(0.2);
      renderDisplay();
      return;
    }
    busy = true;
    if (autoOn && !isFree) autoCount++;
    if (isFree) free--;
    else adjust(-bet);
    tally.innerHTML = '';
    setWin(0);
    popEl.className = 'sm-winpop';
    setMsg(isFree ? `FREE SPIN! ${free} LEFT` : 'GOOD LUCK! 🐉');
    if (!isFree) machine.resetSpots();
    renderDisplay();

    // one paid spin can be several plays: a 🔔 gong on the board gives a respin that keeps the spots
    const spots = isFree ? fsSpots : newSpots();
    let win = 0;
    let res;
    let n = 0;
    for (let respin = false; ; respin = true) {
      if (respin) await gongRespin();
      ({ res, n } = await play({ bet, isFree, spots, offset: win }));
      win += Math.round(res.total);
      if (freeSpinsFor(res.pearls) || res.extraSpins || !res.respin) break;
    }

    if (win) adjust(win);
    if (!isFree) onBet?.(win > bet ? 'win' : win < bet ? 'loss' : 'push', bet, win / bet);
    if (isFree) freeWin += win;
    setWin(win);
    const x = win / bet;
    if (win) {
      const level = x >= 50 ? 3 : x >= 20 ? 2 : x >= 8 ? 1 : 0;
      setMsg(level >= 2 ? 'MEGA DRAGON WIN!!' : level ? 'BIG WIN!' : `YOU WON ${money(win)}`);
      if (level) {
        popEl.innerHTML = `<small>${['', 'BIG WIN', 'MEGA WIN', 'DRAGON JACKPOT'][level]}</small>+${money(win)}<em>${x.toFixed(1)}× YOUR BET</em>`;
        popEl.className = 'sm-winpop show big';
        celebrate({ net: win - (isFree ? 0 : bet), level, origin: { x: innerWidth / 2, y: innerHeight * 0.4 } });
        sound.win(level);
        music?.duck(0.3, 2 + level);
        machine.swoop();
        if (level >= 2) roar();
        if (level >= 3) siren();
      } else {
        dingding(Math.min(10, 2 + n));
        confetti(innerWidth / 2, innerHeight * 0.45, 40 + n * 20, 0.7);
      }
    } else {
      setMsg(isFree ? `FREE SPIN · ${free} LEFT` : 'SO CLOSE. SPIN AGAIN!');
      womp();
    }

    // 🔥 flaming pearls → free spins (plus any spins the markers handed out: 🧧 🥠 🧾)
    const fs = freeSpinsFor(res.pearls);
    const extra = res.extraSpins;
    let introDone = null;
    if (fs) {
      await machine.highlight(machine.cellsOf('pearl'));
      if (!isFree) freeBet = bet;
      introDone = awardFree(fs + extra, `🔥 ${res.pearls} FLAMING PEARLS 🔥`, isFree);
    } else if (extra && isFree) {
      free += extra;
      slam(`<small>${res.envelopes.length ? '🧧 LUCKY MONEY 🧧' : 'THE DRAGON IS GENEROUS'}</small>+${extra} SPIN${extra > 1 ? 'S' : ''}`, 'free', 1600);
      sound.cash?.();
    } else if (extra) {
      freeBet = bet;
      introDone = awardFree(extra, res.tax?.spins ? '🧾 YOUR TAX REFUND 🧾' : '🥠 THE COOKIE HAS SPOKEN 🥠');
    }
    const started = fs || extra;
    busy = false;
    if (isFree && free === 0 && !started) setTimeout(endFree, 700);
    renderDisplay();

    if (free > 0 && introDone) introDone.then(() => setTimeout(() => open && !busy && free > 0 && spin(), 500));
    else if (free > 0) setTimeout(() => open && !busy && free > 0 && spin(), leverTurbo ? 400 : 1100);
    else if (leverHeld && !started) setTimeout(() => leverHeld && open && !busy && spin(), 250);
    else if (autoOn && !started && !inBonus) setTimeout(() => autoOn && open && !busy && !inBonus && spin(), 700);
  }

  // ---------- one play: drop the grid, run every step, settle the end-of-spin markers ----------
  async function play({ bet, isFree, spots, offset }) {
    const res = playSpin({ bet, spots, free: isFree });
    whoosh();
    await machine.dropOut();
    let pearlsSoFar = 0;
    await machine.dropIn(res.start, (c) => {
      land(c);
      marimba(PENTA[c + (isFree ? 3 : 0)], 0, 0.08);
      const p = res.start[c].filter((s) => s === 'pearl').length;
      if (p) {
        pearlsSoFar += p;
        bell(880 + pearlsSoFar * 220, 0, 0.14);
        if (pearlsSoFar >= 2) {
          machine.kick(0.1);
          if (c < 6) riser(0.6 / machine.speed);
        }
      }
    }, tick);

    let run = 0;
    let n = 0;
    for (const step of res.steps) {
      if (step.type === 'win') {
        n++;
        for (const cl of step.clusters) cl.at = machine.screenOf(cl.cells);
        await Promise.all(step.clusters.map((cl) => machine.explode(cl.cells, SYMBOL_INFO[cl.sym].color)));
        pop(n);
        shatter(n);
        step.clusters.forEach((cl) => {
          floatPop(cl);
          addTally(cl);
        });
        run += step.win;
        setWin(offset + run);
        setMsg(step.clusters.some((cl) => cl.wild) ? '🐉 WILD WIN!' : n > 1 ? `TUMBLE ×${n}! 💥` : 'WIN!');
        let top = 0;
        for (const { c, r, v } of step.spotChanges) {
          machine.setSpot(c, r, v);
          top = Math.max(top, v);
        }
        if (top >= 2) chime(top);
        if (top >= MULT_MAX && !joked) {
          joked = true;
          setTimeout(absurd, 300);
        }
        machine.kick(0.05 + 0.04 * n);
        if (n === 3) slam(`<small>BOOM!</small>TUMBLE ×3<em>💥 KEEP GOING 💥</em>`, 'combo c2', 1100);
        if (n === 5) slam(`<small>🔥 YOU ARE ON A ROLL! 🔥</small>TUMBLE ×5`, 'combo c3', 1300);
        if (n >= 7 && n % 2 === 1) slam(`<small>WHAT IS HAPPENING</small>TUMBLE ×${n}`, 'combo c4', 1300);
        await cats(step.cats);
        await machine.wait(260);
      } else {
        await marker(step);
      }
      cascade(Math.max(1, n));
      await machine.tumble(step, (c) => {
        land(c);
        marimba(PENTA[Math.min(9, c + n)], 0, 0.06);
      });
      await eggs(step);
    }
    await finale(res, offset);
    return { res, n };
  }

  // 🐱 the lucky cats wave after a win
  async function cats(list = []) {
    for (const cat of list) {
      machine.wave(cat.c, cat.r);
      meow();
      if (!cat.to) {
        noteAt(cat.c, cat.r, 'waved at nothing', 'fortune small');
        continue;
      }
      await machine.orb(machine.cellPos(cat.c, cat.r), machine.cellPos(cat.to.c, cat.to.r), '#ffd23f');
      machine.setSpot(cat.to.c, cat.to.r, cat.to.v);
      chime(cat.to.v);
      noteAt(cat.to.c, cat.to.r, `🐾 ×${cat.to.v}`, 'good');
    }
  }

  // the markers that act when the tumbles run dry
  async function marker(step) {
    if (step.type === 'cookie') {
      setMsg('🥠 FORTUNE COOKIE!');
      crunch();
      await machine.explode(step.at, SYMBOL_INFO.cookie.color);
      for (const k of step.cookies) {
        if (k.prize === 'spins') {
          noteAt(k.c, k.r, `+${k.spins} FREE SPINS`, 'good big');
          dingding(6);
        } else if (k.prize === 'spot') {
          machine.setSpot(k.c, k.r, k.v);
          chime(k.v);
          noteAt(k.c, k.r, `×${k.v} SPOT`, 'good');
        } else {
          noteAt(k.c, k.r, `“${FORTUNES[(Math.random() * FORTUNES.length) | 0]}”`, 'fortune');
          womp();
        }
      }
      await machine.wait(step.cookies.some((k) => k.prize === 'dud') ? 1100 : 600);
    } else if (step.type === 'panda') {
      setMsg('🐼 THE PANDA WOKE UP. IT IS GRUMPY.');
      grumble();
      for (const [c, r] of step.at) noteAt(c, r, '😤', 'big');
      machine.kick(0.2);
      await machine.wait(350);
      let top = 0;
      for (const [i, s] of step.spotChanges.entries()) {
        machine.wait(i * 45).then(() => machine.setSpot(s.c, s.r, s.v));
        top = Math.max(top, s.v);
      }
      await machine.wait(step.spotChanges.length * 45 + 250);
      if (top >= 2) chime(top);
      await machine.explode(step.at, '#ffffff');
    } else if (step.type === 'firecracker') {
      const many = step.chain.length;
      setMsg(many > 1 ? `🧨 CHAIN REACTION ×${many}!` : '🧨 BOOM!');
      await machine.blast(step.chain, step.removed, bang);
      if (many > 1) slam(`<small>🧨 CHAIN REACTION 🧨</small>×${many} BOOM`, 'combo c3', 1200);
    } else if (step.type === 'kite') {
      const names = step.kites.filter((k) => k.sym).map((k) => SYMBOL_INFO[k.sym].name);
      setMsg(names.length ? `🪁 THE KITE STOLE ALL THE ${names.join(' & ')}!` : '🪁 WHEEEE');
      kiteSwoosh();
      await machine.kiteAway(step.kites.map((k) => ({ ...k, color: k.sym ? SYMBOL_INFO[k.sym].color : '#ffffff' })));
    } else if (step.type === 'moon') {
      setMsg('🌕 FULL MOON!');
      shimmer();
      if (step.target) {
        const to = machine.cellPos(step.target.c, step.target.r);
        await Promise.all(step.from.map(([c, r], i) => machine.orb(machine.cellPos(c, r), to, '#ffe6a0', i * 60)));
        for (const s of step.spotChanges) machine.setSpot(s.c, s.r, s.v);
        chime(step.target.v);
        slam(`<small>🌕 THE MOON GATHERED IT ALL 🌕</small>×${step.target.v}`, 'combo c2', 1500);
        await machine.wait(500);
      } else {
        for (const [c, r] of step.at) noteAt(c, r, 'the moon just… glows', 'fortune small');
        await machine.wait(400);
      }
      await machine.explode(step.at, '#ffe6a0');
    }
  }

  // 🥚 after every refill: eggs crack, cracked eggs hatch into wilds
  async function eggs(step) {
    for (const e of step.eggs) {
      machine.crack(e.c, e.r);
      crackle();
      noteAt(e.c, e.r, 'CRACK!', 'good');
    }
    if (step.eggs.length) await machine.wait(350);
    for (const h of step.hatch) {
      crackle();
      roar();
      setMsg('🐣 THE EGG HATCHED!');
      slam(`<small>🐣 THE EGG HATCHED 🐣</small>WILDS!`, 'free', 1400);
      await machine.hatch(h);
      await machine.wait(250);
    }
  }

  // the end of a play: 🧧 envelopes pop open, 🧾 the tax man takes his cut
  async function finale(res, offset) {
    if (res.envelopes.length) {
      setMsg('🧧 RED ENVELOPES!');
      for (const e of res.envelopes) {
        noteAt(e.c, e.r, `+${e.spins} SPIN${e.spins > 1 ? 'S' : ''}`, 'good big');
        bell(1320 + e.spins * 220, 0, 0.12);
      }
      await machine.explode(res.envelopes.map((e) => [e.c, e.r]), SYMBOL_INFO.envelope.color);
    }
    const tax = res.tax;
    if (tax) {
      await machine.highlight(tax.cells, '#5ee08f');
      if (tax.amount) {
        kaching();
        setWin(offset + res.total);
        setMsg(`🧾 TAXED ${money(tax.amount)}. REFUND: ${tax.spins} FREE SPIN${tax.spins > 1 ? 'S' : ''}`);
        slam(
          `<small>🧾 DRAGON TAX RECEIPT 🧾</small><span class="receipt">WIN ........ ${money(tax.gross)}<br>TAX (10%) .. −${money(tax.amount)}<br>REFUND ..... ${tax.spins} FREE SPIN${tax.spins > 1 ? 'S' : ''}<br><i>Thank you for your contribution.</i></span>`,
          'receipt',
          2600,
        );
        addNote(`🧾 TAX <b>−${money(tax.amount)}</b>`);
        await machine.wait(1400);
      } else {
        for (const [c, r] of tax.cells) noteAt(c, r, 'Nothing to tax. He looks disappointed.', 'fortune');
        womp();
      }
    }
  }

  // 🔔 the gong rings: same bet, same spots, again
  async function gongRespin() {
    setMsg('🔔 GONG! RESPIN!');
    gong();
    slam(`<small>🔔 THE GONG HAS RUNG 🔔</small>RESPIN<em>YOUR SPOTS STAY</em>`, 'free', 1500);
    await machine.ringGongs();
  }

  function awardFree(n, reason, retrigger = false, start = 0) {
    if (!retrigger) {
      emit('freespins');
      fsSpots = newSpots();
      freeWin = 0;
      machine.resetSpots();
      if (start) {
        // SUPER: every spot lights up ×2, in a wave from the middle
        for (const col of fsSpots) col.fill(start);
        fsSpots.forEach((col, c) =>
          col.forEach((v, r) => {
            const d = Math.abs(c - 3) + Math.abs(r - 3);
            setTimeout(() => {
              machine.setSpot(c, r, v);
              if (r === 3) chime(2 + d);
            }, 400 + d * 110);
          }),
        );
      }
    }
    inBonus = true;
    free += n;
    roar();
    machine.setMode(true);
    setMsg(`${free} FREE SPINS!`);
    renderDisplay();
    if (retrigger) {
      return epic({ kicker: reason, title: 'EXTRA SPINS', num: `+${n}`, sub: 'The dragon is NOT done with you.', button: 'KEEP GOING!', cls: 'retrigger', ms: 2600, medal: '🔥' });
    }
    return epic({
      kicker: reason,
      title: start ? 'SUPER FREE SPINS' : 'FREE SPINS',
      num: String(n),
      sub: start ? '💎 EVERY SPOT STARTS AT <b>×2</b> 💎<br>and they stick for the whole bonus' : '✨ MULTIPLIER SPOTS <b>STICK</b> ALL BONUS ✨<br>up to <b>×1024</b>',
      button: 'START!',
      cls: start ? 'super' : '',
      medal: start ? '💎' : '🐉',
    });
  }
  function endFree() {
    inBonus = false;
    machine.setMode(false);
    const x = freeWin / freeBet;
    setMsg(`BONUS PAID ${money(freeWin)}!`);
    renderDisplay();
    const verdict = x >= 100 ? '🐉 LEGENDARY 🐉' : x >= 40 ? '💥 MEGA BONUS 💥' : x >= 10 ? '🔥 NICE BONUS 🔥' : x > 0 ? 'the dragon was sleepy' : 'the dragon ate it all';
    epic({
      kicker: verdict,
      title: 'BONUS COMPLETE',
      countTo: freeWin || 0,
      num: money(0),
      sub: `<b>${x.toFixed(1)}×</b> your bet`,
      button: 'COLLECT',
      cls: 'summary' + (x >= 40 ? ' huge' : ''),
      ms: 6500,
      medal: x >= 10 ? '💰' : '🐉',
    }).then(() => {
      if (x >= 40) celebrate({ net: freeWin, level: x >= 100 ? 3 : 2, origin: { x: innerWidth / 2, y: innerHeight * 0.4 } });
      // autoplay carries on after the bonus
      if (autoOn) setTimeout(() => autoOn && open && !busy && !inBonus && spin(), 800);
    });
  }
  function absurd() {
    roar();
    gong(0.3);
    machine.swoop();
    slam(`<small>🐉 ×1024 DRAGON SPOT 🐉</small><span class="absurd">MULTIPLIER ×100000000000000000000000000000000000000</span>`, 'dragon', 2600);
    setTimeout(() => slam(`<small>…the Dragon Tax Office has capped this at</small>×${MULT_MAX}<em>STILL PRETTY BIG</em>`, 'combo', 2200), 2700);
  }

  // ---------- the lever: pull to spin, HOLD IT DOWN FOR TURBO ----------
  function leverDown() {
    if (!open || moving) return;
    leverHeld = true;
    ratchet();
    machine.kick(0.12);
    if (!busy && !inBonus) spin();
    clearTimeout(holdTimer);
    holdTimer = setTimeout(() => {
      if (!leverHeld) return;
      leverTurbo = true;
      applySpeed();
      machine.setLeverTurbo(true);
      view.classList.add('lever-turbo');
      turboRev();
      slam('<small>HOLDING THE LEVER</small>⚡ TURBO ⚡', 'combo c2', 900);
      setMsg('⚡ LEVER TURBO! KEEP HOLDING!');
    }, 450);
  }
  function leverUp() {
    clearTimeout(holdTimer);
    if (!leverHeld) return;
    leverHeld = false;
    boing();
    if (leverTurbo) {
      leverTurbo = false;
      applySpeed();
      machine.setLeverTurbo(false);
      view.classList.remove('lever-turbo');
    }
  }

  // ---------- walking between rooms ----------
  // A proper walk (footsteps, head-bob, a slow slide), or, when you already walked there on the
  // phone's map, a quick whoosh.
  const WALK_STEPS = 6;
  const WALK_GAP = 0.27;
  const QUICK_MS = 550; // (the .quick-move transitions in style.css)
  function walk(then, quick) {
    moving = true;
    document.body.classList.add(quick ? 'quick-move' : 'walking');
    if (quick) noise({ dur: 0.45, f0: 300, f1: 2600, vol: 0.16 });
    else footsteps(WALK_STEPS, WALK_GAP);
    setTimeout(() => {
      document.body.classList.remove('walking', 'quick-move');
      moving = false;
      renderDisplay();
      then?.();
    }, quick ? QUICK_MS : WALK_STEPS * WALK_GAP * 1000);
  }
  const fitHeight = () => view.style.setProperty('--top', `${host.getBoundingClientRect().top + scrollY}px`);
  addEventListener('resize', () => open && fitHeight());
  /** quick: you walked here on the map already, so just whoosh in. False if you can't go now. */
  function show({ quick = false } = {}) {
    if (open || moving) return false;
    open = true;
    fitHeight();
    machine.start();
    renderDisplay();
    view.classList.add('open');
    // the win tally's icons take a moment to render (a whole extra WebGL setup): do it during
    // the walk in (a CSS slide the compositor runs) instead of freezing the first win
    if (!icons) setTimeout(() => icon('sapph'), 120);
    document.body.classList.add('in-slots');
    music?.setSong?.('slots');
    onOpen?.();
    walk(() => {
      machine.resize();
      gong();
      dingding(8);
      toast('🐉 Welcome to DRAGON RUSH WIN BIG! Spin it!');
      if (free) setTimeout(() => spin(), 800);
    }, quick);
    return true;
  }
  function hide({ quick = false } = {}) {
    if (!open || busy || moving) return false;
    open = false;
    autoOn = false;
    view.classList.remove('open');
    document.body.classList.remove('in-slots');
    music?.setSong?.('lobby');
    onClose?.();
    walk(() => machine.stop(), quick);
    return true;
  }

  return {
    show,
    hide,
    spin: () => spin(),
    isOpen: () => open,
    /** mid-spin (or mid-walk): you can't leave yet */
    busy: () => busy || moving,
    refresh: renderDisplay,
  };
}
